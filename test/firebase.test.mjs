import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createVerify} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createFirebase} from '../lib/firebase.mjs';
import {createStore} from '../lib/store.mjs';
import {createApp,createMonitor} from '../server.mjs';
test('FCM uses signed OAuth JWT, caches credentials, and sends visible high-priority data',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});let oauth=0,sent=0;
 const service=createFirebase({FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:'test-project',client_email:'test@test-project.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})})},async(url,options)=>{
  if(url.includes('oauth2.googleapis.com')){
   oauth++;const token=options.body.get('assertion');const [header,payload,signature]=token.split('.');
   assert.ok(createVerify('RSA-SHA256').update(`${header}.${payload}`).verify(publicKey,Buffer.from(signature,'base64url')));
   const claims=JSON.parse(Buffer.from(payload,'base64url'));assert.equal(claims.aud,'https://oauth2.googleapis.com/token');assert.equal(claims.exp-claims.iat,3600);
   return Response.json({access_token:'test-access-token',expires_in:3600});
  }
  sent++;assert.equal(options.headers.Authorization,'Bearer test-access-token');const body=JSON.parse(options.body);assert.equal(body.message.android.priority,'high');assert.equal(body.message.data.eventKey,'live:123');assert.equal(body.message.notification,undefined);
  return Response.json({name:'sent'});
 });
 const event={key:'live:123',title:'방송 시작',body:'그림 방송',url:'https://play.sooplive.co.kr/w96idqb/123'};
 await service.send('test-device-token',event);await service.send('test-device-token',event);assert.equal(oauth,1);assert.equal(sent,2);
});
test('push registration protects each device secret and supports unsubscribe',async()=>{
 const folder=await mkdtemp(path.join(os.tmpdir(),'tiffany-push-'));
 let calls=0;const store=await createStore(folder);const app=createApp({store,env:{},androidConfigPath:path.join(folder,'missing.json'),services:{push:{configured:true,send:async()=>{calls++;}},status:async()=>({live:{state:'offline'},youtube:{state:'unavailable'}})}});
 app.listen(0,'127.0.0.1');await once(app,'listening');const base=`http://127.0.0.1:${app.address().port}`;
 const post=(endpoint,body)=>fetch(base+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  assert.equal((await fetch(base+'/api/push/config')).status,503);
  assert.equal((await post('/api/push/devices',{token:'invalid'})).status,400);
  const result=await(await post('/api/push/devices',{token:'A'.repeat(100)})).json();assert.ok(result.id&&result.secret);
  assert.equal((await post('/api/push/devices',{id:result.id,secret:'wrong',token:'B'.repeat(100)})).status,403);
  assert.equal((await post('/api/push/devices',{...result,token:'B'.repeat(100)})).status,200);
  assert.equal(store.devices().length,1);assert.equal(store.devices()[0].token,'B'.repeat(100));assert.notEqual(store.devices()[0].secretHash,result.secret);
  assert.equal((await post('/api/push/test',{id:result.id,secret:'wrong'})).status,403);assert.equal(calls,0);
  assert.equal((await post('/api/push/test',result)).status,200);assert.equal(calls,1);
  assert.equal((await post('/api/push/test',result)).status,429);assert.equal(calls,1);
  assert.equal((await post('/api/push/unsubscribe',result)).status,200);assert.equal(store.devices().length,0);
 }finally{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));await rm(folder,{recursive:true,force:true});}
});
test('Discord failure does not block FCM and successful device delivery is not retried',async()=>{
 const folder=await mkdtemp(path.join(os.tmpdir(),'tiffany-push-monitor-'));try{
  const store=await createStore(folder);await store.putDevice({id:'device',token:'token',secretHash:'hash'});let state={live:{state:'offline'},youtube:{state:'unavailable'}},discord=0,push=0;
  const services={status:async()=>state,discordConfigured:true,sendDiscord:async()=>{if(++discord===1)throw Error('temporary');},push:{configured:true,send:async()=>{push++;}}};
  const tick=createMonitor(services,store);await tick();state={live:{state:'live',id:'42',title:'방송',url:'https://play.sooplive.co.kr/w96idqb/42'},youtube:{state:'unavailable'}};
  await assert.rejects(tick);assert.equal(push,1);await tick();assert.equal(push,1);assert.equal(discord,2);
 }finally{await rm(folder,{recursive:true,force:true});}
});
test('Android config loads public file, supports an environment override and rejects project mismatch',async()=>{
 const folder=await mkdtemp(path.join(os.tmpdir(),'tiffany-android-config-'));
 const {writeFile}=await import('node:fs/promises');
 const fallback=path.join(folder,'android.json');
 const config={appId:'1:123:android:test',apiKey:'client-api-key',projectId:'test-project',senderId:'123',private_key:'must-not-be-returned'};
 await writeFile(fallback,JSON.stringify(config));
 async function request(env,projectId='test-project',configured=true){
  const app=createApp({store:{},env,androidConfigPath:fallback,services:{push:{configured,projectId}}});
  app.listen(0,'127.0.0.1');await once(app,'listening');
  try{const response=await fetch(`http://127.0.0.1:${app.address().port}/api/push/config`);return {status:response.status,body:await response.json()};}
  finally{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
 }
 try{
  const file=await request({});assert.equal(file.status,200);assert.equal(file.body.appId,config.appId);assert.equal(file.body.private_key,undefined);assert.equal(Object.keys(file.body).length,4);
  const override=await request({FIREBASE_ANDROID_CONFIG_JSON:JSON.stringify({...config,appId:'override'})});assert.equal(override.body.appId,'override');
  assert.equal((await request({},'another-project')).status,503);
  assert.equal((await request({},'test-project',false)).status,503);
  assert.equal((await request({FIREBASE_ANDROID_CONFIG_JSON:'malformed'})).status,503);
 }finally{await rm(folder,{recursive:true,force:true});}
});
