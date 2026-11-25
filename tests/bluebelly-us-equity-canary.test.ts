import test from "node:test";
import assert from "node:assert/strict";
import {planUsRecovery,US_REPAIR_SYMBOLS,US_EQUITY_CANARY,PREFERRED_US_ETFS,US_RECOVERY_BATCH_LIMIT,fetchUsEquityCanaryHistory} from "../lib/bluebelly-home-etf-history.ts";
test("reallocate existing 17-slot budget, preserve ETF fallback precedence",()=>{
 assert.equal(PREFERRED_US_ETFS.length,15);
 assert.equal(US_EQUITY_CANARY.length,12);
 assert.deepEqual(planUsRecovery(new Set([...US_REPAIR_SYMBOLS,...US_EQUITY_CANARY])),[...US_REPAIR_SYMBOLS]);
 const available=planUsRecovery(new Set(["AVB","EQR",...US_EQUITY_CANARY]));
 assert.equal(available.length,14);
 assert(available.length<=US_RECOVERY_BATCH_LIMIT);
 assert.deepEqual(available.slice(0,2),["AVB","EQR"]);
});
test("equity canary exact listing and completed session, no arbitrary ticker requests",async()=>{
 const now=new Date("2026-11-25T22:00:00Z");
 const dates=["2026-11-18","2026-11-19","2026-11-20","2026-11-23","2026-11-24","2026-11-25"];
 const fixture={chart:{error:null,result:[{meta:{symbol:"NVDA",currency:"USD",instrumentType:"EQUITY",exchangeTimezoneName:"America/New_York"},timestamp:dates.map(d=>Date.parse(d+"T14:30:00Z")/1000),indicators:{quote:[{close:[90,91,92,93,94,95]}]}}]}};
 const fetcher=(async()=>new Response(JSON.stringify(fixture))) as typeof fetch;
 const row=await fetchUsEquityCanaryHistory("NVDA",now,AbortSignal.timeout(1000),fetcher);
 assert.equal(row.points.at(-1)?.close,95);
 assert.equal(new Date(row.points.at(-1)!.time*1000).toISOString().slice(0,10),"2026-11-25");
 await assert.rejects(()=>fetchUsEquityCanaryHistory("OTHER",now,AbortSignal.timeout(1000),fetcher));
 await assert.rejects(()=>fetchUsEquityCanaryHistory("AMD",now,AbortSignal.timeout(1000),fetcher));
});
