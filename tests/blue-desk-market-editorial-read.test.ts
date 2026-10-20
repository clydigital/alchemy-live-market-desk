import assert from "node:assert/strict";
import test from "node:test";
import { projectBlueDeskMarketEditorial, BLUE_DESK_EDITORIAL_READ_V1 } from "../lib/blue-desk-market-editorial-read.ts";

const E="6b86e83a-cd22-4cc2-a37d-0c914f0d5340";
const S="6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e";
const T="85d6149f-50b2-4bc9-a07f-7de152675541";
const P="2e99dc08-f707-4ec4-936c-80c6b4aa5953";
const U="https://pr.tsmc.com/english/news/3346";
const OTHER="https://investors.coreweave.com/news/earnings";
const asOf="2026-10-20T16:19:12.015Z";
const hash="a".repeat(32);
function sample(): any {
  return {
    id:E,published_at:"2026-10-20T16:20:00Z",
    payload:{
      canonicalStoryManifest:[{state:{privateEvidence:"DO_NOT_DISPLAY"}}],
      dossier:{lessons:[{secret:"DO_NOT_DISPLAY"}]},
      marketEditorial:{
        contractVersion:"market-editorial/v1",
        articles:[{
          contractVersion:"market-editorial/v1", fingerprint:hash,
          kind:"STORY",storyId:S,storyThesisVersionId:T,storySnapshotId:P,
          lineage:"FROZEN_DOSSIER_CONTEXT",readiness:"READY",
          asOf,materialChangeAt:null,
          headline:"Why is the market rewarding AI-related backlog and guidance despite evidence that cash conversion lags?",
          evidenceCandidateIds:["secret"],
          paragraphs:[
            {role:"development",
              text:"Taiwan Semiconductor Manufacturing Company reported 2026Q3 net revenue of 46.72 USD_billion.",
              evidenceState:"SOURCE_VERIFIED",evidenceIds:["private-claim-uuid"],sourceUrls:[U]},
            {role:"mechanism",
              text:"Foundry demand can support earnings, although customer capital spending is not the same as free cash flow.",
              evidenceState:"CANONICAL_INTERPRETATION",evidenceIds:[],sourceUrls:[]},
            {role:"markets",
              text:"TSM could benefit if chip orders continue, while NDX exposure is conditional on broader technology earnings.",
              evidenceState:"CONDITIONAL",evidenceIds:[],sourceUrls:[]},
            {role:"outlook",
              text:"Customer financing costs remain a risk. Management guidance is the next observable test.",
              evidenceState:"CONDITIONAL",evidenceIds:[],sourceUrls:[]},
          ],
          sourceLinks:[
            {url:U,sourceName:"TSMC investor relations"},
            {url:OTHER,sourceName:"CoreWeave investor relations"},
          ],
          hidden:{audit:"DO_NOT_DISPLAY"},
        }],
      },
    },
  };
}
test("public projection contains only admitted articles and directly used links",()=>{
  const x=projectBlueDeskMarketEditorial(sample());
  assert.ok(x);
  assert.equal(x.contractVersion,BLUE_DESK_EDITORIAL_READ_V1);
  assert.equal(x.editionId,E);
  assert.equal(x.articles.length,1);
  const a=x.articles[0];
  assert.equal(a.context,"CONTINUING_STORY");
  assert.equal(a.materialChangeAt,null);
  assert.ok(!a.title.startsWith("Why"));
  assert.ok(a.title.length<=63);
  assert.deepEqual(a.sourceLinks,[{url:U,sourceName:"TSMC investor relations"}]);
  assert.equal(a.paragraphs[0].sources[0].url,U);
  const serial=JSON.stringify(x);
  assert.doesNotMatch(serial,/DO_NOT_DISPLAY|private-claim-uuid|marketImpactPackets|canonicalStoryManifest|storyThesisVersionId|storySnapshotId|evidenceCandidateIds|CoreWeave investor relations/);
});
test("future-dated content, unadmitted statuses and absent claim sources fail closed",()=>{
  const future=sample();
  future.payload.marketEditorial.articles[0].asOf="2026-10-22T00:00:00Z";
  assert.equal(projectBlueDeskMarketEditorial(future)?.articles.length,0);
  const noSource=sample();
  noSource.payload.marketEditorial.articles[0].paragraphs[0].sourceUrls=[];
  assert.equal(projectBlueDeskMarketEditorial(noSource)?.articles.length,0);
  const draft=sample();
  draft.payload.marketEditorial.articles[0].readiness="DEVELOPING";
  assert.equal(projectBlueDeskMarketEditorial(draft)?.articles.length,0);
});
test("rejects forged Story identities and invalid context claims",()=>{
  const v=sample();
  v.payload.marketEditorial.articles[0].storyThesisVersionId="not-a-version";
  assert.equal(projectBlueDeskMarketEditorial(v)?.articles.length,0);
  const x=sample();
  x.payload.marketEditorial.articles[0].materialChangeAt="2026-10-19T14:00:00Z";
  assert.equal(projectBlueDeskMarketEditorial(x)?.articles.length,0);
});
test("when exact version has a supported changed timestamp, read model labels it material",()=>{
  const x=sample();
  x.payload.marketEditorial.articles[0].lineage="EXACT_EDITION_MANIFEST";
  x.payload.marketEditorial.articles[0].materialChangeAt="2026-10-19T14:00:00Z";
  const a=projectBlueDeskMarketEditorial(x)?.articles[0];
  assert.equal(a?.context,"MATERIAL_STORY_CHANGE");
  assert.equal(a?.materialChangeAt,"2026-10-19T14:00:00.000Z");
});
test("verified Motion is clearly distinct from accepted Story analysis",()=>{
  const x=sample();
  const a=x.payload.marketEditorial.articles[0];
  a.kind="MOTION";a.lineage="VERIFIED_MOTION_ONLY";
  a.storyThesisVersionId=null;a.storySnapshotId=null;a.materialChangeAt=null;
  const read=projectBlueDeskMarketEditorial(x)?.articles[0];
  assert.equal(read?.kind,"MOTION");
  assert.equal(read?.context,"VERIFIED_EVENT");
  const forged=sample();
  forged.payload.marketEditorial.articles[0].kind="MOTION";
  assert.equal(projectBlueDeskMarketEditorial(forged)?.articles.length,0);
});
test("wrong source mapping, unsafe URLs, process notes and unsupported roles do not publish",()=>{
  const wrong=sample();
  wrong.payload.marketEditorial.articles[0].paragraphs[0].sourceUrls=["https://unrelated.example.com/article"];
  assert.equal(projectBlueDeskMarketEditorial(wrong)?.articles.length,0);
  const unsafe=sample();
  unsafe.payload.marketEditorial.articles[0].sourceLinks[0].url="http://unsecure.example.com/article";
  assert.equal(projectBlueDeskMarketEditorial(unsafe)?.articles.length,0);
  const process=sample();
  process.payload.marketEditorial.articles[0].paragraphs[0].text="Observed by Research Gap at 2026-10-20: a claim is classified as unverified.";
  assert.equal(projectBlueDeskMarketEditorial(process)?.articles.length,0);
  const roles=sample();
  roles.payload.marketEditorial.articles[0].paragraphs[2].role="outlook";
  assert.equal(projectBlueDeskMarketEditorial(roles)?.articles.length,0);
});
test("no editorial publication, malformed edition identity and bogus contract fail closed",()=>{
  assert.equal(projectBlueDeskMarketEditorial({id:E,published_at:asOf,payload:{}}),null);
  assert.equal(projectBlueDeskMarketEditorial({id:"fake",published_at:asOf,payload:sample().payload}),null);
  const contract=sample();
  contract.payload.marketEditorial.contractVersion="market-editorial/v2";
  assert.equal(projectBlueDeskMarketEditorial(contract),null);
});
