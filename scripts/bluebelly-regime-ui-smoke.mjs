/**
 * Local-only rendered UI smoke check. GitHub CI runs the real production Next
 * build on loopback, with a proxy supplying the canonical public Host header.
 * No external data is fabricated; provider gaps render as unavailable.
 * This script never opens owner routes or sends credentials.
 */
import http from "node:http";
import {spawn,spawnSync} from "node:child_process";
import {mkdirSync,statSync,existsSync} from "node:fs";
import {setTimeout as sleep} from "node:timers/promises";
import {resolve} from "node:path";
import {tmpdir} from "node:os";

const BACKEND=3181, PUBLIC=3182;
const deadline=Date.now()+300000;
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
async function renderChrome(url,filename,width,height){
 const bins=[process.env.CHROME_BIN,"google-chrome","chromium","chromium-browser"].filter(Boolean);
 let found=null;
 for(const bin of bins){
  const command=spawnSync(bin,["--version"],{encoding:"utf8"});
  if(command.status===0){found=bin;break}
 }
 if(!found)throw Error("Chromium/Chrome not installed on CI runner");
 const target=resolve(outputs,filename);
 const profile=resolve(tmpdir(),"bluebelly-regime-"+process.pid+"-"+filename.replace(/[^a-z0-9-]/gi,"-"));
 const args=[
  "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
  "--disable-extensions","--disable-background-networking",
  "--user-data-dir="+profile,
  "--hide-scrollbars","--no-first-run","--no-default-browser-check",
  "--window-size="+width+","+height,"--virtual-time-budget=4500",
  "--screenshot="+target,url,
 ];
 // Chrome requests must be served by the proxy running on this event loop;
 // spawnSync would block it and silently time out instead of taking a shot.
 await new Promise((resolveDone,reject)=>{
  const child=spawn(found,args,{stdio:["ignore","pipe","pipe"]});
  let stderr="",stdout="",expired=false;
  const timeout=setTimeout(()=>{expired=true;child.kill("SIGKILL")},48000);
  child.stderr?.on("data",chunk=>{stderr=(stderr+chunk.toString()).slice(-2500)});
  child.stdout?.on("data",chunk=>{stdout=(stdout+chunk.toString()).slice(-2500)});
  child.once("error",error=>{clearTimeout(timeout);reject(error)});
  child.once("close",(code,signal)=>{
   clearTimeout(timeout);
   if(expired||code!==0||!existsSync(target))return reject(new Error(
    "Chrome screenshot failed "+filename+"; exit "+code+" signal "+signal+
    " timeout "+expired+" stdout "+stdout+" stderr "+stderr
   ));
   resolveDone();
  });
 });
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
 assertHtml(root.html,'data-research-lens="energy"','data-research-lens="gold"',"Fundamental outlook","Confidence","Outlook for");
 const outlooks={
  fed:["BEARISH","HIGH"],bonds:["BULLISH","MEDIUM"],ai:["BEARISH","MEDIUM"],
  china:["MIXED","MEDIUM"],energy:["BULLISH","HIGH"],yen:["BULLISH","MEDIUM"],
  breadth:["BULLISH","MEDIUM"],gold:["BEARISH","MEDIUM"],housing:["BEARISH","HIGH"],
 };
 for(const [lens,[bias,confidence]] of Object.entries(outlooks)){
  assertHtml(root.html,'data-outlook-meter="'+lens+'"','data-outlook="'+bias+'"',
   'data-confidence="'+confidence+'"');
 }
 if(root.html.includes("data-fundamental-quick-view"))throw Error("Old giant asset quickview reappeared");
 console.log("Overview "+root.status+" · 9 scopes, confidence meters and 4/4/1 outlook distribution present");
 for(const [lens,[bias,confidence]] of Object.entries(outlooks)){
  const view=await waitResponse("/regime-watch/"+lens);
  assertHtml(view.html,'data-public-research-lens="'+lens+'"',
   'data-lens-outlook="'+bias+'"','data-lens-confidence="'+confidence+'"',
   'data-outlook-meter="'+lens+'"',"WHAT SUPPORTS THIS VIEW","WHAT CHALLENGES IT",
   "WHAT WOULD CHANGE THE CALL","Outlook for");
  if(view.html.includes("data-fundamental-assessment"))throw Error("Contradictory duplicate asset assessment on "+lens);
  if(["energy","ai","bonds","yen","breadth","gold"].includes(lens))assertHtml(view.html,"data-regime-asset-live-context");
  if(["yen","gold","breadth","bonds","fed"].includes(lens)){
   assertHtml(view.html,'data-regime-editorial-verified="'+lens+'"',
    "WHAT THE NEW DATA CONFIRMS","WHAT STILL COULD MISLEAD",
    "Next confirming / invalidating test:","exact observation clocks");
  }else if(view.html.includes("data-regime-editorial-verified")){
   throw Error("Unreviewed lens claimed a fresh crossasset editorial: "+lens);
  }
  console.log("Lens "+lens+" "+view.status+" · differentiated current view with falsifier");
 }

 const crash=await waitResponse("/crash-opportunity");
 assertHtml(crash.html,'data-crash-opportunity="source-dated-research-view"',
   'data-crash-research-verdict="',
   'data-historical-episode="2020"',
   'data-historical-episode="2008"',
   "What has been measured?",
   "How a shock travels between regimes");
 const forbidden=await waitResponse("/crash-opportunity/owner",code=>code!==200);
 if(forbidden.status!==404)console.log("Nonpublic nested crash path blocked HTTP "+forbidden.status);
 console.log("Crash Opportunity "+crash.status+" · contested source-dated gauge / mirrors / cross-regime links");
 await renderChrome("http://127.0.0.1:"+PUBLIC+"/crash-opportunity",
  "crash-opportunity-desktop.png",1440,1000);
 await renderChrome("http://127.0.0.1:"+PUBLIC+"/crash-opportunity",
  "crash-opportunity-mobile.png",390,844);
 const privateRoute=await waitResponse("/owner/presenter",code=>code!==200);
 console.log("Owner route HTTP "+privateRoute.status+" on public host (no anonymous access)");
 const url="http://127.0.0.1:"+PUBLIC+"/regime-watch";
 await renderChrome(url,"overview-desktop.png",1440,1000);
 await renderChrome(url,"overview-mobile.png",390,844);
 await renderChrome("http://127.0.0.1:"+PUBLIC+"/regime-watch/energy","energy-mobile.png",390,844);
 await renderChrome("http://127.0.0.1:"+PUBLIC+"/regime-watch/yen","yen-mobile.png",390,844);
 await renderChrome("http://127.0.0.1:"+PUBLIC+"/regime-watch/gold","gold-mobile.png",390,844);

 // Visual acceptance for the CP public-page convergence. Deliberately use
 // public routes and a source-agnostic data state; never invent market prices.
 const publicPages=[
  ["/newsroom","newsroom",'data-public-newsroom="original-source-only"'],
  ["/key-stories","key-stories",'data-bluebelly-stories="catalyst-led"'],
  ["/daily-report","daily-report",'data-daily-report="editorial-first-v3"'],
  ["/hormuz","hormuz",'data-bluebelly-hormuz="public-source-dated-physical-first"'],
  ["/markets","markets",'data-blue-desk-markets="public-observations"'],
 ];
 for(const [path,id,marker] of publicPages){
  const view=await waitResponse(path);
  assertHtml(view.html,marker);
  // TradingView embeds can keep headless Chrome alive indefinitely; Markets is
  // covered by the route/HTML assertions, not a brittle third-party screenshot.
  if(id!=="markets")
   await renderChrome("http://127.0.0.1:"+PUBLIC+path,id+"-mobile.png",390,844);
  if(id==="newsroom"||id==="key-stories")
   await renderChrome("http://127.0.0.1:"+PUBLIC+path,id+"-desktop.png",1440,1000);
  console.log("Public CP page "+path+" "+view.status+" · mobile render saved");
 }

 // The Learn slide reader shares the visual system but its controls use
 // independent styles; exercise both index and first presentation in Chrome.
 for(const [path,name] of [["/learn","learn-index"],["/learn/decks/d13","learn-deck"]]){
  const page=await waitResponse(path);
  if(page.status!==200)throw Error("Learn readability route failed "+path+" HTTP "+page.status);
  if(!page.html.includes("BLUEBELLY")&&!page.html.includes("Bluebelly"))
   throw Error("Unexpected Learn response "+path);
  await renderChrome("http://127.0.0.1:"+PUBLIC+path,name+"-mobile.png",390,844);
  console.log("Learn readability "+path+" rendered at 390px");
 }
 console.log("Regime UI smoke PASS; outputs in "+outputs);
}catch(error){console.error(error);process.exitCode=1}
finally{
 if(server)await new Promise(resolve=>server.close(()=>resolve()));
 for(const child of children)if(!child.killed)child.kill("SIGTERM");
}
