import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildMacroResearchCharts} from "../lib/bluebelly-research-charts.ts";
import type {MarketMonitorRow} from "../lib/market-monitor.ts";
import {renderScheduledDailyHtml} from "../lib/bluebelly-scheduled-daily-html.ts";
import {parseExistingHtmlEdition} from "../lib/bluebelly-html-archive-import-contract.ts";
import {assembleAutomaticReportEvidence,reportEvidenceReady,type AutomaticReportEvidence}
 from "../lib/blue-desk-automated-report-contract.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const day="2026-10-30";
const now=new Date("2026-10-31T03:45:00Z");
const evidence:AutomaticReportEvidence={asOf:now.toISOString(),slot:"morning",coverageNote:
 "Automated briefing: source-attributed original observations; no independent causal verification.",
 sources:[
  {id:"N1",type:"NEWS",title:"Company releases dated operating update",
   detail:"The issuer published its earnings release, with cash conversion still needing a separate period comparison.",
   sourceName:"Issuer Investor Relations",url:"https://example.com/issuer/2026/10/earnings",eventAt:"2026-10-30T20:05:00Z"},
  {id:"N2",type:"NEWS",title:"Central bank publishes its policy statement",
   detail:"An official decision was announced without proof of a directly attributable market-price change.",
   sourceName:"Central Bank",url:"https://example.com/official/monetary/20261030",eventAt:"2026-10-30T18:00:00Z"},
  {id:"C3",type:"CALENDAR",title:"Future policy decision",detail:"Does the next decision change rate expectations?",
   sourceName:"Central Bank",url:"https://example.com/official/calendar",eventAt:"2026-11-03T18:00:00Z",
   calendarComparison:{previous:"54.9",consensus:"54.8",snapshotAt:"2026-10-31T03:45:00Z"}},
  {id:"M4",type:"OBSERVATION",title:"DXY — source-dated daily level",
   detail:"Daily level 99.5, previous close 100.2; no release-window causality established.",
   sourceName:"Example market provider",url:"https://example.com/market/dxy",eventAt:"2026-10-31T00:00:00Z",
   marketSnapshot:{label:"DXY",level:99.5,previousClose:100.2,asOf:"2026-10-31T00:00:00Z"}},
 ]};
test("private fallback is a complete static and date-valid HTML document, not a fake model success",()=>{
 assert.equal(reportEvidenceReady(evidence),true);
 const r=renderScheduledDailyHtml({day,now,evidence});
 assert.equal(r.mode,"SOURCE_LED_FALLBACK");
 assert.match(r.html,/Source-led fallback/);
 assert.match(r.html,/full editorial report remains pending/i);
 assert.match(r.html,/potential mechanism/i);
 assert.match(r.html,/original-source ledger/i);
 assert.match(r.html,/market observations are separate clocks/);
 assert.doesNotMatch(r.html,/<script|<iframe|javascript:|<link/i);
 const result=parseExistingHtmlEdition({filename:"Bluebelly_"+day+".html",html:r.html});
 assert.equal(result.edition.reportDay,day);
 assert.equal(result.edition.title,r.title);
 assert.equal(result.edition.htmlSha256.length,64);
 assert.ok(Buffer.byteLength(r.html)>1000);
});
test("HTML renderer escapes untrusted publisher text and rejects missing coverage",()=>{
 const changed={...evidence,sources:evidence.sources.map((x,i)=>i===0
  ?{...x,title:"Company <script>alert(1)</script> update",detail:"Earnings & policy <img src=x onerror=bad> reported."}:x)};
 const r=renderScheduledDailyHtml({day,now,evidence:changed});
 assert.doesNotMatch(r.html,/<script|<img|onerror=/i);
 assert.match(r.html,/&lt;script&gt;/);
 assert.match(r.html,/&lt;img/);
 assert.throws(()=>renderScheduledDailyHtml({day,now,evidence:{...evidence,sources:[evidence.sources[0]]}}),/INSUFFICIENT_REPORT_SOURCES/);
});
test("private cron isolation retained with additional first-party US macro check",()=>{
 const route=read("app/api/cron/research-gap/handoff/route.ts");
 const job=read("lib/bluebelly-scheduled-daily-html-job.ts");
 const migration=read("supabase/migrations/20261101095000_scheduled_private_daily_html_fallback.sql");
 const vercel=JSON.parse(read("vercel.json")) as {crons:{path:string;schedule:string}[]};
 // The authorised source-only consolidation removes twelve legacy intelligence polls.
 // Private handoff, calendar discovery and all four official-actuals windows stay intact.
 const original=vercel.crons.filter(item=>item.path!=="/api/cron/research/official-actuals");
 const actuals=vercel.crons.filter(item=>item.path==="/api/cron/research/official-actuals");
 assert.equal(original.length,34);
 assert.equal(original.filter(item=>item.path.endsWith("-intelligence")).length,4);
 assert.deepEqual(original.filter(item=>item.path==="/api/cron/research-gap/handoff").map(item=>item.schedule),["30 3 * * *","45 3 * * *","30 15 * * *","45 15 * * *"]);
 assert.deepEqual(vercel.crons.filter(item=>item.path==="/api/cron/calendar/discover").map(item=>item.schedule),["0 1 * * *"]);
 assert.deepEqual(actuals.map(item=>item.schedule),["42 12 * * *","42 13 * * *","12 14 * * *","12 15 * * *"]);
 assert.match(route,/runPrivateDailyHtmlFallback\(request,now\)/);
 assert.match(route,/handleScheduledResearchGapHandoff\(request\)/);
 assert.match(job,/acceptsResearchAuthorization/);
 assert.match(read("lib/bluebelly-daily-html-fallback-gate.ts"),/NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED/);
 assert.match(job,/scheduledDailyHtmlFallbackEnabled\(process.env\)/);
 assert.match(job,/reportEvidenceReady\(evidence\)/);
 assert.match(job,/getOriginalPressNews/);
 assert.match(job,/getPublicSourceObservations/);
 assert.match(job,/delivery_type:"SCHEDULED_RESEARCH"/);
 assert.match(job,/\.eq\("report_day",day\)/);
 assert.match(job,/private_daily_html_archived/);
 assert.doesNotMatch(job,/story_thesis_versions|market_regime_current|status:"published"/);
 assert.match(migration,/blue_desk_work_html_one_scheduled_session/);
 assert.doesNotMatch(migration,/grant .* authenticated|grant .* anon/i);
});

test("private daily tables derive only from exact source evidence and scheduled calendar",()=>{
 const result=renderScheduledDailyHtml({day,now,evidence});
 assert.match(result.html,/data-private-table="market-snapshots"/);
 assert.match(result.html,/data-private-table="evidence-receipts"/);
 assert.match(result.html,/data-private-table="upcoming-catalysts"/);
 assert.match(result.html,/data-private-table="economic-expectations"/);
 assert.match(result.html,/54\.9/);
 assert.match(result.html,/54\.8/);
 assert.match(result.html,/Actual<\/th>/);
 assert.match(result.html,/Pending<\/td>/);
 assert.match(result.html,/freeze time are not independently established here/);
 assert.match(result.html,/>DXY<\/td>/);
 assert.match(result.html,/>99\.5<\/td>/);
 assert.match(result.html,/>100\.2<\/td>/);
 assert.match(result.html,/ET \/ .* MYT/);
 assert.match(result.html,/Constructive scenario not verified/);
 assert.match(result.html,/no return, yield change or causal link is inferred/i);
 assert.doesNotMatch(result.html,/<iframe|<script|onerror=|javascript:/i);
 const parsed=parseExistingHtmlEdition({filename:"Bluebelly_"+day+".html",html:result.html});
 assert.equal(parsed.edition.reportDay,day);
});
test("private dated visual tables omit missing market data without inventing levels",()=>{
 const onlyOriginals={...evidence,sources:evidence.sources.filter(s=>!s.marketSnapshot)};
 const result=renderScheduledDailyHtml({day,now,evidence:onlyOriginals});
 assert.doesNotMatch(result.html,/data-private-table="market-snapshots"/);
 assert.match(result.html,/data-private-table="upcoming-catalysts"/);
});

test("two distinct releases sharing one official calendar URL remain in the private handoff",()=>{
 const prepared=assembleAutomaticReportEvidence({now,slot:"morning",news:[],observations:[],
  calendar:[
   {title:"ISM Manufacturing PMI",when:"2026-11-03T15:00:00Z",sourceName:"ISM",
    sourceUrl:"https://example.com/official/calendar",question:"Are orders accelerating?"},
   {title:"ISM Services PMI",when:"2026-11-04T15:00:00Z",sourceName:"ISM",
    sourceUrl:"https://example.com/official/calendar",question:"Are services prices accelerating?",
    previous:"54.9",consensus:"54.8"},
  ]});
 const upcoming=prepared.sources.filter(s=>s.type==="CALENDAR");
 assert.equal(upcoming.length,2);
 assert.equal(upcoming[1].calendarComparison?.consensus,"54.8");
 assert.equal(upcoming[1].calendarComparison?.previous,"54.9");
 assert.match(renderScheduledDailyHtml({day,now,evidence:{...evidence,
  sources:[...evidence.sources,...upcoming]}}).html,/ISM Services PMI/);
});

test("scheduled private HTML includes static actual charts, missing states and hash dedupe",()=>{
 const row={id:"us2y",type:"Rates",frequency:"daily",sourceName:"FRED",sourceUrl:"https://fred.stlouisfed.org/series/DGS2",points:[{time:Date.parse("2026-10-29T00:00:00Z")/1000,close:3.8},{time:Date.parse("2026-10-30T00:00:00Z")/1000,close:3.9}]} as MarketMonitorRow;
 const charts=buildMacroResearchCharts([row],now);
 const result=renderScheduledDailyHtml({day,now,evidence,researchCharts:[...charts,charts[0]]});
 assert.equal((result.html.match(/data-chart-rendered="true"/g)||[]).length,1);
 assert.equal((result.html.match(/data-chart-hash="/g)||[]).length,3);
 assert.match(result.html,/<svg xmlns=/);
 assert.match(result.html,/Source-dated research charts/);
 assert.match(result.html,/Chart unavailable/);
 assert.match(result.html,/https:\/\/fred\.stlouisfed\.org\/series\/DGS2/);
 assert.ok(result.html.includes(charts[0].dataHash));
 const bad={...charts[0],svg:'<svg xmlns="http://www.w3.org/2000/svg"><foreignObject>bad</foreignObject></svg>'};
 const rejected=renderScheduledDailyHtml({day,now,evidence,researchCharts:[bad]});
 assert.doesNotMatch(rejected.html,/<foreignObject/i);
 assert.match(rejected.html,/data-chart-rendered="false"/);
 assert.match(read("lib/bluebelly-scheduled-daily-html-job.ts"),/renderScheduledDailyHtml\(\{day,now,evidence,narrative,researchCharts\}\)/);
});
