export function decodeXml(text) {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&(amp|lt|gt|quot|apos);/g,(_,k)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[k]));
}
export function parseFeed(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0,12).map(([,entry])=>{
    const tag=name=>decodeXml(entry.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]||'');
    const id=tag('yt:videoId');
    return {id,title:tag('title'),published:tag('published'),url:`https://www.youtube.com/watch?v=${id}`,thumbnail:`https://i.ytimg.com/vi/${id}/hqdefault.jpg`};
  }).filter(v=>/^[\w-]{11}$/.test(v.id));
}
export function excerpt(text) {
  const lines=text.trim().split(/\n+|(?<=[.!?。])\s+/).map(s=>s.trim()).filter(s=>s.length>15);
  return lines.slice(0,6).map(s=>`• ${s}`).join('\n')||text.trim().slice(0,1000);
}
export function validateSummary(input) {
  if(typeof input.title!=='string'||!input.title.trim()||input.title.length>160)throw Error('160자 이내의 제목을 입력해주세요.');
  if(typeof input.transcript!=='string'||input.transcript.trim().length<80||input.transcript.length>60000)throw Error('자막·대화록은 80~60,000자로 입력해주세요.');
  let url;try{url=new URL(input.sourceUrl);}catch{throw Error('원본 영상 주소를 입력해주세요.');}
  if(url.protocol!=='https:'||!['www.youtube.com','youtu.be','www.sooplive.com','vod.sooplive.co.kr'].includes(url.hostname)||url.username||url.password)throw Error('SOOP 또는 YouTube의 HTTPS 영상 주소를 입력해주세요.');
  return {title:input.title.trim(),transcript:input.transcript.trim(),sourceUrl:url.href};
}
export function planEvents(previous,current) {
  const next={...previous},events=[];
  if(current.live.state==='live') {
    if(previous.live!==undefined&&previous.live!==current.live.id)events.push({key:`live:${current.live.id}`,content:`🔴 티파니 방송이 시작됐어요!\n${current.live.title}\n${current.live.url}`});
    next.live=current.live.id;
  }else if(current.live.state==='offline')next.live='offline';
  if(current.youtube.state==='connected'&&current.youtube.videos.length){
    const videos=current.youtube.videos;
    if(previous.video){
      const index=videos.findIndex(v=>v.id===previous.video);
      const fresh=index>=0?videos.slice(0,index):videos.filter(v=>new Date(v.published)>new Date(previous.published));
      for(const v of [...fresh].reverse())events.push({key:`youtube:${v.id}`,content:`🎬 새 영상이 올라왔어요!\n${v.title}\n${v.url}`});
    }
    next.video=videos[0].id;next.published=videos[0].published;
  }
  return {next,events};
}
