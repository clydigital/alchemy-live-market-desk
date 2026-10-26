import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {MONITOR_SPECS,createDefaultPresenterChecklist} from "../lib/presenter-technical-checks.ts";
import {reconcilePresenterObservations,PRESENTER_RECONCILIATION_CONTRACT}
  from "../lib/presenter-technical-reconciliation.ts";
import type {DossierPresentationSelection} from "../lib/dossier-v2/presentation-reader.ts";
import {blueDeskHostAccess,blueDeskPresentationTarget} from "../lib/blue-desk-host.ts";

const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const DOSSIER="00000000-0000-4000-8000-000000000001";
const EVIDENCE="00000000-0000-4000-8000-000000000002";
const AS_OF="2026-01-03T00:00:00Z";
function selection(mutate:(row:Record<string,unknown>)=>void=()=>{}):DossierPresentationSelection{
 const value:Record<string,unknown>={
  status:"current",selectedDossierId:DOSSIER,selectedAsOf:AS_OF,
  presentation:{
   dossierId:DOSSIER,asOf:AS_OF,health:{degraded:false},
   regimeStrip:[{key:"USD",observed:true,reaction:"A hypothetical macro regime",
    interpretation:"This does not verify an EMA-band break",evidenceRefs:[EVIDENCE]}],
  },
 };
 mutate(value);
 return value as unknown as DossierPresentationSelection;
}
test("all 14 keys reuse the existing owner contract, no duplicate monitor list",()=>{
 const rows=reconcilePresenterObservations(null,null,"2026-01-04T12:00:00Z").rows;
 assert.equal(rows.length,14);
 assert.deepEqual(rows.map(row=>row.key),MONITOR_SPECS.map(spec=>spec.key));
 assert.ok(rows.every(row=>row.verdict==="UNAVAILABLE" && row.ownerReading===null));
});
test("manual alignment cannot become independently verified market agreement",()=>{
 const checks=createDefaultPresenterChecklist().checks;
 checks[0]={...checks[0],technical:"Upper-band break",observedOn:"2026-01-03",
  updatedAt:"2026-01-03T09:00:00Z",alignment:"aligned",fundamentals:"Demo only"};
 const projected=reconcilePresenterObservations(checks,selection(),"2026-01-04T12:00:00Z");
 const dollar=projected.rows.find(row=>row.key==="dxy-4h")!;
 assert.equal(projected.contractVersion,PRESENTER_RECONCILIATION_CONTRACT);
 assert.equal(dollar.ownerAlignment,"aligned");
 assert.equal(dollar.observationState,"SAVED");
 assert.equal(dollar.contextState,"SOURCE_LINKED_CONTEXT");
 assert.deepEqual(dollar.canonicalEvidenceIds,[EVIDENCE]);
 assert.equal(dollar.dossierId,DOSSIER);
 assert.equal(dollar.verdict,"UNAVAILABLE");
 assert.match(dollar.verdictReason,/not independent verification/i);
 assert.doesNotMatch(dollar.presenterTalkingPoint,/canonical agreement established/i);
});
test("missing, degraded, invalid and future Dossier selections fail closed",()=>{
 const checks=createDefaultPresenterChecklist().checks;
 const cases=[
  null,
  selection(v=>{v.selectedDossierId="00000000-0000-4000-8000-000000000005";}),
  selection(v=>{(v.presentation as any).health.degraded=true;}),
  selection(v=>{(v.presentation as any).asOf="2027-01-01T00:00:00Z";v.selectedAsOf="2027-01-01T00:00:00Z";}),
 ];
 for(const context of cases){
  const rows=reconcilePresenterObservations(checks,context,"2026-01-04T12:00:00Z").rows;
  assert.ok(rows.every(row=>row.verdict==="UNAVAILABLE"&&row.canonicalEvidenceIds.length===0));
 }
});
test("stale or unsaved notes remain independently unavailable",()=>{
 const checks=createDefaultPresenterChecklist().checks;
 checks[0]={...checks[0],technical:"Holding uptrend",observedOn:"2025-12-01",
  updatedAt:"2025-12-02T00:00:00Z"};
 const rows=reconcilePresenterObservations(checks,selection(),"2026-01-04T12:00:00Z").rows;
 assert.equal(rows[0].observationState,"STALE");
 assert.equal(rows[1].observationState,"NOT_SAVED");
 assert.equal(rows[1].ownerReading,null);
 assert.equal(rows[0].verdict,"UNAVAILABLE");
});
test("public no-login presenter preview extends existing isolated editorial lab only",()=>{
 const host="bluebelly-desk.vercel.app";
 assert.equal(blueDeskHostAccess("/editorial-lab",host),"public");
 assert.equal(blueDeskPresentationTarget("/editorial-lab",host),"/blue-desk/editorial-lab");
 for(const path of ["/owner/presenter","/owner/editorial","/api/presenter/technical-checks",
  "/api/owner/editorial-generate","/blue-desk/presenter"]){
  assert.notEqual(blueDeskHostAccess(path,host),"public");
 }
 const page=read("app/blue-desk/editorial-lab/page.tsx");
 const panel=read("components/blue-desk/PresenterLabChecks.tsx");
 const adapter=read("lib/presenter-technical-reconciliation.ts");
 assert.match(page,/params\.view==="presenter"/);
 assert.match(page,/previewMode/);
 assert.match(page,/<PresenterLabChecks\/>/);
 assert.match(page,/mode=\{presenter\?"presenter":"editorial"\}/);
 assert.match(panel,/data-presenter-lab-checks="synthetic-only"/);
 assert.match(panel,/reconcilePresenterObservations\(checks,null,/);
 assert.doesNotMatch(panel,/fetch\(|createSupabase|process\.env|localStorage|\/api\//);
 assert.doesNotMatch(page,/getMarketMonitor|getLatestEditorialSlate|createSupabase|process\.env/);
 assert.doesNotMatch(adapter,/\.insert\(|\.update\(|\.upsert\(|story_thesis_versions|createSupabase/);
});
