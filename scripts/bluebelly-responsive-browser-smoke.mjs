#!/usr/bin/env node
/**
 * Browser-level mobile/tablet/desktop smoke of built public Bluebelly views.
 *
 * The browser loads a loopback-only proxy; upstream requests preserve the
 * canonical Bluebelly HTTP Host with custom DNS resolving ALWAYS to loopback.
 * No real Bluebelly / Vercel endpoint or Supabase/AI credential is contacted.
 * This checks rendering/layout, not Vercel SSO or private owner workflows.
 */
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawn,spawnSync} from "node:child_process";
import {once} from "node:events";

const HOST="bluebelly-desk.vercel.app";
const NEXT_PORT=41984,PROXY_PORT=41985;
const ARTIFACT="bluebelly-qa-artifacts";
const nap=ms=>new Promise(r=>setTimeout(r,ms));
const sanitized=Object.fromEntries(Object.entries(process.env).filter(([k])=>
  !/(SUPABASE|GEMINI|OPENAI|ANTHROPIC|SERVICE_ROLE|VERCEL_OIDC_TOKEN|BYPASS_TOKEN|SHARED_KEY|CRON_SECRET)/i.test(k)));
sanitized.NODE_ENV="production";
const processes=[];
let tail="";
const remember=p=>{
  processes.push(p);
  for(const stream of [p.stdout,p.stderr]){
    stream?.on("data",b=>{tail=(tail+b.toString()).slice(-6500)});
  }
  return p;
};
const lookup=(_hostname,options,callback)=>options.all
  ?callback(null,[{address:"127.0.0.1",family:4}])
  :callback(null,"127.0.0.1",4);

function upstream(req,res){
  const headers={...req.headers,host:HOST,"x-forwarded-host":HOST};
  delete headers["x-forwarded-proto"];
  const proxyRequest=http.request({
    hostname:HOST,port:NEXT_PORT,path:req.url,
    method:req.method,headers,lookup,
  },up=>{
    res.writeHead(up.statusCode||502,up.headers);
    up.pipe(res);
  });
  proxyRequest.setTimeout(25000,()=>proxyRequest.destroy(new Error("Next response timeout")));
  proxyRequest.on("error",e=>{
    if(!res.headersSent)res.writeHead(502);
    res.end("Local browser QA upstream unavailable");
    tail+=String(e);
  });
  req.pipe(proxyRequest);
}
function httpGet(host,port,pathname="/"){
  return new Promise((resolve,reject)=>{
    const req=http.get({hostname:host,port,path:pathname,
      ...(host===HOST?{lookup,headers:{host:HOST}}:{})},res=>{
      res.resume();res.on("end",()=>resolve(res.statusCode));
    });
    req.setTimeout(1800,()=>req.destroy(new Error("Probe timeout")));
    req.on("error",reject);
  });
}
async function waitForServer(server){
  for(let i=0;i<70;i++){
    if(server.exitCode!==null)throw new Error("Next server exited: "+tail);
    try{let status=await httpGet(HOST,NEXT_PORT,"/key-stories");if(status===200)return}
    catch{}
    await nap(240);
  }
  throw new Error("Loopback Next.js did not render a canonical public page");
}
const readJson=async url=>{
  const res=await fetch(url,{signal:AbortSignal.timeout(5000)});
  if(!res.ok)throw Error("CDP discovery "+res.status);
  return res.json();
};
async function debugPort(directory){
  const target=path.join(directory,"DevToolsActivePort");
  for(let i=0;i<60;i++){
    if(fs.existsSync(target))return Number(fs.readFileSync(target,"utf8").split("\n")[0]);
    await nap(200);
  }
  throw new Error("Chrome debug port unavailable; "+tail.slice(-700));
}
class CDP {
  constructor(ws){this.ws=ws;this.pending=new Map();this.id=0;
    ws.addEventListener("message",e=>{
      const data=JSON.parse(e.data);if(!data.id)return;
      const p=this.pending.get(data.id);if(!p)return;
      this.pending.delete(data.id);
      if(data.error)p.reject(new Error(data.error.message));
      else p.resolve(data.result||{});
    });
  }
  async call(method,params={}){
    const id=++this.id;
    const promise=new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));
    this.ws.send(JSON.stringify({id,method,params}));
    return Promise.race([promise,nap(15000).then(()=>{if(this.pending.has(id)){
      this.pending.delete(id);throw new Error("CDP timeout "+method);
    }})]);
  }
  async value(expression){
    const r=await this.call("Runtime.evaluate",{expression,returnByValue:true,
      awaitPromise:true});
    if(r.exceptionDetails)throw new Error("Chrome Runtime evaluation failed");
    return r.result?.value;
  }
}
async function connectPage(port){
  for(let i=0;i<40;i++){
    try{
      const targets=await readJson(`http://127.0.0.1:${port}/json/list`);
      const target=targets.find(t=>t.type==="page");
      if(target){
        const ws=new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((resolve,reject)=>{
          ws.addEventListener("open",resolve,{once:true});
          ws.addEventListener("error",reject,{once:true});
        });
        return new CDP(ws);
      }
    }catch{}
    await nap(150);
  }
  throw new Error("Chrome page CDP endpoint unavailable");
}
function outName(route,width){
  return (route==="/"? "home":route.slice(1)).replace(/[^a-z0-9-]/gi,"-")+"-"+width;
}

const pages=[
  {url:"/",heading:"Blue Desk"},
  {url:"/key-stories",heading:"Key market stories"},
  {url:"/rates",heading:"US Treasury rates"},
  {url:"/what-changed",heading:"New catalysts and follow-through"},
  {url:"/calendar",heading:"Market calendar"},
  {url:"/markets",heading:"Markets"},
];
const widths=[360,768,1440];
const results=[];
function test(name,condition,detail){
  results.push({name,result:condition?"PASS":"FAIL",detail:condition?"":String(detail||"")});
  process.stdout.write(`[${condition?"PASS":"FAIL"}] ${name}${condition?"":" — "+detail}\n`);
}
const chromePath=["google-chrome","google-chrome-stable","chromium","chromium-browser"]
  .find(bin=>spawnSync("which",[bin],{encoding:"utf8"}).status===0);
let proxy,ws,dir;
try{
  assert.ok(chromePath,"GitHub runner must include Chrome/Chromium; no remote browser service permitted");
  fs.mkdirSync(ARTIFACT,{recursive:true});
  const next=remember(spawn(process.execPath,[
    "node_modules/next/dist/bin/next","start","--hostname","127.0.0.1",
    "--port",String(NEXT_PORT),
  ],{env:sanitized,stdio:["ignore","pipe","pipe"]}));
  await waitForServer(next);
  proxy=http.createServer(upstream);
  await new Promise((resolve,reject)=>proxy.listen(PROXY_PORT,"127.0.0.1",e=>e?reject(e):resolve()));
  assert.equal(await httpGet("127.0.0.1",PROXY_PORT,"/key-stories"),200,
    "Proxy must serve same public route as direct named-host loopback test");

  dir=fs.mkdtempSync(path.join(os.tmpdir(),"bluebelly-chrome-"));
  const chrome=remember(spawn(chromePath,[
    "--headless=new","--no-sandbox","--disable-dev-shm-usage",
    "--disable-gpu","--disable-background-networking",
    "--no-first-run","--no-default-browser-check",
    "--remote-debugging-port=0","--user-data-dir="+dir,
    "--window-size=1440,900","about:blank",
  ],{stdio:["ignore","pipe","pipe"]}));
  const port=await debugPort(dir);
  const client=await connectPage(port);ws=client.ws;
  await client.call("Page.enable");
  await client.call("Runtime.enable");
  for(const width of widths){
    const selected=width===360?pages:pages.slice(0,3);
    for(const p of selected){
      await client.call("Emulation.setDeviceMetricsOverride",{
        width,height:900,deviceScaleFactor:1,mobile:width===360,
      });
      const target=`http://127.0.0.1:${PROXY_PORT}${p.url}`;
      const nav=await client.call("Page.navigate",{url:target});
      test(p.url+" @ "+width+" navigation accepted",!nav.errorText,nav.errorText);
      let state;
      for(let tryCount=0;tryCount<35;tryCount++){
        state=await client.value(`(()=>({
          state:document.readyState,
          h1:document.querySelector("h1")?.textContent||"",
          title:document.title,
          viewport:document.documentElement.clientWidth,
          scrollWidth:document.documentElement.scrollWidth,
          nav:[...document.querySelectorAll('nav[aria-label="Blue Desk primary"] a')].map(a=>a.getAttribute("href")),
        }))()`);
        if(state.state==="complete"&&state.h1)break;
        await nap(200);
      }
      test(p.url+" @ "+width+" heading",state.h1.toLowerCase().includes(p.heading.toLowerCase()),
        `saw "${state.h1}"`);
      test(p.url+" @ "+width+" no horizontal overflow",state.scrollWidth<=width+6,
        `document width ${state.scrollWidth}, expected at most ${width+6}`);
      const expected=["/","/markets","/key-stories","/rates","/what-changed","/calendar","/presenter"];
      test(p.url+" @ "+width+" complete public navigation",
        expected.every(href=>state.nav.includes(href)),
        `found ${JSON.stringify(state.nav)}`);
      const pic=await client.call("Page.captureScreenshot",{
        format:"png",captureBeyondViewport:false,fromSurface:true
      });
      fs.writeFileSync(path.join(ARTIFACT,outName(p.url,width)+".png"),Buffer.from(pic.data,"base64"));
    }
  }
  const failed=results.filter(r=>r.result==="FAIL");
  fs.writeFileSync(path.join(ARTIFACT,"results.json"),JSON.stringify({
    scope:"Credential-free local Chrome+Next public-reader rendering; NOT owner/SSO acceptance",
    upstreamHost:HOST,widths,checks:results},null,2));
  process.stdout.write(`Bluebelly browser responsive: ${results.length-failed.length}/${results.length} checks passed.\n`);
  assert.equal(failed.length,0,failed.length+" responsive assertions failed");
}catch(e){
  process.exitCode=1;
  process.stderr.write("Bluebelly responsive browser QA failed: "+String(e)+"\n");
  process.stderr.write("Runner tail: "+tail.slice(-2000)+"\n");
}finally{
  try{ws?.close()}catch{}
  try{proxy?.close()}catch{}
  for(const p of processes.reverse()){
    if(p.exitCode===null){
      p.kill("SIGTERM");
      await Promise.race([once(p,"exit").catch(()=>{}),nap(1200)]);
      if(p.exitCode===null)p.kill("SIGKILL");
    }
  }
  if(dir)try{fs.rmSync(dir,{recursive:true,force:true})}catch{}
}
