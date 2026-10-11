import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { MarketMonitorRow } from "../lib/market-monitor.ts";
import {
  AI_COMPANY_CLOSE_METHOD,AI_COMPANY_WATCH,buildAiCompanyCloseCandidates,
} from "../lib/ai-company-canonical-closes.ts";
import { collectScheduledAiCompanyCloses } from "../lib/scheduled-ai-company-closes.ts";

const FRI=new Date("2026-10-09T00:00:00Z").getTime()/1000;
const THU=new Date("2026-10-08T00:00:00Z").getTime()/1000;
const MON=new Date("2026-10-12T00:00:00Z").getTime()/1000;
const NOW=new Date("2026-10-11T01:30:00Z");
function stocks() {
  return AI_COMPANY_WATCH.filter(x=>x.monitorId!==null);
}
function rows(time=FRI):MarketMonitorRow[] {
  return stocks().map((x,i)=>({
    id:x.monitorId,symbol:x.ticker,
    label:x.name,type:"AI / Semis",benchmark:"ndx",
    asOf:new Date(time*1000).toISOString().slice(0,10),
    frequency:"daily",
    sourceName:"Nasdaq official stocks history",
    sourceUrl:"https://www.nasdaq.com/market-activity/stocks/"+x.ticker.toLowerCase()+"/historical",
    points:[{time:THU,close:100+i},{time,close:102+i}],
  } as MarketMonitorRow));
}
test("P0B 16 monitored entities, eleven valid Nasdaq shares/ADS and five without supported US prices",()=>{
  assert.equal(AI_COMPANY_WATCH.length,16);
  assert.equal(stocks().length,11);
  assert.deepEqual(AI_COMPANY_WATCH.filter(x=>x.monitorId===null).map(x=>x.name),[
    "Samsung Electronics","SK Hynix","SpaceX AI","OpenAI","Anthropic",
  ]);
  assert.equal(AI_COMPANY_WATCH.find(x=>x.ticker==="TSM")?.name,"TSMC US ADS");
  assert.equal(AI_COMPANY_WATCH.find(x=>x.ticker==="CRWV")?.monitorId,"crwv");
});
test("P0B completed Friday price is source-verified numeric, dated, linked to specific ticker; NOT financial fundamentals",()=>{
  const x=buildAiCompanyCloseCandidates(rows(),NOW);
  assert.equal(x.expectedSession,"2026-10-09");
  assert.deepEqual(x.gaps,[]);
  assert.equal(x.items.length,11);
  assert.equal(x.uncovered.length,5);
  const crwv=x.items.find(z=>z.symbol==="CRWV")!;
  assert.equal(crwv.observationDay,"2026-10-09");
  assert.equal(crwv.observedAt,"2026-10-09T23:59:59.999Z");
  assert.equal(crwv.sourceUrl,"https://www.nasdaq.com/market-activity/stocks/crwv/historical");
  assert.equal(crwv.externalEvidenceId,"ai-close:CRWV:2026-10-09");
  assert.equal(crwv.priorCloseUsd,105);
  assert.ok(crwv.priceChangePercent!==null);
  assert.match(crwv.contentHash,/^[a-f0-9]{64}$/);
});
test("P0B provider source spoof, stale quote, missing ticker and future-dated partial bar held (no silent current)",()=>{
  let rs=rows();
  rs[0]={...rs[0],sourceUrl:"https://unverified.example.com/GOOGL"};
  let v=buildAiCompanyCloseCandidates(rs,NOW);
  assert.equal(v.items.length,10);
  assert.ok(v.gaps.some(x=>x.includes("SOURCE_IDENTITY_OR_FREQUENCY_MISMATCH")));
  v=buildAiCompanyCloseCandidates(rows(new Date("2026-09-22T00:00:00Z").getTime()/1000),NOW);
  assert.equal(v.items.length,0);
  assert.ok(v.gaps.some(x=>x.includes("STALE_OR_FUTURE_QUOTE")));
  v=buildAiCompanyCloseCandidates(rows(MON),NOW);
  assert.equal(v.items.length,0);
  assert.ok(v.gaps.some(x=>x.includes("NO_FINISHED_SESSION_PRICE")));
  v=buildAiCompanyCloseCandidates(rows().filter(x=>x.id!=="crwv"),NOW);
  assert.ok(v.gaps.some(x=>x==="CRWV:MISSING_OR_DUPLICATE_MONITOR_SERIES"));
});
test("P0B a Saturday or Sunday recheck with already canonical Friday observations makes zero provider or DB writes",async()=>{
  const prior=stocks().map(x=>({
    id:"69dfaa87-cab9-4a5b-be09-fe78c0c0d198",
    external_evidence_id:"ai-close:"+x.ticker+":2026-10-09",
    event_at:"2026-10-09T23:59:59.999Z",
    content_hash:"a".repeat(64),
    normalised_observation_id:"c8d88e70-bc98-420e-b368-69d8b1a93344",
  }));
  let fetched=0,writing=0;
  const out=await collectScheduledAiCompanyCloses(NOW,{
    readExisting:async()=>prior,
    readMonitor:async()=>{fetched++;return {rows:rows()} as Awaited<ReturnType<typeof import("../lib/market-monitor.ts").getMarketMonitor>>},
    write:async()=>{writing++;return{ids:[],gaps:[]}},
  });
  assert.equal(out.status,"SKIPPED_UNCHANGED");
  assert.equal(out.evidenceIds.length,0);
  assert.equal(fetched,0);assert.equal(writing,0);
  assert.equal(out.unsupported.length,5);
});
test("P0B first natural acquisition backfills only original Friday closes, no private valuation",async()=>{
  let count=0, saved:string[]=[];
  const result=await collectScheduledAiCompanyCloses(NOW,{
    readExisting:async()=>[],
    readMonitor:async()=>{count++;return{rows:rows()} as Awaited<ReturnType<typeof import("../lib/market-monitor.ts").getMarketMonitor>>},
    write:async(items)=>{saved=items.map(x=>x.externalEvidenceId);return{ids:items.map((x,i)=>"uuid-"+i),gaps:[]}},
  });
  assert.equal(count,1);
  assert.equal(result.status,"EVIDENCE_WRITTEN");
  assert.equal(result.evidenceIds.length,11);
  assert.ok(saved.every(x=>x.endsWith("2026-10-09")));
  assert.equal(saved.some(x=>x.includes("OpenAI")||x.includes("Samsung")),false);
});
test("P0B provider outage is reported and does not forge an Evidence UUID",async()=>{
  const r=await collectScheduledAiCompanyCloses(NOW,{
    readExisting:async()=>[],
    readMonitor:async()=>{throw Error("nasdaq blocked");},
  });
  assert.equal(r.status,"DEGRADED");
  assert.equal(r.evidenceIds.length,0);
  assert.ok(r.gaps[0].includes("AI_PRICE_PROVIDER_OR_CANONICAL_ERROR"));
});
test("P0B price Evidence reaches existing scheduled acquisition before publisher, no new cron or thesis authority",()=>{
  const code=readFileSync(new URL("../lib/scheduled-ai-company-closes.ts",import.meta.url),"utf8");
  const cron=readFileSync(new URL("../lib/cron-research-handler.ts",import.meta.url),"utf8");
  const vercel=readFileSync(new URL("../vercel.json",import.meta.url),"utf8");
  const monitor=readFileSync(new URL("../lib/market-monitor.ts",import.meta.url),"utf8");
  assert.equal(AI_COMPANY_CLOSE_METHOD,"ai-issuer-nasdaq-close/1");
  assert.match(monitor,/id: "crwv", providerSymbol: "CRWV"/);
  assert.match(code,/persistSensorMemory/);
  assert.match(code,/normalised_observation_id:normalized\.id/);
  assert.match(code,/\.from\("intelligence_evidence"\)/);
  assert.match(code,/CONFLICTING_SAME_SESSION_PRICE_REVISION/);
  assert.match(code,/market_perception_only_not_fundamentals/);
  assert.match(cron,/collectScheduledAiCompanyCloses/);
  assert.match(cron,/aiIssuerPrices,/);
  assert.ok(cron.indexOf("aiIssuerPricePromise")<cron.indexOf("const publication = await"));
  assert.doesNotMatch(code,/story_thesis_versions|runIntelligenceEngine|OpenAIStageError/);
  assert.doesNotMatch(vercel,/\/api\/cron\/ai-company-closes/);
});
