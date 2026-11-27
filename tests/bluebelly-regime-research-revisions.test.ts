import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {REGIME_RESEARCH_REVISIONS,getRegimeResearchRevisions} from "../lib/bluebelly-regime-research-revisions.ts";
import {REGIME_LENS_WORKBOOKS} from "../lib/bluebelly-regime-lens-workbook.ts";

test("dated cross-lens research is scoped, sourced, conditional and expires",()=>{
 const now=new Date("2026-11-17T19:30:00Z");
 const all=getRegimeResearchRevisions(now);
 assert.equal(all.length,8);
 assert.equal(new Set(all.map(x=>x.read.id)).size,all.length);
 for(const {read,ideas} of all){
  assert.equal(read.freshness,"current",read.id);
  assert.equal(read.authority,"SOURCE_REVIEWED_PROVISIONAL");
  assert.ok(read.sources.length&&read.countercase&&read.nextTest&&ideas);
 }
 const energy=getRegimeResearchRevisions(now,"energy");
 assert.deepEqual(energy.map(x=>x.read.id),["crude-glut","refined-products","china-demand","ai-power"]);
 assert.equal(energy[0].read.verdict,"improving");
 assert.equal(energy[1].read.verdict,"mixed");
 assert.equal(all.find(x=>x.read.id==="ai-earnings-gate")?.read.verdict,"insufficient");
 assert.match(all.find(x=>x.read.id==="cyber-resilience")!.read.countercase,/unified attack/);
 assert.match(all.find(x=>x.read.id==="china-demand")!.read.why,/1\.52m b\/d/);
 assert.equal(getRegimeResearchRevisions(now,"housing").length,0);
 assert.ok(getRegimeResearchRevisions(new Date("2026-11-25")).every(x=>x.read.freshness==="stale"&&x.read.verdict==="insufficient"));
 assert.ok(getRegimeResearchRevisions(new Date("2026-11-16")).every(x=>x.read.freshness==="unavailable"));
 assert.ok(REGIME_RESEARCH_REVISIONS.every(x=>x.record.revisions[0].sources.every(s=>s.url.startsWith("https://"))));
});
test("existing research fanout picks up new evidence and both lens views show review context",()=>{
 for(const term of ["Anthropic","Quaise","Optimizely"])assert.match(term,REGIME_LENS_WORKBOOKS.ai.sourcePattern);
 for(const term of ["urea","geothermal","Western Canada Select"])assert.match(term,REGIME_LENS_WORKBOOKS.energy.sourcePattern);
 const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
 const overview=read("app/blue-desk/regime-watch/page.tsx"),detail=read("app/blue-desk/regime-watch/[lensId]/page.tsx");
 assert.match(overview,/getRegimeResearchRevisions\(now,lens.id\)/);
 assert.match(detail,/getRegimeResearchRevisions\(now,lens.id\)/);
 assert.match(detail,/QuestionVerdictCard read=\{read\}/);
 assert.match(detail,/Historical watch ideas/);
});

test("27 November reviews cover all nine lenses with dated sources and preserve older snapshots",()=>{
 const now=new Date("2026-11-27T07:34:00Z");
 const fresh=getRegimeResearchRevisions(now).filter(x=>x.read.reviewedOn==="2026-11-27");
 assert.equal(fresh.length,10);
 assert.equal(new Set(fresh.flatMap(x=>x.lenses)).size,9);
 for(const {read} of fresh){
  assert.equal(read.freshness,"current",read.id);
  assert.ok(read.sources.length&&read.countercase&&read.nextTest);
  assert.ok(read.sourceThrough&&read.sourceThrough<=read.reviewedOn!);
 }
 assert.equal(getRegimeResearchRevisions(new Date("2026-11-26T23:59:00Z")).length,8);
});
