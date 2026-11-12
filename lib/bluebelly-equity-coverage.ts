import {BLUEBELLY_STOCK_UNIVERSE,stockUniverseCoverage,type StockIdentity} from "./bluebelly-equity-universe";
import type {MarketMonitorRow} from "./market-monitor";

export type EquityCoverageStatus="SOURCE_DATED"|"MONITORED_UNAVAILABLE";
export type PublicEquityCoverageRow=Pick<StockIdentity,
 "ticker"|"company"|"region"|"exchange"|"currency"|"timeZone"|"priority"|"theme"> & {
  status:EquityCoverageStatus;price:number|null;changePct:number|null;
  asOf:string|null;sourceName:string|null;sourceUrl:string|null;
};
export type PublicEquityCoverage={
 contractVersion:"bluebelly-equity-coverage/1";source:"Bluebelly public market monitor";
 asOf:string;generatedAt:string;coverage:{tracked:number;US:number;EU:number;sourceDated:number;unavailable:number};
 rows:PublicEquityCoverageRow[];disclaimer:string;
};
function eligible(row:MarketMonitorRow,spec:StockIdentity,now:Date):boolean{
 if(row.frequency!=="daily"||row.symbol.toUpperCase()!==spec.ticker||!row.asOf
  ||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(row.asOf)
  ||!Number.isFinite(row.last)||!(row.last!>0)||row.currency&&row.currency!==spec.currency)return false;
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
 const observed=new Map<string,MarketMonitorRow>();
 for(const raw of rows){
  const ticker=raw.symbol?.toUpperCase();if(!ticker)continue;
  const old=observed.get(ticker);
  if(!old||(old.asOf??"")<(raw.asOf??""))observed.set(ticker,raw);
 }
 const projected:PublicEquityCoverageRow[]=BLUEBELLY_STOCK_UNIVERSE.map(spec=>{
  const row=observed.get(spec.ticker),ok=!!row&&eligible(row,spec,now);
  return {ticker:spec.ticker,company:spec.company,region:spec.region,exchange:spec.exchange,
   currency:spec.currency,timeZone:spec.timeZone,priority:spec.priority,theme:spec.theme,
   status:ok?"SOURCE_DATED":"MONITORED_UNAVAILABLE",
   price:ok?row!.last:null,changePct:ok&&Number.isFinite(row!.dayChange)?row!.dayChange:null,
   asOf:ok?row!.asOf:null,sourceName:ok?row!.sourceName:null,sourceUrl:ok?row!.sourceUrl:null};
 });
 const coverage=stockUniverseCoverage(),available=projected.filter(x=>x.status==="SOURCE_DATED").length;
 return {contractVersion:"bluebelly-equity-coverage/1",source:"Bluebelly public market monitor",
  asOf:now.toISOString().slice(0,10),generatedAt:now.toISOString(),
  coverage:{tracked:coverage.total,US:coverage.byRegion.US,EU:coverage.byRegion.EU,
   sourceDated:available,unavailable:coverage.total-available},
  rows:projected,
  disclaimer:"Public curated research universe, not private Power Stack holdings. Source-dated prices are unofficial delayed observations in local listing currency, not streaming quotes or trading recommendations. Unavailable is not a flat/zero price."};
}
