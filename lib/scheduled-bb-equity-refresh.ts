import {projectPublicEquityCoverage} from "./bluebelly-equity-coverage.ts";
import {expectedLocalEquityDay} from "./bluebelly-europe-stock-history.ts";
import {BLUEBELLY_STOCK_UNIVERSE} from "./bluebelly-equity-universe.ts";
import type {MarketMonitor} from "./market-monitor.ts";
/** Authenticated existing AM/PM acquisition calls this even if other intake is
 * unchanged. Cache warm + source-date receipt only, no owner write or new job.
 * Local dates are conservative weekday expectations, not exchange holiday proof. */
export async function refreshScheduledBbEquities(now:Date,read?:()=>Promise<MarketMonitor>){
 const checkedAt=now.toISOString();
 try{
  const monitor=await (read??(async()=>{const {getMarketMonitor}=await import("./market-monitor.ts");return getMarketMonitor();}))();
  const coverage=projectPublicEquityCoverage(monitor.rows,now);
  const behindLocal=coverage.rows.filter(r=>{const spec=BLUEBELLY_STOCK_UNIVERSE.find(s=>s.ticker===r.ticker);return spec&&spec.region!=="US"&&(!r.asOf||r.asOf<expectedLocalEquityDay(now,spec));}).map(r=>r.ticker);
  const missing=coverage.rows.filter(r=>r.status!=="SOURCE_DATED").map(r=>r.ticker);
  const behindUs=coverage.rows.filter(r=>r.sessionFreshness==="BEHIND_US_SESSION").map(r=>r.ticker);
  return {checkedAt,status:missing.length||behindUs.length||behindLocal.length?"DEGRADED":"CURRENT_SOURCE_DATES",coverage:coverage.coverage,expectedUsSession:coverage.quality?.expectedUsSession??null,latestUs:coverage.quality?.latestUs??0,missing,behindUs,behindLocal,localCalendarBasis:"WEEKDAY_ESTIMATE"};
 }catch{return {checkedAt,status:"PROVIDER_ERROR",coverage:null,expectedUsSession:null,latestUs:0,missing:[],behindUs:[],behindLocal:[],localCalendarBasis:"WEEKDAY_ESTIMATE"};}
}
