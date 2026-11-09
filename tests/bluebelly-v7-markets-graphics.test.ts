import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectEtfRotationVisual} from "../lib/bluebelly-etf-rotation-visuals.ts";
import type {PublicMarketObservation} from "../lib/blue-desk-public-markets.ts";

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
function etf(symbol:string,asOf:string|null,change:number|null,change3d:number|null,change5d:number|null):PublicMarketObservation{
  return {
    id:`test-${symbol}`,symbol,label:symbol,type:"Sector",last:100,
    change,change3d,change5d,changeUnit:"%",frequency:"daily",asOf,
    sourceName:"Source fixture",sourceUrl:null,
  };
}
test("XL rotation graphic compares only selected, same-session percent returns",()=>{
  const all=[
    etf("XLK","2026-11-06",2.5,4.5,7.1),
    etf("XLF","2026-11-06",-1.0,-2.0,-3.0),
    etf("XLE","2026-11-05",8,10,12),
    etf("XLV","2026-11-06",null,null,null),
    {...etf("MIXED","2026-11-06",25,30,32),changeUnit:"bp" as const},
  ];
  const result=projectEtfRotationVisual(all,["XLK","XLF","XLE","XLV","MIXED"],"1D");
  assert.ok(result);
  assert.equal(result.asOf,"2026-11-06");
  assert.deepEqual(result.bars.map(x=>x.symbol),["XLK","XLF"]);
  assert.deepEqual(result.bars.map(x=>x.display),["+2.50%","-1.00%"]);
  assert.equal(result.omitted,3);
  assert.equal(result.bars[0].leftPercent,50);
  assert.ok(result.bars[1].leftPercent<50);
  assert.ok(result.bars.every(x=>x.widthPercent>=0&&x.widthPercent<=49));
});
test("chart window is exact 3D/5D, and same-session/missingness fails closed",()=>{
  const rows=[etf("XLK","2026-11-06",1,2,null),etf("XLE","2026-11-06",2,-3,null)];
  const graph=projectEtfRotationVisual(rows,["XLK","XLE"],"3D");
  assert.deepEqual(graph?.bars.map(x=>x.display),["+2.00%","-3.00%"]);
  assert.equal(projectEtfRotationVisual(rows,["XLK","XLE"],"5D"),null);
  assert.equal(projectEtfRotationVisual(rows,["XLK"],"1D"),null);
  assert.equal(projectEtfRotationVisual([rows[0],{...rows[1],asOf:"2026-11-05"}],["XLK","XLE"],"1D"),null);
  assert.equal(projectEtfRotationVisual([rows[0],{...rows[1],dataStatus:"UNAVAILABLE_OR_STALE"}],["XLK","XLE"],"1D"),null);
});
test("CP Markets visuals stay tied to the canonical screener and source dates",()=>{
  const page=read("app/blue-desk/markets/page.tsx");
  const screener=read("components/blue-desk/PublicMarketScreener.tsx");
  const treasury=read("components/blue-desk/PublicTreasuryLadder.tsx");
  const css=read("app/blue-desk/markets/legibility.module.css");
  assert.match(page,/getMarketMonitor\(\)/);
  assert.match(page,/data-market-breadth-watch="research-first"/);
  assert.doesNotMatch(page,/<CurrentMarketUpdates host=\{host\} mode="compact"\/>/);
  assert.ok(page.indexOf('data-market-breadth-watch="research-first"')
    <page.indexOf('aria-label="Related market investigation"'));
  assert.ok(page.indexOf('href="#breadth-watch-heading"')<page.indexOf('href="#jobs-monitor"'));
  assert.match(page,/reading\.dataStatus==="SOURCE_DATED_SECONDARY"/);
  assert.match(page,/--breadth-fill/);
  assert.match(page,/reading\.asOf\|\|"unavailable"/);
  assert.match(page,/<PublicTreasuryLadder rows=\{publicMarketObservations\(monitor\?\.rows\|\|\[\],"rates"\)\}/);
  assert.match(page,/<PublicMarketScreener key=\{group\} observations=\{observations\}/);
  assert.match(page,/aria-labelledby="market-group-heading"/);
  assert.ok(page.indexOf('data-market-breadth-watch="research-first"')
    <page.indexOf('aria-labelledby="market-group-heading"'));
  assert.ok(page.indexOf('aria-labelledby="market-group-heading"')
    <page.indexOf('aria-label="Related market investigation"'));
  assert.match(screener,/data-v7-etf-rotation="source-matched"/);
  assert.match(screener,/projectEtfRotationVisual\(comparisonUniverse,compareSymbols,graphicWindow\)/);
  assert.match(screener,/aria-pressed=\{graphicWindow===period\}/);
  assert.match(screener,/sortEtfComparisonRows/);
  assert.match(screener,/filterPublicMarketObservations/);
  assert.match(screener,/setQuery\(event\.target\.value\)/);
  assert.match(screener,/const \[window, setWindow\] = useState<MarketChangeWindow>\("1D"\)/);
  assert.match(screener,/Sort ETF comparison by/);
  assert.match(screener,/All XL sectors/);
  assert.match(screener,/RSP vs XL sectors/);
  assert.match(screener,/Semis vs market/);
  assert.match(screener,/data-market-advanced="optional"/);
  assert.match(treasury,/source-dated-us-only/);
  assert.match(treasury,/Official|official/);
  assert.match(treasury,/change3d=\{available\?row!\.change3d:null\}/);
  assert.match(treasury,/unit="bp"/);
  assert.match(treasury,/row\?\.sourceUrl/);
  assert.match(css,/conic-gradient/);
  assert.doesNotMatch(screener,/Math\.random|Math\.sin/);
  assert.doesNotMatch(treasury,/Math\.random|Math\.sin/);
});
