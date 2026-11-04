import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  applyChartWatchApprovals,CHART_WATCH_PUBLIC_APPROVALS,
  isPublishedChartWatch,publishedChartWatchCount,
  type ChartWatchApproval,
} from "../lib/bluebelly-chart-watch.ts";
import type {NewsroomEditorialItem} from "../lib/bluebelly-newsroom-editorial.ts";
import type {VisualPayload} from "../lib/bluebelly-visual-evidence.ts";
import {isPublicVisualEligible} from "../lib/bluebelly-visual-evidence.ts";
import {getImmutableChartWatchEarningsEdition} from "../lib/blue-desk-earnings-results.ts";

const source="https://www.sec.gov/Archives/edgar/data/1045810/000104581026000075/";
const path="/key-stories?brief=reviewed-earnings-example";
const visual:VisualPayload={
  schema_version:"bluebelly.visual.v1",
  visual_id:"reviewed-figure-001",kind:"comparison",
  title:"Cash and funded debt, reported basis",
  description:"A dated balance-sheet comparison, not a real-time quote.",
  unit:"USD billion",
  as_of_et:"2026-10-31T16:00:00-04:00",
  retrieved_at:"2026-11-04T00:00:00Z",
  period_basis:"fiscal quarterly as-filed snapshot",
  columns:["Issuer","Cash","Debt"],rows:[["Example",40,20]],
  series:[{name:"Cash",values:[40]},{name:"Debt",values:[20]}],
  sources:[{url:source,publisher:"SEC EDGAR",observed_at:"2026-08-26T00:00:00Z"}],
  evidence_status:"ORIGINAL_VERIFIED",limitations:["Illustrative test fixture only."],
};
const editorial:NewsroomEditorialItem={
  id:"earnings-release:reviewed-earnings-example",
  headline:"Illustrative reviewed issuer result",
  summary:"An independently reviewed public event, not a private writing commission.",
  occurredAt:"2026-11-03T20:30:00Z",
  sourceName:"SEC EDGAR",sourceUrl:source,readerHref:path,
  topics:["earnings"],verificationLabel:"REVIEWED ISSUER RELEASE",
  why:"The company reported a financial change.",nextTest:"Next official filing.",
  kind:"earnings",
};
const approval:ChartWatchApproval={
  editorialId:editorial.id,sourceUrl:source,readerPath:path,
  reviewReceiptId:"review-20261104-source-exact",
  publicChartRights:true,visual,
};

test("Chart Watch publishes only the one owner-approved AMD edition, not private research",()=>{
  assert.equal(CHART_WATCH_PUBLIC_APPROVALS.length,1);
  assert.equal(CHART_WATCH_PUBLIC_APPROVALS[0]?.editorialId,"earnings-release:amd-2026q3");
  assert.equal(CHART_WATCH_PUBLIC_APPROVALS[0]?.reviewReceiptId,"40e519b6-7a94-8132-9f7c-f29dee2178bf");
  assert.equal(CHART_WATCH_PUBLIC_APPROVALS[0]?.publicChartRights,true);
  assert.equal(isPublicVisualEligible(CHART_WATCH_PUBLIC_APPROVALS[0]?.visual),true);
  assert.equal(publishedChartWatchCount([editorial]),0);
  assert.equal(isPublishedChartWatch(editorial),false);
  assert.equal(applyChartWatchApprovals([], [approval]).length,0);
});

test("only an existing approved public Newsroom item with exact identity, source, reader and visual is tagged",()=>{
  const [published]=applyChartWatchApprovals([editorial],[approval]);
  assert.equal(published.id,editorial.id);
  assert.equal(publishedChartWatchCount([published]),1);
  assert.equal(isPublishedChartWatch(published),true);
  assert.equal(published.chartWatch?.visual.visual_id,visual.visual_id);
  assert.equal(published.chartWatch?.reviewReceiptId,approval.reviewReceiptId);
  assert.equal(editorial.chartWatch,undefined); // original source projection not mutated
});

test("recycled titles or ambiguous approvals cannot attach a Chart Watch label",()=>{
  const noSource=applyChartWatchApprovals([editorial],[{...approval,sourceUrl:"https://example.org/rumour"}]);
  const wrongRoute=applyChartWatchApprovals([editorial],[{...approval,readerPath:"/owner/research"}]);
  const duplicate=applyChartWatchApprovals([editorial],[approval,approval]);
  const unknown=applyChartWatchApprovals([editorial],[{...approval,editorialId:"some-other-public-record"}]);
  for(const records of [noSource,wrongRoute,duplicate,unknown])
    assert.equal(publishedChartWatchCount(records),0);
});

test("private routes, unverified chart inputs and absent public rights are never public series items",()=>{
  const unverified={...visual,evidence_status:"RESEARCH_LEAD" as const};
  const noRights={...approval,publicChartRights:false as unknown as true};
  const pending={...approval,visual:unverified};
  const privateEntry={...editorial,readerHref:"/owner/research"};
  assert.equal(publishedChartWatchCount(applyChartWatchApprovals([editorial],[pending])),0);
  assert.equal(publishedChartWatchCount(applyChartWatchApprovals([editorial],[noRights])),0);
  assert.equal(publishedChartWatchCount(applyChartWatchApprovals([privateEntry],[{...approval,readerPath:"/owner/research"}])),0);
});

test("Newsroom user interaction only filters reviewed items, not every source-only alert",()=>{
  const read=(file:string)=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
  const newswire=read("components/blue-desk/BluebellyNewsWire.tsx");
  const feed=read("lib/bluebelly-public-newsroom-feed.ts");
  const oldPublisher=read("app/api/owner/editorial-publish/route.ts");
  assert.match(newswire,/data-newsroom-chart-watch-filter="approved-only"/);
  assert.match(newswire,/topic==="chart-watch"\?isPublishedChartWatch\(item\)/);
  assert.match(newswire,/data-chart-watch-source-ledger/);
  assert.match(newswire,/No reviewed Chart Watch articles are published yet/);
  assert.match(newswire,/topic==="chart-watch"\?false/);
  assert.match(feed,/applyChartWatchApprovals\(result\)/);
  assert.match(oldPublisher,/status:410/);
});

test("the source-exact AMD article is public on both clean and /blue-desk preview paths",()=>{
 const a=CHART_WATCH_PUBLIC_APPROVALS[0];
 const record=getImmutableChartWatchEarningsEdition(new Date("2026-11-04T00:10:00Z"));
 assert.ok(record);
 assert.equal(record.id,"amd-2026q3");
 assert.equal(record.sourceUrl,a.sourceUrl);
 assert.equal(getImmutableChartWatchEarningsEdition(new Date("2026-11-03T22:00:00Z")),null);
 assert.equal(getImmutableChartWatchEarningsEdition(new Date("2027-04-04T12:00:00Z"))?.id,"amd-2026q3");
 for(const readerHref of ["/key-stories?brief=amd-2026q3","/blue-desk/key-stories?brief=amd-2026q3"]){
  const item:NewsroomEditorialItem={
   ...editorial,id:a.editorialId,sourceUrl:record.sourceUrl,
   readerHref,headline:record.headline,
  };
  const projected=applyChartWatchApprovals([item]);
  assert.equal(publishedChartWatchCount(projected),1);
  assert.equal(projected[0].chartWatch?.reviewReceiptId,a.reviewReceiptId);
 }
});
