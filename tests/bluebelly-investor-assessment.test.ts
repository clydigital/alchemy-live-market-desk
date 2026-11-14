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
 assert.equal(out.status,"RESEARCHED");
 assert.equal(out.asOf,"2026-11-14T02:30:00Z");
 assert.match(out.rows.rates||"",/cash is more attractive/);
 assert.match(out.rows.chips||"",/real chip orders/);
 assert.equal(out.rows.breadth,undefined);
 assert.equal(out.rows.catalyst,undefined);
 assert.match(out.whatWouldChangeMind||"",/credit deterioration/);
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
