import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assembleAutomaticReportEvidence,parseAutomatedReportNarrative,reportEvidenceReady}
 from "../lib/blue-desk-automated-report-contract.ts";
import {renderAutomatedReportPdf} from "../lib/blue-desk-automated-report-pdf.ts";
import {isAutomaticReportFinalisationWindow}
 from "../lib/blue-desk-automated-report-job.ts";

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
test("public PDF reader never accepts a storage path, only an exact published edition id",()=>{
 const reader=readFileSync(new URL("../app/daily-report/pdf/route.ts",import.meta.url),"utf8");
 const host=readFileSync(new URL("../lib/blue-desk-host.ts",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../app/blue-desk/daily-report/page.tsx",import.meta.url),"utf8");
 const am=readFileSync(new URL("../supabase/migrations/20261027013000_automated_daily_pdf_reports.sql",import.meta.url),"utf8");
 assert.match(reader,/validPublicationId/);
 assert.match(reader,/status","published"/);
 assert.match(reader,/data\.pdf_path!==exact/);
 assert.match(reader,/isBlueDeskPublicReaderHost/);
 assert.match(host,/pathname === "\/daily-report\/pdf"/);
 assert.match(ui,/data-automated-pdf-editions="source-gated"/);
 assert.match(ui,/<iframe/);
 assert.match(am,/enable row level security/);
 assert.match(am,/using \(status='published'\)/);
 assert.doesNotMatch(am,/grant (insert|update|delete).* to anon/i);
 const morning=readFileSync(new URL("../app/api/cron/research/morning-dossier/route.ts",import.meta.url),"utf8");
 assert.match(morning,/handleScheduledPostResearchDossier/);
 assert.match(morning,/runAutomatedDailyPdfReport/);
 assert.doesNotMatch(morning,/\.insert\(\{.*story_thesis_versions/);
});
