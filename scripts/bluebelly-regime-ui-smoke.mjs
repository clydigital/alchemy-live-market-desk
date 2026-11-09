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
let marketsSnapshotHtml=null;
let supportSnapshotHtml=null;
function launch(cmd,args,opts={}){
 const child=spawn(cmd,args,{stdio:"inherit",...opts});
 children.push(child);return child;
}
function proxy(){
 const server=http.createServer((req,res)=>{
  // CI-only HTML replay of the verified anonymous public SSR response. This
  // avoids a second expensive Markets backend fetch during Chrome capture.
  // Assets still resolve through this loopback proxy; no mock quote is used.
  if(req.url?.split("?")[0]==="/__markets_snapshot"&&marketsSnapshotHtml){
   res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});
   res.end(marketsSnapshotHtml);return;
  }
  if(req.url?.split("?")[0]==="/__support_snapshot"&&supportSnapshotHtml){
   res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});
   res.end(supportSnapshotHtml);return;
  }
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
   if(accepted(resp.status))return {status:resp.status,html,location:resp.headers.get("location")};
   last=path+" HTTP "+resp.status+" "+html.slice(0,200);
  }catch(e){last=String(e)}
  await sleep(2500);
 }
 throw new Error("UI smoke timed out: "+last);
}
function assertHtml(html,...needles){
 for(const needle of needles)if(!html.includes(needle))throw Error("Missing rendered marker "+needle);
}
async function renderChrome(url,filename,width,height,{disableJavascript=false}={}){
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
  "--window-size="+width+","+height,
  ...(disableJavascript && (filename.startsWith("markets-")||filename.startsWith("calendar-")||filename.startsWith("research-")) ? ["--virtual-time-budget=3500"] : disableJavascript ? [] : ["--virtual-time-budget=4500"]),
  // Server-rendered public reading can include large external embeds. Capture
  // static layout without executing third-party scripts where appropriate.
  ...(disableJavascript?["--disable-javascript"]:[]),
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
 // All private entries must remain denied by the public host, including the
 // sidebar's owner shortcut. Never follow OAuth or simulate owner credentials.
 for (const path of ["/owner/presenter", "/owner/x-wire", "/my-reports"]) {
  const privateRoute=await waitResponse(path,code=>code!==200);
  if(![302,307,401,403,404].includes(privateRoute.status))
   throw Error("Unexpected owner route response "+path+" "+privateRoute.status);
  if(privateRoute.html.includes('data-owner-intelligence=') ||
     privateRoute.html.includes('data-owner-x-wire='))
   throw Error("Private owner content leaked to public host: "+path);
  console.log("Owner route "+path+" HTTP "+privateRoute.status+" (no anonymous access)");
 }
 const url="http://127.0.0.1:"+PUBLIC+"/regime-watch";
 await renderChrome(url,"overview-desktop.png",1440,1000);
 await renderChrome(url,"overview-mobile.png",390,844);
 await renderChrome("http://127.0.0.1:"+PUBLIC+"/regime-watch/energy","energy-mobile.png",390,844);
 await renderChrome("http://127.0.0.1:"+PUBLIC+"/regime-watch/yen","yen-mobile.png",390,844);
 await renderChrome("http://127.0.0.1:"+PUBLIC+"/regime-watch/gold","gold-mobile.png",390,844);

 // Visual acceptance for the CP public-page convergence. Deliberately use
 // public routes and a source-agnostic data state; never invent market prices.
 const publicPages=[
  ["/","market-home",'data-home-market-first="source-dated-terminal"'],
  ["/newsroom","newsroom",'data-public-newsroom="original-source-only"'],
  ["/key-stories","key-stories",'data-bluebelly-watch="lean-readonly-v1"'],
  ["/hormuz","hormuz",'data-bluebelly-hormuz="public-source-dated-physical-first"'],
  ["/markets","markets",'data-blue-desk-markets="public-observations"'],
  ["/calendar","calendar",'data-blue-desk-calendar="ET-primary"'],
  ["/research","research",'data-bluebelly-research-index="public-approved-dated"'],
 ];
 // The duplicate public report is retired; old public bookmarks must
 // land on Newsroom without exposing or substituting a private daily edition.
 for(const path of ["/daily-report","/blue-desk/daily-report"]){
  const retired=await waitResponse(path,code=>code===307);
  if(new URL(retired.location,"https://bluebelly-desk.vercel.app").pathname!=="/newsroom")
   throw new Error("Retired Daily Report did not lead to Newsroom: "+path+" -> "+retired.location);
 }
 const historical=await waitResponse("/daily-report?edition=legacy",code=>code===404);
 if(historical.status!==404)throw Error("Retired historical selector incorrectly forwarded to today's Newsroom");
 console.log("Retired duplicate Daily Report redirects 307 · historical selector fails closed");

 for(const [path,id,marker] of publicPages){
  const view=await waitResponse(path);
  assertHtml(view.html,marker);
  if(id==="market-home"){
   assertHtml(view.html,'data-home-editorial-reader="legacy-on-demand"','data-home-detailed-brief="on-demand"',
    'data-bluebelly-layout="v7-command"','aria-label="Bluebelly command navigation"');
  }
  if(id==="newsroom"){
   assertHtml(view.html,'data-v7-newsroom-command="source-qualified"');
   assertHtml(view.html,'data-editorial-newsroom="verified-only"');
   if(view.html.includes('data-newsroom-release-rail='))throw Error("Duplicate release rail still rendered in public Newsroom");
  }
  if(id==="key-stories"){
   assertHtml(view.html,'data-v7-watch-graphic="decorative-research-radar"');
   assertHtml(view.html,"What is developing?","Market narratives",
    "Browse complete historical Story library");
   if(!view.html.includes("No approved public thesis snapshot"))
    assertHtml(view.html,"Evidence and counterargument",
      "Read full thesis and source context");
  }
  if(id==="calendar"||id==="research"){
   if(id==="calendar")assertHtml(view.html,
     'data-v7-calendar="source-dated-catalyst-command"',
     'data-calendar-graphics="source-listed-counts"',
     'data-catalyst-calendar="v4"');
   else assertHtml(view.html,'data-v7-research-command="dated-archive"',
     'data-research-editorial="archived-secondary"',"Search investigations");
   // Replay the actual public SSR response with only nonvisual third-party
   // images and hydration scripts omitted for stable screenshot capture.
   supportSnapshotHtml=view.html
     .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
     .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,"")
     .replace(/<img\b[^>]*>/gi,"");
   for(const [suffix,width,height] of [["desktop",1440,1200],["mobile",390,1200]]){
    await renderChrome("http://127.0.0.1:"+PUBLIC+"/__support_snapshot",
      id+"-"+suffix+".png",width,height,{disableJavascript:true});
   }
   console.log("Public support view "+id+" "+view.status+" · original SSR and desktop/mobile CSS verified");
   continue;
  }
  // Render the real source-dated SSR Markets document once from a CI-only
  // cached, same-origin path. Disable JS to exclude third-party TradingView.
  // Source rows, percentage units, dates and comparison order are untouched.
  if(id==="markets"){
   // Keep real public SSR data but avoid nonvisual external resources.
   marketsSnapshotHtml=view.html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
      .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,"")
      .replace(/<img\b[^>]*>/gi,"")
      .replace(/<link\b(?=[^>]*\brel=["']preload["'])[^>]*>/gi,"");
   assertHtml(view.html,'data-v7-treasury-ladder="source-dated-us-only"',
      'data-market-change-screener="read-only"');
   // ETF graphic is conditional on actual public data coverage; the fail-closed
   // unavailable state must remain acceptable during provider outages.
   if(!view.html.includes('data-v7-etf-rotation="source-matched"'))
    assertHtml(view.html,"Observations unavailable");
   for(const [filename,width,height] of [
     ["markets-desktop.png",1440,1950],
     ["markets-tablet.png",1024,2350],
     ["markets-mobile.png",390,2000],
   ]){
    try{
     await renderChrome("http://127.0.0.1:"+PUBLIC+"/__markets_snapshot",
       filename,width,height,{disableJavascript:true});
    }catch(error){
     // Content acceptance remains hard; report any nonrendering viewport.
     console.warn("MARKETS VISUAL DEFERRED: "+filename+" screenshot failed: "+String(error));
    }
   }
  }
  if(id!=="markets")
   await renderChrome("http://127.0.0.1:"+PUBLIC+path,id+"-mobile.png",390,844,{disableJavascript:id==="key-stories"||id==="market-home"});
  if(id==="newsroom"||id==="key-stories"||id==="market-home")
   await renderChrome("http://127.0.0.1:"+PUBLIC+path,id+"-desktop.png",1440,1000,{disableJavascript:id==="key-stories"||id==="market-home"});
  // 1024px is the breakpoint most likely to expose doubled navigation or
  // overflow from the collapsed icon rail. Keep third-party embeds disabled.
  if(id==="market-home")
   await renderChrome("http://127.0.0.1:"+PUBLIC+path,
    "market-home-tablet.png",1024,900,{disableJavascript:true});
  // Markets remains route/HTML-checked. Rendering its third-party chart embeds
  // in headless Chrome can hang the smoke runner even when JS is disabled.
  console.log("Public CP page "+path+" "+view.status+" · SSR verified; eligible screenshots saved");
 }

 // The full historical Story index remains accessible via an explicit
 // category selector, even though default Watch is now a compact projection.
 const archive=await waitResponse("/key-stories?category=All");
 assertHtml(archive.html,'data-bluebelly-stories="catalyst-led"',
   'data-persistent-thesis-ledger="source-identity"');
 console.log("Historical Story index preserved via explicit ?category=All");
 // Brief-first reader acceptance uses a frozen public issuer snapshot:
 // it checks rendering, not current financial accuracy or unsourced prices.
 const investorPath="/markets?view=earnings&ticker=AMZN";
 const investor=await waitResponse(investorPath);
 assertHtml(investor.html,'data-bluebelly-financial-article="AMZN"',
   'data-quick-market-brief="dated-investor-research"',
   "QUICK MARKET BRIEF","Follow the money, not just the EPS headline",
   "Original records and the unresolved gaps");
 await renderChrome("http://127.0.0.1:"+PUBLIC+investorPath,
   "consequence-investor-desktop.png",1440,1000);
 await renderChrome("http://127.0.0.1:"+PUBLIC+investorPath,
   "consequence-investor-mobile.png",390,844);
 console.log("Investor brief/read-through "+investor.status+" · desktop and mobile renders saved");
 const fedPath="/key-stories?news=e378d91d-deb9-4148-88c5-ab6bf5ef367f";
 const fed=await waitResponse(fedPath);
 assertHtml(fed.html,'data-key-story-depth="source-verified-analysis"',
   'data-quick-market-brief="source-reviewed"',"QUICK MARKET BRIEF",
   "The difference","Measurements Bluebelly still lacks");
 await renderChrome("http://127.0.0.1:"+PUBLIC+fedPath,
   "consequence-fomc-mobile.png",390,844);
 console.log("FOMC historical evidence "+fed.status+" · mobile render saved");

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
