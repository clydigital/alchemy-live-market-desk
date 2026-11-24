import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("Regime Watch, AI/breadth lenses consume the same Compare research projection as daily research",()=>{
 for(const path of ["app/blue-desk/regime-watch/page.tsx","app/blue-desk/regime-watch/[lensId]/page.tsx","app/api/owner/daily-research/route.ts"]){
  const source=readFileSync(path,"utf8");
  assert.match(source,/const compare=buildCompareResearch\(/);
  assert.match(source,/compareBreadthObservations\(breadthFeed.series|compareBreadthObservations\(breadthSource.series/);
  assert.match(source,/getSourceDatedBreadth\(true\)/);
 }
 const evidence=readFileSync("components/blue-desk/RegimeCompareEvidence.tsx","utf8");
 assert.match(evidence,/five.coverage>=8/);
 assert.match(evidence,/affinity.count/);
 assert.match(evidence,/affinity.coverage/);
 assert.match(evidence,/provisional/);
 assert.match(evidence,/not a causal explanation or an automatic regime classification/);
});
