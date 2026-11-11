import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getRegimeManualChallenge} from "../lib/bluebelly-regime-manual-challenges.ts";

test("only the four relevant research lenses carry a source-dated November challenger",()=>{
  for(const lens of ["fed","bonds","ai","breadth"] as const){
    const result=getRegimeManualChallenge(lens);
    assert.ok(result,lens);
    assert.equal(result.status,"RESEARCH_ONLY");
    assert.equal(result.asOf,"2026-11-11");
    assert.ok(result.whatChanged.length>90);
    assert.ok(result.objection.length>85);
    assert.ok(result.nextTest.length>65);
    assert.ok(result.sourceLinks.length>=2);
    assert.ok(result.sourceLinks.every(x=>x.url.startsWith("https://")));
  }
  for(const lens of ["energy","china","yen","gold","housing"] as const){
    assert.equal(getRegimeManualChallenge(lens),null,lens);
  }
});

test("breadth and AI are each distinguished from proof of a complete risk-on bull run",()=>{
  const breadth=getRegimeManualChallenge("breadth")!;
  const ai=getRegimeManualChallenge("ai")!;
  assert.match(breadth.whatChanged,/7\.2 percentage points/);
  assert.match(breadth.objection,/not at a completed close/);
  assert.match(ai.whatChanged,/customer deposits\/prepayments are prospective/);
  assert.match(ai.objection,/cash PP&E/);
});

test("Fed and bonds explain Treasury closure and refrain from fabricated rate and credit verdicts",()=>{
  const fed=getRegimeManualChallenge("fed")!;
  const bonds=getRegimeManualChallenge("bonds")!;
  assert.match(fed.objection,/unavailable on 11 November/);
  assert.match(bonds.objection,/Neither high yields nor recovering equities alone/);
  assert.match(bonds.nextTest,/12 November/);
});

test("manual challenge component is read-only and mounted on existing nine lens pages",()=>{
  const component=readFileSync("components/blue-desk/RegimeManualChallenge.tsx","utf8");
  const lens=readFileSync("app/blue-desk/regime-watch/[lensId]/page.tsx","utf8");
  assert.match(component,/data-regime-research-status={update.status}/);
  assert.match(component,/not automatically revise the lens meter/);
  assert.match(lens,/<RegimeManualChallenge lens={lens.id}\/>/);
  assert.doesNotMatch(component,/createSupabaseAdminClient|update\(|insert\(|service_role/i);
});
