import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateSummary,planEvents} from './lib/content.mjs';
import {createServices} from './lib/services.mjs';
import {createStore} from './lib/store.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){let value='';for await(const chunk of req){value+=chunk;if(Buffer.byteLength(value)>180000)throw Error('요청이 너무 큽니다.');}return JSON.parse(value);}
function equal(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function createApp({services,store,env=process.env}){
  return http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      if(req.method==='GET'&&url.pathname==='/healthz')return json(res,200,{status:'ok'});
      if(req.method==='GET'&&url.pathname==='/api/status')return json(res,200,{...await services.status(),discordConfigured:services.discordConfigured,aiConfigured:services.aiConfigured,writeProtected:Boolean(env.WRITE_TOKEN)});
      if(req.method==='GET'&&url.pathname==='/api/summaries')return json(res,200,store.list());
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
      if(url.pathname==='/downloads/tiffany-windows.zip'){
        const data=await readFile(path.join(root,'desktop/tiffany-windows.zip'));res.writeHead(200,{'Content-Type':'application/zip','Content-Disposition':'attachment; filename=tiffany-windows.zip'});return res.end(data);
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
      const {next,events}=planEvents(previous,await services.status());
      if(services.discordConfigured)for(const event of events){if(store.delivered(event.key))continue;await services.sendDiscord(event.content);await store.mark(event.key);}
      previous=next;
    }finally{busy=false;}
  };
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const store=await createStore(process.env.DATA_DIR||path.join(root,'.data'));
  const services=createServices();const app=createApp({services,store});
  app.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log(`Tiffany Room listening on ${process.env.PORT||3000}`));
  const tick=createMonitor(services,store);
  const poll=()=>tick().catch(e=>console.error('Monitor:',e.message));
  poll();setInterval(poll,60000).unref();
}
