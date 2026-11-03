import test from "node:test";
import assert from "node:assert/strict";
import {parseVisualPayload,isPublicVisualEligible,type VisualPayload} from "../lib/bluebelly-visual-evidence.ts";
import {applyChartWatchApprovals,publishedChartWatchCount} from "../lib/bluebelly-chart-watch.ts";
import type {NewsroomEditorialItem} from "../lib/bluebelly-newsroom-editorial.ts";

/**
 * Public original-source example captured 4 Nov 2026; demonstration NOT a
 * publishing receipt, not a linked live chart and not a future earnings feed.
 * Source: AMD 3 Nov 2026 Q3 results and SEC 8-K 0000002488-26-000188.
 */
const release="https://newsroom.amd.com/news/amd-reports-third-quarter-2026-earnings/";
const filing="https://www.sec.gov/Archives/edgar/data/2488/000000248826000188/amdq32026earningsslidesf.htm";
const basis={
  schema_version:"bluebelly.visual.v1" as const,
  as_of_et:"2026-11-03T18:44:34-05:00",
  retrieved_at:"2026-11-03T23:44:34Z",
  period_basis:"As-reported AMD fiscal Q3 2025 and Q3 2026; source published 3 Nov 2026 ET.",
  sources:[
    {url:release,publisher:"AMD",observed_at:"2026-11-03T23:44:34Z"},
    {url:filing,publisher:"SEC EDGAR",observed_at:"2026-11-03T23:44:34Z"},
  ],
  evidence_status:"ORIGINAL_VERIFIED" as const,
};
const segment:VisualPayload={
  ...basis,
  visual_id:"amd-2026-q3-segment-growth",
  kind:"bar",
  title:"AMD revenue by reportable segment, USD billions",
  description:"Original issuer comparatives; Data Centre accounted for more than consolidated net growth.",
  unit:"USD billions",
  columns:["Segment","Q3 2025","Q3 2026"],
  rows:[
    ["Data Centre",4.341,8.546],
    ["Client & Gaming",4.048,3.722],
    ["Embedded",0.857,1.109],
  ],
  series:[
    {name:"Q3 2025",values:[4.341,4.048,.857]},
    {name:"Q3 2026",values:[8.546,3.722,1.109]},
  ],
  limitations:["One issuer filing vintage, no price-reaction causality.","An original source is not a market-data redistribution licence."],
};
const fcf:VisualPayload={
  ...basis,
  visual_id:"amd-2026-q3-reported-fcf",
  kind:"comparison",
  title:"AMD free cash flow, USD billions",
  description:"Reported continuing-operations-basis FCF, Q3 2025 vs Q3 2026.",
  unit:"USD billions",
  columns:["Measure","Q3 2025","Q3 2026"],
  rows:[["Free cash flow",1.530,0.554]],
  series:[
    {name:"Q3 2025",values:[1.530]},
    {name:"Q3 2026",values:[0.554]},
  ],
  limitations:["Q3 2025 total CFO includes $0.371bn of discontinued-operations cash flow. Continuing-operations CFO $1.788bn minus PP&E $0.258bn equals $1.530bn reported FCF.","Q3 2026 CFO $1.202bn minus capex $0.648bn equals $0.554bn."],
};

test("4 Nov issuer original provides a valid source-dated chart pair",()=>{
  for(const data of [segment,fcf]){
    assert.ok(parseVisualPayload(data));
    assert.equal(isPublicVisualEligible(data),true);
    assert.ok(data.sources.some(s=>s.url===filing));
    assert.ok(data.period_basis.includes("Q3 2026"));
  }
});
test("Q3 data-center growth exceeds the company's entire net revenue increase",()=>{
  const dataCenterDelta=8.546-4.341;
  const companyDelta=13.377-9.246;
  assert.ok(dataCenterDelta>companyDelta);
  assert.ok(Math.abs((dataCenterDelta/companyDelta)*100-101.79)<0.1);
  assert.ok(Math.abs((3.722-4.048)+(1.109-.857)+0.074)<1e-9);
});
test("free cash flow decline is not based on discontinued-operations CFO",()=>{
  assert.ok(Math.abs((1.788-.258)-1.530)<1e-9);
  assert.ok(Math.abs((1.202-.648)-.554)<1e-9);
  assert.ok(Math.abs((1-.554/1.530)*100-63.79)<0.1);
  // Incorrect total-CFO-minus-capex calculation would have misstated 2025 FCF.
  assert.notEqual(Math.round((2.159-.258)*1000),1530);
});
test("verified numeric issuer evidence alone cannot publish a Chart Watch article",()=>{
  const item:NewsroomEditorialItem={
    id:"test:AMD-2026-Q3",headline:"AMD Q3 private Chart Watch",
    summary:"Not an approved public release",
    occurredAt:"2026-11-03T22:00:00Z",
    sourceName:"AMD",sourceUrl:release,
    readerHref:"/key-stories?brief=amd-q3-2026",
    topics:["ai","earnings"],verificationLabel:"PRIVATE RESEARCH ONLY",
    why:"AI revenue acceleration versus working-capital conversion.",
    nextTest:"Verify next-quarter OCF and FCF.",
    kind:"earnings",
  };
  const publicList=applyChartWatchApprovals([item]);
  assert.equal(publishedChartWatchCount(publicList),0);
  assert.equal(publicList[0].chartWatch,undefined);
});
