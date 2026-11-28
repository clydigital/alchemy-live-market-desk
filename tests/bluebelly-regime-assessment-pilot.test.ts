import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {selectPilotLensAssessment} from "../lib/bluebelly-regime-assessment-pilot.ts";
import type {InvestorAssessmentRead, InvestorLensReview} from "../lib/bluebelly-investor-assessment.ts";
const review:InvestorLensReview={status:"RESEARCHED",asOf:"2026-11-24T15:05:00Z",sourceThrough:"2026-11-23T21:00:00Z",interpretation:"Evidence supports a conditional investor explanation.",previousInterpretation:"Prior private text must not leak into this card.",nextTest:"Check cash conversion and financing."};
const read=(reviews:InvestorAssessmentRead["lensReviews"]):InvestorAssessmentRead=>({status:"DEGRADED",asOf:review.asOf,headline:null,whatWouldChangeMind:null,rows:{},lensReviews:reviews});
test("pilot uses qualified individual reviews without converting them to a directional score",()=>{
 const result=selectPilotLensAssessment("ai",read({chips:review,rates:{...review,status:"UNRESOLVED"}}));
 assert.equal(result?.state,"CURRENT");
 assert.equal(result?.interpretation,review.interpretation);
 assert.equal(result?.sourceThrough,review.sourceThrough);
 assert.equal(result?.nextTest,review.nextTest);
 assert.equal("outlook" in result!,false);
 assert.equal("previousInterpretation" in result!,false);
 assert.equal(selectPilotLensAssessment("bonds",read({rates:{...review,status:"UNRESOLVED"}}))?.state,"PENDING");
 assert.equal(selectPilotLensAssessment("fed",read({rates:review})),null);
});
test("stale and missing evidence preserve the historical baseline instead of posing as current",()=>{
 for(const r of [{...review,status:"STALE" as const},{...review,sourceThrough:null},{...review,status:"UNRESOLVED" as const}]){
  const result=selectPilotLensAssessment("bonds",read({rates:r}));
  assert.notEqual(result?.state,"CURRENT");
  assert.equal(result?.interpretation,null);
  assert.equal(result?.nextTest,null);
 }
 assert.equal(selectPilotLensAssessment("bonds",read({}))?.state,"PENDING");
});
test("overview and detail use current research reconciliation rather than the manual Dossier pilot",()=>{
 for(const path of ["app/blue-desk/regime-watch/page.tsx","app/blue-desk/regime-watch/[lensId]/page.tsx"]){
  const source=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  assert.match(source,/projectLensReconciliation/);
  assert.doesNotMatch(source,/projectInvestorAssessment|selectPilotLensAssessment|getDossierV2PresentationSelection/);
  assert.match(source,/getLensOutlook/);
  assert.doesNotMatch(source,/\.upsert\(|\.insert\(/);
 }
});
