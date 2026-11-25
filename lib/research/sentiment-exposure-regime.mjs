// Exploratory offline extension. NBER labels and matched exposure benchmarks are ex-post diagnostics only.
export function extendedTest(rows,recession={},sahm={},options={}){
 const cfg={threshold:30,cooldown:63,maxWait:42,horizon:63,cost:.001,...options};
 const {threshold,cooldown,maxWait,horizon:h,cost}=cfg;
 if(rows.length<401||!Number.isInteger(h)||h<1||!Number.isInteger(cooldown)||cooldown<1||!Number.isInteger(maxWait)||maxWait<1||!Number.isFinite(cost)||cost<0||cost>=1||!Number.isFinite(threshold)||threshold<=0)throw Error("Invalid inputs");
 const specs=[[20,1],[50,1],[100,.5],[200,.25]],em=specs.map(()=>rows[0].price);
 const x=rows.map((r,i)=>{
  if(!/^\d{4}-\d\d-\d\d$/.test(r.date)||!Number.isFinite(Date.parse(r.date+"T00:00:00Z"))||new Date(r.date+"T00:00:00Z").toISOString().slice(0,10)!==r.date||(i&&r.date<=rows[i-1].date)||!Number.isFinite(r.price)||r.price<=0||!(r.vix===null||Number.isFinite(r.vix)&&r.vix>=0))throw Error("Bad row "+i);
  const bands=specs.map(([n,m],k)=>{em[k]+=(r.price-em[k])*2/(n+1);const w=rows.slice(Math.max(0,i-n+1),i+1).map(y=>y.price),mean=w.reduce((a,b)=>a+b,0)/w.length,sd=Math.sqrt(w.reduce((a,b)=>a+(b-mean)**2,0)/w.length);return {n,ema:em[k],lower:em[k]-m*sd,upper:em[k]+m*sd};});return {...r,bands};
 });
 let last=-cooldown;const episodes=[];
 for(let i=400;i<x.length;i++)if(x[i].vix!==null&&x[i].vix>=threshold&&x[i-1].vix!==null&&x[i-1].vix<threshold&&i-last>=cooldown){episodes.push(i);last=i;}
 const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
 const rnd=v=>v===null?null:Math.round(v*100)/100;
 const details=[];
 for(const i of episodes){
  if(i+maxWait+1+h>=x.length)continue;
  const start=i+1,end=start+h,cap=Math.min(i+maxWait,end-2);
  const first=fn=>{for(let j=i+1;j<=cap;j++)if(fn(j))return j+1;return null;};
  const dip=first(j=>j>=i+5&&x[j].price<x[i].price*.97),vix=first(j=>x[j].vix!==null&&x[j].vix<25),ema=first(j=>x[j-1].price<=x[j-1].bands[0].ema&&x[j].price>x[j].bands[0].ema);
  const band=specs.map((_,k)=>first(j=>x[j-1].price<x[j-1].bands[k].lower&&x[j].price>=x[j].bands[k].lower&&x[j].price<=x[j].bands[k].upper));
  const fill=(e,w)=>e===null||e>=end?[]:[{e,w}];
  const stagedA=[...fill(start,.25),...fill(dip,.25),...fill(ema,.5)],stagedB=[...fill(start,.25),...fill(vix,.25),...fill(band[0],.5)];
  // Match invested capital-days, not end allocation. Ex-post match is explanatory, not a tradable signal.
  const exposure=f=>f.reduce((s,o)=>s+o.w*(end-o.e)/h,0);
  const orders=[["Immediate",fill(start,1)],["75% immediate",fill(start,.75)],["Calendar 25/25/50",[...fill(start,.25),...fill(start+10,.25),...fill(start+20,.5)]],["Staged dip + EMA",stagedA],["Staged VIX + band",stagedB],["Matched cash A (ex post)",fill(start,exposure(stagedA))],["Matched cash B (ex post)",fill(start,exposure(stagedB))],["EMA20 reclaim",fill(ema,1)],...specs.map(([n],k)=>["Band "+n+" re-entry",fill(band[k],1)])];
  const month=x[i].date.slice(0,7),lag=new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7)-3,1)).toISOString().slice(0,7);
  const rec=recession[month]===1?"NBER recession":recession[month]===0?"NBER non-recession":"Unknown";
  const s=sahm[lag];const sahmState=Number.isFinite(s)?s>=.5?"Sahm >=0.5":"Sahm <0.5":"Unknown";
  for(const [method,fills] of orders){
   const value=(j,liquidate=false)=>1+fills.filter(o=>o.e<=j).reduce((s,o)=>s+o.w*(x[j].price/x[o.e].price-1-cost*(liquidate?1:.5)),0);
   let mae=0,dd=0,peak=1;for(let j=start;j<=end;j++){const a=value(j,j===end);mae=Math.min(mae,a-1);peak=Math.max(peak,a);dd=Math.min(dd,a/peak-1);}
   details.push({episode:x[i].date,method,rec,sahmState,sahmValue:Number.isFinite(s)?s:null,ret:100*(value(end,true)-1),mae:100*mae,dd:100*dd,exposure:100*exposure(fills),entered:fills.some(o=>o.w>0),end:x[end].date});
  }
 }
 const summaries=[];for(const group of ["All","NBER recession","NBER non-recession","Sahm >=0.5","Sahm <0.5","1999–2016","2017–2026"]){const d=details.filter(r=>group==="All"||r.rec===group||r.sahmState===group||group==="1999–2016"&&r.episode<"2017"||group==="2017–2026"&&r.episode>="2017");for(const method of [...new Set(details.map(r=>r.method))]){const a=d.filter(r=>r.method===method);summaries.push({group,method,n:a.length,entered:a.filter(r=>r.entered).length,mean:rnd(mean(a.map(r=>r.ret))),hit:a.length?rnd(a.filter(r=>r.ret>0).length/a.length*100):null,worstMAE:a.length?rnd(Math.min(...a.map(r=>r.mae))):null,worstDD:a.length?rnd(Math.min(...a.map(r=>r.dd))):null,exposure:rnd(mean(a.map(r=>r.exposure)))});}}
 return {config:cfg,coverage:{sessions:x.length,first:x[0].date,last:x.at(-1).date,missingVix:x.filter(r=>r.vix===null).length},episodes:episodes.map(i=>x[i].date),summaries,details};
}
