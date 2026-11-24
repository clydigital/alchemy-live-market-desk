import type {MarketMonitorRow} from "./market-monitor.ts";
import {XL_COMPARISON_SYMBOLS} from "./bluebelly-etf-comparison-universe.ts";
export const BENCHMARKS=[{id:"spx",label:"S&P 500",detail:"Cash index (FRED)"},{id:"rsp",label:"RSP",detail:"Equal-weight S&P 500 ETF"},{id:"ndx",label:"Nasdaq 100",detail:"QQQ ETF proxy"},{id:"dow",label:"Dow",detail:"DIA ETF proxy"}] as const;
type History=Map<string,number>;
type Interval={key:string;start:string;end:string;value:number};
type Window=1|3|5|20|60;
const WINDOWS=[1,3,5,20,60] as const;
const fresh=(day:string,now:Date)=>{const age=+now-Date.parse(day+"T00:00:00Z");return age>=0&&age<=6*86400000;};
function history(row:MarketMonitorRow|undefined,now:Date):History{
 if(!row||row.frequency!=="daily"||!row.asOf||!fresh(row.asOf,now)||!row.sourceUrl)return new Map();
 const h=new Map<string,number>();for(const p of row.points){
  if(!Number.isFinite(p.time)||!Number.isFinite(p.close)||p.close<=0)continue;
  const d=new Date(p.time*1000);if(!Number.isFinite(+d))continue;
  const day=d.toISOString().slice(0,10);if(day<=row.asOf&&+d<=+now)h.set(day,p.close);
 }
 const sorted=new Map([...h].sort((a,b)=>a[0].localeCompare(b[0])));
 const last=[...sorted].at(-1);
 return last&&last[0]===row.asOf&&row.last!==null&&Math.abs(last[1]-row.last)<=Math.max(0.00001,Math.abs(row.last)*0.000001)?sorted:new Map();
}
function intervals(h:History):Interval[]{
 const p=[...h];return p.slice(1).map(([end,v],i)=>({key:p[i][0]+"/"+end,start:p[i][0],end,value:v/p[i][1]-1}));
}
function pearson(x:number[],y:number[]):number|null{
 if(x.length<2||x.length!==y.length)return null;
 const mx=x.reduce((a,b)=>a+b,0)/x.length,my=y.reduce((a,b)=>a+b,0)/y.length;
 let cross=0,xx=0,yy=0;for(let i=0;i<x.length;i++){const a=x[i]-mx,b=y[i]-my;cross+=a*b;xx+=a*a;yy+=b*b;}
 return xx>0&&yy>0?Math.max(-1,Math.min(1,cross/Math.sqrt(xx*yy))):null;
}
function relative(sector:History,bench:History):Record<Window,number|null>{
 const a=[...sector],b=[...bench],out={1:null,3:null,5:null,20:null,60:null} as Record<Window,number|null>;
 // Both histories must end on the same session, and every date in the
 // lookback must match. Never compare different holding periods.
 for(const n of WINDOWS){
  if(a.length<=n||b.length<=n)continue;
  const x=a.slice(-n-1),y=b.slice(-n-1);
  if(x.some((p,i)=>p[0]!==y[i][0]))continue;
  out[n]=((x.at(-1)![1]/x[0][1]-1)-(y.at(-1)![1]/y[0][1]-1))*100;
 }
 return out;
}
export function buildXlBenchmarkSynergy(rows:readonly MarketMonitorRow[],now=new Date()){
 const source=(id:string)=>rows.find(r=>r.id===id);
 const benches=BENCHMARKS.map(b=>{const row=source(b.id);const h=history(row,now);return {...b,asOf:[...h.keys()].at(-1)??null,sourceUrl:h.size?row!.sourceUrl:null,h,returns:new Map(intervals(h).map(r=>[r.key,r.value]))};});
 const sectorRows=XL_COMPARISON_SYMBOLS.map(symbol=>{
  const raw=source(symbol.toLowerCase());const h=history(raw,now),returns=intervals(h);
  // Use the identical intersection of return intervals for every available
  // benchmark, so correlation rankings are on the same sample.
  const available=benches.filter(b=>b.returns.size>=20);
  const common=returns.filter(r=>available.every(b=>b.returns.has(r.key)));
  const measure=(n:20|60)=>{
   const sample=common.slice(-n);const sufficient=sample.length>=n&&fresh(sample.at(-1)?.end??"",now);
   const values=benches.map(b=>({id:b.id,correlation:sufficient&&available.includes(b)?pearson(sample.map(r=>r.value),sample.map(r=>b.returns.get(r.key)!)):null}));
   const ranked=values.filter(v=>v.correlation!==null).sort((a,b)=>b.correlation!-a.correlation!);
   const best=ranked.length===4&&ranked[0].correlation!>0?ranked[0]:null;
   return {count:sample.length,asOf:sample.at(-1)?.end??null,values,best:best?.id??null,tied:best!==null&&ranked[1]!==undefined&&best.correlation!-ranked[1].correlation!<0.02};
  };
  return {symbol,label:raw?.label??symbol,asOf:[...h.keys()].at(-1)??null,sourceUrl:h.size?raw!.sourceUrl:null,
   relative:benches.map(b=>({id:b.id,changes:relative(h,b.h)})),correlation20:measure(20),correlation60:measure(60)};
 });
 return {benchmarks:benches.map(({h,returns,...b})=>b),sectors:sectorRows};
}
export type XlBenchmarkSynergy=ReturnType<typeof buildXlBenchmarkSynergy>;
