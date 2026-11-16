import test from "node:test";
import assert from "node:assert/strict";
import {projectLiveLensResearch,liveLensSignal} from "../lib/bluebelly-regime-live-research.ts";
import {EDITORIAL_REGIME_LENSES} from "../lib/bluebelly-editorial-architecture.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";
import type {PublicMarketObservation} from "../lib/blue-desk-public-markets.ts";
import type {RegimeDirectionId} from "../lib/bluebelly-regime-direction-reads.ts";
import type {RegimeMeterReading} from "../lib/bluebelly-regime-market-meter.ts";
const now=new Date("2026-11-16T04:00:00Z");
const titles=["Federal Reserve CPI","Treasury auction","Nvidia GPU capacity","China export controls","Crude oil inventories","Bank of Japan yen rates","S&P 500 equity breadth","Gold reserve holdings","Mortgage rates and home sales"];
const news:NewsBriefV1[]=titles.map((headline,i)=>({id:String(i),contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",headline,summary:"Reported original source update.",sourceName:"Issuer",sourceUrl:"https://example.org/release/"+i,sourceKind:"official",occurredAt:"2026-11-15T00:00:00Z",observedAt:"2026-11-15T01:00:00Z",verification:"SOURCE_VERIFIED"}));
test("one shared ledger fans out fresh qualified receipts to all nine lenses without new retrieval",()=>{
 for(const [i,lens] of EDITORIAL_REGIME_LENSES.entries()){
  const read=projectLiveLensResearch(lens.id,[...news,news[i]],[],[],null,now);
  assert.equal(read.facts.filter(r=>r.id===String(i)).length,1,lens.id);
  assert.equal(read.partial,true);
 }
});
test("stale and future facts are not a current observation",()=>{
 const read=projectLiveLensResearch("fed",[{...news[0],occurredAt:"2026-11-01T00:00:00Z"},{...news[0],occurredAt:"2026-11-17T00:00:00Z"}],[],[],null,now);
 assert.equal(read.facts.length,0);
});
test("four additional proxies show actual dated sessions, not a synthetic verdict",()=>{
 const rows:PublicMarketObservation[]=["csi300","usdjpy","gold","us10y-fred"].map(id=>({id,label:id,symbol:id,type:id==="us10y-fred"?"Rates":"FX",last:100,change:1,change3d:null,change5d:null,changeUnit:id==="us10y-fred"?"bp":"%",frequency:"daily",sourceName:"source",sourceUrl:"https://example.org/data",asOf:"2026-11-13"}));
 const readings={} as Record<RegimeDirectionId,RegimeMeterReading>;
 assert.equal(liveLensSignal("china",readings,rows,now).tone,"improving");
 assert.equal(liveLensSignal("yen",readings,rows,now).tone,"mixed");
 assert.equal(liveLensSignal("gold",readings,rows,now).tone,"improving");
 assert.equal(liveLensSignal("housing",readings,rows,now).tone,"pressure");
 assert.match(liveLensSignal("housing",readings,rows,now).scope,/not mortgage/);
 assert.equal(liveLensSignal("housing",readings,rows,new Date("2026-11-25")).tone,"unknown");
});
