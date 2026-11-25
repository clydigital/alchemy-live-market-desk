import type {PublicEquityCoverage} from "./bluebelly-equity-coverage.ts";
import type {SensorMemoryInput} from "./providers/sensor-memory.ts";
export const EMA_LEDGER_METHOD="bb-equity-ema-session-ledger/1";
// One bounded diagnostic observation per completed US session, not one write
// per ticker/band. Never archive stale, short-warmup or owner-private readings
// as verified current signals. No canonical evidence/forecast promotion.
export function buildEmaLedgerInput(coverage:PublicEquityCoverage):SensorMemoryInput|null{
 const session=coverage.quality?.expectedUsSession;
 if(!session||!/^\d{4}-\d{2}-\d{2}$/.test(session))return null;
 const rows=coverage.rows.filter(r=>r.region==="US"&&r.sessionFreshness==="LATEST_COMPLETED_US_SESSION"&&r.asOf===session&&r.emaScan?.asOf===session&&r.sourceName&&r.sourceUrl)
 .map(r=>({ticker:r.ticker,sourceName:r.sourceName,sourceUrl:r.sourceUrl,price:r.price,observations:r.emaScan!.observations.filter(o=>o.warmup==="READY"&&o.asOf===session).map(o=>({
 frame:o.frame,period:o.period,ema:o.ema,upper:o.upper,lower:o.lower,band:o.band,side:o.side,distancePct:o.distancePct,anchorDay:o.anchorDay,closeHolds:o.closeHolds??[],events:o.windows["1"]?.events??[],
 // Additive forward-compatible replay metadata from the pending trend PR.
 respectedBandTrend:"respectedBandTrend" in o?o.respectedBandTrend??null:null,
 })).sort((a,b)=>a.frame.localeCompare(b.frame)||a.period-b.period)})).sort((a,b)=>a.ticker.localeCompare(b.ticker));
 const value={session,method:EMA_LEDGER_METHOD,trackedUS:coverage.coverage.US,currentUS:coverage.quality!.latestUs,behindUS:coverage.quality!.behindUs,unavailableUS:coverage.quality!.unavailableUs,rows};
 const sourceUrl="https://alchemy-live-market-desk-rogue-magazine.vercel.app/api/markets/stocks";
 // Deterministic payload excludes collection timestamps. Real same-session
 // revisions are handled by the existing sensor memory versioning contract.
 return {provider:"bluebelly_ema_session_ledger",sourceUrl,sourceType:"market_data",contentType:"application/json",rawPayload:value,contentText:"Bluebelly completed US session EMA measurement snapshot "+session,publishedAt:null,observedAt:coverage.generatedAt,ingestionKey:EMA_LEDGER_METHOD+":"+session,observations:[{observationType:"ema_session_diagnostic",subjectType:"public_equity_universe",subjectKey:"bluebelly_us_equities",observedAt:session+"T23:59:59.999Z",effectiveAt:null,value,unit:"snapshot",confidence:70,isPreliminary:true,methodologyVersion:EMA_LEDGER_METHOD}]};
}
