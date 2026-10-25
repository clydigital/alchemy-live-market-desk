import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {projectSourceObservations} from "../lib/blue-desk-source-observations-projector.ts";
import {projectPublicTheses} from "../lib/blue-desk-thesis-ledger.ts";

const NOW=new Date("2026-10-25T18:24:00.000Z");
const release={
 id:"8f7ac58d-c576-4af6-901d-263128ae8cef",
 evidence_class:"market_observation",
 claim_text:"TSM Nasdaq official market close $418.51 on 2026-10-23. This is a prior session measurement, not proof of AI valuation.",
 event_at:"2026-10-23T23:59:59.999Z",
 received_at:"2026-10-24T13:34:28.224Z",
 provenance_urls:["https://www.nasdaq.com/market-activity/stocks/tsm/historical"],
 freshness_status:"current",
 source:{source_name:"Nasdaq official stocks history",source_type:"data_provider",source_tier:2,
  source_url:"https://www.nasdaq.com/market-activity/stocks/tsm/historical"},
};

test("last completed primary market observations are admitted with original event clock",()=>{
 const accepted=projectSourceObservations([release],NOW,8);
 assert.equal(accepted.length,1);
 assert.equal(accepted[0].kind,"MARKET_OBSERVATION");
 assert.equal(accepted[0].eventAt,"2026-10-23T23:59:59.999Z");
 assert.equal(accepted[0].sourceTier,2);
 assert.match(accepted[0].sourceUrl,/nasdaq.com/);
});

test("creator, reporting tier, future, stale, bad provenance and process notes cannot appear as source-verified",()=>{
 const probes=[
  {...release,evidence_class:"transcript"},
  {...release,evidence_class:"news_report"},
  {...release,source:{...release.source,source_tier:3}},
  {...release,event_at:"2026-10-26T02:00:00Z"},
  {...release,event_at:"2026-10-20T23:59:59.999Z"},
  {...release,provenance_urls:["http://example.com/p"],source:{...release.source,source_url:"http://example.com/p"}},
  {...release,claim_text:"Research Gap ingestion pipeline status ready with source summary."},
  {...release,freshness_status:"aging"},
 ];
 for(const item of probes)assert.deepEqual(projectSourceObservations([item],NOW),[],
  "rejects unsafe test variant "+String(item.evidence_class)+" "+String(item.event_at));
});
test("multiple repeated pulls of one measurement never create extra headlines",()=>{
 assert.equal(projectSourceObservations([release,{...release,id:"2f7ac58d-c576-4af6-901d-263128ae8cef"}],NOW).length,1);
});
test("real Story IDs and dated long-lived thesis snapshots survive news expiry",()=>{
 const story={
  id:"261d7726-6503-4603-8570-055177846859",
  slug:"ai-financing-stress", title:"AI Boom Hits the Cost of Capital",
  status:"publish",rank:1,updated_at:"2026-10-07T14:01:37.972Z",
  market_question:"Is the market beginning to price financing constraints for AI?",
  thesis:"AI spending and markets may diverge from AI financing costs as new projects seek external funding.",
  strongest_support:"Observed AI debt spreads widening",
  strongest_contradiction:"The long-end yield rise may have independent fiscal explanations",
  confirmation_trigger:"Further credit spread widening",
  invalidation_trigger:"Credit conditions improve",
  next_catalyst:"Issuer financing disclosures",
 };
 const got=projectPublicTheses([story],NOW);
 assert.equal(got.length,1);
 assert.equal(got[0].slug,"ai-financing-stress");
 assert.equal(got[0].updatedAt,"2026-10-07T14:01:37.972Z");
 assert.match(got[0].contradiction,/independent/);
 assert.equal(projectPublicTheses([{...story,status:"develop"}],NOW).length,1);
 assert.equal(projectPublicTheses([{...story,rank:null}],NOW).length,1);
 assert.deepEqual(projectPublicTheses([{...story,updated_at:"2026-10-27T00:00:00Z"}],NOW),[]);
});

test("public blue desk reads original-source evidence but never exposes admin or hidden thesis versions to browser",()=>{
 const reader=readFileSync(new URL("../lib/blue-desk-source-observations.ts",import.meta.url),"utf8");
 const ledger=readFileSync(new URL("../lib/blue-desk-thesis-ledger-server.ts",import.meta.url),"utf8");
 const home=readFileSync(new URL("../app/blue-desk/page.tsx",import.meta.url),"utf8");
 const stories=readFileSync(new URL("../app/blue-desk/key-stories/page.tsx",import.meta.url),"utf8");
 assert.match(reader,/import "server-only"/);
 assert.match(reader,/projectSourceObservations/);
 assert.doesNotMatch(reader,/\.(?:insert|update|upsert|delete)\(/);
 assert.match(ledger,/getSupabasePublicConfig/);
 assert.doesNotMatch(ledger,/createSupabaseAdminClient/);
 assert.doesNotMatch(ledger,/story_thesis_versions/);
 assert.match(home,/getPublicThesisLedger/);
 assert.match(home,/getPublicSourceObservations/);
 assert.match(stories,/data-persistent-thesis-ledger="source-identity"/);
 assert.match(stories,/Last updated/);
});
