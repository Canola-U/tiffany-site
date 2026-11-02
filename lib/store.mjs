import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
export async function createStore(folder){
  await mkdir(folder,{recursive:true});
  async function load(name,fallback){try{return JSON.parse(await readFile(path.join(folder,name),'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
  let summaries=await load('summaries.json',[]),delivery=await load('delivery.json',{}),devices=await load('push-devices.json',[]),queue=Promise.resolve();
  function write(name,data){const target=path.join(folder,name);return writeFile(target+'.tmp',JSON.stringify(data,null,2)).then(()=>rename(target+'.tmp',target));}
  function serialize(fn){const next=queue.catch(()=>{}).then(fn);queue=next;return next;}
  return {
    list:()=>summaries,
    devices:()=>devices,
    putDevice:device=>serialize(async()=>{
      const next=[...devices.filter(d=>d.id!==device.id),device];
      if(next.length>200)throw Error('등록 가능한 기기 수를 초과했습니다.');
      await write('push-devices.json',next);devices=next;
    }),
    removeDevice:(id,token)=>serialize(async()=>{
      const next=devices.filter(d=>d.id!==id||(token&&d.token!==token));
      await write('push-devices.json',next);devices=next;
    }),
    add:summary=>serialize(async()=>{const next=[summary,...summaries];await write('summaries.json',next);summaries=next;}),
    delivered:key=>Boolean(delivery[key]),
    mark:key=>serialize(async()=>{const next={...delivery,[key]:new Date().toISOString()};await write('delivery.json',next);delivery=next;})
  };
}
