import assert from "node:assert/strict";
import test from "node:test";
import {
  MARKET_EDITORIAL_V1, selectMarketEditorialCandidates, validateMarketEditorialOutput,
} from "../lib/market-editorial-v1.ts";
import type { MarketImpactPacketV1 } from "../lib/market-impact-packet.ts";

const asOf="2026-10-20T16:19:12.015Z";
const storyId="6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e";
const motionId="10234567-1234-4abc-9999-012345678901";
const evidenceId="c3776638-d2cb-40e1-acf7-36850d992edc";
const original="https://www.example.org/investors/quarterly-results-2026";
function story(lineage: MarketImpactPacketV1["identity"]["lineage"]="EXACT_EDITION_MANIFEST"): MarketImpactPacketV1 {
  return {
    contractVersion:"market-impact-packet/1",kind:"STORY",evidenceCandidateIds:[evidenceId],
    identity:{storyId,motionId:null,storyThesisVersionId:"861cb4cb-f23f-4747-b105-39e363c71a8d",
      storySnapshotId:"01234567-1234-4abc-9999-012345678901",lineage},
    asOf,sourceVersionEffectiveAt:"2026-10-19T14:01:47Z",attentionAssessedAt:asOf,
    materialChangeAt:lineage==="EXACT_EDITION_MANIFEST"?"2026-10-19T14:01:47Z":null,
    headline:"TSMC chip demand meets investor funding concerns",
    development:{text:lineage==="EXACT_EDITION_MANIFEST"?"TSMC reported higher demand.":null,
      basis:lineage==="EXACT_EDITION_MANIFEST"?"CANONICAL_CLAIM":"FROZEN_DOSSIER_CONTEXT",
      evidenceIds:lineage==="EXACT_EDITION_MANIFEST"?[evidenceId]:[],sourceUrl:null},
    background:["Cloud operators are increasing infrastructure spending."],
    mechanism:{text:"Chip orders can improve foundry utilisation.",evidenceIds:[evidenceId],evidenceState:"CANONICAL_INTERPRETATION"},
    assetReadThroughs:[{asset:"TSM",interpretation:"Earnings sensitivity to AI chip orders",
      evidenceIds:[evidenceId],kind:"CANONICAL_CONDITIONAL"},
      {asset:"NDX",interpretation:"Broader index could respond if technology earnings improve",
      evidenceIds:[],kind:"CANONICAL_CONDITIONAL"}],
    observedReaction:null,reactionCandidate:"TSM rallied 4% today",
    countercase:"Financing costs may limit buyers' returns",nextTest:"Next management guidance",
    sourceUrls:[],missing:["ORIGINAL_SOURCE_LINK","MEASURED_MARKET_REACTION"],
  };
}
const proof={
  id:evidenceId,claimText:"TSMC reported higher demand for accelerator chips in its quarterly release.",
  evidenceClass:"company_primary",sourceTier:1,sourceName:"Issuer IR",
  sourceUrl:"https://www.example.org/",provenanceUrls:[original],
  createdAt:"2026-10-19T13:00:00Z",availableAt:"2026-10-19T13:30:00Z",
};
function model(fp:string) {
  return { articles:[{ fingerprint:fp, paragraphs:[
    {role:"development",text:"TSMC reported higher demand for accelerator chips in its quarterly release.",
      factIds:[evidenceId],evidenceState:"SOURCE_VERIFIED"},
    {role:"mechanism",text:"Higher chip orders could improve foundry utilisation while financing costs remain a risk.",
      factIds:[],evidenceState:"CANONICAL_INTERPRETATION"},
    {role:"markets",text:"TSM earnings could benefit if chip orders are sustained, while NDX exposure remains conditional.",
      factIds:[],evidenceState:"CONDITIONAL"},
    {role:"outlook",text:"The next management guidance will test orders against customer financing and spending.",
      factIds:[],evidenceState:"CONDITIONAL"},
  ] }] };
}
test("source-qualified frozen Story supports an evidence-linked, four-paragraph LY output",()=>{
  const [candidate]=selectMarketEditorialCandidates({packets:[story()],evidence:[proof]});
  assert.ok(candidate);
  const [article]=validateMarketEditorialOutput(model(candidate.fingerprint),[candidate]);
  assert.equal(article.contractVersion,MARKET_EDITORIAL_V1);
  assert.equal(article.readiness,"READY");
  assert.equal(article.paragraphs.length,4);
  assert.deepEqual(article.paragraphs.map(p=>p.role),["development","mechanism","markets","outlook"]);
  assert.deepEqual(article.paragraphs[0].evidenceIds,[evidenceId]);
  assert.deepEqual(article.paragraphs[0].sourceUrls,[original]);
  assert.deepEqual(article.sourceLinks,[{url:original,sourceName:"Issuer IR"}]);
  assert.equal(article.storyThesisVersionId,story().identity.storyThesisVersionId);
  assert.equal(article.materialChangeAt,story().materialChangeAt);
});
test("strict original source, tier and as-of controls exclude invalid narrative inputs",()=>{
  const rows=[
    {...proof,availableAt:"2026-10-22T01:00:00Z"},
    {...proof,evidenceClass:"creator_commentary"},
    {...proof,sourceTier:3},
    {...proof,provenanceUrls:[],sourceUrl:"https://www.example.org/"},
    {...proof,createdAt:null},
  ];
  for(const bad of rows)assert.equal(
    selectMarketEditorialCandidates({packets:[story()],evidence:[bad]}).length,0);
});
test("quiet frozen context retains its historical lineage and does not invent material change",()=>{
  const [candidate]=selectMarketEditorialCandidates({packets:[story("FROZEN_DOSSIER_CONTEXT")],evidence:[proof]});
  const [article]=validateMarketEditorialOutput(model(candidate.fingerprint),[candidate]);
  assert.equal(article.lineage,"FROZEN_DOSSIER_CONTEXT");
  assert.equal(article.materialChangeAt,null);
  assert.equal(article.asOf,asOf);
});
test("unsourced price rally and unknown numeric magnitudes cannot pass as observed market results",()=>{
  const [candidate]=selectMarketEditorialCandidates({packets:[story()],evidence:[proof]});
  const invented=model(candidate.fingerprint);
  invented.articles[0].paragraphs[2].text="TSM rallied 20% and lifted NDX after the news.";
  invented.articles[0].paragraphs[3].text="The company expects 82 billion new orders.";
  const [article]=validateMarketEditorialOutput(invented,[candidate]);
  assert.equal(article.readiness,"DEVELOPING");
  assert.deepEqual(article.paragraphs.map(p=>p.role),["development","mechanism"]);
  assert.ok(!article.paragraphs.some(p=>p.text.includes("20%")));
});
test("an invented source ID, bad fingerprint and irrelevant asset prevent editorial admission",()=>{
  const [candidate]=selectMarketEditorialCandidates({packets:[story()],evidence:[proof]});
  const bad=model(candidate.fingerprint);
  bad.articles[0].paragraphs[0].factIds=["33333333-3333-4333-8333-333333333333"];
  bad.articles[0].paragraphs[2].text="GOLD could rise if oil prices increase.";
  const [article]=validateMarketEditorialOutput(bad,[candidate]);
  assert.deepEqual(article.paragraphs.map(p=>p.role),["mechanism","outlook"]);
  assert.equal(article.readiness,"DEVELOPING");
  assert.deepEqual(validateMarketEditorialOutput(model("incorrect-fingerprint"),[candidate]),[]);
});
test("verified Motion is a separate factual edition product, never a thesis mutation",()=>{
  const p: MarketImpactPacketV1={
    ...story(),kind:"MOTION",evidenceCandidateIds:[],
    identity:{storyId,motionId,storyThesisVersionId:null,storySnapshotId:null,lineage:"VERIFIED_MOTION_ONLY"},
    development:{text:"The company published new factory guidance.",basis:"SOURCE_VERIFIED_MOTION",
      evidenceIds:[],sourceUrl:original},materialChangeAt:null,attentionAssessedAt:asOf,
  };
  const [candidate]=selectMarketEditorialCandidates({packets:[p],evidence:[]});
  assert.equal(candidate.facts[0].factId,"motion:"+motionId);
  const raw=model(candidate.fingerprint);
  raw.articles[0].paragraphs[0].factIds=["motion:"+motionId];
  raw.articles[0].paragraphs[0].text="The company published new factory guidance.";
  const [article]=validateMarketEditorialOutput(raw,[candidate]);
  assert.equal(article.kind,"MOTION");
  assert.equal(article.storyThesisVersionId,null);
  assert.equal(article.motionId,motionId);
  assert.deepEqual(article.paragraphs[0].evidenceIds,[]);
  assert.deepEqual(article.paragraphs[0].sourceUrls,[original]);
});
test("bounded candidate selection returns no model work when no original proof is available",()=>{
  assert.deepEqual(selectMarketEditorialCandidates({packets:[story()],evidence:[]}),[]);
  assert.equal(selectMarketEditorialCandidates({packets:Array(9).fill(story()),evidence:[proof]}).length,3);
});
