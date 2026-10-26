import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assembleAutomaticReportEvidence,parseAutomatedReportNarrative,reportEvidenceReady,isAutomaticReportFinalisationWindow,isAutomaticReportFallbackWindow,isCompletedDossierForAutomaticReport}
 from "../lib/blue-desk-automated-report-contract.ts";
import {renderAutomatedReportPdf} from "../lib/blue-desk-automated-report-pdf.ts";


const now=new Date("2026-10-27T02:41:00Z");
function fixture(){
 const evidence=assembleAutomaticReportEvidence({now,slot:"morning",news:[
  {contractVersion:"news-brief/1" as const,contentType:"NEWS_BRIEF" as const,id:"a",
   headline:"Federal Reserve announces policy discussion",
   summary:"Federal Reserve confirms a policy statement and directs readers to the original communication.",
   sourceName:"Federal Reserve",sourceUrl:"https://www.federalreserve.gov/newsevents/pressreleases/monetary20261026a.htm",
   sourceKind:"official",occurredAt:"2026-10-26T18:00:00Z",observedAt:"2026-10-26T18:05:00Z",verification:"SOURCE_VERIFIED" as const},
 ],observations:[
  {id:"bc89e22b-a0e5-4e11-b421-67306b651719",kind:"MARKET_OBSERVATION" as const,
   description:"A source documented the latest daily Treasury rate observation with an exact session timestamp.",
   eventAt:"2026-10-26T20:00:00Z",recordedAt:"2026-10-26T20:04:00Z",
   sourceName:"Treasury",sourceUrl:"https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView",
   sourceTier:1},
 ],calendar:[{title:"FOMC meeting",when:"2026-10-28T18:00:00Z",sourceName:"Federal Reserve",
  sourceUrl:"https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
  question:"Will the new decision shift the expected borrowing-cost path?"}]});
 const refs=evidence.sources.filter(s=>s.type!=="CALENDAR").map(s=>s.id);
 const watches=evidence.sources.filter(s=>s.type==="CALENDAR").map(s=>s.id);
 const paragraph="The dated source records an observable development without establishing a direct market-price reaction. Investors should compare the underlying facts, financing costs and the next release before revising a directional view.";
 const story={headline:"Why the upcoming policy decision matters",setup:paragraph,reveal:paragraph,
  humanStake:paragraph,mechanism:paragraph,countercase:paragraph,nextTest:paragraph,sourceIds:refs};
 const narrative={title:"Rates and the financial decisions ahead",
  deck:"A source-grounded account of the economic mechanism and the market events that could change the assessment.",
  executiveSummary:paragraph,bigPicture:paragraph+paragraph,
  stories:[story,{...story,headline:"The trade-off in Treasury financing"}],
  crossMarket:[paragraph,paragraph,paragraph],
  watchlist:[{event:"FOMC meeting",when:"2026-10-28T18:00:00Z",question:paragraph,
   positiveCase:paragraph,negativeCase:paragraph,sourceIds:watches},
   {event:"Treasury follow-through",when:"2026-10-28T18:00:00Z",question:paragraph,
   positiveCase:paragraph,negativeCase:paragraph,sourceIds:refs}],
  concludingAssessment:paragraph,limitations:paragraph};
 return {evidence,narrative};
}
test("only existing final Dossier retry times can author an automatic edition",()=>{
 assert.equal(isAutomaticReportFinalisationWindow(new Date("2026-10-27T02:40:00Z"),"morning"),true);
 assert.equal(isAutomaticReportFinalisationWindow(new Date("2026-10-27T15:20:00Z"),"evening"),true);
 assert.equal(isAutomaticReportFinalisationWindow(new Date("2026-10-27T02:20:00Z"),"morning"),false);
 assert.equal(isAutomaticReportFinalisationWindow(new Date("2026-10-27T14:59:00Z"),"evening"),false);
});
test("only existing late Research Gap handoff calls provide Dossier-backed PDF retries",()=>{
 const utc=(when:string)=>new Date(when);
 assert.equal(isAutomaticReportFallbackWindow(utc("2026-10-27T03:30:00Z"),"morning"),true);
 assert.equal(isAutomaticReportFallbackWindow(utc("2026-10-27T03:45:00Z"),"morning"),true);
 assert.equal(isAutomaticReportFallbackWindow(utc("2026-10-27T03:56:00Z"),"morning"),false);
 assert.equal(isAutomaticReportFallbackWindow(utc("2026-10-27T02:40:00Z"),"morning"),false);
 assert.equal(isAutomaticReportFallbackWindow(utc("2026-10-27T15:30:00Z"),"evening"),true);
 assert.equal(isAutomaticReportFallbackWindow(utc("2026-10-27T15:45:00Z"),"evening"),true);
 assert.equal(isAutomaticReportFallbackWindow(utc("2026-10-27T16:00:00Z"),"evening"),false);
 assert.equal(isAutomaticReportFallbackWindow(utc("2026-10-27T15:45:00Z"),"morning"),false);
 const now=utc("2026-10-27T03:30:00Z");
 const run={id:"00000000-0000-4000-8000-000000000001",schedule_slot:"morning",
  status:"completed",scheduled_for:"2026-10-27T01:30:00Z",completed_at:"2026-10-27T02:46:41Z"};
 const slotRun={research_run_id:run.id,slot_key:"morning",status:"completed",
  health_state:"healthy",live_publication_status:"complete",hybrid_handoff_status:"complete",
  stage_summary:{evidence_gate_passed:true,required_sources_complete:true,accuracy_gate:"clear",
   postResearchDossier:{contractVersion:"post-research-dossier/1",state:"DONE",
    finishedAt:"2026-10-27T03:01:00Z"}}};
 assert.equal(isCompletedDossierForAutomaticReport(run,slotRun,"morning",now),true);
 assert.equal(isCompletedDossierForAutomaticReport(run,{...slotRun,stage_summary:{
  ...slotRun.stage_summary,postResearchDossier:{state:"RUNNING",contractVersion:"post-research-dossier/1"}}},"morning",now),false);
 assert.equal(isCompletedDossierForAutomaticReport(run,{...slotRun,stage_summary:{
  ...slotRun.stage_summary,evidence_gate_passed:false}},"morning",now),false);
 assert.equal(isCompletedDossierForAutomaticReport(run,{...slotRun,stage_summary:{
  ...slotRun.stage_summary,required_sources_complete:false}},"morning",now),false);
 assert.equal(isCompletedDossierForAutomaticReport(run,slotRun,"evening",now),false);
 assert.equal(isCompletedDossierForAutomaticReport({...run,completed_at:"2026-10-27T04:30:00Z"},slotRun,"morning",now),false);
 assert.equal(isCompletedDossierForAutomaticReport({...run,scheduled_for:"2026-10-26T21:30:00Z"},slotRun,"morning",now),false);
});
test("late PDF retry reuses authorised Research Gap cron without weakening public/private boundaries",()=>{
 const route=readFileSync(new URL("../app/api/cron/research-gap/handoff/route.ts",import.meta.url),"utf8");
 const retry=readFileSync(new URL("../lib/blue-desk-automated-report-late-handoff.ts",import.meta.url),"utf8");
 const job=readFileSync(new URL("../lib/blue-desk-automated-report-job.ts",import.meta.url),"utf8");
 const schedule=readFileSync(new URL("../vercel.json",import.meta.url),"utf8");
 assert.ok(route.includes("handleScheduledResearchGapHandoff(request)"));
 assert.ok(route.includes("attemptPrivateDailyPdfAfterLateDossier(request,slot,now)"));
 assert.ok(route.includes('payload.status!=="completed"'));
 assert.ok(retry.includes("acceptsResearchAuthorization"));
 assert.ok(retry.includes("isCompletedDossierForAutomaticReport"));
 assert.ok(retry.includes("runAutomatedDailyPdfReport(slot,now)"));
 assert.ok(job.includes("isAutomaticReportFallbackWindow(now,slot)"));
 assert.ok(job.includes('status:"ready"'));
 assert.ok(!job.includes('status:"published"'));
 assert.ok(schedule.includes('"/api/cron/research-gap/handoff"'));
 assert.ok(!schedule.includes("/api/cron/automatic-daily-pdf"));
});
test("source gate excludes creator or calendar-only claims, checks exact source ID joins",()=>{
 const {evidence,narrative}=fixture();
 assert.equal(reportEvidenceReady(evidence),true);
 assert.equal(evidence.sources.filter(s=>s.type!=="CALENDAR").length,2);
 assert.ok(parseAutomatedReportNarrative(narrative,evidence));
 assert.equal(parseAutomatedReportNarrative({...narrative,
  stories:[{...narrative.stories[0],sourceIds:["unverified-social"]},narrative.stories[1]]},evidence),null);
 assert.equal(parseAutomatedReportNarrative({...narrative,
  stories:[{...narrative.stories[0],reveal:"The latest oil price surged to $98765 without a source record. ".repeat(3)},narrative.stories[1]]},evidence),null);
 assert.equal(reportEvidenceReady({...evidence,sources:evidence.sources.filter(s=>s.type==="CALENDAR")}),false);
});
test("market-data-led briefing admits only dated provider values and explicitly flags missing verified news",()=>{
 const monitored=["US 10Y yield","S&P 500","WTI oil","USD index"].map((label,i)=>({
  label,level:100+i,previousClose:99+i,asOf:"2026-10-26T20:00:00Z",
  sourceName:"Primary market-data provider",
  sourceUrl:"https://fred.stlouisfed.org/series/TEST"+i,
  frequency:"daily",
 }));
 const evidence=assembleAutomaticReportEvidence({now,slot:"morning",news:[],observations:[],
  market:monitored,
  calendar:[{title:"Upcoming FOMC meeting",when:"2026-10-28T18:00:00Z",
   sourceName:"Federal Reserve",sourceUrl:"https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
   question:"How will the decision affect financing costs?"}]});
 assert.equal(reportEvidenceReady(evidence),true);
 assert.match(evidence.coverageNote,/NEWS COVERAGE GAP/);
 assert.equal(evidence.sources.filter(s=>s.type==="OBSERVATION").length,4);
 assert.equal(reportEvidenceReady({...evidence,sources:evidence.sources.filter(s=>s.type!=="CALENDAR")}),false);
 const stale=assembleAutomaticReportEvidence({now,slot:"morning",news:[],observations:[],
  market:monitored.map(v=>({...v,asOf:"2026-10-01T20:00:00Z"})),
  calendar:[]});
 assert.equal(reportEvidenceReady(stale),false);
});
test("client-ready report is valid, paginated PDF with evidence ledger and page count",()=>{
 const {evidence,narrative}=fixture();
 const parsed=parseAutomatedReportNarrative(narrative,evidence);
 assert.ok(parsed);
 const pdf=renderAutomatedReportPdf(evidence,parsed!);
 const s=Buffer.from(pdf).toString("latin1");
 assert.ok(s.startsWith("%PDF-1.4"));
 assert.match(s,/\/Type \/Catalog/);
 assert.match(s,/\/Type \/Pages \/Count [2-9]/);
 assert.match(s,/%%EOF\s*$/);
 assert.match(s,/The setup/);
 assert.match(s,/Source ledger/);
 assert.match(s,/\/Subtype \/Link/);
 assert.ok(pdf.length>3000&&pdf.length<3145728);
});
test("automatic PDF editions are private with owner session, allowlist and no public reader",()=>{
 const read=(name:string)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
 const ownerPdf=read("app/api/owner/automated-report-pdf/route.ts");
 const publicPdf=read("app/daily-report/pdf/route.ts");
 const publicPage=read("app/blue-desk/daily-report/page.tsx");
 const ownerPage=read("app/owner/daily-report/page.tsx");
 const ownerComponent=read("components/blue-desk/OwnerAutomaticReportReader.tsx");
 const host=read("lib/blue-desk-host.ts");
 const privateReader=read("lib/blue-desk-automated-report-reader.ts");
 const migration=read("supabase/migrations/20261027013000_automated_daily_pdf_reports.sql");
 assert.ok(ownerPdf.includes("session.auth.getUser()"));
 assert.ok(ownerPdf.includes("app_access_allowlist"));
 assert.ok(ownerPdf.includes('blueDeskHostAccess("/api/owner/automated-report-pdf"'));
 assert.ok(ownerPdf.includes("data.pdf_path!==exact"));
 assert.ok(ownerPdf.includes('.eq("status","ready")'));
 assert.ok(ownerPdf.includes("private, no-store"));
 assert.ok(ownerPdf.includes("validPublicationId"));
 assert.ok(publicPdf.includes("status:404"));
 assert.ok(!host.includes('pathname === "/daily-report/pdf"'));
 assert.ok(!publicPage.includes("getAutomaticDailyReports"));
 assert.ok(!publicPage.includes("data-automated-pdf-editions"));
 assert.ok(!publicPage.includes("/daily-report/pdf?edition"));
 assert.ok(ownerPage.includes("<OwnerAutomaticReportReader/>"));
 assert.ok(ownerComponent.includes("session.auth.getUser()"));
 assert.ok(ownerComponent.includes("app_access_allowlist"));
 assert.ok(ownerComponent.includes("/api/owner/automated-report-pdf"));
 assert.ok(privateReader.includes("createSupabaseAdminClient"));
 assert.ok(!privateReader.includes("getSupabasePublicConfig"));
 assert.ok(migration.includes("enable row level security"));
 assert.ok(migration.includes("revoke all on public.blue_desk_automated_reports from anon,authenticated"));
 assert.ok(!migration.includes("grant select ("));
 assert.ok(migration.includes("'building','ready','blocked','failed'"));
 const morning=read("app/api/cron/research/morning-dossier/route.ts");
 assert.ok(morning.includes("handleScheduledPostResearchDossier"));
 assert.ok(morning.includes("runAutomatedDailyPdfReport"));
 const job=read("lib/blue-desk-automated-report-job.ts");
 assert.ok(job.includes('status:"ready"'));
 assert.ok(!job.includes('status:"published"'));
});

test("source-gate refusals retain owner-only attempt receipts without manufacturing PDFs",()=>{
 const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
 const job=read("lib/blue-desk-automated-report-job.ts");
 const reader=read("lib/blue-desk-automated-report-reader.ts");
 const owner=read("components/blue-desk/OwnerAutomaticReportReader.tsx");
 const publicPage=read("app/blue-desk/daily-report/page.tsx");
 const migration=read("supabase/migrations/20261027013000_automated_daily_pdf_reports.sql");
 assert.ok(job.includes('noteWithheldEdition(db,reportDay,slot,now'));
 assert.ok(job.includes('status:"blocked"'));
 assert.ok(job.includes('error.code!=="23505"'));
 assert.ok(job.includes('if(!reportEvidenceReady(evidence))'));
 assert.ok(reader.includes("getOwnerLatestDailyPdfAttempt"));
 assert.ok(reader.includes("createSupabaseAdminClient"));
 assert.ok(owner.includes("getOwnerLatestDailyPdfAttempt"));
 assert.ok(owner.includes('data-owner-automatic-pdf-attempt="private"'));
 assert.ok(owner.includes("session.auth.getUser()"));
 assert.ok(owner.includes("app_access_allowlist"));
 assert.ok(!publicPage.includes("getOwnerLatestDailyPdfAttempt"));
 assert.ok(migration.includes("unique(report_day,slot)"));
 assert.ok(migration.includes("revoke all on public.blue_desk_automated_reports from anon,authenticated"));
});
