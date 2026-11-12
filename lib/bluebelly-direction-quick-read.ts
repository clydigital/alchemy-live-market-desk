/** Dated human-reviewed direction cues; never a ceasefire probability or canonical Regime verdict. */
export type DirectionTrend="better"|"mixed"|"worse"|"unknown";
export type DirectionEvidence={
 id:string;date:string;direction:Exclude<DirectionTrend,"unknown">;
 title:string;sourceName:string;sourceUrl:string;limitation:string;
 comparisonSourceUrl?:string;
};
export type DirectionWindow={
 label:"1D"|"3D"|"5D";days:1|3|5;from:string;to:string;
 trend:DirectionTrend;better:number;worse:number;mixed:number;count:number;
};
export type DirectionQuickRead={
 evidence:DirectionEvidence[];sourceDay:string|null;stale:boolean;
 windows:DirectionWindow[];
};
const DAY=86_400_000;
const DAY_RE=/^\d{4}-\d{2}-\d{2}$/;
function validDay(date:string){
 if(!DAY_RE.test(date))return false;
 const at=Date.parse(date+"T00:00:00Z");
 return Number.isFinite(at)&&new Date(at).toISOString().slice(0,10)===date;
}
function validSource(url:string){
 try{const parsed=new URL(url);return parsed.protocol==="https:"&&!parsed.username&&!parsed.password;}catch{return false;}
}
function dayMinus(date:string,n:number){
 return new Date(Date.parse(date+"T00:00:00Z")-n*DAY).toISOString().slice(0,10);
}
/** Calendar publication-date windows (UTC), anchored at newest admissible source day.
 * Never treat absence of new evidence as an improvement. A 2+ UTC-day-old
 * review renders UNKNOWN until a fresh human-vetted update is supplied.
 */
export function buildDirectionQuickRead(input:readonly DirectionEvidence[],now:Date):DirectionQuickRead{
 const today=now.toISOString().slice(0,10),seen=new Set<string>();
 const evidence=input.filter(item=>{
  if(!item||!item.id||seen.has(item.id)||!validDay(item.date)||item.date>today||
    !["better","mixed","worse"].includes(item.direction)||!item.title||!item.sourceName||
    !validSource(item.sourceUrl)||!item.limitation||
    (item.comparisonSourceUrl!==undefined&&!validSource(item.comparisonSourceUrl)))return false;
  seen.add(item.id);return true;
 }).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
 const sourceDay=evidence[0]?.date||null;
 const stale=!sourceDay||(Date.parse(today+"T00:00:00Z")-Date.parse(sourceDay+"T00:00:00Z"))>=2*DAY;
 const windows=([1,3,5] as const).map(days=>{
  const from=sourceDay?dayMinus(sourceDay,days-1):today;
  const matching=evidence.filter(item=>sourceDay&&item.date>=from&&item.date<=sourceDay);
  const better=matching.filter(item=>item.direction==="better").length;
  const worse=matching.filter(item=>item.direction==="worse").length;
  const mixed=matching.filter(item=>item.direction==="mixed").length;
  const trend:DirectionTrend=stale||!matching.length?"unknown":
    better&&worse?"mixed":worse?"worse":better?"better":"mixed";
  return {label:(days+"D") as DirectionWindow["label"],days,from,to:sourceDay||today,
    trend,better,worse,mixed,count:matching.length};
 });
 return {evidence,sourceDay,stale,windows};
}
