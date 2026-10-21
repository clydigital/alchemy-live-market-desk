import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {buildPresenterPrepEditorialReadiness} from "../lib/presenter-prep-editorial-readiness.ts";

const BASE="b4033b64-c1e9-41a9-9e8f-d99fa94905e7";
const EDITION="44842161-a48d-4a64-95dd-93a6bbe6f0d0";
const STORY="6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e";
const THESIS="c1b12524-77f2-4a78-80c5-34854898c64d";
const SNAPSHOT="93c4b401-bc7e-4fa9-ac8b-1ba900c5a446";
const ASOF="2026-10-21T02:02:42.815Z";
const PUBLISHED="2026-10-21T02:06:04.771Z";
const SOURCE_URL="https://pr.tsmc.com/english/news/3346";
const CLAIMS=[
  "dcd63f17-2f70-4bf8-9c0b-b39c57b20f2a",
  "02cac7ef-cbef-4568-9f2e-33015a2ccf8c",
  "974105a2-be20-4831-a124-cd500f97126c",
];
const rich=[
  "Taiwan Semiconductor Manufacturing Company reported that the manufacturing segment expanded during its latest quarterly reporting period, as shown in the issuer release. The subsequent statement sets out the exact period and corresponding scope of consolidated manufacturing operations.",
  "The same issuer disclosed a separate margin development in its quarterly financial statement, with an accounting scope and a stated comparison period. This additional factual statement is distinct from observed prices, credit spreads or other inferred market reaction.",
  "A verified operating statement described a separate measurement of financial resources committed during the specified accounting period, rather than a forecast for the market. Its issuer release also defined the timing and cash-flow categories applicable to the reported figures.",
];
function packet(){
  return {
    kind:"STORY",asOf:ASOF,
    headline:"AI spending and cash conversion",
    identity:{storyId:STORY,storyThesisVersionId:THESIS,storySnapshotId:SNAPSHOT,
      lineage:"FROZEN_DOSSIER_CONTEXT"},
  };
}
function identity(){
  return {storyId:STORY,storyThesisVersionId:THESIS,storySnapshotId:SNAPSHOT,asOf:ASOF,
    materialChangeAt:null,kind:"STORY",lineage:"FROZEN_DOSSIER_CONTEXT"};
}
function brief(){
  return {contractVersion:"market-editorial/v1",fingerprint:"frozen-brief",...identity(),
    headline:"AI earnings facts",readiness:"READY",gaps:[],
    sourceLinks:[{url:SOURCE_URL,sourceName:"TSMC"}],
    paragraphs:[
      {role:"development",text:"TSMC released an issuer-reported quarterly figure.",
        evidenceIds:[CLAIMS[0]],sourceUrls:[SOURCE_URL],evidenceState:"SOURCE_VERIFIED"},
      {role:"mechanism",text:"Demand could support supplier margins under the frozen Story.",
        evidenceIds:[],sourceUrls:[],evidenceState:"CONTEXT_ONLY"},
      {role:"markets",text:"TSM may benefit if foundry utilisation remains high.",
        evidenceIds:[],sourceUrls:[],evidenceState:"CONDITIONAL"},
    ],
  };
}
function full(){
  return {contractVersion:"article-sections/2",fingerprint:"article-v2",...identity(),
    context:"CONTINUING_STORY",readiness:"FULL_ARTICLE",gaps:[],
    reporting:rich.map((text,i)=>({
      text,evidenceIds:[CLAIMS[i]],sourceUrls:[SOURCE_URL],sourceName:"TSMC",
      sourceAvailableAt:"2026-10-20T07:00:00.000Z",basis:"SOURCE_VERIFIED",
    })),
    interpretation:[
      {text:"Demand may support manufacturing revenues, but cash conversion could lag.",
        evidenceIds:[],sourceUrls:[],basis:"HISTORICAL_CONTEXT",support:"mechanism",asset:null},
      {text:"TSM might benefit if foundry utilisation holds.",
        evidenceIds:[],sourceUrls:[],basis:"CONDITIONAL",support:"asset",asset:"TSM"},
    ],
    sourceLinks:[{url:SOURCE_URL,sourceName:"TSMC"}],
  };
}
function fixture(){
  return {presenterStatus:"READY" as const,
    pinned:{editionId:EDITION,publishedAt:PUBLISHED},
    selectedEdition:{id:EDITION,publishedAt:PUBLISHED,supersedesSnapshotId:BASE as string|null,
      payload:{
        marketImpactPackets:[packet()],
        marketEditorial:{
          contractVersion:"market-editorial/v1",parentEditionId:BASE,articles:[brief()],
        },
        marketEditorialSectionsV2:{
          contractVersion:"article-sections/2",parentEditionId:BASE,articles:[full()],
        },
      } as Record<string,unknown>},
    focusedStoryId:STORY,
  };
}
test("a full article displays only source-backed paragraphs, frozen mechanism and exact as-of",()=>{
  const result=buildPresenterPrepEditorialReadiness(fixture());
  assert.equal(result.status,"HAS_EDITORIAL");
  assert.equal(result.contractVersion,"presenter-prep-editorial-read/1");
  assert.equal(result.selectedEditionId,EDITION);
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].kind,"FULL_ARTICLE");
  assert.equal(result.items[0].asOf,ASOF);
  assert.equal(result.items[0].materialChangeAt,null);
  assert.deepEqual(result.items[0].reporting.map(x=>x.text),rich);
  assert.ok(result.items[0].reporting.every(x=>x.sourceUrl===SOURCE_URL));
  assert.equal(result.items[0].implications[0].basis,"HISTORICAL_CONTEXT");
  assert.equal(result.items[0].marketReaction,"NOT_ESTABLISHED_BY_EDITORIAL");
});
test("valid v1 source-backed brief is not promoted to full V2 article",()=>{
  const x=fixture();delete x.selectedEdition.payload.marketEditorialSectionsV2;
  const result=buildPresenterPrepEditorialReadiness(x);
  assert.equal(result.items[0]?.kind,"FACTUAL_BRIEF");
  assert.equal(result.items[0]?.reporting.length,1);
  assert.equal(result.items[0]?.reporting[0].availableAt,null);
});
test("developing brief never claims verified fact without citation and exact UUID",()=>{
  const x=fixture();delete x.selectedEdition.payload.marketEditorialSectionsV2;
  const article=((x.selectedEdition.payload.marketEditorial as any).articles as any[])[0];
  article.readiness="DEVELOPING";article.paragraphs[0].evidenceIds=["unverified"];
  const result=buildPresenterPrepEditorialReadiness(x);
  assert.equal(result.items[0]?.kind,"DEVELOPING");
  assert.equal(result.items[0]?.reporting.length,0);
  assert.ok(result.items[0]?.gaps.some(x=>x.includes("factual opening")));
});
test("invalid/historical-selected edition does not fall back to a newer editorial source",()=>{
  const x=fixture();x.presenterStatus="UNAVAILABLE" as "READY";
  assert.equal(buildPresenterPrepEditorialReadiness(x).status,"UNAVAILABLE");
  assert.deepEqual(buildPresenterPrepEditorialReadiness(x).items,[]);
  const y=fixture();y.pinned.editionId=BASE;
  assert.equal(buildPresenterPrepEditorialReadiness(y).status,"UNAVAILABLE");
  const z=fixture();delete z.selectedEdition.payload.marketEditorialSectionsV2;
  delete z.selectedEdition.payload.marketEditorial;
  assert.equal(buildPresenterPrepEditorialReadiness(z).status,"NO_EDITORIAL");
});
test("wrong base parent, Story thesis identity or publisher SOURCE_URL cannot cross edition boundary",()=>{
  for(const change of [
    (x:ReturnType<typeof fixture>)=>{(x.selectedEdition.payload.marketEditorialSectionsV2 as any).parentEditionId="other";},
    (x:ReturnType<typeof fixture>)=>{((x.selectedEdition.payload.marketEditorialSectionsV2 as any).articles[0]).storyThesisVersionId="wrong";},
    (x:ReturnType<typeof fixture>)=>{((x.selectedEdition.payload.marketEditorialSectionsV2 as any).articles[0]).storySnapshotId="wrong";},
    (x:ReturnType<typeof fixture>)=>{((x.selectedEdition.payload.marketEditorialSectionsV2 as any).articles[0]).reporting[0].sourceUrls=["https://fake.example/article"];},
    (x:ReturnType<typeof fixture>)=>{((x.selectedEdition.payload.marketEditorialSectionsV2 as any).articles[0]).reporting[0].sourceAvailableAt="2026-10-22T00:00:00Z";},
    (x:ReturnType<typeof fixture>)=>{((x.selectedEdition.payload.marketEditorialSectionsV2 as any).articles[0]).reporting[0].sourceUrls=["javascript:alert(1)"];},
  ]){
    const x=fixture();change(x);
    const result=buildPresenterPrepEditorialReadiness(x);
    assert.equal(result.items[0]?.kind,"FACTUAL_BRIEF","invalid V2 must not promote, valid pinned V1 may remain");
  }
});
test("a later composed publication cannot be borrowed by a pinned historical base",()=>{
  const x=fixture();
  x.selectedEdition.id=BASE;x.pinned.editionId=BASE;
  x.selectedEdition.supersedesSnapshotId=null;
  assert.equal(buildPresenterPrepEditorialReadiness(x).status,"NO_EDITORIAL");
});
test("private Presenter Prep shows evidence, holes and caveats without generating or publishing",()=>{
  const page=readFileSync(new URL("../app/hybrid-output/prepare/page.tsx",import.meta.url),"utf8");
  assert.match(page,/buildPresenterPrepEditorialReadiness/);
  assert.match(page,/Editorial readiness — PRE-PRODUCTION/);
  assert.match(page,/NOT ESTABLISHED BY THIS EDITORIAL RECORD/);
  assert.match(page,/No admitted editorial for this exact edition/);
  assert.match(page,/item\.materialChangeAt/);
  assert.match(page,/item\.reporting/);
  assert.match(page,/sourceUrl/);
  assert.match(page,/<PresenterPrepSession/);
  assert.doesNotMatch(page,/marketEditorialSectionsV2Enabled|setMarketEditorialSectionsV2|runStructuredStage/);
});
