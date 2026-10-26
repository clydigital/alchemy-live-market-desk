import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {
 INVESTOR_TEST_STAGES,selectFlagshipInvestorTest,
} from "../lib/blue-desk-investor-test.ts";
import type { MotionOrderedStory } from "../lib/blue-desk-thesis-ledger.ts";

const fake=(p:Partial<MotionOrderedStory>={}):MotionOrderedStory=>({
 id:"a8a55160-7b13-4f23-946c-84782040a100",
 slug:"ai-capex-cash-conversion",
 title:"AI capital expenditure versus future cash profits",
 question:"What would make investment productive?",
 thesis:"An extensive record of AI investment needs to be checked against actual operating cash flow.",
 support:"A historical issuer report cited in the canonical thesis; source still requires independent inspection.",
 contradiction:"An alternative view is that customer adoption can raise future returns faster than expected.",
 confirmation:"Compare future company disclosures against the recorded cash-generation thesis.",
 invalidation:"A separate dated filing could undermine the funding-pressure argument.",
 nextTest:"Read the next quarterly cash flow statement and management funding guidance.",
 pricedAssessment:"",
 updatedAt:"2026-10-26T10:00:00Z",status:"monitor",rank:2,
 latestMotionAt:null,latestMotionVerification:null,
 ...p,
});

const text=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Investor Test preserves the source fields and never fabricates finance or market numbers",()=>{
 const story=fake();
 const view=selectFlagshipInvestorTest([story]);
 assert.ok(view);
 assert.equal(view.story,story);
 assert.equal(view.story.support,story.support);
 assert.equal(view.story.nextTest,story.nextTest);
 assert.equal(view.quality,"partial");
 assert.match(view.fundingQuestion,/Who supplies the capital/);
 assert.match(view.marketQuestion,/Check dated market observations/);
 assert.match(view.evidenceNote,/archived research thesis/i);
 const ui=text("components/blue-desk/InvestorTest.tsx");
 assert.match(ui,/story\.pricedAssessment \?/);
 assert.match(ui,/No source-grounded pricing assessment is recorded/);
 assert.match(ui,/This is stored research support/);
 assert.match(ui,/not a new price observation/);
 assert.doesNotMatch(ui,/BUY NOW|SELL NOW|UPSID[Ee] \d+%/);
});

test("Investor Test is omitted on incomplete, unsourced thesis records",()=>{
 assert.equal(selectFlagshipInvestorTest([]),null);
 assert.equal(selectFlagshipInvestorTest([fake({support:""})]),null);
 assert.equal(selectFlagshipInvestorTest([fake({contradiction:"",invalidation:""})]),null);
 assert.equal(selectFlagshipInvestorTest([fake({nextTest:"",confirmation:""})]),null);
});

test("Financing-ready AI candidate takes preference over unrelated archival macro Story",()=>{
 const macro=fake({id:"b8b55160-7b13-4f23-946c-84782040a100",slug:"usd-index",title:"US dollar shifts and equity risk",
 updatedAt:"2026-10-27T10:00:00Z",pricedAssessment:"Recorded historical market expectations must be checked."});
 const view=selectFlagshipInvestorTest([macro,fake()]);
 assert.equal(view?.story.slug,"ai-capex-cash-conversion");
 assert.deepEqual(INVESTOR_TEST_STAGES.map(s=>s.id),["pitch","money","catch","verdict"]);
});

test("Rates and energy funding questions remain questions rather than inferred outcomes",()=>{
 const rates=selectFlagshipInvestorTest([fake({slug:"bond-funding-pressure",title:"Bond funding pressure"})]);
 assert.match(rates?.fundingQuestion||"",/Who must refinance/);
 const energy=selectFlagshipInvestorTest([fake({slug:"brent-oil-supply",title:"Brent oil supply disruption"})]);
 assert.match(energy?.fundingQuestion||"",/Who pays more/);
});

test("Investor Test reuses Key Stories and only reveals older details on request",()=>{
 const page=text("app/blue-desk/key-stories/page.tsx");
 assert.match(page,/selectFlagshipInvestorTest\(orderedTheses\)/);
 assert.match(page,/<InvestorTest view=\{investorTest\}/);
 assert.match(page,/data-living-topics="dossier-independent"/);
 assert.match(page,/<details className=\{ui\.more\}>/);
 assert.match(page,/Read the reasoning, risks and deciding tests/);
 assert.match(page,/Historical research snapshot, not an independently confirmed price reaction/);
 assert.match(page,/getPublicThesisLedger\(now,24\)/);
 assert.match(page,/getCurrentVerifiedMarketMotion/);
 assert.doesNotMatch(page,/createSupabaseAdminClient|story_thesis_versions.*insert|use server/);
 const comp=text("components/blue-desk/InvestorTest.tsx");
 assert.match(comp,/href=\{"#thesis-"\+story\.slug\}/);
 assert.match(comp,/data-investor-test="source-bounded"/);
 assert.match(comp,/Researched <DualTimestamp value=\{story\.updatedAt\}/);
});
