import {BLUEBELLY_STOCK_UNIVERSE,stockUniverseCoverage,type StockIdentity} from "./bluebelly-equity-universe.ts";
import {expectedHomeEtfSession} from "./bluebelly-home-etf-history.ts";
import type {EquityEmaScan} from "./bluebelly-equity-ema";
import type {MarketMonitorRow} from "./market-monitor";

export type EquityCoverageStatus="SOURCE_DATED"|"MONITORED_UNAVAILABLE";
export type PublicEquityCoverageRow=Pick<StockIdentity,
 "ticker"|"company"|"region"|"exchange"|"currency"|"timeZone"|"priority"|"theme"> & {
  status:EquityCoverageStatus;sessionFreshness?:"LATEST_COMPLETED_US_SESSION"|"BEHIND_US_SESSION"|"LOCAL_SESSION_DATED"|"UNAVAILABLE";expectedUsSession?:string|null;price:number|null;changePct:number|null;change3dPct?:number|null;change5dPct?:number|null;emaScan?:EquityEmaScan|null;
  asOf:string|null;sourceName:string|null;sourceUrl:string|null;
};
export type PublicEquityCoverage={
 contractVersion:"bluebelly-equity-coverage/1";source:"Bluebelly public market monitor";
 asOf:string;generatedAt:string;coverage:{tracked:number;US:number;EU:number;ASIA:number;sourceDated:number;unavailable:number};
 rows:PublicEquityCoverageRow[];disclaimer:string;
 /** Additive diagnostics only: dated observations are not a latest-session claim.
  * Counts include property identities for measurement coverage, not PS alerts. */
 quality?:{expectedUsSession:string|null;latestUs:number;behindUs:number;unavailableUs:number;datedLocal:number;technical:{key:string;ready:number;indicative:number;unavailable:number}[]};
};
function eligible(row:MarketMonitorRow,spec:StockIdentity,now:Date):boolean{
 if(row.frequency!=="daily"||row.symbol.toUpperCase()!==spec.ticker||!row.asOf
  ||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(row.asOf)
  ||!Number.isFinite(row.last)||!(row.last!>0)||row.currency&&row.currency!==spec.currency)return false;
 if(spec.region==="US"){const expected=expectedHomeEtfSession(now);if(!expected||row.asOf>expected)return false;}
 const time=Date.parse(row.asOf+"T00:00:00Z"),age=now.getTime()-time;
 if(!Number.isFinite(time)||age<0||age>8*86400000)return false;
 try{
  const u=new URL(row.sourceUrl);
  return u.protocol==="https:"&&!u.username&&!u.password&&!!row.sourceName;
 }catch{return false;}
}
/** Market tracker, not portfolio authority. All rows are bounded public symbols.
 * Never infer security membership from user's private account.
 */
export function projectPublicEquityCoverage(
 rows:readonly MarketMonitorRow[],now=new Date(),
):PublicEquityCoverage{
 const observed=new Map<string,MarketMonitorRow[]>();
 for(const raw of rows){
  const ticker=raw.symbol?.toUpperCase();if(!ticker)continue;
  const list=observed.get(ticker)??[];list.push(raw);observed.set(ticker,list);
 }
 const expected=expectedHomeEtfSession(now);
 const projected:PublicEquityCoverageRow[]=BLUEBELLY_STOCK_UNIVERSE.map(spec=>{
  const candidates=(observed.get(spec.ticker)??[]).filter(r=>eligible(r,spec,now)).sort((a,b)=>b.asOf!.localeCompare(a.asOf!));
  const row=candidates[0];
  const conflict=!!row&&candidates.some(r=>r.asOf===row.asOf&&Math.abs(r.last!-row.last!)>Math.max(0.000001,Math.abs(row.last!)*0.000001));
  const ok=!!row&&!conflict;
  return {ticker:spec.ticker,company:spec.company,region:spec.region,exchange:spec.exchange,
   currency:spec.currency,timeZone:spec.timeZone,priority:spec.priority,theme:spec.theme,
   status:ok?"SOURCE_DATED":"MONITORED_UNAVAILABLE",
   sessionFreshness:!ok?"UNAVAILABLE":spec.region!=="US"?"LOCAL_SESSION_DATED":row!.asOf===expected?"LATEST_COMPLETED_US_SESSION":"BEHIND_US_SESSION",expectedUsSession:spec.region==="US"?expected:null,
   price:ok?row!.last:null,changePct:ok&&Number.isFinite(row!.dayChange)?row!.dayChange:null,
   change3dPct:ok&&Number.isFinite(row!.change3d)?row!.change3d:null,
   change5dPct:ok&&Number.isFinite(row!.change5d)?row!.change5d:null,
   emaScan:ok&&row!.emaScan?.asOf===row!.asOf?row!.emaScan:null,
   asOf:ok?row!.asOf:null,sourceName:ok?row!.sourceName:null,sourceUrl:ok?row!.sourceUrl:null};
 });
 const coverage=stockUniverseCoverage(),available=projected.filter(x=>x.status==="SOURCE_DATED").length;
 const technical=(["D","W","M"] as const).flatMap(frame=>[20,50,100,200].map(period=>{
  const eligible=projected.filter(r=>r.region!=="US"||r.sessionFreshness==="LATEST_COMPLETED_US_SESSION");
  const observations=eligible.flatMap(r=>r.emaScan?.observations.filter(o=>o.frame===frame&&o.period===period)??[]);
  const ready=observations.filter(o=>o.warmup==="READY").length,indicative=observations.filter(o=>o.warmup==="SHORT_WARMUP").length;
  return {key:frame+period,ready,indicative,unavailable:coverage.total-ready-indicative};
 }));
 const quality={expectedUsSession:expected,latestUs:projected.filter(r=>r.sessionFreshness==="LATEST_COMPLETED_US_SESSION").length,behindUs:projected.filter(r=>r.sessionFreshness==="BEHIND_US_SESSION").length,unavailableUs:projected.filter(r=>r.region==="US"&&r.status!=="SOURCE_DATED").length,datedLocal:projected.filter(r=>r.sessionFreshness==="LOCAL_SESSION_DATED").length,technical};
 return {contractVersion:"bluebelly-equity-coverage/1",source:"Bluebelly public market monitor",
  asOf:now.toISOString().slice(0,10),generatedAt:now.toISOString(),
  coverage:{tracked:coverage.total,US:coverage.byRegion.US,EU:coverage.byRegion.EU,ASIA:coverage.byRegion.ASIA,
   sourceDated:available,unavailable:coverage.total-available},
  rows:projected,quality,
  disclaimer:"Public curated research universe, not private Power Stack holdings. Source-dated prices are unofficial delayed observations in local listing currency, not streaming quotes or trading recommendations. Unavailable is not a flat/zero price. Technical coverage counts exclude lagging US sessions; local venue calendar freshness is not established."};
}
