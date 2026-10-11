import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  allQuantifiedMarketInputsCurrent, assessScheduledMarketMeasurements,
  expectedMarketMeasurementDays,
  type ExistingMarketEvidence,
} from "../lib/scheduled-market-measurement-quality.ts";
import { collectScheduledMarketMeasurements } from "../lib/scheduled-market-measurement-intake.ts";

const FRI="2026-10-09",THU="2026-10-08",MON="2026-10-12";
const ALL=[
  ["hy_oas_20s",THU,"basis_points"],
  ["ig_oas_20s",THU,"basis_points"],
  ["smh_qqq_20s",FRI,"percentage_points"],
  ["xlf_spx_20s",FRI,"percentage_points"],
  ["rsp_spx_20s",FRI,"percentage_points"],
] as const;
function rows(
  inputs: readonly (readonly [string,string,string])[]=ALL
):ExistingMarketEvidence[]{
  return inputs.map(([key,day,unit],i)=>({
    id:"69dfaa87-cab9-4a5b-be09-fe78c0c0d1"+String(90+i).padStart(2,"0"),
    external_evidence_id:"market-crack:"+key+":2026-09-10:"+day,
    event_at:day+"T23:59:59.999Z",measurement_unit:unit,
  }));
}
test("P0 Oct 11 Sunday MYT preserves Friday market closes and Thursday delayed FRED OAS",()=>{
  const now=new Date("2026-10-11T01:30:00.000Z");
  assert.deepEqual(expectedMarketMeasurementDays(now),{usClose:FRI,creditDue:THU});
  const status=assessScheduledMarketMeasurements(now,rows());
  assert.equal(status.length,5);
  assert.equal(status.filter(x=>x.status==="UNCHANGED_EXPECTED").length,5);
  assert.ok(allQuantifiedMarketInputsCurrent(status));
  assert.deepEqual(status.map(x=>x.lastObservationDay),[THU,THU,FRI,FRI,FRI]);
});
test("P0 09:30 MYT Monday while NY Sunday is still an unchanged Friday close",()=>{
  const now=new Date("2026-10-12T01:30:00Z");
  assert.deepEqual(expectedMarketMeasurementDays(now),{usClose:FRI,creditDue:THU});
  assert.ok(allQuantifiedMarketInputsCurrent(assessScheduledMarketMeasurements(now,rows())));
});
test("P0 Tue MYT after NY Monday completed close demands actual Monday equity session, not a new timestamp on Friday",()=>{
  const now=new Date("2026-10-13T01:30:00Z");
  assert.deepEqual(expectedMarketMeasurementDays(now),{usClose:MON,creditDue:FRI});
  const states=assessScheduledMarketMeasurements(now,rows());
  assert.equal(states.filter(x=>x.status==="EXPECTED_UPDATE").length,5);
  assert.equal(allQuantifiedMarketInputsCurrent(states),false);
  assert.equal(states[2].lastObservationDay,FRI);
  assert.equal(states[2].requiredObservationDay,MON);
  assert.ok(states[2].reason.includes("newer matched completed session"));
});
test("P0 at 21:30 MYT Monday NY market still open; do not fabricate Monday closing values",()=>{
  const now=new Date("2026-10-12T13:30:00Z");
  assert.deepEqual(expectedMarketMeasurementDays(now),{usClose:FRI,creditDue:THU});
  const check=assessScheduledMarketMeasurements(now,rows());
  assert.ok(check.every(x=>x.status==="UNCHANGED_EXPECTED"));
});
test("P0 real current Monday equity and Friday OAS samples return CURRENT next morning",()=>{
  const now=new Date("2026-10-13T01:30:00Z");
  const updated=rows(ALL.map(([key,date,unit])=>[
    key,key.endsWith("oas_20s")?FRI:MON,unit,
  ] as const));
  const check=assessScheduledMarketMeasurements(now,updated);
  assert.ok(check.every(x=>x.status==="CURRENT"));
});
test("P0 corrupted canonical units cannot be accepted as freshness",()=>{
  const corrupt=rows();
  corrupt[0]={...corrupt[0],measurement_unit:"percentage_points"};
  const check=assessScheduledMarketMeasurements(new Date("2026-10-11T01:30:00Z"),corrupt);
  assert.equal(check[0].status,"DEFINITION_MISMATCH");
  assert.equal(allQuantifiedMarketInputsCurrent(check),false);
});
test("P0 missing canonical metrics are MISSING (not zero, not 'no change')",()=>{
  const checks=assessScheduledMarketMeasurements(new Date("2026-10-11T01:30:00Z"),[]);
  assert.ok(checks.every(x=>x.status==="MISSING"&&x.canonicalEvidenceUuid===null));
});
test("P0 scheduled collector uses neither provider nor writer on unchanged weekend",async()=>{
  let fetches=0,writes=0,reads=0;
  const r=await collectScheduledMarketMeasurements(new Date("2026-10-11T01:30:00Z"),{
    readEvidence:async()=>{reads++;return rows();},
    fetchMonitor:async()=>{fetches++;return{rows:[]};},
    writeMeasurements:async()=>{writes++;return{persisted:[],gaps:[]};},
  });
  assert.equal(r.acquisition,"SKIPPED_UNCHANGED");
  assert.equal(fetches,0);assert.equal(writes,0);assert.equal(reads,1);
  assert.ok(r.checks.every(x=>x.status==="UNCHANGED_EXPECTED"));
});
test("P0 real new market session is written BEFORE return, then read-back fresh canonical UUIDs",async()=>{
  let fetches=0,writes=0,reads=0;
  const now=new Date("2026-10-13T01:30:00Z");
  const old=rows();
  const updated=rows(ALL.map(([key,date,unit])=>[
    key,key.endsWith("oas_20s")?FRI:MON,unit,
  ] as const));
  const r=await collectScheduledMarketMeasurements(now,{
    readEvidence:async()=>++reads===1?old:updated,
    fetchMonitor:async()=>{fetches++;return{rows:[]};},
    writeMeasurements:async()=>{writes++;return{persisted:[{id:"new",evidenceId:"69dfaa87-cab9-4a5b-be09-fe78c0c0d199",observationId:"b"}],gaps:[]};},
  });
  assert.equal(fetches,1);assert.equal(writes,1);assert.equal(reads,2);
  assert.equal(r.acquisition,"CANONICAL_WRITER_RAN");
  assert.deepEqual(r.evidenceIds,["69dfaa87-cab9-4a5b-be09-fe78c0c0d199"]);
  assert.equal(r.unresolved.length,0);
});
test("P0 provider failure does not reset clock or create false current measurements",async()=>{
  const now=new Date("2026-10-13T01:30:00Z");
  const r=await collectScheduledMarketMeasurements(now,{
    readEvidence:async()=>rows(),
    fetchMonitor:async()=>{throw Error("provider unavailable");},
    writeMeasurements:async()=>{throw Error("must not write");},
  });
  assert.equal(r.acquisition,"PROVIDER_ERROR");
  assert.ok(r.checks.some(c=>c.status==="PROVIDER_ERROR"&&c.lastObservationDay===FRI));
  assert.ok(r.unresolved.some(x=>x.includes("SOURCE_OR_CANONICAL_COLLECTION_FAILED")));
  assert.equal(r.evidenceIds.length,0);
});
test("P0 new numeric writer belongs to existing scheduled acquisition, before research publication; no cron/LLM",()=>{
  const cron=readFileSync(new URL("../lib/cron-research-handler.ts",import.meta.url),"utf8");
  const acquisition=readFileSync(new URL("../lib/cron-research-acquisition-handler.ts",import.meta.url),"utf8");
  const runner=readFileSync(new URL("../lib/scheduled-market-measurement-intake.ts",import.meta.url),"utf8");
  const vercel=readFileSync(new URL("../vercel.json",import.meta.url),"utf8");
  assert.match(cron,/collectScheduledMarketMeasurements/);
  assert.match(cron,/const numericIntakePromise/);
  assert.ok(cron.indexOf("numericIntakePromise") < cron.indexOf("const publication = await"));
  assert.match(cron,/quantifiedMarket: numericIntake/);
  assert.match(acquisition,/handleScheduledResearchWithDependencies/);
  assert.match(runner,/persistCanonicalMarketMeasurements/);
  assert.match(runner,/\.like\("external_evidence_id","market-crack:%"\)/);
  assert.doesNotMatch(runner,/story_thesis_versions|runIntelligenceEngine|modelRunner/);
  assert.doesNotMatch(vercel,/\/api\/cron\/market-measurements/);
});
