import test from "node:test";
import assert from "node:assert/strict";
import {buildMarketDivergenceWatch} from "../lib/bluebelly-market-divergence-watch.ts";
import type {PublicMarketObservation} from "../lib/blue-desk-public-markets.ts";
import {readFileSync} from "node:fs";

function row(symbol:string,change:number|null,change3d:number|null,change5d:number|null,asOf="2026-11-06"):PublicMarketObservation{
  return {id:symbol,symbol,label:symbol,type:"Sector",last:100,change,change3d,change5d,
    changeUnit:"%",asOf,frequency:"daily",sourceName:"Fixture",sourceUrl:"https://example.com/"+symbol};
}
test("opposite moves are observed only on matched source sessions",()=>{
  const readings=buildMarketDivergenceWatch([
    row("SMH",-3,-6,-9),row("QQQ",2,3,4),row("XLK",1,1,1),row("XLF",2,2,2),
  ],"5D");
  const semis=readings.find(r=>r.id==="semis-vs-nasdaq")!;
  assert.equal(semis.status,"OPPOSITE_MOVE");
  assert.equal(semis.leftChange,-9);
  assert.equal(semis.rightChange,4);
  assert.equal(semis.gapPp,-13);
  assert.equal(semis.sourceSession,"2026-11-06");
  assert.equal(readings[0].id,"semis-vs-nasdaq");
});
test("mismatched, unavailable, stale and nonpercent rows fail closed",()=>{
  const shifted=buildMarketDivergenceWatch([row("SMH",-2,-3,-4),row("QQQ",2,3,4,"2026-11-05")],"5D");
  assert.equal(shifted.find(r=>r.id==="semis-vs-nasdaq")!.status,"NOT_COMPARABLE");
  assert.equal(shifted.find(r=>r.id==="semis-vs-nasdaq")!.gapPp,null);
  const stale=buildMarketDivergenceWatch([
    {...row("SMH",-2,-3,-4),dataStatus:"UNAVAILABLE_OR_STALE"},row("QQQ",2,3,4),
  ],"1D");
  assert.equal(stale.find(r=>r.id==="semis-vs-nasdaq")!.status,"NOT_COMPARABLE");
  const units=buildMarketDivergenceWatch([
    {...row("SMH",-2,-3,-4),changeUnit:"bp"},row("QQQ",2,3,4),
  ],"1D");
  assert.equal(units.find(r=>r.id==="semis-vs-nasdaq")!.status,"NOT_COMPARABLE");
  const missing=buildMarketDivergenceWatch([row("SMH",-2,-3,null),row("QQQ",2,3,4)],"5D");
  assert.equal(missing.find(r=>r.id==="semis-vs-nasdaq")!.status,"NOT_COMPARABLE");
});
test("comparison chooses newest matched ETFs and prefers one provider on tied dates",()=>{
 const nasdaq="Nasdaq official etf history";
 const baseRSP={...row("RSP",2,3,4,"2026-11-13"),sourceName:"Core market price feed"};
 const sameExchangeRSP={...row("RSP",-1,-2,-3,"2026-11-12"),sourceName:nasdaq};
 const spy={...row("SPY",0.5,1,2,"2026-11-12"),sourceName:nasdaq};
 const match=buildMarketDivergenceWatch([baseRSP,sameExchangeRSP,spy],"1D")
  .find(r=>r.id==="equal-vs-cap")!;
 assert.equal(match.status,"OPPOSITE_MOVE");
 assert.equal(match.sourceSession,"2026-11-12");
 assert.equal(match.leftChange,-1);
 const sameDateCore={...row("RSP",9,9,9,"2026-11-12"),sourceName:"Core market price feed"};
 const preferred=buildMarketDivergenceWatch([sameDateCore,sameExchangeRSP,spy],"1D")
  .find(r=>r.id==="equal-vs-cap")!;
 assert.equal(preferred.leftChange,-1,"same-session Nasdaq ETF source preferred on tied dates");
 const mismatched=buildMarketDivergenceWatch([sameExchangeRSP,{...spy,asOf:"2026-11-13"}],"1D")
  .find(r=>r.id==="equal-vs-cap")!;
 assert.equal(mismatched.status,"NOT_COMPARABLE");
 assert.match(mismatched.reason!,/Unmatched source sessions/);
});
test("window selection changes measurements rather than substituting 1D",()=>{
  const input=[row("SMH",-3,4,6),row("QQQ",2,1,1)];
  const d1=buildMarketDivergenceWatch(input,"1D").find(r=>r.id==="semis-vs-nasdaq")!;
  const d3=buildMarketDivergenceWatch(input,"3D").find(r=>r.id==="semis-vs-nasdaq")!;
  assert.equal(d1.status,"OPPOSITE_MOVE");
  assert.equal(d3.status,"RELATIVE_MOVE");
  assert.equal(d3.gapPp,3);
});
test("Markets retains one screener, preserves source controls and has a separate watch mode",()=>{
  const page=readFileSync(new URL("../app/blue-desk/markets/page.tsx",import.meta.url),"utf8");
  const screener=readFileSync(new URL("../components/blue-desk/PublicMarketScreener.tsx",import.meta.url),"utf8");
  assert.match(page,/data-markets-working-modes/);
  assert.match(page,/mode=watch/);
  assert.match(page,/<MarketDivergenceWatch/);
  assert.match(page,/<PublicMarketScreener key=\{group\}/);
  assert.match(screener,/sortEtfComparisonRows/);
  assert.match(screener,/sortPublicMarketColumns/);
  assert.match(screener,/mode === "assets"/);
});

test("Rates category preserves source-gated sovereign and FedWatch tools from the older PR",()=>{
  const page=readFileSync(new URL("../app/blue-desk/markets/page.tsx",import.meta.url),"utf8");
  const rates=readFileSync(new URL("../components/blue-desk/RatesPolicyMonitor.tsx",import.meta.url),"utf8");
  assert.match(page,/mode==="assets"&&group==="rates"\?fetchJapanMofJgbYields/);
  assert.match(page,/mode==="assets"&&group==="rates"\?fetchBundesbankBund10/);
  assert.match(page,/mode==="assets"&&group==="rates"\?fetchBoeGilt10/);
  assert.match(page,/<RatesPolicyMonitor observations=/);
  assert.match(page,/publicGovernmentRateTrends\(monitor\?\.rows\|\|\[\]\)/);
  assert.match(page,/<PublicTreasuryLadder rows=/);
  assert.match(rates,/Matching dated observations unavailable/);
  assert.match(rates,/CME FedWatch target-rate probabilities require/);
  assert.doesNotMatch(rates,/Math\.random|Math\.sin/);
});
