import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildMarketCompassSummary} from "../lib/bluebelly-market-compass.ts";
import {buildMarketDivergenceWatch} from "../lib/bluebelly-market-divergence-watch.ts";
import type {PublicMarketObservation} from "../lib/blue-desk-public-markets.ts";

function etf(symbol:string,delta:number,date="2026-11-12"):PublicMarketObservation{
 return {id:"etf-"+symbol,symbol,label:symbol,type:"Major Index",last:100,change:delta,
 change3d:null,change5d:null,changeUnit:"%",asOf:date,frequency:"daily",
 sourceName:"Nasdaq official etf history",
 sourceUrl:"https://www.nasdaq.com/market-activity/etf/"+symbol.toLowerCase()+"/historical"};
}
test("SPY and exchange-sourced RSP are explicit monitor ETFs, not a renamed S&P index",()=>{
 const source=readFileSync(new URL("../lib/market-monitor.ts",import.meta.url),"utf8");
 assert.match(source,/id: "spy", providerSymbol: "SPY", assetClass: "etf"/);
 assert.match(source,/id: "rsp-exchange", providerSymbol: "RSP", assetClass: "etf"/);
 assert.match(source,/id: "spx-proxy", sourceSymbol: "\^GSPC"/);
 assert.match(source,/extras-v9-compass-etfs/);
});
test("actual four-ETF same-day close yields an ordinal equity direction",()=>{
 const reads=buildMarketDivergenceWatch([
  etf("SMH",-1.5),etf("QQQ",0.8),etf("RSP",-0.2),etf("SPY",0.4)
 ],"1D");
 const result=buildMarketCompassSummary(reads,new Date("2026-11-13T14:00:00Z"));
 assert.equal(result.state,"MIXED");
 assert.equal(result.sourceSession,"2026-11-12");
 assert.match(result.contradiction,/opposite directions/);
});
test("a missing SPY never substitutes the cash S&P 500 index",()=>{
 const reads=buildMarketDivergenceWatch([
  etf("SMH",1.5),etf("QQQ",0.8),etf("RSP",0.2),
  {...etf("^GSPC",0.4),id:"spx-proxy",symbol:"^GSPC",sourceName:"Index"}
 ],"1D");
 assert.equal(reads.find(x=>x.id==="equal-vs-cap")?.status,"NOT_COMPARABLE");
 const verdict=buildMarketCompassSummary(reads,new Date("2026-11-13T14:00:00Z"));
 assert.equal(verdict.state,"UNMEASURED");
 assert.match(verdict.explanation,/SPY/);
});
