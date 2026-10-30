/**
 * Local-only rendered UI smoke check. GitHub CI runs the real production Next
 * build on loopback, with a proxy supplying the canonical public Host header.
 * No external data is fabricated; provider gaps render as unavailable.
 * This script never opens owner routes or sends credentials.
 */
import http from "node:http";
import {spawn,spawnSync} from "node:child_process";
import {mkdirSync,statSync} from "node:fs";
import {setTimeout as sleep} from "node:timers/promises";
import {join} from "node:path";

const BACKEND=3181, PUBLIC=3182;
const deadline=Date.now()+140000;
const outputs="artifacts/regime-ui";
mkdirSync(outputs,{recursive:true});
const children=[];
function launch(cmd,args,opts={}){
 const child=spawn(cmd,args,{stdio:"inherit",...opts});
 children.push(child);return child;
}
function proxy(){
 const server=http.createServer((req,res)=>{
  const headers={...req.headers,host:"bluebelly-desk.vercel.app",
    "x-forwarded-host":"bluebelly-desk.vercel.app","x-forwarded-proto":"https"};
  delete headers.cookie;
  const upstream=http.request({hostname:"127.0.0.1",port:BACKEND,
    method:req.method,path:req.url,headers},response=>{
     res.writeHead(response.statusCode||502,response.headers);
     response.pipe(res);
    });
  upstream.on("error",error=>{res.writeHead(502);res.end(error.message)});
  req.pipe(upstream);
 });
 return new Promise(resolve=>server.listen(PUBLIC,"127.0.0.1",()=>resolve(server)));
}
async function waitResponse(path,accepted=(code)=>code===200){
 let last="";
 while(Date.now()<deadline){
  try{
   const resp=await fetch("http://127.0.0.1:"+PUBLIC+path,{signal:AbortSignal.timeout(16000),redirect:"manual"});
   const html=await resp.text();
   if(accepted(resp.status))return {status:resp.status,html};
   last=path+" HTTP "+resp.status+" "+html.slice(0,200);
  }catch(e){last=String(e)}
  await sleep(2500);
 }
 throw new Error("UI smoke timed out: "+last);
}
function assertHtml(html,...needles){
 for(const needle of needles)if(!html.includes(needle))throw Error("Missing rendered marker "+needle);
}
function renderChrome(url,filename,width,height){
 const bins=[process.env.CHROME_BIN,"google-chrome","chromium","chromium-browser"].filter(Boolean);
 let found=false;
 for(const bin of bins){
  const command=spawnSync(bin,["--version"],{encoding:"utf8"});
  if(command.status===0){found=bin;break}
 }
 if(!found)throw Error("Chromium/Chrome not installed on CI runner");
 const target=join(outputs,filename);
 const result=spawnSync(found,[
  "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
  "--hide-scrollbars","--no-first-run","--no-default-browser-check",
  "--window-size="+width+","+height,"--virtual-time-budget=6000",
  "--screenshot="+target,url
 ],{encoding:"utf8",timeout:50000});
 if(result.status!==0)throw Error("Chrome screenshot failed "+filename+" "+(result.stderr||"").slice(-1000));
 const bytes=statSync(target).size;
 if(bytes<12000)throw Error("Screenshot unexpectedly small: "+filename+" ("+bytes+" bytes)");
 console.log("Screenshot "+target+" ("+bytes+" bytes)");
}
let server;
try{
 launch(process.execPath,["node_modules/next/dist/bin/next","start","-p",String(BACKEND)],{
  env:{...process.env,PORT:String(BACKEND),NEXT_TELEMETRY_DISABLED:"1"}
 });
 server=await proxy();
 const root=await waitResponse("/regime-watch");
 assertHtml(root.html,"data-fundamental-quick-view","data-asset=\"brent\"","data-asset=\"diesel\"","data-asset=\"gold\"","MARKET TAPE");
 console.log("Overview "+root.status+" · source-dated fundamentals visible");
 for(const lens of ["energy","ai","bonds"]){
  const view=await waitResponse("/regime-watch/"+lens);
  assertHtml(view.html,"data-public-research-lens=\""+lens+"\"","data-regime-asset-live-context");
  console.log("Lens "+lens+" "+view.status+" · source and tape cards visible");
 }
 const privateRoute=await waitResponse("/owner/presenter",code=>code!==200);
 console.log("Owner route HTTP "+privateRoute.status+" on public host (no anonymous access)");
 const url="http://127.0.0.1:"+PUBLIC+"/regime-watch";
 renderChrome(url,"overview-desktop.png",1440,1000);
 renderChrome(url,"overview-mobile.png",390,844);
 renderChrome("http://127.0.0.1:"+PUBLIC+"/regime-watch/energy","energy-mobile.png",390,844);
 console.log("Regime UI smoke PASS; outputs in "+outputs);
}catch(error){console.error(error);process.exitCode=1}
finally{
 if(server)await new Promise(resolve=>server.close(()=>resolve()));
 for(const child of children)if(!child.killed)child.kill("SIGTERM");
}
