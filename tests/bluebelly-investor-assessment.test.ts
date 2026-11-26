import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {projectInvestorAssessment} from "../lib/bluebelly-investor-assessment.ts";
import type {DossierPresentationSelection} from "../lib/dossier-v2/presentation-reader.ts";

const now=new Date("2026-11-14T04:00:00Z");
function selection(overrides:Record<string,unknown>={}):DossierPresentationSelection{
 return {
  status:"current",selectedDossierId:"dossier-one",
  latestDossierId:"dossier-one",selectedAsOf:"2026-11-14T02:30:00Z",
  presentation:{
   health:{degraded:false},
   evidenceGovernance:{items:["rate-1","chip-1"].map(evidenceId=>({evidenceId,temporalState:"ACTIVE",independentLineageCount:1,occurrenceTime:"2026-11-13T21:00:00Z",availableAt:"2026-11-13T21:01:00Z",publishedAt:[]})),conflictGroups:[]},
   header:{
    epistemicLabel:"SUPPORTED",headline:"Rates have risen while chip stocks hold up",
    whatWouldChangeMind:"Broad credit deterioration would challenge this interpretation."
   },
   regimeStrip:[
    {key:"US_RATES",observed:true,evidenceRefs:["rate-1"],interpretation:
     "One explanation is that cash is more attractive; falling inflation expectations could reverse that preference."},
    {key:"TECH_AI",observed:true,evidenceRefs:["chip-1"],interpretation:
     "Investors may be separating real chip orders from valuation risks in the wider AI supply chain."},
    {key:"BREADTH",observed:false,evidenceRefs:[],interpretation:
     "Investors are buying every stock with unlimited confidence."},
   ],
  },
  ...overrides,
 } as unknown as DossierPresentationSelection;
}
test("only current, fresh, supported Dossier observations appear as inferred investor motives",()=>{
 const out=projectInvestorAssessment(selection(),now);
 assert.equal(out.status,"PARTIAL");
 assert.equal(out.asOf,"2026-11-14T02:30:00Z");
 assert.match(out.rows.rates||"",/cash is more attractive/);
 assert.match(out.rows.chips||"",/real chip orders/);
 assert.equal(out.rows.breadth,undefined);
 assert.equal(out.rows.catalyst,undefined);
 assert.equal(out.whatWouldChangeMind,null);
 assert.match(out.statusDetail||"",/Unqualified core lenses/);
});
test("no stale, degraded, historical or unselected reasoning is recycled as current",()=>{
 for(const bad of [
  {selectedAsOf:"2026-11-10T02:30:00Z"},
  {status:"degraded_latest",presentation:{health:{degraded:true},regimeStrip:[],header:{}}},
  {usingFallback:true},
  {selectedDossierId:"different"},
  {selectedAsOf:"2026-11-15T02:00:00Z"},
 ]){
  const out=projectInvestorAssessment(selection(bad),now);
  assert.notEqual(out.status,"RESEARCHED");
  assert.deepEqual(out.rows,{});
 }
 assert.equal(projectInvestorAssessment(null,now).status,"UNAVAILABLE");
});
test("a rate-data coverage gap does not suppress a qualified independent chip lens",()=>{
 const input=selection();
 input.status="degraded_latest";
 input.presentation!.health.degraded=true;
 input.presentation!.health.executionDegraded=false;
 input.presentation!.health.researchGaps=[{id:"gap:move",category:"MARKET_DATA",severity:"MATERIAL",description:"MOVE data missing"}];
 input.presentation!.evidenceGovernance!.items[0].temporalState="SUPERSEDED";
 const out=projectInvestorAssessment(input,now);
 assert.equal(out.status,"PARTIAL");
 assert.match(out.statusDetail||"",/MOVE data missing/);
 assert.equal(out.lensReviews.rates?.status,"UNRESOLVED");
 assert.equal(out.lensReviews.chips?.status,"RESEARCHED");
 assert.match(out.rows.chips||"",/real chip orders/);
});
test("a new assessment timestamp does not refresh stale underlying source dates",()=>{
 const input=selection();
 input.presentation!.evidenceGovernance!.items[0].occurrenceTime="2026-10-01T21:00:00Z";
 assert.equal(projectInvestorAssessment(input,now).lensReviews.rates?.status,"UNRESOLVED");
});
test("a deterministic edition refresh cannot advance the actual reasoning clock",()=>{
 const input=selection();
 input.presentation!.investorReviewedAt="2026-11-12T02:30:00Z";
 const out=projectInvestorAssessment(input,now);
 assert.equal(out.status,"STALE");
 assert.equal(out.asOf,"2026-11-12T02:30:00Z");
 assert.deepEqual(out.rows,{});
});
test("Tino-style game-theory questions reuse canonical research brain and existing manual action",()=>{
 const prompt=readFileSync(new URL("../lib/dossier-v2/research-brain-prompt.ts",import.meta.url),"utf8");
 const handoff=readFileSync(new URL("../lib/dossier-post-research-trigger.ts",import.meta.url),"utf8");
 const workflow=readFileSync(new URL("../.github/workflows/run-live-research.yml",import.meta.url),"utf8");
 const home=readFileSync(new URL("../app/blue-desk/page.tsx",import.meta.url),"utf8");
 assert.match(prompt,/INVESTOR MINDSET \/ GAME THEORY/);
 assert.match(prompt,/buy, sell, hold cash or rotate/);
 assert.match(handoff,/source_only_contract === "BLUEBELLY_SOURCE_ONLY_V1"/);
 assert.match(workflow,/dossier_v2_persist/);
 assert.match(home,/publicHost\?getDossierV2PresentationSelection/);
 assert.doesNotMatch(home,/runManualDossierV2|\.upsert\(|\.insert\(/);
});

test("execution failure with otherwise qualified receipts withholds all interpretations",()=>{
 const input=selection();
 input.presentation!.health.executionDegraded=true;
 const out=projectInvestorAssessment(input,now);
 assert.equal(out.status,"DEGRADED");
 assert.deepEqual(out.rows,{});
 assert.equal(out.lensReviews.chips?.status,"UNRESOLVED");
});
test("all core lenses independently qualified yields reviewed status",()=>{
 const input=selection();
 const p=input.presentation!;
 p.regimeStrip=p.regimeStrip.map(lens=>lens.key==="BREADTH"?{...lens,observed:true,evidenceRefs:["rate-1"]}:lens);
 p.regimeStrip.push({...p.regimeStrip[0],key:"OIL_WAR_INFLATION"});
 const out=projectInvestorAssessment(input,now);
 assert.equal(out.status,"RESEARCHED");
 assert.equal(Object.keys(out.rows).length,4);
 assert.match(out.whatWouldChangeMind||"",/credit deterioration/);
});
test("stale review takes precedence over incomplete coverage",()=>{
 const input=selection();
 input.status="degraded_latest";
 input.presentation!.health.degraded=true;
 input.presentation!.health.executionDegraded=false;
 input.presentation!.investorReviewedAt="2026-11-12T02:30:00Z";
 const out=projectInvestorAssessment(input,now);
 assert.equal(out.status,"STALE");
 assert.deepEqual(out.rows,{});
});
