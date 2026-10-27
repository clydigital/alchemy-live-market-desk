import type {MarketMonitorRow} from "./market-monitor.ts";

/** Read-only presentation from the SAME dated price/yield series as Markets.
 * A market change is an observed difference between completed sessions,
 * not a causal explanation or evidence of a new catalyst. */
export const WHATS_NEW_ASSETS=[
  {key:"rates-short",title:"US short yields",ids:["us2y"]},
  {key:"rates-long",title:"US long yields",ids:["us10y-fred","us10y"]},
  {key:"equities",title:"US equities",ids:["spx","spx-proxy"]},
  {key:"semiconductors",title:"Semiconductors",ids:["smh","soxx"]},
  {key:"energy",title:"Crude oil",ids:["brent","wti"]},
  {key:"fx",title:"Dollar / yen proxy",ids:["jpy","dxy"]},
] as const;

export type TrendStatus="ready"|"stale"|"unavailable";
export type TrendDatum={time:number;close:number};
export type PublicTrendCard={
 key:string;title:string;label:string|null;sourceName:string|null;
 sourceUrl:string|null;asOf:string|null;status:TrendStatus;
 unit:"bp"|"%"|null;last:number|null;
 changes:{d1:number|null;d3:number|null;d5:number|null};
 points:TrendDatum[];
 missingReason:string|null;
};
const DAY=86_400_000;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const URL_OK=(url:string)=>{try{const u=new URL(url);return u.protocol==="https:"&&!u.username&&!u.password&&!!u.hostname;}catch{return false;}};
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
function empty(key:string,title:string,why:string):PublicTrendCard{
 return {key,title,label:null,sourceName:null,sourceUrl:null,asOf:null,
 status:"unavailable",unit:null,last:null,changes:{d1:null,d3:null,d5:null},
 points:[],missingReason:why};
}
function present(row:MarketMonitorRow,now:Date):PublicTrendCard|null{
 const maxTime=now.getTime();
 if(row.frequency!=="daily"||!row.asOf||!DATE.test(row.asOf)||!row.sourceName||
    !URL_OK(row.sourceUrl)||!Array.isArray(row.points))return null;
 const day=Date.parse(row.asOf+"T00:00:00Z");
 if(!Number.isFinite(day)||day>maxTime)return null;
 // Monitor points use UTC seconds, and their final date is the source's
 // completed trading session, not the moment the webpage was refreshed.
 const pts=[...row.points].filter(p=>Number.isFinite(p.time)&&Number.isFinite(p.close)
   &&p.time>0&&p.time*1000<=maxTime
   &&(row.type==="Rates"||p.close>0))
   .sort((a,b)=>a.time-b.time)
   .filter((p,i,a)=>i===0||p.time!==a[i-1].time);
 const last=pts.at(-1);
 if(!last||new Date(last.time*1000).toISOString().slice(0,10)!==row.asOf)return null;
 // Never mislabel a monthly release, missing series, or single point as a
 // 1/3/5-session trend. Insufficient records retain a transparent gap.
 if(pts.length<6)return null;
 const isYield=row.type==="Rates";
 const move=(count:number)=>{
   const current=last.close,prior=pts.at(-(count+1))?.close;
   if(prior===undefined||!Number.isFinite(prior))return null;
   if(isYield)return round((current-prior)*100); // percentage points -> bp
   return prior>0?round((current/prior-1)*100):null;
 };
 return {key:row.id,title:"",label:row.label,sourceName:row.sourceName,
 sourceUrl:row.sourceUrl,asOf:row.asOf,
 status:maxTime-day>7*DAY?"stale":"ready",
 unit:isYield?"bp":"%",last:last.close,
 changes:{d1:move(1),d3:move(3),d5:move(5)},
 points:pts.slice(-20),missingReason:null};
}
export function projectWhatsNewTrends(rows:readonly MarketMonitorRow[],now=new Date()):PublicTrendCard[]{
 if(!Number.isFinite(now.getTime()))return [];
 const byId=new Map(rows.map(row=>[row.id,row]));
 return WHATS_NEW_ASSETS.map(spec=>{
   for(const id of spec.ids){
     const row=byId.get(id);if(!row)continue;
     const candidate=present(row,now);
     if(candidate)return {...candidate,key:spec.key,title:spec.title};
   }
   return empty(spec.key,spec.title,"Source-dated daily history insufficient for a 1/3/5-session comparison.");
 });
}
export function trendPolyline(points:readonly TrendDatum[]):string|null{
 if(points.length<2||points.some(p=>!Number.isFinite(p.close)))return null;
 const sample=points.slice(-20);const values=sample.map(p=>p.close);
 const low=Math.min(...values),high=Math.max(...values),range=high-low;
 const x=(n:number)=>12+(n/(sample.length-1))*276;
 const y=(value:number)=>range===0?50:88-76*((value-low)/range);
 return sample.map((p,i)=>x(i).toFixed(2)+","+y(p.close).toFixed(2)).join(" ");
}
