import assert from "node:assert/strict";
import test from "node:test";

import { buildMarketToolsCorrelations } from "../lib/market-tools-correlations.ts";
import type { MarketSeries } from "../lib/market.ts";
import type { MarketMonitorRow } from "../lib/market-monitor.ts";

const NOW=new Date("2026-10-28T12:00:00Z");
function prices(symbol:string,sign=1,n=180):MarketSeries {
 let price=100;
 const start=Date.parse("2026-05-01T00:00:00Z")/1000;
 const points=Array.from({length:n},(_,i)=>{
   if(i>0)price*=Math.exp(sign*(0.002+0.007*Math.sin(i/7)));
   return {time:start+i*86400,close:price};
 });
 return {symbol,label:symbol,sourceName:"Test source",sourceUrl:"https://example.org/data",points,
   last:points.at(-1)!.close,change5d:null,change21d:null};
}
function monitor(id:string,series:MarketSeries):MarketMonitorRow {
 return {id,label:id,symbol:id,frequency:"daily",sourceName:"Official test source",
  sourceUrl:"https://example.org/data",points:series.points,asOf:"2026-10-27"} as MarketMonitorRow;
}

test("20, 60 and 120 windows use the same aligned dated returns, not prices",()=>{
 const rows=buildMarketToolsCorrelations([prices("UUP",1),prices("GLD",-1)],[],NOW);
 const pair=rows.find(p=>p.id==="dollar-gold")!;
 assert.equal(pair.status,"measured");
 assert.equal(pair.asOf,"2026-10-27");
 for(const n of [20,60,120] as const){
   assert.equal(pair.values[n].observations,n);
   assert.equal(pair.values[n].coefficient,-1);
 }
 assert.match(pair.proxyNote,/neither is the DXY index/);
});

test("US two-year yield uses bp changes and USDJPY uses log returns",()=>{
 const base=prices("JPY=X",1);
 const dailyRates=base.points.map((p,i)=>({time:p.time,close:3.5+0.001*i+0.05*Math.sin(i/7)}));
 const fx=base.points.map((p,i)=>({time:p.time,close:100*Math.exp((dailyRates[i].close-3.5)*20)}));
 const usdJpy={...base,points:fx};
 const dgs2=monitor("us2y",{...base,points:dailyRates});
 const pair=buildMarketToolsCorrelations([usdJpy],[dgs2],NOW).find(p=>p.id==="2y-yen")!;
 assert.equal(pair.status,"measured");
 assert.equal(pair.values[20].coefficient,1);
 assert.equal(pair.values[60].coefficient,1);
});

test("unavailable provider and zero-variance return series fail closed",()=>{
 const absent=buildMarketToolsCorrelations([],[],NOW).find(p=>p.id==="dollar-gold")!;
 assert.equal(absent.status,"unavailable");
 assert.equal(absent.values[20].coefficient,null);
 const flat=prices("GLD",1);
 flat.points=flat.points.map(x=>({...x,close:100}));
 const row=buildMarketToolsCorrelations([prices("UUP",1),flat],[],NOW).find(p=>p.id==="dollar-gold")!;
 assert.equal(row.status,"insufficient");
 assert.equal(row.values[120].coefficient,null);
});

test("old original observations retain stale label regardless of retrieval time",()=>{
 const row=buildMarketToolsCorrelations([prices("UUP",1,145),prices("GLD",-1,145)],[],NOW)
  .find(p=>p.id==="dollar-gold")!;
 assert.equal(row.status,"stale");
 assert.equal(row.values[120].observations,120);
});

test("spot VIX is not silently fabricated from a futures ETF",()=>{
 const vixy=prices("VIXY",-1);vixy.points=vixy.points.slice(-50);
 const row=buildMarketToolsCorrelations([prices("^GSPC",1)],[monitor("vixy",vixy)],NOW)
  .find(p=>p.id==="equity-vol")!;
 assert.equal(row.status,"measured");
 assert.equal(row.values[20].coefficient,-1);
 assert.equal(row.values[60].coefficient,null);
 assert.match(row.proxyNote,/NOT the VIX spot index/);
});

test("private long-history override unlocks 120-session results without changing public 64-point view",()=>{
  const market=prices("GLD",1);
  const rate=monitor("us10y-real",prices("DFII10",-1));
  const publicRate={...rate,points:rate.points.slice(-64)};
  const without=buildMarketToolsCorrelations([market],[publicRate],NOW)
    .find(p=>p.id==="gold-real-yield")!;
  assert.equal(without.values[120].coefficient,null);
  const withExtended=buildMarketToolsCorrelations([market],[publicRate],NOW,[rate])
    .find(p=>p.id==="gold-real-yield")!;
  assert.equal(withExtended.values[120].observations,120);
  assert.equal(withExtended.status,"measured");
  assert.equal(publicRate.points.length,64);
});
test("private override never substitutes an older history over a newer source date",()=>{
  const market=prices("GLD",1);
  const newer=monitor("us10y-real",prices("DFII10",-1));
  newer.points=newer.points.slice(-64);
  const older=monitor("us10y-real",prices("DFII10",-1));
  older.points=older.points.slice(0,-20);
  const p=buildMarketToolsCorrelations([market],[newer],NOW,[older])
    .find(p=>p.id==="gold-real-yield")!;
  assert.equal(p.values[120].coefficient,null);
  assert.equal(p.dateRight,"2026-10-27");
});

test("expanded cross-asset families are read-only and preserve proxy disclosure",()=>{
 const ids=["yen-carry-equities","rates-dollar","real-yields-growth","equal-weight-breadth",
  "semis-nasdaq","miners-gold","credit-equities","oil-energy-equities","brent-distillate"];
 const rows=buildMarketToolsCorrelations([],[],NOW);
 assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
 for(const id of ids){
  const pair=rows.find(r=>r.id===id);
  assert.ok(pair,`Missing expanded pair: ${id}`);
  assert.equal(pair.status,"unavailable");
  assert.ok(pair.proxyNote.length>40);
  assert.equal(pair.values[20].coefficient,null);
 }
});
test("new semi and breadth pairs use matched returns, and credit fails closed without spread",()=>{
 const rows=buildMarketToolsCorrelations(
  [prices("RSP",1),prices("^GSPC",1),prices("SOXX",-1),prices("^IXIC",1)],[],NOW);
 const breadth=rows.find(p=>p.id==="equal-weight-breadth")!;
 const semis=rows.find(p=>p.id==="semis-nasdaq")!;
 const credit=rows.find(p=>p.id==="credit-equities")!;
 assert.equal(breadth.status,"measured");
 assert.equal(breadth.values[60].coefficient,1);
 assert.equal(semis.values[20].coefficient,-1);
 assert.equal(credit.status,"unavailable");
});
