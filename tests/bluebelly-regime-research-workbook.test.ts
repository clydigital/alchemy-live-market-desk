import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {EDITORIAL_REGIME_LENSES} from "../lib/bluebelly-editorial-architecture.ts";
import {REGIME_LENS_WORKBOOKS,matchRecentLensObservations} from "../lib/bluebelly-regime-lens-workbook.ts";
import type {PublicSourceObservation} from "../lib/blue-desk-source-observations-projector.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const now=new Date("2026-10-28T10:00:00Z");
const obs=(id:string,description:string,eventAt:string):PublicSourceObservation=>({
 id,description,eventAt,recordedAt:eventAt,kind:"ORIGINAL_RELEASE",
 sourceName:"Primary source",sourceUrl:"https://www.sec.gov/search-filings",sourceTier:1
});
test("all nine lenses have distinctive 4-step causal maps and source-oriented research plans",()=>{
 const ids=EDITORIAL_REGIME_LENSES.map(x=>x.id);
 assert.equal(ids.length,9);
 assert.deepEqual(Object.keys(REGIME_LENS_WORKBOOKS).sort(),[...ids].sort());
 const steps=new Set<string>();
 for(const lens of EDITORIAL_REGIME_LENSES){
  const plan=REGIME_LENS_WORKBOOKS[lens.id];
  assert.ok(plan.lead.length>45);
  assert.equal(plan.causalPath.length,4);
  assert.ok(plan.monitors.length>=3);
  assert.ok(plan.strengthen.length>50&&plan.challenge.length>50);
  assert.ok(plan.mechanismCaution.length>40);
  for(const item of plan.monitors){
   assert.ok(item.purpose&&item.discriminator&&item.cadence&&item.sourceName);
   assert.match(item.sourceUrl,/^https:\/\/[^/]+\//);
   assert.ok(!item.sourceUrl.includes("example.com"));
  }
  for(const item of plan.related){
   assert.ok(ids.includes(item.id)&&item.id!==lens.id&&item.why);
  }
  steps.add(plan.causalPath.join("→"));
 }
 assert.equal(steps.size,9);
});
test("housing lens separates Fed mandate from affordability and maps cross-market scenarios",()=>{
 const lens=EDITORIAL_REGIME_LENSES.find(x=>x.id==="housing")!;
 const plan=REGIME_LENS_WORKBOOKS.housing;
 assert.match(lens.question,/Fed/);
 assert.match(plan.policyDilemma!.answer,/not a rate-setting veto/);
 assert.equal(plan.scenarios?.length,3);
 assert.ok(plan.scenarios?.every(item=>item.crossMarketEffects.some(effect=>/2Y/ .test(effect))));
 assert.ok(plan.monitors.some(item=>item.sourceName==="US Bureau of Labor Statistics"));
 assert.ok(plan.monitors.some(item=>item.sourceName==="Federal Reserve Bank of New York"));
});
test("recent original-source topical matches are not inferred as causal evidence",()=>{
 const news=[
  obs("a","The EIA weekly petroleum report described distillate inventories.","2026-10-28T09:00:00Z"),
  obs("b","The latest company cash flow report detailed semiconductor capex.","2026-10-28T08:00:00Z"),
  obs("c","The EIA reported new weekly petroleum supply observations.","2026-10-24T09:00:00Z"),
  obs("d","A new data publication about mathematics in schools.","2026-10-28T09:00:00Z"),
  obs("e","The EIA published the petroleum weekly supply update.","2026-10-28T13:00:00Z")
 ];
 const before=structuredClone(news);
 const energy=matchRecentLensObservations("energy",news,now);
 assert.deepEqual(energy.map(x=>x.id),["a"]);
 assert.deepEqual(matchRecentLensObservations("ai",news,now).map(x=>x.id),["b"]);
 assert.deepEqual(matchRecentLensObservations("gold",news,now),[]);
 assert.deepEqual(news,before);
});
test("research lens page distinguishes plan, stored Story, and independently admitted sources",()=>{
 const page=read("app/blue-desk/regime-watch/[lensId]/page.tsx");
 assert.match(page,/getPublicThesisLedger/);
 assert.match(page,/getPublicSourceObservations\(now,12\)/);
 assert.match(page,/matchRecentLensObservations/);
 assert.match(page,/sourceObservations===null/);
 assert.match(page,/editorial topic match/i);
 assert.match(page,/Value \/ observation date: not supplied/);
 assert.match(page,/not a complete immutable edition history/);
 assert.match(page,/story\.confirmation/);
 assert.match(page,/story\.invalidation/);
 assert.match(page,/workbook\.causalPath/);
 assert.doesNotMatch(page,/createSupabaseAdminClient|story_thesis_versions|\.insert\(|\.update\(|service_role/);
});
test("home Regime teaser and sidebar links use new detail routes rather than stale anchors",()=>{
 const home=read("components/blue-desk/BluebellyNewsfront.tsx");
 assert.match(home,/href=\{regimes\+"\/"\+lens\.id\}/);
 assert.match(home,/href=\{regimes\+"\/"\+l\.id\}/);
 assert.doesNotMatch(home,/href=\{regimes\+"#"/);
});

test("a cross-theme historical Story cannot hijack the featured lens position",()=>{
 const plans=REGIME_LENS_WORKBOOKS;
 assert.equal(plans.fed.leadHeadlinePattern.test("Distillate Scarcity Persists Despite Crude-Flow Recovery"),false);
 assert.equal(plans.china.leadHeadlinePattern.test("Rates-led same-session repricing overwhelms summit optics"),false);
 assert.equal(plans.breadth.leadHeadlinePattern.test("Rates-led same-session repricing overwhelms summit optics"),false);
 assert.equal(plans.gold.leadHeadlinePattern.test("Real Yields and Funding Pressure Keep Rates Restrictive"),false);
 assert.equal(plans.energy.leadHeadlinePattern.test("Distillate Scarcity Persists Despite Crude-Flow Recovery"),true);
 assert.equal(plans.ai.leadHeadlinePattern.test("AI orders/backlog are real but cash conversion uncertain"),true);
 assert.equal(plans.fed.leadHeadlinePattern.test("Fed inflation decision and the policy path"),true);
 const page=read("app/blue-desk/regime-watch/[lensId]/page.tsx");
 assert.match(page,/lens\.stories\.find\(story=>workbook\.leadHeadlinePattern\.test\(story\.title\)\)/);
 assert.match(page,/Related public Story records are listed below/);
 assert.doesNotMatch(page,/const newest=lens\.stories\[0\]/);
});
