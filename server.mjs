import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomUUID,timingSafeEqual,randomBytes,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateSummary,planEvents} from './lib/content.mjs';
import {createFirebase} from './lib/firebase.mjs';
import {createServices} from './lib/services.mjs';
import {createStore} from './lib/store.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){let value='';for await(const chunk of req){value+=chunk;if(Buffer.byteLength(value)>180000)throw Error('요청이 너무 큽니다.');}return JSON.parse(value);}
function equal(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function createApp({services,store,env=process.env,androidConfigPath=path.join(root,'config/firebase-android.json')}){
  return http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      if(req.method==='GET'&&url.pathname==='/healthz')return json(res,200,{status:'ok'});
      if(req.method==='GET'&&url.pathname==='/api/push/config'){
        let config;try{config=JSON.parse(env.FIREBASE_ANDROID_CONFIG_JSON||await readFile(androidConfigPath,'utf8'));}catch{}
        if(!services.push?.configured||!config?.appId||!config?.apiKey||!config?.projectId||!config?.senderId)return json(res,503,{error:services.push?.error||'Firebase 앱 연결 설정이 아직 준비되지 않았습니다.'});
        if(services.push.projectId&&config.projectId!==services.push.projectId)return json(res,503,{error:'Firebase 앱과 서버의 프로젝트가 일치하지 않습니다.'});
        return json(res,200,{appId:config.appId,apiKey:config.apiKey,projectId:config.projectId,senderId:config.senderId});
      }

      if(req.method==='GET'&&url.pathname==='/api/status')return json(res,200,{...await services.status(),pushConfigured:Boolean(services.push?.configured),pushError:services.push?.error||null,discordConfigured:services.discordConfigured,aiConfigured:services.aiConfigured,writeProtected:Boolean(env.WRITE_TOKEN)});
      if(req.method==='GET'&&url.pathname==='/api/summaries')return json(res,200,store.list());
      if(req.method==='POST'&&(url.pathname==='/api/push/devices'||url.pathname==='/api/push/unsubscribe'||url.pathname==='/api/push/test')){
        if(!services.push?.configured)return json(res,503,{error:'Firebase 서버 연결이 아직 설정되지 않았습니다.'});
        if(req.headers.origin)return json(res,403,{error:'기기 앱에서만 등록할 수 있습니다.'});
        const input=await body(req);
        let device=input.id&&store.devices().find(d=>d.id===input.id);
        const hash=value=>createHash('sha256').update(value).digest('hex');
        if(input.id&&(!device||typeof input.secret!=='string'||!equal(device.secretHash,hash(input.secret))))return json(res,403,{error:'기기 인증이 올바르지 않습니다.'});
        if(url.pathname==='/api/push/test'){
          if(!device)return json(res,400,{error:'먼저 기기 등록을 완료해주세요.'});
          if(Date.now()-(device.lastTestAt||0)<60000)return json(res,429,{error:'테스트는 1분에 한 번 가능합니다.'});
          await store.putDevice({...device,lastTestAt:Date.now()});
          await services.push.send(device.token,{key:`test:${randomUUID()}`,title:'티파니룸 푸시 테스트',body:'서버에서 보낸 테스트 알림이에요. 도착했다면 앱 푸시 연결이 완료됐어요.',url:'https://play.sooplive.co.kr/w96idqb'});
          return json(res,200,{sent:true});
        }
        if(url.pathname==='/api/push/unsubscribe'){
          if(!device)return json(res,400,{error:'기기 정보가 필요합니다.'});
          await store.removeDevice(device.id);return json(res,200,{removed:true});
        }
        if(typeof input.token!=='string'||!/^[A-Za-z0-9_:.\-]{30,4096}$/.test(input.token)||input.token.length>4096)return json(res,400,{error:'유효한 푸시 토큰이 필요합니다.'});
        const id=device?.id||randomUUID(),secret=device?input.secret:randomBytes(32).toString('base64url');
        await store.putDevice({...device,id,secretHash:hash(secret),token:input.token});
        return json(res,200,{id,secret});
      }

      if(req.method==='POST'&&url.pathname==='/api/summaries'){
        const origin=req.headers.origin;
        if(origin&&origin!==`http://${req.headers.host}`&&origin!==`https://${req.headers.host}`)return json(res,403,{error:'다른 사이트에서 요청할 수 없습니다.'});
        if(env.WRITE_TOKEN&&!equal(req.headers.authorization||'',`Bearer ${env.WRITE_TOKEN}`))return json(res,401,{error:'요약 작성 키를 확인해주세요.'});
        if(env.NODE_ENV==='production'&&!env.WRITE_TOKEN)return json(res,503,{error:'운영 환경에서 WRITE_TOKEN 설정이 필요합니다.'});
        let input;try{input=validateSummary(await body(req));}catch(e){return json(res,400,{error:e.message});}
        const result=await services.summarize(input.transcript);
        const summary={id:randomUUID(),title:input.title,sourceUrl:input.sourceUrl,...result,createdAt:new Date().toISOString()};
        await store.add(summary);return json(res,201,summary);
      }
      if(req.method!=='GET')return json(res,405,{error:'지원하지 않는 요청입니다.'});
      const downloads={
        '/downloads/tiffany-windows.zip': ['desktop/tiffany-windows.zip','application/zip'],
        '/downloads/tiffany-room-android.apk': ['android/releases/tiffany-room-android.apk','application/vnd.android.package-archive'],
        '/downloads/tiffany-room-android.apk.sha256': ['android/releases/tiffany-room-android.apk.sha256','text/plain; charset=utf-8']
      };
      if(Object.hasOwn(downloads,url.pathname)){
        const [file,mime]=downloads[url.pathname];
        const data=await readFile(path.join(root,file));
        res.writeHead(200,{'Content-Type':mime,'Content-Length':data.length,'Content-Disposition':`attachment; filename=${path.basename(file)}`,'X-Content-Type-Options':'nosniff'});
        return res.end(data);
      }
      const name={'/':'index.html','/style.css':'style.css','/app.js':'app.js'}[url.pathname];
      if(!name)return json(res,404,{error:'페이지를 찾을 수 없습니다.'});
      const data=await readFile(path.join(root,'public',name));
      res.writeHead(200,{'Content-Type':name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' https://i.ytimg.com; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(data);
    }catch(e){json(res,502,{error:e.message});}
  });
}
export function createMonitor(services,store){
  let previous={},busy=false;
  return async()=>{
    if(busy)return;busy=true;
    try{
      const current=await services.status();
      const {next,events}=planEvents(previous,current);
      const deliveries=[];
      for(const event of events){
        if(services.discordConfigured)deliveries.push((async()=>{
          const key=`discord:${event.key}`;
          if(store.delivered(key))return;
          await services.sendDiscord(event.content);await store.mark(key);
        })());
        if(services.push?.configured)for(const device of store.devices())deliveries.push((async()=>{
          const key=`push:${device.id}:${event.key}`;
          if(store.delivered(key))return;
          const video=current.youtube.videos?.find(v=>`youtube:${v.id}`===event.key);
          const payload=event.key.startsWith('live:')?{title:'티파니 방송 시작!',body:current.live.title,url:current.live.url}:{title:'티파니 새 영상',body:video?.title||'새 영상이 올라왔어요.',url:video?.url||'https://www.youtube.com/@w96idqb'};
          try{await services.push.send(device.token,{key:event.key,...payload});await store.mark(key);}
          catch(e){if(e.invalidToken){await store.removeDevice(device.id,device.token);return;}throw e;}
        })());
      }
      const results=await Promise.allSettled(deliveries);
      if(results.some(r=>r.status==='rejected'))throw Error('일부 알림 발송에 실패했습니다. 다음 조회에서 재시도합니다.');
      previous=next;
    }finally{busy=false;}
  };
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const store=await createStore(process.env.DATA_DIR||path.join(root,'.data'));
  const services=createServices();services.push=createFirebase();if(services.push.error)console.warn('Firebase push disabled:',services.push.error);const app=createApp({services,store});
  app.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log(`Tiffany Room listening on ${process.env.PORT||3000}`));
  const tick=createMonitor(services,store);
  const poll=()=>tick().catch(e=>console.error('Monitor:',e.message));
  poll();setInterval(poll,60000).unref();
}
