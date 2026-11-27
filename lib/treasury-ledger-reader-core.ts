import {NOMINAL_TREASURY_TENORS,type NominalTreasuryMonitorId} from "./providers/treasury-nominal-curve.ts";
type Point={time:number;close:number};
export type LedgerSeries={id:NominalTreasuryMonitorId;points:Point[];sourceUrl:string;sourceUpdatedAt:string|null};
type Row={tenor_id?:unknown;observation_date?:unknown;yield_percent?:unknown;source_updated_at?:unknown;source_url?:unknown;collected_at?:unknown};
/** Read only previously collected official yields; never fabricate a current close. */
export function projectTreasuryLedger(input:readonly unknown[],now:Date):LedgerSeries[]{
 const byTenor=new Map<NominalTreasuryMonitorId,Map<string,{row:Row;point:Point;clock:number;conflict:boolean}>>();
 for(const value of input){
  if(!value||typeof value!=="object")continue;
  const r=value as Row;
  if(typeof r.tenor_id!=="string"||!Object.prototype.hasOwnProperty.call(NOMINAL_TREASURY_TENORS,r.tenor_id)||typeof r.observation_date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(r.observation_date)||typeof r.source_url!=="string"||typeof r.collected_at!=="string")continue;
  const t=Date.parse(r.observation_date+"T00:00:00Z"),collected=Date.parse(r.collected_at);
  if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==r.observation_date||t>+now||!Number.isFinite(collected)||collected>+now)continue;
  try{const u=new URL(r.source_url);if(u.origin!=="https://home.treasury.gov"||u.username||u.password||!u.pathname.endsWith("/pages/xml")||u.searchParams.get("data")!=="daily_treasury_yield_curve")continue}catch{continue}
  const n=typeof r.yield_percent==="number"?r.yield_percent:typeof r.yield_percent==="string"&&r.yield_percent.trim()?Number(r.yield_percent):NaN;
  if(!Number.isFinite(n)||n<0||n>30)continue;
  const clock=r.source_updated_at==null?collected:typeof r.source_updated_at==="string"?Date.parse(r.source_updated_at):NaN;
  if(!Number.isFinite(clock)||clock>+now)continue;
  const id=r.tenor_id as NominalTreasuryMonitorId;
  const days=byTenor.get(id)??new Map();byTenor.set(id,days);
  const old=days.get(r.observation_date);
  if(!old||clock>old.clock)days.set(r.observation_date,{row:r,point:{time:t/1000,close:n},clock,conflict:false});
  else if(clock===old.clock&&n!==old.point.close)old.conflict=true;
 }
 const result:LedgerSeries[]=[];
 for(const [id,days] of byTenor){
  const sorted=[...days.values()].sort((a,b)=>a.point.time-b.point.time);
  if(sorted.length<2||sorted.at(-1)!.conflict)continue;
  const clean=sorted.filter(x=>!x.conflict);
  if(clean.length<2)continue;
  const last=clean.at(-1)!;
  result.push({id,points:clean.map(x=>x.point),sourceUrl:last.row.source_url as string,sourceUpdatedAt:typeof last.row.source_updated_at==="string"?last.row.source_updated_at:null});
 }
 return result;
}
export function preferLedgerSeries(current:readonly Point[]|null,ledger:readonly Point[]):boolean{
 if(ledger.length<2)return false;
 const last=ledger.at(-1)!.time,previous=current?.at(-1)?.time??-1;
 return last>previous||last===previous&&(current?.length??0)<2;
}
