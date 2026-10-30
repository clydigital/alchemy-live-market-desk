import test from "node:test";
import assert from "node:assert/strict";
import type { MarketMonitorRow } from "../lib/market-monitor.ts";
import type { PublicSourceObservation } from "../lib/blue-desk-source-observations-projector.ts";
import {matchAssetSourceEvents,projectAssetTape} from "../lib/bluebelly-regime-asset-context.ts";

const now=new Date("2026-10-30T04:00:00Z");
const o=(id:string,description:string,eventAt="2026-10-29T17:00:00Z"):PublicSourceObservation=>({
 id,description,eventAt,recordedAt:eventAt,sourceTier:1,
 kind:"ORIGINAL_RELEASE",sourceName:"Issuer original",sourceUrl:"https://example.org/release/"+id,
});
const row=(id:string,last:number,previousClose:number|null,asOf:string,frequency:"daily"|"monthly"="daily"):MarketMonitorRow=>({
 id,symbol:id.toUpperCase(),label:id,type:"Rates",benchmark:null,last,previousClose,
 sessionOpen:null,dayChange:2,gapChange:null,change3d:null,change5d:null,
 rsi:null,stochRsi:null,volPercentile:null,relative5d:null,
 attentionScore:0,hot:false,contradiction:false,tags:[],asOf,frequency,
 sourceName:"Source feed",sourceUrl:"https://www.federalreserve.gov/releases/h15/",points:[],
});

test("asset-matched source hits exclude unrelated same-theme items and are source-dated",()=>{
 const src=[
  o("b","Official company reported strong Brent physical crude export inventories."),
  o("d","Diesel distillate inventories rose as refining capacity recovered."),
  o("e","Shell reported cash flow and upstream profits."),
  o("f","Meta Platforms reported infrastructure cash capex."),
  o("z","General AI market maker warned about market futures."),
 ];
 const before=structuredClone(src);
 assert.deepEqual(matchAssetSourceEvents("brent",src,now).items.map(x=>x.id),["b"]);
 assert.deepEqual(matchAssetSourceEvents("diesel",src,now).items.map(x=>x.id),["d"]);
 assert.deepEqual(matchAssetSourceEvents("energy-producers",src,now).items.map(x=>x.id),["e"]);
 assert.deepEqual(matchAssetSourceEvents("ai-buyers",src,now).items.map(x=>x.id),["f"]);
 assert.deepEqual(matchAssetSourceEvents("ai-suppliers",src,now).items.map(x=>x.id),[]);
 assert.deepEqual(src,before);
});

test("source matching rejects future/stale/unsafe posts and never treats missing reader as zero",()=>{
 const events=[
  o("old","Diesel exports fell.","2026-10-20T10:00:00Z"),
  o("future","Diesel prices rose.","2026-11-01T10:00:00Z"),
  {...o("unsafe","Diesel inventories"),sourceUrl:"http://example.org/unverified"},
  o("good","Diesel inventories fell."),
 ];
 assert.equal(matchAssetSourceEvents("diesel",events,now).items.length,1);
 assert.equal(matchAssetSourceEvents("diesel",[],now).state,"NO_MATCH");
 assert.equal(matchAssetSourceEvents("diesel",null,now).state,"UNAVAILABLE");
 assert.equal(matchAssetSourceEvents("diesel",[events[3],events[3]],now).items.length,1);
});

test("yield change uses basis points; price change uses percent; neither becomes fundamental bias",()=>{
 const rates=projectAssetTape("us10y",[row("us10y-fred",4.98,5.05,"2026-10-29")],now);
 assert.equal(rates.state,"DATED");
 assert.equal(rates.change,-7);
 assert.equal(rates.changeUnit,"bp");
 assert.equal(rates.last,4.98);
 const nasdaq=projectAssetTape("nasdaq",[row("nasdaq-comp",110,100,"2026-10-29")],now);
 assert.equal(nasdaq.change,10);
 assert.equal(nasdaq.changeUnit,"%");
 assert.equal(nasdaq.instrument,"NASDAQ-COMP");
});

test("stale, monthly, future, and absent prices cannot be passed off as current tape",()=>{
 assert.equal(projectAssetTape("brent",null,now).state,"UNAVAILABLE");
 assert.equal(projectAssetTape("brent",[],now).state,"MISSING");
 assert.equal(projectAssetTape("brent",[row("brent",75,70,"2026-10-19")],now).state,"STALE");
 assert.equal(projectAssetTape("brent",[row("brent",123.1,128.1,"2026-10-27")],now).state,"STALE");
 assert.equal(projectAssetTape("brent",[row("brent",75,70,"2026-10-19")],now).change,null);
 assert.equal(projectAssetTape("brent",[row("brent",75,70,"2026-11-02")],now).state,"MISSING");
 assert.equal(projectAssetTape("brent",[row("brent",75,70,"2026-10-29","monthly")],now).state,"MISSING");
 assert.equal(projectAssetTape("energy-producers",[row("brent",75,70,"2026-10-29")],now).state,"MISSING");
 assert.match(projectAssetTape("diesel",[],now).measurement||"",/not a diesel crack spread/i);
});
