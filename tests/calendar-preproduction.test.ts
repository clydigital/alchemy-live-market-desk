import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {OFFICIAL_BLS_RELEASE_SCHEDULES,parseOfficialBlsScheduleHtml} from "../lib/calendar-official-bls-schedule.ts";
import {futureCpiMetricSeedRows,preReleaseConsensusCandidates} from "../lib/calendar-preproduction.ts";
import type {TradingEconomicsCalendarEvent} from "../lib/providers/trading-economics-calendar.ts";
import {getForwardEarningsEvents} from "../lib/forward-earnings-sources.ts";
import {formatVerifiedCpiConsensus} from "../lib/calendar.ts";

const release = {
  id:"us-bls-2026-11-10-cpi-october-2026",
  release_name:"Consumer Price Index for October 2026",
  release_date:"2026-11-10T13:30:00.000Z",
  reference_period:"October 2026",
  consensus:null, consensus_captured_at:null,
  actual:null,status:"scheduled",
};
const now="2026-11-09T08:00:00.000Z";
function row(event:string,reference:string="Oct/26"):TradingEconomicsCalendarEvent {
  return {
    calendarId:event,date:"2026-11-10T13:30:00.000Z",
    country:"United States",category:"Consumer Price Index",
    event,reference,source:"Bureau of Labor Statistics",sourceUrl:"https://www.bls.gov",
    actual:null,previous:"0.2%",consensus:"0.3%",teForecast:"0.5%",
    importance:3,lastUpdate:"2026-11-09T07:00:00.000Z",
    url:null,parsedActual:null,parsedPrevious:0.2,parsedConsensus:0.3,surprise:null,
  };
}
const metrics=[
  {release_id:release.id,metric_key:"cpi_headline_mom",consensus:null,consensus_captured_at:null},
  {release_id:release.id,metric_key:"cpi_headline_yoy",consensus:null,consensus_captured_at:null},
  {release_id:release.id,metric_key:"cpi_core_mom",consensus:null,consensus_captured_at:null},
  {release_id:release.id,metric_key:"cpi_core_yoy",consensus:null,consensus_captured_at:null},
];

test("live BLS official release table auto-parses exact reference period, date and time",()=>{
  const html="<table><tr><th>Reference Month</th><th>Release Date</th><th>Release Time</th></tr>"+
    "<tr><td>October 2026</td><td>Nov. 10, 2026</td><td>08:30 AM</td></tr>"+
    "<tr><td>November 2026</td><td>Dec. 10, 2026</td><td>08:30 AM</td></tr></table>";
  const events=parseOfficialBlsScheduleHtml(html,OFFICIAL_BLS_RELEASE_SCHEDULES[0]);
  assert.deepEqual(events.map(e=>[e.date,e.referencePeriod,e.timeLabel]),[
    ["2026-11-10","October 2026","08:30 ET"],["2026-12-10","November 2026","08:30 ET"],
  ]);
  assert.ok(events.every(e=>e.consensus===null&&e.actual===null&&e.sourceKind==="official-live"));
  assert.deepEqual(parseOfficialBlsScheduleHtml("<html>No matching official release table</html>",OFFICIAL_BLS_RELEASE_SCHEDULES[0]),[]);
});

test("pre-production first creates empty official CPI measure keys, no price or consensus",()=>{
  const seeded=futureCpiMetricSeedRows([release],[],now);
  assert.deepEqual(seeded.map(r=>r.metric_key),metrics.map(r=>r.metric_key));
  assert.ok(seeded.every(r=>r.unit==="%"&&r.metadata.forecastStatus==="NOT_CAPTURED"));
  assert.deepEqual(futureCpiMetricSeedRows([release],metrics,now),[]);
  assert.deepEqual(futureCpiMetricSeedRows([release],[],release.release_date),[]);
  assert.deepEqual(futureCpiMetricSeedRows([{...release,reference_period:null}],[],now),[]);
});

test("pre-release TE consensus is captured only for exact CPI metric, reference period and forecast vintage",()=>{
  const matched=preReleaseConsensusCandidates({
    releases:[release],metrics,provider:[
      row("Inflation Rate MoM"),
      row("Core Inflation Rate MoM"),
      {...row("Inflation Rate YoY"),consensus:"3.2%",parsedConsensus:3.2},
      {...row("Core Inflation Rate YoY"),consensus:"2.7%",parsedConsensus:2.7},
    ],capturedAt:now,
  });
  assert.deepEqual(matched.map(r=>r.metricKey),metrics.map(r=>r.metric_key));
  assert.equal(matched[0].value,0.3);
  assert.equal(matched[2].value,0.3);
  assert.ok(matched.every(r=>r.capturedAt===now && r.source.startsWith("https://")));
  assert.equal(preReleaseConsensusCandidates({releases:[release],metrics,provider:[row("Inflation Rate MoM")],capturedAt:"2026-11-11T00:00:00Z"}).length,0);
  assert.equal(preReleaseConsensusCandidates({releases:[release],metrics,provider:[{...row("Inflation Rate MoM"),actual:"0.3%"}],capturedAt:now}).length,0);
  assert.equal(preReleaseConsensusCandidates({releases:[release],metrics,provider:[row("Inflation Rate MoM","Sep/26")],capturedAt:now}).length,0);
  assert.equal(preReleaseConsensusCandidates({releases:[release],metrics,provider:[row("Inflation Rate MoM"),row("Inflation Rate MoM")],capturedAt:now}).length,0);
  assert.equal(preReleaseConsensusCandidates({releases:[release],metrics,provider:[{...row("Inflation Rate MoM"),consensus:null,parsedConsensus:null,teForecast:"0.9%"}],capturedAt:now}).length,0);
  assert.equal(preReleaseConsensusCandidates({releases:[release],metrics:[{...metrics[0],consensus:0.4}],provider:[row("Inflation Rate MoM")],capturedAt:now}).length,0);
});

test("calendar displays four metric-labelled genuinely pre-release forecasts only",()=>{
  const source=metrics.map((m,i)=>({
    ...m,consensus:[0.3,3.2,0.2,2.7][i],
    consensus_captured_at:"2026-11-09T08:00:00Z",
    label:m.metric_key,unit:"%",previous:null,revised_previous:null,alchemy_expectation:null,actual:null,
  }));
  assert.equal(formatVerifiedCpiConsensus(source,release.release_date),
    "Headline m/m 0.3% · Headline y/y 3.2% · Core m/m 0.2% · Core y/y 2.7%");
  assert.equal(formatVerifiedCpiConsensus(source.map(x=>({...x,consensus_captured_at:"2026-11-11T00:00:00Z"})),release.release_date),null);
  assert.equal(formatVerifiedCpiConsensus(source.map(x=>({...x,consensus_captured_at:null})),release.release_date),null);
});

test("existing automatic research slot includes calendar pre-production before CPI coverage and publication",()=>{
  const code=readFileSync(new URL("../lib/cron-research-handler.ts",import.meta.url),"utf8");
  const at=code.indexOf("const calendarPreproduction = await");
  assert.ok(at>0);
  assert.ok(at<code.indexOf("const cpiCoverage = await"));
  assert.ok(at<code.indexOf("const publication = await"));
  assert.match(code,/event: "scheduled_calendar_preproduction"/);
  assert.match(code,/calendarPreproduction,/);
  const calendar=readFileSync(new URL("../lib/calendar.ts",import.meta.url),"utf8");
  assert.match(calendar,/getOfficialBlsReleaseTables/);
});

test("Finnhub credentials no longer automatically cause any earnings calendar requests",async()=>{
  const oldKey=process.env.FINNHUB_API_KEY;
  const oldApproval=process.env.FINNHUB_COMMERCIAL_USE_APPROVED;
  process.env.FINNHUB_API_KEY="DO_NOT_POLL";
  process.env.FINNHUB_COMMERCIAL_USE_APPROVED="true";
  let calls=0;
  try {
    const result=await getForwardEarningsEvents({
      now:new Date("2026-10-20T00:00:00Z"),
      fetchImpl:(async()=>{calls++;throw Error("not allowed");}) as typeof fetch,
    });
    assert.equal(calls,0);
    assert.equal(result.coverage,"official_only");
    assert.ok(result.events.every(e=>e.verificationState==="official"));
  }finally {
    if(oldKey===undefined)delete process.env.FINNHUB_API_KEY;else process.env.FINNHUB_API_KEY=oldKey;
    if(oldApproval===undefined)delete process.env.FINNHUB_COMMERCIAL_USE_APPROVED;else process.env.FINNHUB_COMMERCIAL_USE_APPROVED=oldApproval;
  }
});
