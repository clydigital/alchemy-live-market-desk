import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {originalUsReleaseClock,projectUsEconStatWatch} from "../lib/bluebelly-us-econ-stat-watch.ts";

const releaseAt="2026-11-25T13:30:00.000Z";
const retrieved="2026-11-25T13:38:00.000Z";
const source="https://www.bea.gov/news/2026/personal-income-and-outlays-october-2026";
const pce={
 id:"us-bea-2026-11-25-personal-income-outlays-oct-2026",
 release_name:"Personal Income and Outlays",release_date:releaseAt,
 agency:"U.S. Bureau of Economic Analysis",reference_period:"October 2026",
 source_url:source,source_classification:"official_government",
 actual:"Headline PCE +0.3% m/m; +3.8% y/y; Core PCE +0.2% m/m; +3.1% y/y",
 status:"completed",ingestion_attempt_status:"completed",released_at:releaseAt,actual_retrieved_at:retrieved,
};
const metrics=[
 ["pce_headline_mom",0.3,0.3],["pce_headline_yoy",3.8,3.8],
 ["pce_core_mom",0.2,0.3],["pce_core_yoy",3.1,3.2],
].map(([metric_key,actual,consensus])=>({
 release_id:pce.id,metric_key,actual,consensus,label:String(metric_key),unit:"%",
 source_url:source,retrieved_at:retrieved,consensus_source:"Econoday",
 consensus_captured_at:"2026-11-25T13:25:00Z",
 metadata:{consensus_source_url:"https://example.org/econ/pce"},
 previous:null,revised_previous:null,
}));
const calendar=[{id:"us-bls-2026-12-04-employment-situation",event:"Employment Situation",
 date:"2026-12-04",timeLabel:"08:30 ET",country:"United States",
 referencePeriod:"November 2026",sourceName:"U.S. Bureau of Labor Statistics",
 sourceUrl:"https://www.bls.gov/schedule/news_release/empsit.htm",sourceKind:"official-schedule"}];

test("US stats watch refreshes across multiple events instead of hardcoding a single PCE date",()=>{
 const result=projectUsEconStatWatch({releases:[pce],metrics,schedule:calendar,now:new Date("2026-11-25T15:00:00Z")});
 assert.equal(result.status,"OK");
 assert.equal(result.latest[0].family,"PCE");
 assert.equal(result.latest[0].status,"VERIFIED_ACTUAL");
 assert.equal(result.upcoming[0].family,"JOBS");
 assert.equal(result.upcoming[0].status,"SCHEDULED");
 assert.equal(result.countVerified,1);
 assert.equal(result.researchOnly,true);
 assert.deepEqual(result.latest[0].metrics.map(x=>x.surprise),[0,0,-0.1,-0.1]);
});
test("scheduled time alone does not create an actual or surprise",()=>{
 const before=projectUsEconStatWatch({releases:[pce],metrics,schedule:calendar,now:new Date("2026-11-24T18:00:00Z")});
 assert.equal(before.latest.length,0);
 assert.equal(before.upcoming.find(e=>e.family==="PCE")?.status,"SCHEDULED");
 assert.equal(before.upcoming.find(e=>e.family==="PCE")?.actualText,null);
 const missing=projectUsEconStatWatch({releases:[{...pce,actual:null,status:"released_pending_ingestion",
  actual_retrieved_at:null}],metrics,now:new Date("2026-11-25T15:00:00Z")});
 assert.equal(missing.latest[0].status,"AWAITING_ACTUAL");
 assert.equal(missing.latest[0].metrics.every(m=>m.actual===null),true);
});
test("late or linkless forecasts cannot turn into surprise values",()=>{
 const wrong=metrics.map(x=>({...x,consensus_captured_at:"2026-11-25T14:00:00Z"}));
 const late=projectUsEconStatWatch({releases:[pce],metrics:wrong,now:new Date("2026-11-25T15:00:00Z")});
 assert.equal(late.latest[0].metrics[2].forecast,null);
 assert.equal(late.latest[0].metrics[2].surprise,null);
 const unlinked=metrics.map(x=>({...x,metadata:{}}));
 const result=projectUsEconStatWatch({releases:[pce],metrics:unlinked,now:new Date("2026-11-25T15:00:00Z")});
 assert.equal(result.latest[0].metrics[2].surprise,null);
});
test("partially ingested or mismatched PCE remains partial or conflicted",()=>{
 const partial=projectUsEconStatWatch({releases:[pce],metrics:metrics.slice(0,3),now:new Date("2026-11-25T15:00:00Z")});
 assert.equal(partial.latest[0].status,"PARTIAL_METRICS");
 const mismatch=metrics.map(x=>x.metric_key==="pce_core_mom"?{...x,actual:0.7}:x);
 const wrong=projectUsEconStatWatch({releases:[pce],metrics:mismatch,now:new Date("2026-11-25T15:00:00Z")});
 assert.equal(wrong.latest[0].status,"SOURCE_CONFLICT");
 const duplicate=projectUsEconStatWatch({releases:[pce,pce],metrics,now:new Date("2026-11-25T15:00:00Z")});
 assert.equal(duplicate.latest.length,1);
});
test("unavailable database and vendor calendar never become verified releases",()=>{
 const result=projectUsEconStatWatch({releases:[],metrics:[],schedule:calendar,
  now:new Date("2026-11-24T18:00:00Z"),sourceUnavailable:true});
 assert.equal(result.status,"SOURCE_UNAVAILABLE");
 assert.equal(result.countVerified,0);
 assert.equal(result.upcoming[0].status,"SCHEDULED");
 const poisoned=projectUsEconStatWatch({releases:[{...pce,source_url:"https://some-trader.example/pce"}],metrics,
  now:new Date("2026-11-25T15:00:00Z")});
 assert.equal(poisoned.countVerified,0);
});
test("public US macro reader uses scheduled official releases without owner data or canonical writes",()=>{
 const server=readFileSync("lib/bluebelly-us-econ-stat-watch-server.ts","utf8");
 const component=readFileSync("components/blue-desk/RegimeNov23PceChallenge.tsx","utf8");
 const lens=readFileSync("app/blue-desk/regime-watch/[lensId]/page.tsx","utf8");
 const crash=readFileSync("app/blue-desk/crash-opportunity/page.tsx","utf8");
 const cron=readFileSync("vercel.json","utf8");
 assert.match(server,/getEconomicCalendar/);
 assert.match(server,/\.from\("macro_releases"\)/);
 assert.match(server,/\.from\("macro_release_metrics"\)/);
 assert.match(component,/US Economic Statistics Watch/);
 assert.match(component,/data-us-econ-stat-watch/);
 assert.match(lens,/getUsEconStatWatch/);
 assert.match(crash,/getUsEconStatWatch/);
 assert.match(cron,/\/api\/cron\/research\/official-actuals/);
 assert.doesNotMatch(server,/\.insert\(|\.upsert\(|\.update\(|getPrivateReviewedCreatorArguments|portfolio_positions/);
});


test("operational watch flags missing PCE template and provider without inventing actual or consensus",()=>{
 const scheduled={...pce,actual:null,status:"scheduled",ingestion_attempt_status:null,
  released_at:null,actual_retrieved_at:null,
  source_url:"https://www.bea.gov/news/schedule"};
 const watch=projectUsEconStatWatch({releases:[scheduled],metrics:[],
  now:new Date("2026-11-24T18:00:00Z"),consensusProviderConfigured:false});
 assert.equal(watch.operationalHealth,"DEGRADED");
 assert.equal(watch.consensusProvider,"UNCONFIGURED");
 assert.ok(watch.warnings.includes("PCE_METRIC_TEMPLATES_MISSING"));
 assert.ok(watch.warnings.includes("PCE_PRE_RELEASE_CONSENSUS_INCOMPLETE"));
 assert.ok(watch.warnings.includes("PRE_RELEASE_CONSENSUS_PROVIDER_UNCONFIGURED"));
 assert.equal(watch.upcoming[0].actualText,null);
 const late=projectUsEconStatWatch({releases:[scheduled],metrics:[],
  now:new Date("2026-11-25T15:10:00Z"),consensusProviderConfigured:false});
 assert.ok(late.warnings.some(x=>x.startsWith("OVERDUE_HIGH_IMPACT_ACTUAL:")));
 assert.equal(late.latest[0].status,"AWAITING_ACTUAL");
});
test("official 10:00 ET calendars use real daylight-saving clock, not midnight UTC",()=>{
 const schedule={...calendar[0],id:"us-bls-2026-11-03-jolts",
  event:"Job Openings and Labor Turnover Survey",date:"2026-11-03",
  timeLabel:"10:00 ET"};
 assert.equal(originalUsReleaseClock(schedule),"2026-11-03T15:00:00.000Z");
 assert.equal(originalUsReleaseClock({...schedule,date:"2026-07-03"}),"2026-07-03T14:00:00.000Z");
 assert.equal(originalUsReleaseClock({...schedule,timeLabel:"Unconfirmed"}),null);
 const before=projectUsEconStatWatch({releases:[],metrics:[],schedule:[schedule],
  now:new Date("2026-11-03T14:59:00Z")});
 assert.equal(before.upcoming[0].status,"SCHEDULED");
 const after=projectUsEconStatWatch({releases:[],metrics:[],schedule:[schedule],
  now:new Date("2026-11-03T15:01:00Z")});
 assert.equal(after.latest[0].status,"AWAITING_ACTUAL");
});
test("official calendar outage and source outage are visible even with scheduled fallback rows",()=>{
 const w=projectUsEconStatWatch({releases:[],metrics:[],schedule:calendar,
  now:new Date("2026-11-24T18:00:00Z"),calendarUnavailable:true,sourceUnavailable:true});
 assert.equal(w.operationalHealth,"DEGRADED");
 assert.ok(w.warnings.includes("OFFICIAL_CALENDAR_FETCH_UNAVAILABLE"));
 assert.ok(w.warnings.includes("CANONICAL_MACRO_SOURCE_UNAVAILABLE"));
});


test("empty official metric templates cannot masquerade as freshly retrieved actual evidence",()=>{
 const templates=metrics.map(row=>({
  ...row,actual:null,consensus:null,
  source_url:"https://www.bea.gov/news/schedule",
  retrieved_at:"2026-11-24T21:27:42Z",
 }));
 const future={...pce,actual:null,status:"scheduled",
  actual_retrieved_at:null,released_at:null,
  source_url:"https://www.bea.gov/news/schedule"};
 const watch=projectUsEconStatWatch({releases:[future],metrics:templates,
  now:new Date("2026-11-24T22:00:00Z")});
 assert.equal(watch.lastMetricRetrievedAt,null);
 assert.equal(watch.countVerified,0);
 const verified=projectUsEconStatWatch({releases:[pce],metrics,
  now:new Date("2026-11-25T15:00:00Z")});
 assert.equal(verified.lastMetricRetrievedAt,retrieved);
});
