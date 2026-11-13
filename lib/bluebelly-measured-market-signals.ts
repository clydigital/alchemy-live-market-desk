import type {MarketDivergenceRead} from "./bluebelly-market-divergence-watch.ts";
import type {MarketChangeWindow} from "./blue-desk-market-filters.ts";
import type {SignalTag} from "./bluebelly-signal-tags.ts";

/** Precisely named, matched-session return observations. This is a price
 * comparison, not a historical correlation break, valuation or causal regime
 * verdict. No private holdings are consulted here.
 */
export type MeasuredMarketSignal=Readonly<{
 id:string;title:string;left:string;right:string;window:MarketChangeWindow;
 sourceSession:string;leftChange:number;rightChange:number;gapPp:number;
 leftSourceUrl:string;rightSourceUrl:string;
 status:"OPPOSITE_MOVE"|"RELATIVE_MOVE";question:string;nextTest:string;
 tag:SignalTag;
}>;
const validUrl=(url:string|null):url is string=>{
 if(!url)return false;
 try{const parsed=new URL(url);return parsed.protocol==="https:"&&!parsed.username&&!parsed.password&&parsed.hostname.includes(".");}
 catch{return false;}
};
const utcDay=(value:string):number|null=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const d=Date.parse(value+"T00:00:00Z");
 return Number.isFinite(d)&&new Date(d).toISOString().slice(0,10)===value?d:null;
};
/** Two original data links + the identical market session are required.
 * Opposite sign is observable; a same-sign gap is displayed only above a
 * conservative presentation threshold, NOT a tested statistical threshold.
 * 4-day UTC source-age tolerance preserves weekends/market closures.
 */
export function selectMeasuredMarketSignals(
 readings:readonly MarketDivergenceRead[],window:MarketChangeWindow,
 now=new Date(),limit=5,
):MeasuredMarketSignal[]{
 const today=utcDay(now.toISOString().slice(0,10));
 if(today===null||!Number.isInteger(limit)||limit<1)return [];
 const gapThreshold:Record<MarketChangeWindow,number>={"1D":2,"3D":4,"5D":6};
 const admitted:MeasuredMarketSignal[]=[];
 for(const read of readings){
  if(read.status!=="OPPOSITE_MOVE"&&read.status!=="RELATIVE_MOVE")continue;
  const session=read.sourceSession?utcDay(read.sourceSession):null;
  if(session===null||session>today||(today-session)>4*86400000)continue;
  if(!validUrl(read.leftSourceUrl)||!validUrl(read.rightSourceUrl))continue;
  if(read.leftChange===null||read.rightChange===null||read.gapPp===null||
    !Number.isFinite(read.leftChange)||!Number.isFinite(read.rightChange)||!Number.isFinite(read.gapPp))continue;
  if(read.status==="RELATIVE_MOVE"&&Math.abs(read.gapPp)<gapThreshold[window])continue;
  if(read.status==="OPPOSITE_MOVE"&&read.leftChange*read.rightChange>=0)continue;
  admitted.push({
   id:read.id,title:read.title,left:read.left,right:read.right,window,
   sourceSession:read.sourceSession!,leftChange:read.leftChange,rightChange:read.rightChange,gapPp:read.gapPp,
   leftSourceUrl:read.leftSourceUrl,rightSourceUrl:read.rightSourceUrl,
   status:read.status,question:read.question,nextTest:read.nextTest,
   tag:{id:"divergence",label:"Divergence",state:"MEASURED_RELATIVE"},
  });
 }
 return admitted.sort((a,b)=>{
  const aPriority=a.status==="OPPOSITE_MOVE"?1:0;
  const bPriority=b.status==="OPPOSITE_MOVE"?1:0;
  return bPriority-aPriority||Math.abs(b.gapPp)-Math.abs(a.gapPp)||a.title.localeCompare(b.title);
 }).slice(0,limit);
}
