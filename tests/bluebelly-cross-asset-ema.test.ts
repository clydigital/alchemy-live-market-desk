import test from "node:test";
import assert from "node:assert/strict";
import {crossAssetEmaIdentity,scanCrossAssetEma,CROSS_ASSET_DEEP_ETFS} from "../lib/bluebelly-cross-asset-ema.ts";
const now=new Date("2026-11-25T22:00:00Z");
const spy={id:"spx-proxy",symbol:"^GSPC",frequency:"daily",sourceName:"Nasdaq official etf history",sourceUrl:"https://www.nasdaq.com/market-activity/etf/spy/historical"};
const cash={id:"spx",symbol:"SP500",frequency:"daily",sourceName:"S&P Dow Jones Indices via FRED",sourceUrl:"https://fred.stlouisfed.org/series/SP500"};
test("ETF proxy and cash index are exact distinct identities",()=>{
 assert.equal(CROSS_ASSET_DEEP_ETFS.length,12);
 assert.deepEqual(crossAssetEmaIdentity(spy),{instrument:"SPY",kind:"ETF"});
 assert.deepEqual(crossAssetEmaIdentity(cash),{instrument:"SP500",kind:"CASH_INDEX"});
 assert.equal(crossAssetEmaIdentity({...cash,sourceUrl:spy.sourceUrl}),null);
 assert.equal(crossAssetEmaIdentity({...spy,frequency:"monthly"}),null);
 assert.equal(crossAssetEmaIdentity({id:"gold",symbol:"XAUUSD",frequency:"daily",sourceName:"XAUS XAU/USD cash",sourceUrl:"https://xaus.com/api/"}),null);
});
test("current and lagging ETF histories remain separately identified, future and intraday excluded",()=>{
 const end=Date.parse("2026-11-25T00:00:00Z");
 const points=Array.from({length:180},(_,i)=>({time:(end-(179-i)*86400000)/1000,close:100+i*.01}));
 const s=scanCrossAssetEma(spy,[...points,{time:end/1000+86400,close:200},{time:end/1000+3600,close:300}],now)!;
 assert.equal(s.scope.status,"CURRENT");assert.equal(s.scan.asOf,"2026-11-25");
 assert.equal(s.scan.observations.find(o=>o.frame==="D"&&o.period===20)?.warmup,"READY");
 assert.equal(scanCrossAssetEma(spy,points.slice(0,-1),now)?.scope.status,"BEHIND");
 assert.equal(scanCrossAssetEma(spy,[...points,points.at(-1)!],now),null);
});
