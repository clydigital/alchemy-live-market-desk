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
 const row=buildMarketToolsCorrelations([prices("^GSPC",1)],[monitor("vixy",prices("VIXY",-1,50))],NOW)
  .find(p=>p.id==="equity-vol")!;
 assert.equal(row.status,"measured");
 assert.equal(row.values[20].coefficient,-1);
 assert.equal(row.values[60].coefficient,null);
 assert.match(row.proxyNote,/NOT the VIX spot index/);
});
