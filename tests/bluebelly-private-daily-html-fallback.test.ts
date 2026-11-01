import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {renderScheduledDailyHtml} from "../lib/bluebelly-scheduled-daily-html.ts";
import {parseExistingHtmlEdition} from "../lib/bluebelly-html-archive-import-contract.ts";
import {reportEvidenceReady,type AutomaticReportEvidence}
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
   sourceName:"Central Bank",url:"https://example.com/official/calendar",eventAt:"2026-11-03T18:00:00Z"},
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
test("existing cron calls authorised private generator without new schedules or public publication",()=>{
 const route=read("app/api/cron/research-gap/handoff/route.ts");
 const job=read("lib/bluebelly-scheduled-daily-html-job.ts");
 const migration=read("supabase/migrations/20261101095000_scheduled_private_daily_html_fallback.sql");
 const vercel=JSON.parse(read("vercel.json")) as {crons:{path:string;schedule:string}[]};
 assert.equal(vercel.crons.length,43);
 assert.match(route,/runPrivateDailyHtmlFallback\(request,now\)/);
 assert.match(route,/handleScheduledResearchGapHandoff\(request\)/);
 assert.match(job,/acceptsResearchAuthorization/);
 assert.match(job,/NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED/);
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
