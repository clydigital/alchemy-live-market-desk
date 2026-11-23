import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {OCTOBER_PCE_AT,OCTOBER_PCE_SOURCE,projectOctoberPceReadout} from "../lib/bluebelly-pce-event-readout.ts";

const releasedAt="2026-11-25T13:30:00.000Z";
const retrievedAt="2026-11-25T13:36:00.000Z";
const before=new Date("2026-11-24T19:00:00Z");
const after=new Date("2026-11-25T14:00:00Z");
const source={id:"us-bea-2026-11-25-personal-income-outlays-oct-2026",
 release_name:"Personal Income and Outlays",agency:"U.S. Bureau of Economic Analysis",
 reference_period:"October 2026",release_date:releasedAt,released_at:releasedAt,
 actual_retrieved_at:retrievedAt,source_url:OCTOBER_PCE_SOURCE,
 source_classification:"official_government",ingestion_attempt_status:"completed",status:"completed",
 actual:"Headline PCE +0.3% m/m; +3.8% y/y; Core PCE +0.2% m/m; +3.1% y/y"};
const fixtures=[
 ["pce_headline_mom",0.3,0.3],["pce_headline_yoy",3.8,3.8],
 ["pce_core_mom",0.2,0.3],["pce_core_yoy",3.1,3.2],
] as const;
const metrics=fixtures.map(([metric_key,actual,consensus])=>({
 metric_key,actual,consensus,consensus_source:"Econoday",
 consensus_captured_at:"2026-11-25T13:25:00Z",
 metadata:{consensus_source_url:"https://example.org/economic-calendar/pce"},
 source_url:OCTOBER_PCE_SOURCE,retrieved_at:retrievedAt,
 previous:metric_key==="pce_headline_mom"?0.5:null,revised_previous:null,
}));

test("original BEA October 2026 PCE remains a future event before publication",()=>{
 const result=projectOctoberPceReadout(source,metrics,before);
 assert.equal(result.state,"PRE_RELEASE");
 assert.equal(result.actualVerified,false);
 assert.equal(result.metrics.every(metric=>metric.actual===null),true);
 assert.equal(result.canonicalRegimeUnchanged,true);
});
test("four original actuals + independently timed consensus yields descriptive surprises, not a trade",()=>{
 const result=projectOctoberPceReadout(source,metrics,after);
 assert.equal(result.state,"AWAITING_MARKET_CONFIRMATION");
 assert.equal(result.actualVerified,true);
 assert.equal(result.validConsensusCount,4);
 assert.deepEqual(result.metrics.map(metric=>metric.surprisePp),[0,0,-0.1,-0.1]);
 assert.equal(result.marketReaction,"INTRADAY_NOT_INTEGRATED");
 assert.equal(result.metrics[0].previous,0.5);
 assert.equal(result.metrics[2].consensusCapturedAt,"2026-11-25T13:25:00.000Z");
 assert.equal(result.releaseAt,OCTOBER_PCE_AT);
});
test("missing, late or unsourced forecasts never create a false surprise",()=>{
 const late=metrics.map(row=>({...row,consensus_captured_at:"2026-11-25T13:40:00Z"}));
 assert.equal(projectOctoberPceReadout(source,late,after).validConsensusCount,0);
 const unsourced=metrics.map(row=>({...row,metadata:{}}));
 const result=projectOctoberPceReadout(source,unsourced,after);
 assert.equal(result.metrics[2].consensus,null);
 assert.equal(result.metrics[2].surprisePp,null);
});
test("partial or mismatched official metrics do not produce false completed state",()=>{
 const partial=projectOctoberPceReadout(source,metrics.slice(0,3),after);
 assert.equal(partial.state,"AWAITING_VERIFIED_METRICS");
 assert.equal(partial.metrics[3].actual,null);
 const wrong=metrics.map(row=>row.metric_key==="pce_core_mom"?{...row,actual:0.5}:row);
 assert.equal(projectOctoberPceReadout(source,wrong,after).state,"OFFICIAL_SOURCE_CONFLICT");
 const duplicate=projectOctoberPceReadout(source,[...metrics,metrics[0]],after);
 assert.equal(duplicate.state,"OFFICIAL_SOURCE_CONFLICT");
});
test("missing official release, erroneous source and inaccessible database fail closed",()=>{
 const pending=projectOctoberPceReadout(null,[],after);
 assert.equal(pending.state,"AWAITING_VERIFIED_ACTUAL");
 assert.equal(pending.actualVerified,false);
 const fake=projectOctoberPceReadout({...source,source_url:"https://example.org/press"},metrics,after);
 assert.equal(fake.state,"OFFICIAL_SOURCE_CONFLICT");
 assert.equal(fake.metrics.every(row=>row.actual===null),true);
 const inaccessible=projectOctoberPceReadout(source,null,after,true);
 assert.equal(inaccessible.state,"SOURCE_UNAVAILABLE");
 assert.equal(inaccessible.actualVerified,false);
});
test("public Regime and Crash PCE event handoff is read-only, no creator or canonical write",()=>{
 const component=readFileSync("components/blue-desk/RegimeNov23PceChallenge.tsx","utf8");
 const server=readFileSync("lib/bluebelly-pce-event-server.ts","utf8");
 const lens=readFileSync("app/blue-desk/regime-watch/[lensId]/page.tsx","utf8");
 const crash=readFileSync("app/blue-desk/crash-opportunity/page.tsx","utf8");
 assert.match(component,/data-pce-event-state={event.state}/);
 assert.match(component,/market-confirmation|Cross-asset verification/i);
 assert.match(lens,/event={pceEvent\?\?undefined}/);
 assert.match(crash,/event={pceEvent\?\?undefined}/);
 assert.match(server,/\.from\("macro_release_metrics"\)/);
 assert.doesNotMatch(server,/\.insert\(|\.update\(|\.upsert\(|getPrivateReviewedCreatorArguments/);
 assert.doesNotMatch(component,/createSupabaseAdminClient|getPrivateReviewedCreatorArguments/);
});
