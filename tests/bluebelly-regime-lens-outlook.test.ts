import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EDITORIAL_REGIME_LENSES} from "../lib/bluebelly-editorial-architecture.ts";
import {
 LENS_RESEARCH_OUTLOOKS,LENS_OUTLOOK_REVIEWED_ON,
 LENS_OUTLOOK_VERSION,outlookPosition,confidenceSegments,getLensOutlook,
} from "../lib/bluebelly-regime-lens-outlook.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("each of the nine original lenses has its own source-dated and counter-tested outlook",()=>{
 const ids=EDITORIAL_REGIME_LENSES.map(l=>l.id);
 assert.equal(ids.length,9);
 assert.deepEqual(Object.keys(LENS_RESEARCH_OUTLOOKS).sort(),[...ids].sort());
 assert.equal(LENS_OUTLOOK_REVIEWED_ON,"2026-10-30");
 assert.match(LENS_OUTLOOK_VERSION,/editorial-lens-outlook/);
 for(const id of ids){
  const x=getLensOutlook(id);
  assert.equal(x.lens,id);
  assert.ok(["BEARISH","MIXED","BULLISH"].includes(x.outlook),id);
  assert.ok(["LOW","MEDIUM","HIGH"].includes(x.confidence),id);
  assert.equal(x.reviewedAt,"2026-10-30");
  assert.ok(x.headline.length>25,id);
  assert.ok(x.directionTarget.length>22,id+" scoped directional exposure");
  assert.ok(x.horizon.length>8,id+" evidence horizon");
  assert.ok(x.why.length>100,id);
  assert.ok(x.supporting.length>40,id);
  assert.ok(x.opposing.length>40,id);
  assert.ok(x.decidingTest.length>60,id);
  assert.ok(x.evidenceStatus.length>35,id);
  assert.ok(x.sources.length>=1,id);
  for(const source of x.sources){
   assert.match(source.url,/^https:\/\//,id);
   assert.ok(source.name&&source.asOf,id);
   assert.ok(["PRIMARY","REPORTING","COMMENTARY"].includes(source.kind),id);
  }
 }
});

test("full October sweep differentiates nine views instead of defaulting eight to Mixed",()=>{
 const expected={
  fed:["BEARISH","HIGH"],bonds:["BULLISH","MEDIUM"],ai:["BEARISH","MEDIUM"],
  china:["MIXED","MEDIUM"],energy:["BULLISH","HIGH"],yen:["BULLISH","MEDIUM"],
  breadth:["BULLISH","MEDIUM"],gold:["BEARISH","MEDIUM"],housing:["BEARISH","HIGH"]
 } as const;
 for(const [id,fields] of Object.entries(expected)){
  const actual=getLensOutlook(id as keyof typeof expected);
  assert.equal(actual.outlook,fields[0],id);
  assert.equal(actual.confidence,fields[1],id);
  assert.equal(actual.reviewedAt,"2026-10-30",id);
 }
 assert.equal(Object.values(LENS_RESEARCH_OUTLOOKS).filter(x=>x.outlook==="BULLISH").length,4);
 assert.equal(Object.values(LENS_RESEARCH_OUTLOOKS).filter(x=>x.outlook==="BEARISH").length,4);
 assert.equal(Object.values(LENS_RESEARCH_OUTLOOKS).filter(x=>x.outlook==="MIXED").length,1);
 assert.match(getLensOutlook("fed").directionTarget,/Fed easing/);
 assert.match(getLensOutlook("bonds").directionTarget,/Treasury prices/);
 assert.match(getLensOutlook("yen").directionTarget,/JPY up/);
 assert.match(getLensOutlook("energy").directionTarget,/diesel/);
 assert.equal(outlookPosition("BEARISH"),1);
 assert.equal(outlookPosition("MIXED"),3);
 assert.equal(outlookPosition("BULLISH"),5);
 assert.equal(confidenceSegments("LOW"),1);
 assert.equal(confidenceSegments("MEDIUM"),2);
 assert.equal(confidenceSegments("HIGH"),3);
 assert.ok(getLensOutlook("china").sources.some(s=>s.kind==="PRIMARY"));
 assert.ok(getLensOutlook("gold").sources.some(s=>s.kind==="REPORTING"));
 assert.ok(getLensOutlook("breadth").sources.some(s=>s.kind==="COMMENTARY"));
});

test("landing leads with nine outlook cards and no longer displays an unrelated ten-asset table",()=>{
 const directory=read("app/blue-desk/regime-watch/page.tsx");
 const css=read("app/blue-desk/regime-watch/regime-watch.module.css");
 assert.match(directory,/Explore a research lens/);
 assert.match(directory,/RegimeOutlookMeter assessment=\{getLensOutlook\(lens\.id\)\}/);
 assert.match(directory,/getLensOutlook\(lens\.id\)\.headline/);
 assert.doesNotMatch(directory,/data-fundamental-quick-view|FUNDAMENTAL_QUICK_VIEW|quickSection/);
 assert.match(css,/\.lensReason/);
 assert.match(css,/@media\(max-width:540px\)/);
});

test("each detail starts with its outlook and reasons rather than requiring a scroll to history",()=>{
 const page=read("app/blue-desk/regime-watch/[lensId]/page.tsx");
 const meter=read("components/blue-desk/RegimeOutlookMeter.tsx");
 const styles=read("app/blue-desk/regime-watch/[lensId]/lens.module.css");
 assert.ok(page.indexOf('id="lens-outlook"')>page.indexOf("<header"));
 assert.ok(page.indexOf('id="lens-outlook"')<page.indexOf('className={styles.pageNav}'));
 assert.match(page,/outlook\.supporting/);
 assert.match(page,/outlook\.opposing/);
 assert.match(page,/outlook\.decidingTest/);
 assert.match(page,/outlook\.evidenceStatus/);
 assert.match(page,/outlook\.sources/);
 assert.doesNotMatch(page,/data-fundamental-assessment/);
 assert.match(page,/size="full"/);
 assert.match(meter,/data-outlook-meter=\{assessment\.lens\}/);
 assert.match(meter,/assessment\.directionTarget/);
 assert.match(meter,/assessment\.horizon/);
 assert.match(meter,/aria-label=\{"Editorial outlook/);
 assert.match(styles,/\.outlookPanel/);
 assert.doesNotMatch(page,/DIRECTION UNPROVEN|display may be UNRESOLVED/);
 assert.doesNotMatch(meter,/UNRESOLVED/);
 for(const text of [page,meter])assert.doesNotMatch(text,/createSupabaseAdminClient|service_role|\.insert\(|\.update\(/);
});
