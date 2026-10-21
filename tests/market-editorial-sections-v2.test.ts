import assert from "node:assert/strict";
import test from "node:test";
import {
  ARTICLE_SECTIONS_V2, MODEL_ARTICLE_SECTIONS_V2_SCHEMA,
  eligibleForArticleSectionsV2, validateArticleSectionsV2,
  type ModelArticleSectionsV2,
} from "../lib/market-editorial-sections-v2.ts";
import {
  selectMarketEditorialCandidates,type EditorialCandidate,type EditorialEvidence,
} from "../lib/market-editorial-v1.ts";
import type { MarketImpactPacketV1 } from "../lib/market-impact-packet.ts";

const asOf="2026-10-21T02:02:42.815Z";
const storyId="6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e";
const thesis="85d6149f-50b2-4bc9-a07f-7de152675541";
const snapshot="2e99dc08-f707-4ec4-936c-80c6b4aa5953";
const id1="c3776638-d2cb-40e1-acf7-36850d992edc";
const id2="e41e3ff2-65a4-4429-866f-08b6648ebabd";
const id3="cf1ecffd-b6f1-4431-bd34-a54657251b9e";
const id4="d847a1cd-bdc8-43d5-bacb-5557e6e42bfa";
const tsm="https://pr.tsmc.com/english/news/3346";
const cw="https://investors.coreweave.com/news/news-details/2026/CoreWeave-Reports-Strong-Second-Quarter-2026-Results/default.aspx";
function packet():MarketImpactPacketV1{
  return{
    contractVersion:"market-impact-packet/1",kind:"STORY",
    identity:{storyId,motionId:null,storyThesisVersionId:thesis,storySnapshotId:snapshot,lineage:"FROZEN_DOSSIER_CONTEXT"},
    evidenceCandidateIds:[id1,id2,id3,id4],asOf,
    sourceVersionEffectiveAt:null,attentionAssessedAt:null,materialChangeAt:null,
    headline:"AI demand, capital spending and cash conversion",
    development:{text:null,basis:"FROZEN_DOSSIER_CONTEXT",evidenceIds:[],sourceUrl:null},
    background:[],mechanism:{
      text:"Foundry orders could help supplier margins while cloud capital spending may pressure cash conversion.",
      evidenceIds:[],evidenceState:"CONTEXT_ONLY",
    },
    assetReadThroughs:[{asset:"TSM",
      interpretation:"TSM earnings are exposed to AI hardware demand and foundry utilisation.",
      evidenceIds:[],kind:"LESSON_CONTEXT"}],
    observedReaction:null,reactionCandidate:null,
    countercase:"Customer utilisation may underperform planned AI investment.",
    nextTest:"Next management results and capital spending guidance.",
    sourceUrls:[],missing:[],
  };
}
const rows:EditorialEvidence[]=[
  {id:id1,claimText:"Taiwan Semiconductor Manufacturing Company reported 2026Q3 operating margin of 58.7 percent in its issuer release dated 2026-10-15.",
    sourceName:"Taiwan Semiconductor Manufacturing Company",sourceUrl:tsm,provenanceUrls:[tsm]},
  {id:id2,claimText:"Taiwan Semiconductor Manufacturing Company reported 2026Q3 net revenue of 46.72 USD_billion in its issuer release dated 2026-10-15.",
    sourceName:"Taiwan Semiconductor Manufacturing Company",sourceUrl:tsm,provenanceUrls:[tsm]},
  {id:id3,claimText:"CoreWeave reported 2026Q2 cash purchases of property and equipment including capitalised software of 6.422 USD_billion in its issuer release dated 2026-08-11.",
    sourceName:"CoreWeave",sourceUrl:cw,provenanceUrls:[cw]},
  {id:id4,claimText:"CoreWeave reported 2026Q2 net cash from operating activities of 0.679 USD_billion in its issuer release dated 2026-08-11.",
    sourceName:"CoreWeave",sourceUrl:cw,provenanceUrls:[cw]},
].map(x=>({...x,evidenceClass:"company_primary",sourceTier:1,
  createdAt:"2026-10-18T01:00:00Z",availableAt:"2026-10-18T01:01:16.085Z"}));

function candidate():EditorialCandidate {
  const [result]=selectMarketEditorialCandidates({packets:[packet()],evidence:rows});
  assert.ok(result);
  return result;
}
function model(c:EditorialCandidate):ModelArticleSectionsV2 {
  return {fingerprint:c.fingerprint,reportingFactIds:[id1,id2,id3,id4],
    interpretation:[
      {support:"mechanism",asset:null,text:"AI hardware demand could support foundry revenue, while cloud capital spending might delay cash conversion."},
      {support:"asset",asset:"TSM",text:"TSM earnings could benefit if demand for advanced chips and foundry utilisation remain firm."},
      {support:"nextTest",asset:null,text:"The next results could test whether customer orders and operating cash flow catch up to spending."},
    ]};
}
test("real-shaped first-tier TSMC and CoreWeave facts can form a historically labelled full article",()=>{
  const c=candidate();
  assert.equal(eligibleForArticleSectionsV2(c),true);
  const result=validateArticleSectionsV2(model(c),c);
  assert.ok(result);
  assert.equal(result.contractVersion,ARTICLE_SECTIONS_V2);
  assert.equal(result.readiness,"FULL_ARTICLE");
  assert.equal(result.reporting.length,4);
  assert.equal(result.interpretation.length,3);
  assert.equal(result.storyId,storyId);
  assert.equal(result.storyThesisVersionId,thesis);
  assert.equal(result.storySnapshotId,snapshot);
  assert.equal(result.asOf,asOf);
  assert.equal(result.materialChangeAt,null);
  assert.equal(result.context,"CONTINUING_STORY");
  assert.deepEqual(result.reporting.map(x=>x.text),rows.map(x=>x.claimText));
  assert.deepEqual(result.reporting.map(x=>x.evidenceIds[0]),[id1,id2,id3,id4]);
  assert.deepEqual(result.sourceLinks,[
    {url:tsm,sourceName:"Taiwan Semiconductor Manufacturing Company"},
    {url:cw,sourceName:"CoreWeave"},
  ]);
  assert.equal(result.interpretation[0].basis,"HISTORICAL_CONTEXT");
  assert.equal(result.interpretation[1].basis,"HISTORICAL_CONTEXT");
  assert.deepEqual(result.gaps,[]);
});
test("model cannot author factual prose or fabricate factual dates and numbers",()=>{
  const c=candidate();
  const x=model(c) as unknown as Record<string,unknown>;
  x.fakeReporting="TSMC just announced a 99% return today";
  const result=validateArticleSectionsV2(x,c);
  assert.ok(result);
  assert.ok(result.reporting.every(p=>!p.text.includes("99%")));
  assert.deepEqual(result.reporting[0].sourceUrls,[tsm]);
  assert.deepEqual(result.reporting[0].evidenceIds,[id1]);
});
test("one or two facts produce a labelled brief, never a full article",()=>{
  const c=candidate();
  for (const ids of [[id1],[id1,id2]]) {
    const x=model(c);
    x.reportingFactIds=ids;
    const result=validateArticleSectionsV2(x,c);
    assert.equal(result?.readiness,"BRIEF_ONLY");
    assert.ok(result?.gaps.some(g=>g.includes("three distinct")));
  }
});
test("unknown/duplicate IDs cannot inflate three paragraph threshold",()=>{
  const c=candidate();
  const x=model(c);
  x.reportingFactIds=[id1,id1,"33333333-3333-4333-8333-333333333333"];
  const result=validateArticleSectionsV2(x,c);
  assert.equal(result?.reporting.length,1);
  assert.equal(result?.readiness,"BRIEF_ONLY");
});
test("invented realised reactions, missing conditional wording, unrelated assets fail impact admission",()=>{
  const c=candidate();
  const x=model(c);
  x.interpretation=[
    {support:"asset",asset:"TSM",text:"TSM shares rallied 25% and drove Nasdaq higher after today's results."},
    {support:"asset",asset:"GOLD",text:"Gold might rally if markets react to the latest report."},
    {support:"mechanism",asset:null,text:"Foundry orders supported operating cash flow."},
  ];
  const result=validateArticleSectionsV2(x,c);
  assert.equal(result?.interpretation.length,0);
  assert.equal(result?.readiness,"BRIEF_ONLY");
  assert.ok(result?.gaps.some(g=>g.includes("market-interpretation")));
});
test("fact preflight fails closed with future dated, unlinked or motion-only fact pools",()=>{
  const c=candidate();
  assert.equal(eligibleForArticleSectionsV2({...c,facts:[c.facts[0],c.facts[1]]}),false);
  assert.equal(eligibleForArticleSectionsV2({...c,facts:c.facts.map(f=>({...f,availableAt:"2026-10-22T00:00:00Z"}))}),false);
  assert.equal(eligibleForArticleSectionsV2({...c,facts:c.facts.map(f=>({...f,sourceUrl:"http://fake.example/"}))}),false);
  assert.equal(eligibleForArticleSectionsV2({...c,packet:{...c.packet,kind:"MOTION"}}),false);
  assert.equal(eligibleForArticleSectionsV2({...c,packet:{...c.packet,mechanism:{...c.packet.mechanism,evidenceState:"UNAVAILABLE"}}}),false);
});
test("bad fingerprints and absent model arrays never become an edition article",()=>{
  const c=candidate();
  assert.equal(validateArticleSectionsV2({...model(c),fingerprint:"bogus"},c),null);
  assert.equal(validateArticleSectionsV2({fingerprint:c.fingerprint},c),null);
  assert.equal(validateArticleSectionsV2(null,c),null);
});
test("strict model schema requires a fact selector and conditional interpretation items",()=>{
  assert.equal(MODEL_ARTICLE_SECTIONS_V2_SCHEMA.additionalProperties,false);
  assert.deepEqual(MODEL_ARTICLE_SECTIONS_V2_SCHEMA.required,
    ["fingerprint","reportingFactIds","interpretation"]);
  assert.deepEqual(MODEL_ARTICLE_SECTIONS_V2_SCHEMA.properties.interpretation.items.required,
    ["text","support","asset"]);
});
