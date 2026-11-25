// Offline exploratory price-index backtest. No acquisition, writes, or trade authority.
export function backtest(rows, options={}){
 const cfg={threshold:30,cooldown:63,maxWait:42,cost:0.001,horizons:[21,42,63,126,252],...options};
 if(!Array.isArray(rows)||rows.length<101)throw Error("Insufficient daily sessions");
 if(!Number.isFinite(cfg.cost)||cfg.cost<0||cfg.cost>=1||!Number.isFinite(cfg.threshold)||cfg.threshold<=0||!Number.isInteger(cfg.cooldown)||cfg.cooldown<1||!Number.isInteger(cfg.maxWait)||cfg.maxWait<1||!cfg.horizons.every(h=>Number.isInteger(h)&&h>0))throw Error("Invalid configuration");
 const x=rows.map((r,i)=>{
  if(!/^\d{4}-\d\d-\d\d$/.test(r.date)||!Number.isFinite(Date.parse(r.date+"T00:00:00Z"))||new Date(r.date+"T00:00:00Z").toISOString().slice(0,10)!==r.date||(i&&r.date<=rows[i-1].date)||!Number.isFinite(r.price)||r.price<=0||!(r.vix===null||Number.isFinite(r.vix)&&r.vix>=0)||!(r.oas==null||Number.isFinite(r.oas)&&r.oas>=0))throw Error("Invalid session "+i);
  return {...r,ema:0,lower:0};
 });
 let ema=x[0].price;for(let i=0;i<x.length;i++){ema=2/21*x[i].price+19/21*ema;const w=x.slice(Math.max(0,i-19),i+1).map(r=>r.price),mean=w.reduce((a,b)=>a+b,0)/w.length,sd=Math.sqrt(w.reduce((a,b)=>a+(b-mean)**2,0)/w.length);x[i].ema=ema;x[i].lower=ema-sd;}
 const episodes=[];let last=-cfg.cooldown;
 for(let i=100;i<x.length;i++){if(x[i].vix!==null&&x[i].vix>=cfg.threshold&&x[i-1].vix!==null&&x[i-1].vix<cfg.threshold&&i-last>=cfg.cooldown){episodes.push(i);last=i;}}
 const methods=["Immediate","VIX < 25","EMA reclaim","Lower band reclaim","Both","Second wave","Staged dip + EMA","Staged VIX + band","Credit gate"];
 function signals(i){
  const z={vix:null,ema:null,band:null,both:null,dip:null,credit:null};
  for(let j=i;j<=Math.min(i+cfg.maxWait,x.length-1);j++){const a=x[j],b=x[j-1];
   if(j>i){
    if(z.vix===null&&a.vix!==null&&a.vix<25)z.vix=j;
    if(z.ema===null&&b.price<=b.ema&&a.price>a.ema)z.ema=j;
    if(z.band===null&&b.price<b.lower&&a.price>=a.lower)z.band=j;
    if(z.both===null&&a.vix!==null&&a.vix<25&&a.price>a.ema)z.both=j;
    if(z.dip===null&&j>=i+5&&a.price<x[i].price*.97)z.dip=j;
   }
   if(z.credit===null&&b.oas!=null&&b.oas<5)z.credit=j;
  }return z;
 }
 function orders(i,m,z){
  const a=(j,w)=>j===null?[]:[{entry:j+1,w}];
  switch(m){case "Immediate":return a(i,1);case "VIX < 25":return a(z.vix,1);case "EMA reclaim":return a(z.ema,1);case "Lower band reclaim":return a(z.band,1);case "Both":return a(z.both,1);case "Second wave":return a(z.dip,1);case "Staged dip + EMA":return [...a(i,.25),...a(z.dip,.25),...a(z.ema,.5)];case "Staged VIX + band":return [...a(i,.25),...a(z.vix,.25),...a(z.band,.5)];case "Credit gate":return a(z.credit,1);default:throw Error("Unknown method");}
 }
 const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
 const median=a=>{if(!a.length)return null;const v=[...a].sort((a,b)=>a-b);return (v[Math.floor((v.length-1)/2)]+v[Math.floor(v.length/2)])/2;};
 const rnd=v=>v===null?null:Math.round(v*100)/100;
 const result=[],details=[];
 for(const h of cfg.horizons){const eligible=episodes.filter(i=>i+cfg.maxWait+1+h<x.length);
  for(const i of eligible){const z=signals(i),end=i+1+h;
   for(const m of methods){
    // Only credit gate requires full previous-session OAS coverage for its whole potential wait window.
    if(m==="Credit gate"&&x.slice(i-1,i+cfg.maxWait).some(r=>r.oas==null))continue;
    const all=orders(i,m,z),fills=all.filter(o=>o.entry<end),deployed=fills.reduce((s,o)=>s+o.w,0);
    const value=(j,liquidate=false)=>1+fills.filter(o=>o.entry<=j).reduce((s,o)=>s+o.w*(x[j].price/x[o.entry].price-1-cfg.cost*(liquidate?1:.5)),0);
    let mae=0,peak=1,dd=0;for(let j=i+1;j<=end;j++){const a=value(j,j===end);mae=Math.min(mae,a-1);peak=Math.max(peak,a);dd=Math.min(dd,a/peak-1);}
    details.push({h,method:m,episode:x[i].date,ret:100*(value(end,true)-1),mae:100*mae,dd:100*dd,deployed:100*deployed,entries:fills.length,entryDates:fills.map(o=>({date:x[o.entry].date,w:o.w})),end:x[end].date});
   }
  }
  for(const m of methods){const a=details.filter(d=>d.h===h&&d.method===m),active=a.filter(d=>d.entries>0);
   const summarize=b=>({n:b.length,mean:rnd(mean(b.map(d=>d.ret))),median:rnd(median(b.map(d=>d.ret))),hit:b.length?rnd(100*b.filter(d=>d.ret>0).length/b.length):null,meanMAE:rnd(mean(b.map(d=>d.mae))),worstMAE:b.length?rnd(Math.min(...b.map(d=>d.mae))):null,worstDrawdown:b.length?rnd(Math.min(...b.map(d=>d.dd))):null,meanDeployed:rnd(mean(b.map(d=>d.deployed)))});
   result.push({h,method:m,...summarize(a),entered:active.length,pre2024:summarize(a.filter(d=>d.episode<"2024-01-01")),since2024:summarize(a.filter(d=>d.episode>="2024-01-01"))});
  }
 }
 return {config:cfg,coverage:{sessions:x.length,first:x[0].date,last:x.at(-1).date,missingVix:x.filter(r=>r.vix===null).length,missingOas:x.filter(r=>r.oas==null).length},episodes:episodes.map(i=>({date:x[i].date,vix:x[i].vix,price:x[i].price})),result,details};
}
