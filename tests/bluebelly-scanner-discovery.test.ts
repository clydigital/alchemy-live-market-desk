import test from "node:test";
import assert from "node:assert/strict";
import {buildScannerDiscovery} from "../lib/bluebelly-scanner-discovery.ts";
import type {PublicMarketObservation as Row} from "../lib/blue-desk-public-markets.ts";
const now=new Date("2026-11-24T04:00:00Z");
function row(symbol:string,type:Row["type"],change:number,change3d:number,change5d:number,asOf="2026-11-23"):Row{
 return {id:symbol,label:symbol,symbol,type,last:100,change,change3d,change5d,asOf,changeUnit:"%",frequency:"daily",sourceName:"Test",sourceUrl:"https://example.com/"+symbol};
}
test("scanner anchors equity date and uses sector-relative returns",()=>{
 const r=buildScannerDiscovery([
  row("RSP","Major Index",2,2,4),row("XLK","Sector",4,4,3),row("MSFT","MAG7",1,0,-2),
  row("NVDA","MAG7",8,9,10),row("BTCUSD","Crypto",-3,-3,-3,"2026-11-24"),
  row("QQQ","Major Index",5,5,5),row("IBIT","Crypto",-2,-3,-3),
  row("AAPL","MAG7",-10,-10,-10,"2026-11-20"),
 ],now);
 assert.equal(r.session,"2026-11-23");
 assert.equal(r.laggards[0]?.symbol,"MSFT");
 assert.equal(r.rotation[0]?.symbol,"XLK");
 assert.ok(r.cross.some(x=>x.symbol==="IBIT / QQQ"));
 assert.equal(r.gainers[0]?.symbol,"NVDA");
 assert.equal(r.stockCoverage,2);
 assert.equal(r.rebound.length,0);
});
test("scanner refuses stale or missing evidence",()=>{
 const r=buildScannerDiscovery([row("RSP","Major Index",1,1,1,"2026-11-10"),
 {...row("NVDA","MAG7",2,3,4),sourceUrl:null},
 {...row("MSFT","MAG7",2,3,4),dataStatus:"UNAVAILABLE_OR_STALE"},
 {...row("AAPL","MAG7",2,3,4),change:null}],now);
 assert.equal(r.session,null);assert.equal(r.coverage,0);assert.equal(r.laggards.length,0);
});
