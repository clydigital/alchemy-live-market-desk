import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 REGIME_EDITORIAL_UPDATES,REGIME_EDITORIAL_SWEEP_REVIEWED_ON,
 REGIME_EDITORIAL_SWEEP_VERSION,getRegimeEditorialUpdate
} from "../lib/bluebelly-regime-verified-crossasset.ts";
import {LENS_RESEARCH_OUTLOOKS} from "../lib/bluebelly-regime-lens-outlook.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("five independently checked cross-asset stories keep source roles, vintages and falsifiers",()=>{
 assert.equal(REGIME_EDITORIAL_SWEEP_REVIEWED_ON,"2026-10-30");
 assert.match(REGIME_EDITORIAL_SWEEP_VERSION,/post-boj-crossasset/);
 assert.deepEqual(Object.keys(REGIME_EDITORIAL_UPDATES).sort(),["bonds","breadth","fed","gold","yen"]);
 for(const [lens,entry] of Object.entries(REGIME_EDITORIAL_UPDATES)){
  assert.ok(entry,lens);
  assert.equal(entry.lens,lens);
  assert.equal(getRegimeEditorialUpdate(lens as keyof typeof LENS_RESEARCH_OUTLOOKS),entry);
  assert.match(entry.asOf,/2026/);
  assert.ok(entry.headline.length>25,lens+" headline concise but substantive");
  for(const prop of ["story","confirmation","dissent","nextTest"] as const){
   assert.ok(entry[prop].length>70,lens+" "+prop+" sufficiently explained");
  }
  assert.ok(entry.evidence.length>=3,lens);
  for(const e of entry.evidence){
   assert.match(e.url,/^https:\/\//);
   assert.ok(e.name&&e.value&&e.at&&e.scope,lens);
   assert.ok(["ORIGINAL","DATA_VENDOR","REPORTING","TECHNICAL_PROXY"].includes(e.sourceType),e.name);
  }
 }
 assert.equal(getRegimeEditorialUpdate("china"),null);
 assert.equal(getRegimeEditorialUpdate("housing"),null);
});

test("event and instrument distinctions cannot be hidden by the editorial upgrade",()=>{
 const yen=REGIME_EDITORIAL_UPDATES.yen!;
 assert.match(yen.story,/8–1/);
 assert.match(yen.confirmation,/different clocks/);
 assert.match(yen.dissent,/post-decision 4H/i);
 assert.ok(yen.evidence.some(s=>s.value.includes("157.115")));
 assert.ok(yen.evidence.some(s=>s.value.includes("157.305")));
 const gold=REGIME_EDITORIAL_UPDATES.gold!;
 assert.match(gold.confirmation,/futures/);
 assert.match(gold.dissent,/not a certified single-feed spot/i);
 assert.match(gold.dissent,/288.9 tonnes|288.9/);
 assert.ok(gold.evidence.some(s=>s.sourceType==="ORIGINAL"&&s.url.includes("gold.org/goldhub")));
 assert.ok(gold.evidence.some(s=>s.value.includes("2.35%")));
 assert.ok(gold.evidence.some(s=>s.sourceType==="TECHNICAL_PROXY"));
 assert.ok(gold.evidence.some(s=>s.value.includes("2.63%")));
 const breadth=REGIME_EDITORIAL_UPDATES.breadth!;
 assert.ok(breadth.evidence.some(s=>s.value.includes("406")));
 assert.ok(breadth.evidence.some(s=>s.value.includes("3.14%")));
 assert.match(breadth.dissent,/lagged one US session/);
 const bonds=REGIME_EDITORIAL_UPDATES.bonds!;
 assert.match(bonds.confirmation,/Amazon|AMZN|2Y|Treasury/i);
 assert.match(bonds.dissent,/before Amazon/);
 const fed=REGIME_EDITORIAL_UPDATES.fed!;
 assert.match(fed.dissent,/no aligned DXY 4H/);
});

test("current lens opinions adopt the rechecked evidence rather than repeating old missing-data text",()=>{
 const yen=LENS_RESEARCH_OUTLOOKS.yen;
 const gold=LENS_RESEARCH_OUTLOOKS.gold;
 const breadth=LENS_RESEARCH_OUTLOOKS.breadth;
 assert.match(yen.evidenceStatus,/Reuters post-decision/);
 assert.match(gold.evidenceStatus,/4H futures/);
 assert.match(breadth.evidenceStatus,/advance\/decline/);
 assert.equal(yen.outlook,"BULLISH");
 assert.equal(gold.outlook,"BEARISH");
 assert.equal(gold.confidence,"MEDIUM");
 assert.match(gold.opposing,/2024–25/);
 assert.match(gold.evidenceStatus,/creator transcripts/);
 assert.match(gold.decidingTest,/DFII10/);
 assert.equal(breadth.outlook,"BULLISH");
});

test("post-decision evidence is rendered on the relevant public pages without modifying the canonical writer",()=>{
 const detail=read("app/blue-desk/regime-watch/[lensId]/page.tsx");
 const overview=read("app/blue-desk/regime-watch/page.tsx");
 const css=read("app/blue-desk/regime-watch/[lensId]/lens.module.css");
 assert.match(detail,/getRegimeEditorialUpdate\(lens\.id\)/);
 assert.match(detail,/id="latest-editorial"/);
 assert.match(detail,/latestEditorial\.story/);
 assert.match(detail,/latestEditorial\.evidence\.map/);
 assert.match(detail,/source\.sourceType/);
 assert.match(detail,/data-regime-editorial-verified/);
 assert.match(detail,/Latest editorial evidence/);
 assert.match(overview,/getRegimeEditorialUpdate\(lens\.id\)/);
 assert.match(css,/\.verifiedEditorial/);
 for(const text of [detail,overview])assert.doesNotMatch(text,/createSupabaseAdminClient|service_role|story_thesis_versions|\.insert\(|\.update\(/);
});
