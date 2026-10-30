import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { EDITORIAL_REGIME_LENSES } from "../lib/bluebelly-editorial-architecture.ts";
import {
  FUNDAMENTAL_QUICK_VIEW, FUNDAMENTAL_VIEW_REVIEWED_ON,
  FUNDAMENTAL_VIEW_VERSION, fundamentalSnapshotAgeDays, quickViewsForLens,
} from "../lib/bluebelly-fundamental-quickview.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("ten differentiated fundamental assets have a dated, falsifiable, source-labelled editorial assessment",()=>{
  assert.equal(FUNDAMENTAL_QUICK_VIEW.length,10);
  assert.equal(FUNDAMENTAL_VIEW_REVIEWED_ON,"2026-10-30");
  assert.match(FUNDAMENTAL_VIEW_VERSION,/editorial-fundamentals/);
  assert.equal(new Set(FUNDAMENTAL_QUICK_VIEW.map(row=>row.id)).size,FUNDAMENTAL_QUICK_VIEW.length);
  const known=new Set(EDITORIAL_REGIME_LENSES.map(lens=>lens.id));
  for(const asset of FUNDAMENTAL_QUICK_VIEW){
    assert.ok(known.has(asset.lens),asset.id);
    assert.ok(["BULLISH","BEARISH","MIXED","UNRESOLVED"].includes(asset.bias),asset.id);
    assert.ok(["HIGH","MEDIUM","LOW"].includes(asset.confidence),asset.id);
    assert.ok(asset.reason.length>=75,asset.id+" explained");
    assert.ok(asset.countercase.length>=65,asset.id+" has genuine countercase");
    assert.ok(asset.decidingTest.length>=65,asset.id+" has falsifier");
    assert.ok(asset.sourceObservationDate,asset.id+" source status");
    assert.ok(asset.sources.length>0,asset.id+" at least one source");
    for(const source of asset.sources){
      assert.match(source.url,/^https:\/\//);
      assert.ok(source.name && source.publicationDate);
      assert.ok(source.role==="PRIMARY"||source.role==="COMMENTARY");
    }
  }
});

test("creator opinion is expressly commentary, and unverified asset tape remains unresolved",()=>{
  const brent=FUNDAMENTAL_QUICK_VIEW.find(row=>row.id==="brent")!;
  assert.equal(brent.sources.find(source=>source.name.includes("HFI"))?.role,"COMMENTARY");
  assert.match(brent.reason,/hypothesis/);
  for(const id of ["usd","gold","yen"]){
    const asset=FUNDAMENTAL_QUICK_VIEW.find(row=>row.id===id)!;
    assert.equal(asset.bias,"UNRESOLVED");
    assert.equal(asset.confidence,"LOW");
    assert.match(asset.sourceObservationDate,/no independently|pending verification/);
  }
  assert.ok(!FUNDAMENTAL_QUICK_VIEW.some(row=>/automatic buy|guaranteed return|must trade/i.test(row.reason)));
});

test("lens routing never invents or changes the canonical Story/Regime writer",()=>{
  const energy=quickViewsForLens("energy");
  assert.deepEqual(energy.map(x=>x.id),["brent","diesel","energy-producers"]);
  assert.deepEqual(quickViewsForLens("china"),[]);
  assert.deepEqual(quickViewsForLens("housing"),[]);
  const before=structuredClone(FUNDAMENTAL_QUICK_VIEW);
  quickViewsForLens("ai");
  assert.deepEqual(FUNDAMENTAL_QUICK_VIEW,before);
});

test("snapshot age is explicit; a visited page does not reset the research review clock",()=>{
  assert.equal(fundamentalSnapshotAgeDays(new Date("2026-10-30T00:00:00Z")),0);
  assert.ok((fundamentalSnapshotAgeDays(new Date("2026-11-10T12:00:00Z"))||0)>7);
  assert.equal(fundamentalSnapshotAgeDays(new Date("invalid")),null);
});

test("public pages use safe source-observation readers and keep opinions separate from changing facts",()=>{
  const page=read("app/blue-desk/regime-watch/page.tsx");
  const detail=read("app/blue-desk/regime-watch/[lensId]/page.tsx");
  const css=read("app/blue-desk/regime-watch/regime-watch.module.css");
  assert.match(page,/data-fundamental-quick-view/);
  assert.match(page,/getPublicSourceObservations\(now,24\)/);
  assert.match(page,/matchRecentLensObservations/);
  assert.match(page,/48h topic matches.not verdict changes/);
  assert.match(page,/source\.role==="COMMENTARY"/);
  assert.match(detail,/quickViewsForLens/);
  assert.match(detail,/data-fundamental-assessment/);
  assert.match(detail,/what argues against it:/i);
  assert.match(detail,/no opinion is silently promoted/i);
  assert.match(css,/@media\(max-width:750px\)/);
  for(const source of [page,detail]) assert.doesNotMatch(source,/service_role|createSupabaseAdminClient|story_thesis_versions|\.insert\(|\.update\(/);
});
