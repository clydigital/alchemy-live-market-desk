import assert from "node:assert/strict";
import test from "node:test";
import {scanRegimeViews,summarizeRegimeScans} from "../lib/bluebelly-regime-view-scan.ts";
import type {PublicThesis} from "../lib/blue-desk-thesis-ledger.ts";
import type {PublicSourceObservation} from "../lib/blue-desk-source-observations-projector.ts";

const now=new Date("2026-11-01T00:00:00.000Z");
function story(partial:Partial<PublicThesis>={}):PublicThesis {
 return {
  id:"261d7726-6503-4603-8570-055177846859",slug:"fed-inflation-policy",
  title:"Fed policy inflation and yields",question:"Does the Fed's view change?",
  thesis:"Higher inflation may keep the Federal Reserve from easing as quickly as equities expect.",
  support:"Official inflation data",contradiction:"Weaker labour market",
  confirmation:"Inflation accelerates",invalidation:"Inflation cools",
  nextTest:"Next PCE",pricedAssessment:"Uncertain",status:"monitor",
  updatedAt:"2026-10-31T14:40:00.000Z",createdAt:"2026-10-10T12:00:00.000Z",
  rank:3,...partial,
 };
}
function source(partial:Partial<PublicSourceObservation>={}):PublicSourceObservation {
 return {
  id:"4ca089de-b3c7-4e4d-bb48-e124e84b3e9c",
  kind:"ORIGINAL_RELEASE",description:"The Federal Reserve published an updated FOMC inflation policy statement.",
  eventAt:"2026-10-31T15:00:00.000Z",recordedAt:"2026-10-31T16:00:00.000Z",
  sourceName:"Federal Reserve",sourceUrl:"https://www.federalreserve.gov/newsevents/pressreleases/monetary.htm",
  sourceTier:1,...partial,
 };
}

test("newly created views are separated from previously tracked record updates",()=>{
 const newView=story({id:"b486f4ae-581a-48c7-8486-f8ce08b3200d",createdAt:"2026-10-31T16:30:00.000Z"});
 const existing=story();
 const scan=scanRegimeViews("fed","2026-10-30",[existing,newView],[],now);
 assert.equal(scan.state,"NEW_VIEW");
 assert.deepEqual(scan.newViews.map(x=>x.id),[newView.id]);
 assert.deepEqual(scan.updatedRecords.map(x=>x.id),[existing.id]);
 assert.equal(scan.sourceInputs.length,0);
});
test("MYT-reviewed day does not generate false new view alerts",()=>{
 const old=story({updatedAt:"2026-10-30T15:59:59.000Z",createdAt:"2026-10-30T10:00:00.000Z"});
 const scan=scanRegimeViews("fed","2026-10-30",[old],[],now);
 assert.equal(scan.state,"NO_NEW_INPUT");
});
test("recent original-source inputs surface a review request but never change verdict",()=>{
 const scan=scanRegimeViews("fed","2026-10-30",[],[source()],now);
 assert.equal(scan.state,"NEW_SOURCE");
 assert.equal(scan.sourceInputs.length,1);
 assert.equal(scan.latestInputAt,"2026-10-31T16:00:00.000Z");
});
test("unrelated source does not contaminate another research lens",()=>{
 const scan=scanRegimeViews("fed","2026-10-30",[],[
  source({description:"Nvidia disclosed chip shipment and artificial intelligence capex investment."}),
 ],now);
 assert.equal(scan.sourceInputs.length,0);
 assert.equal(scan.state,"NO_NEW_INPUT");
});
test("partial/unavailable reads are explicit, not presented as no updates",()=>{
 assert.equal(scanRegimeViews("fed","2026-10-30",null,null,now).state,"UNAVAILABLE");
 assert.equal(scanRegimeViews("fed","2026-10-30",null,[],now).state,"PARTIAL");
 assert.equal(scanRegimeViews("fed","2026-10-30",[],null,now).state,"PARTIAL");
 assert.equal(summarizeRegimeScans([
  scanRegimeViews("fed","2026-10-30",null,[],now),
  scanRegimeViews("ai","2026-10-30",[],[],now),
 ]).incompleteLenses,1);
});
test("invalid review dates and future inputs do not trigger changes",()=>{
 assert.equal(scanRegimeViews("fed","2026-10-32",[story()],[],now).state,"UNAVAILABLE");
 assert.equal(scanRegimeViews("fed","2026-10-30",[story({updatedAt:"2026-11-02T00:00:00Z"})],[],now).state,"NO_NEW_INPUT");
});
