import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const src=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("both pre-existing private Dossier crons log only gate booleans and status, not PDF bytes or secret",()=>{
 const entries=[
  ["app/api/cron/research/morning-dossier/route.ts","morning"],
  ["app/api/cron/research/evening-dossier/route.ts","evening"],
 ] as const;
 for(const [path,slot] of entries){
  const s=src(path);
  assert.match(s,/isAutomaticReportFinalisationWindow\(now,/);
  assert.match(s,/const scheduleEnabled=process\.env\.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED==="true"/);
  assert.match(s,/const reportEligible=authorised && scheduleEnabled && reportWindow/);
  assert.match(s,/if\(reportWindow\)\{/);
  assert.match(s,/event:"bluebelly_pdf_cron_gate"/);
  assert.match(s,/event:"bluebelly_pdf_cron_outcome"/);
  assert.match(s,/const reportEligible=authorised && scheduleEnabled && reportWindow/);
  assert.match(s,/JSON\.stringify\(\{event:"bluebelly_pdf_cron_gate",slot:"/);
  assert.match(s,/asOf:now\.toISOString\(\),authorised,scheduleEnabled,reportEligible/);
  assert.match(s,/const result=await handleScheduledPostResearchDossier/);
  assert.ok(s.indexOf('event:"bluebelly_pdf_cron_gate"')<s.indexOf("await handleScheduledPostResearchDossier"));
  assert.ok(s.includes('slot:"'+slot+'"'));
  const logSnippets=s.split("\n").filter(x=>x.includes('event:"bluebelly_pdf_cron')||x.includes("marketPdfReason")||x.includes("slatePdfReason")||x.includes("asOf:now.toISOString()")).join("\n");
  assert.doesNotMatch(logSnippets,/CRON_SECRET|GEMINI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|pdf_path|sourceUrls|pdf_sha256/);
 }
});
test("reports remain independent of canonical Dossier completion, and schedule is not changed",()=>{
 const m=src("app/api/cron/research/morning-dossier/route.ts");
 const e=src("app/api/cron/research/evening-dossier/route.ts");
 const json=src("vercel.json");
 assert.match(m,/runPrivateEditorialSlatePdf\(now\)/);
 assert.match(m,/runAutomatedDailyPdfReport\("morning",now\)/);
 assert.match(e,/runAutomatedDailyPdfReport\("evening",now\)/);
 assert.ok(m.indexOf("const reports=reportEligible")<m.indexOf("await handleScheduledPostResearchDossier"));
 assert.ok(e.indexOf("const reportTask=reportEligible")<e.indexOf("await handleScheduledPostResearchDossier"));
 assert.match(json,/"\/api\/cron\/research\/morning-dossier"/);
 assert.match(json,/"\/api\/cron\/research\/evening-dossier"/);
 assert.doesNotMatch(json,/bluebelly-pdf-cron-gate/);
});
