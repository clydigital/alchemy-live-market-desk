/**
 * Actual browser-interaction acceptance for the shared v7 visual-only cursor.
 * Uses local Chrome DevTools on loopback (no Playwright dependency, no owner
 * credentials). Captures a real mouse-position screenshot on the public host.
 */
import {spawn,spawnSync} from "node:child_process";
import {mkdtempSync,rmSync,writeFileSync,existsSync,statSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {setTimeout as sleep} from "node:timers/promises";

const halo="[data-bluebelly-pointer-halo='presentation-only']";
const splash="[data-bluebelly-sidebar-splash='vector-ambient-art']";

export async function checkV7PointerInteraction({origin,output}){
  const bins=[process.env.CHROME_BIN,"google-chrome","chromium","chromium-browser"].filter(Boolean);
  const found=bins.find(bin=>spawnSync(bin,["--version"],{encoding:"utf8"}).status===0);
  if(!found)throw Error("V7 pointer browser check: Chrome missing");

  const profile=mkdtempSync(join(tmpdir(),"bluebelly-v7-cdp-"));
  // Zero-port allocation is handled by Chrome, avoiding clashes across jobs.
  const chrome=spawn(found,[
    "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
    "--disable-extensions","--disable-background-networking",
    "--no-first-run","--no-default-browser-check",
    "--remote-debugging-port=0","--remote-allow-origins=*",
    "--window-size=1440,950","--user-data-dir="+profile,"about:blank"
  ],{stdio:"ignore"});
  let socket=null,sequence=0;
  const inflight=new Map();
  let closed=false;
  try{
    let port=null;
    const started=Date.now();
    while(Date.now()-started<16000&&!port){
      const file=join(profile,"DevToolsActivePort");
      if(existsSync(file)){
        const value=(await import("node:fs")).readFileSync(file,"utf8").split("\n")[0];
        if(/^\d+$/.test(value))port=Number(value);
      }
      if(chrome.exitCode!==null)throw Error("Chrome exited before DevTools was available");
      if(!port)await sleep(180);
    }
    if(!port)throw Error("Chrome DevTools did not start");
    const tabs=await (await fetch("http://127.0.0.1:"+port+"/json/list",{signal:AbortSignal.timeout(3000)})).json();
    const target=tabs.find(tab=>tab.type==="page"&&tab.webSocketDebuggerUrl);
    if(!target)throw Error("No Chrome page target available");

    socket=new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolveDone,reject)=>{
      const timeout=setTimeout(()=>reject(Error("CDP WebSocket connection timed out")),5000);
      socket.addEventListener("open",()=>{clearTimeout(timeout);resolveDone()},{once:true});
      socket.addEventListener("error",e=>{clearTimeout(timeout);reject(e)},{once:true});
    });
    socket.addEventListener("message",event=>{
      let msg;
      try{msg=JSON.parse(event.data)}catch{return}
      const pending=inflight.get(msg.id);
      if(!pending)return;
      inflight.delete(msg.id);
      clearTimeout(pending.timer);
      if(msg.error)pending.reject(Error(JSON.stringify(msg.error)));
      else pending.resolve(msg.result||{});
    });
    const send=(method,params={})=>new Promise((resolveDone,reject)=>{
      const id=++sequence;
      const timer=setTimeout(()=>{inflight.delete(id);reject(Error("CDP timeout "+method))},8000);
      inflight.set(id,{resolve:resolveDone,reject,timer});
      socket.send(JSON.stringify({id,method,params}));
    });
    const evalJS=async expression=>{
      const result=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
      if(result.exceptionDetails)throw Error("Browser JS exception: "+JSON.stringify(result.exceptionDetails));
      return result.result?.value;
    };
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Page.navigate",{url:origin+"/learn"});

    // Wait for both the SSR nodes and React hydration. The halo's listener
    // is attached only after the client effect has mounted.
    let mounted=false;
    for(let i=0;i<70;i++){
      const ready=await evalJS(`document.readyState==="complete" &&
        Boolean(document.querySelector("${halo}")) &&
        Boolean(document.querySelector("${splash}"))`);
      if(ready){mounted=true;break}
      await sleep(140);
    }
    if(!mounted)throw Error("V7 shared shell not rendered on public Learn");
    const layers=await evalJS(`({
      splash:document.querySelector("${splash}")?.getAttribute("aria-hidden"),
      halo:document.querySelector("${halo}")?.getAttribute("aria-hidden"),
      captures:getComputedStyle(document.querySelector("${halo}")).pointerEvents,
      rail:getComputedStyle(document.querySelector("[aria-label='Bluebelly command navigation']")).display
    })`);
    if(layers.splash!=="true"||layers.halo!=="true"||layers.captures!=="none"||layers.rail==="none")
      throw Error("V7 decorative rail integrity failed: "+JSON.stringify(layers));

    // A real CDP mouse event exercises the hook; synthetic screenshots alone
    // cannot establish that the cursor-following effect is operational.
    let active=false;
    for(let attempt=0;attempt<18;attempt++){
      await send("Input.dispatchMouseEvent",{type:"mouseMoved",x:640+attempt,y:290+attempt,button:"none",pointerType:"mouse"});
      await sleep(170);
      const data=await evalJS(`({
        visible:document.querySelector("${halo}")?.dataset.visible,
        x:parseFloat(document.querySelector("${halo}")?.style.getPropertyValue("--halo-x")),
        y:parseFloat(document.querySelector("${halo}")?.style.getPropertyValue("--halo-y"))
      })`);
      if(data.visible==="true"&&Number.isFinite(data.x)&&Math.abs(data.x-(640+attempt))<25&&
        Number.isFinite(data.y)&&Math.abs(data.y-(290+attempt))<25){active=true;break}
    }
    if(!active)throw Error("V7 pointer halo did not follow an actual CDP mouse event");
    const image=await send("Page.captureScreenshot",{format:"png",fromSurface:true});
    const screenshot=resolve(output,"v7-cursor-halo-active-desktop.png");
    writeFileSync(screenshot,Buffer.from(image.data,"base64"));
    if(statSync(screenshot).size<12000)throw Error("Pointer screenshot unexpectedly small");

    // Changed media preference must make the effect disappear, not merely slow
    // down its animation or steal interaction from keyboard users.
    await send("Emulation.setEmulatedMedia",{
      features:[{name:"prefers-reduced-motion",value:"reduce"}]
    });
    await sleep(240);
    const reduced=await evalJS(`({
      display:getComputedStyle(document.querySelector("${halo}")).display,
      visible:document.querySelector("${halo}").dataset.visible
    })`);
    if(reduced.display!=="none"||reduced.visible!=="false")
      throw Error("Reduced-motion cursor safeguard failed: "+JSON.stringify(reduced));

    await send("Emulation.setEmulatedMedia",{
      features:[{name:"prefers-reduced-motion",value:"no-preference"}]
    });
    await send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await sleep(200);
    const mobile=await evalJS(`({
      spotlight:getComputedStyle(document.querySelector("${halo}")).display,
      rail:getComputedStyle(document.querySelector("[aria-label='Bluebelly command navigation']")).display
    })`);
    if(mobile.spotlight!=="none"||mobile.rail!=="none")
      throw Error("Mobile visual safeguards failed: "+JSON.stringify(mobile));

    console.log("V7 POINTER PASS · real pointer movement, reduced-motion fail-closed, mobile rail/halo hidden, no click interception");
    console.log("V7 POINTER screenshot "+screenshot);
  }finally{
    closed=true;
    if(socket&&socket.readyState<=1)socket.close();
    for(const [id,p] of inflight){clearTimeout(p.timer);p.reject(Error("CDP closed "+id))}
    inflight.clear();
    if(chrome.exitCode===null)chrome.kill("SIGTERM");
    await sleep(100);
    rmSync(profile,{recursive:true,force:true});
  }
}
