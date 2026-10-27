import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseEditorialSlate} from "../lib/editorial-slate-core.ts";
import {renderPrivateEditorialSlatePdf} from "../lib/blue-desk-private-slate-pdf.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const source=["https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
 "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView"];
function slate(){
 const urls=source;
 const ideas=[1,2,3].map((rank)=>({
  rank,title:"Rates and funding risk - angle "+rank,format:rank===2?"COTD":"OB",
  hook:"Why lenders and investors disagree about the latest rate outlook",
  catalystTimeline:"An official scheduled policy date requires confirmation before any price attribution.",
  expectation:"Market expectations were not independently measured in this scheduled slate.",
  priceReaction:"UNKNOWN - 1D/3D/5D original completed-session closes require checks.",
  mechanism:"Higher financing costs may tighten credit availability if lenders reprice risk.",
  countercase:"Issuers could offset funding pressure with stronger cash flows or lower inflation.",
  nextTrigger:"Compare the next official Treasury observation with the dated policy release.",
  chartGuidance:["Inspect 4H EMA bands, but do not assert a breakout without actual data."],
  sourceUrls:urls,missingProof:"Original time-matched yields and a separately verified price reaction are missing.",
 }));
 const result=parseEditorialSlate({day_myt:"2026-10-27",produced_at:"2026-10-27T01:00:00Z",
  verification_status:"partial",ideas,sources:source,notes:"Three competing starting angles"},
  "2026-10-27T02:40:00Z");
 assert.ok(result);return result!;
}
test("private OB/COTD research PDF preserves source URLs and uncertainty, never masquerades as verified article",()=>{
 const pdf=renderPrivateEditorialSlatePdf(slate());
 const str=Buffer.from(pdf).toString("latin1");
 assert.ok(pdf.length>2500&&pdf.length<3145728);
 assert.ok(str.startsWith("%PDF-1.4"));
 assert.match(str,/\/Type \/Pages \/Count [4-9]/);
 assert.match(str,/%%EOF\s*$/);
 assert.match(str,/NOT FOR PUBLICATION/);
 assert.match(str,/UNKNOWN - 1D\/3D\/5D/);
 assert.match(read("lib/blue-desk-private-slate-pdf.ts"),/No plugin invocations are asserted/);
 assert.match(str,/\/Subtype \/Link/);
 assert.match(str,/federalreserve.gov/);
 assert.match(str,/home.treasury.gov/);
 assert.match(str,/Source and provenance manifest/);
});
test("multi-report schema preserves legacy daily rows, forbids browser reads and dedupes by type",()=>{
 const migration=read("supabase/migrations/20261027040000_private_report_kinds_and_receipts.sql");
 assert.ok(migration.includes("report_kind text not null default 'DAILY_MACRO'"));
 assert.ok(migration.includes("unique(report_day,slot,report_kind)"));
 assert.ok(migration.includes("revoke all privileges on table public.blue_desk_automated_reports from anon,authenticated"));
 assert.ok(migration.includes("source_receipts jsonb"));
 assert.ok(migration.includes("private-packs/(editorial-slate"));
 const daily=read("lib/blue-desk-automated-report-job.ts");
 assert.ok(daily.includes('.eq("report_kind","DAILY_MACRO")'));
 assert.ok(daily.includes('report_kind:"DAILY_MACRO"'));
 assert.ok(!daily.includes('status:"published"'));
});
test("Research Slate generation reads genuine durable task output and preserves canonical boundaries",()=>{
 const job=read("lib/blue-desk-private-slate-job.ts");
 const render=read("lib/blue-desk-private-slate-pdf.ts");
 assert.ok(job.includes("getLatestEditorialSlate()"));
 assert.ok(job.includes('report_kind:KIND'));
 assert.ok(job.includes("isAutomaticReportFinalisationWindow"));
 assert.ok(job.includes("isAutomaticReportFallbackWindow"));
 assert.ok(job.includes('status:"blocked"'));
 assert.ok(job.includes('status:"ready"'));
 assert.ok(job.includes('pluginCallsVerified:[]'));
 assert.ok(job.includes("slate?.dayMyt===day"));
 assert.ok(job.includes("url"));
 assert.ok(job.includes("source_receipts:[receipt]"));
 assert.ok(!job.includes("story_thesis_versions"));
 assert.ok(!render.includes("GoogleGenAI"));
 assert.ok(!render.includes("generateContent"));
});
test("second private PDF is delivered only through existing authorised jobs and file path",()=>{
 const morning=read("app/api/cron/research/morning-dossier/route.ts");
 const late=read("lib/blue-desk-automated-report-late-handoff.ts");
 const api=read("app/api/owner/automated-report-pdf/route.ts");
 const page=read("app/my-reports/page.tsx");
 const reader=read("components/blue-desk/OwnerEditorialSlatePdfReader.tsx");
 const host=read("lib/blue-desk-host.ts");
 const publicPdf=read("app/daily-report/pdf/route.ts");
 const cron=read("vercel.json");
 assert.ok(morning.includes('runPrivateEditorialSlatePdf(now)'));
 assert.ok(late.includes('runPrivateEditorialSlatePdf(now)'));
 assert.ok(!late.includes("isCompletedDossierForAutomaticReport"));
 assert.ok(late.includes("acceptsResearchAuthorization"));
 assert.ok(late.includes("runAutomatedDailyPdfReport"));
 assert.ok(late.includes("runPrivateEditorialSlatePdf"));
 assert.ok(!cron.includes("private-slate-job"));
 assert.ok(api.includes('data.report_kind==="COTD_OB_RESEARCH"'));
 assert.ok(api.includes("data.pdf_path!==exact"));
 assert.ok(api.includes("session.auth.getUser()"));
 assert.ok(api.includes("app_access_allowlist"));
 assert.ok(host.includes('"/api/owner/automated-report-pdf"'));
 assert.ok(publicPdf.includes("status:404"));
 assert.ok(page.includes("<OwnerEditorialSlatePdfReader/>"));
 assert.ok(reader.includes("session.auth.getUser()"));
 assert.ok(reader.includes("app_access_allowlist"));
 assert.ok(reader.includes('data-private-report-kind="COTD_OB_RESEARCH"'));
});
