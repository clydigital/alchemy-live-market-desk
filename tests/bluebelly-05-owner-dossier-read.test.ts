import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectPresenterDossierSelection,reconcilePresenterObservations}
  from "../lib/presenter-technical-reconciliation.ts";
import {createDefaultPresenterChecklist} from "../lib/presenter-technical-checks.ts";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";
import type {DossierPresentationSelection} from "../lib/dossier-v2/presentation-reader.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const ID="00000000-0000-4000-8000-000000000001";
const EVIDENCE="00000000-0000-4000-8000-000000000002";
function selection():DossierPresentationSelection {
  return {
    status:"current",selectedDossierId:ID,selectedAsOf:"2026-10-27T01:00:00Z",
    presentation:{
      dossierId:ID,asOf:"2026-10-27T01:00:00Z",
      health:{degraded:false},
      regimeStrip:[{key:"USD",observed:true,reaction:"USD strengthened after a release",
        interpretation:"Macro context only",evidenceRefs:[EVIDENCE]}],
      header:{headline:"SHOULD NEVER BE SENT TO CLIENT"},
      privateSourceField:"SHOULD NEVER BE SENT TO CLIENT",
    },
  } as unknown as DossierPresentationSelection;
}
test("server trims selection to required immutable identity and macro Regime lens fields",()=>{
  const projected=projectPresenterDossierSelection(selection())!;
  const json=JSON.stringify(projected);
  assert.equal(projected.presentation!.dossierId,ID);
  assert.equal(projected.presentation!.regimeStrip[0].evidenceRefs[0],EVIDENCE);
  assert.doesNotMatch(json,/SHOULD NEVER BE SENT TO CLIENT/);
  assert.equal(projected.status,"current");
});
test("cloud-dated owner technical note projects alongside Dossier source context without agreement inference",()=>{
  const items=createDefaultPresenterChecklist().checks;
  items[0]={...items[0],technical:"Upper-band break",observedOn:"2026-10-27",
    updatedAt:"2026-10-27T01:30:00Z",alignment:"aligned"};
  const rows=reconcilePresenterObservations(items,projectPresenterDossierSelection(selection()),
    "2026-10-27T02:00:00Z").rows;
  const row=rows[0];
  assert.equal(row.ownerReading,"Upper-band break");
  assert.equal(row.dossierAsOf,"2026-10-27T01:00:00Z");
  assert.deepEqual(row.canonicalEvidenceIds,[EVIDENCE]);
  assert.equal(row.contextState,"SOURCE_LINKED_CONTEXT");
  assert.equal(row.verdict,"UNAVAILABLE");
  assert.equal(row.ownerAlignment,"aligned");
  assert.match(row.confirmOrInvalidate,/completed DXY 4H EMA20/);
  assert.equal(rows.length,14);
});
test("owner integration fails closed and cannot expose routes to unauthenticated public Bluebelly",()=>{
 const page=read("app/owner/presenter/page.tsx");
 const component=read("components/live-desk/PresenterTechnicalChecks.tsx");
 const adapter=read("lib/presenter-technical-reconciliation.ts");
 const middleware=read("middleware.ts");
 assert.match(page,/redirect\("\/my-reports"\)/);
 assert.doesNotMatch(page,/getDossierV2PresentationSelection|PresenterTechnicalChecks/);
 assert.match(component,/cloudMode === "ready" \? data\.checks : null/);
 assert.match(component,/data-dossier-reconciliation="read-only"/);
 assert.match(component,/All 14 instrument-level verdicts remain UNAVAILABLE/);
 assert.doesNotMatch(component,/\/api\/dossier\//);
 assert.doesNotMatch(adapter,/story_thesis_versions|\.insert\(|\.update\(|\.upsert\(/);
 assert.match(middleware,/app_access_allowlist/);
 assert.equal(blueDeskHostAccess("/owner/presenter","bluebelly-desk.vercel.app"),"private");
 assert.notEqual(blueDeskHostAccess("/api/dossier-v2","bluebelly-desk.vercel.app"),"public");
});
