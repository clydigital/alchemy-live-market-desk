import test from "node:test";
import assert from "node:assert/strict";
import {scanDirectEma,directEmaIdentity} from "../lib/bluebelly-direct-ema.ts";
import {replayRespectedBand} from "../lib/bluebelly-ema-trend-replay.ts";
const btc={id:"btc",symbol:"BTCUSD",frequency:"daily",sourceName:"Coinbase Exchange BTC-USD spot",sourceUrl:"https://exchange.coinbase.com/trade/BTC-USD"};
test("direct BTC uses completed UTC days, including weekends; live candle excluded",()=>{
 const now=new Date("2026-11-26T12:00:00Z"),end=Date.parse("2026-11-26T00:00:00Z");
 const p=Array.from({length:150},(_,i)=>({time:(end-(149-i)*86400000)/1000,close:100+i}));
 const result=scanDirectEma(btc,p,now)!;
 assert.equal(result.scope.status,"CURRENT");
 assert.equal(result.scan.asOf,"2026-11-25");
 assert.equal(result.scan.observations.find(o=>o.frame==="D"&&o.period===20)?.sampleCount,149);
 assert.equal(scanDirectEma(btc,p.slice(0,-2),now)?.scope.status,"BEHIND");
 assert.equal(scanDirectEma(btc,[...p,p[0]],now),null);
 assert.equal(directEmaIdentity({...btc,symbol:"IBIT"}),null);
 assert.equal(directEmaIdentity({id:"gold",symbol:"XAUUSD",frequency:"daily",sourceName:"XAUS XAU/USD cash",sourceUrl:"https://xaus.com/api/"}),null);
});
test("fixing is source-dated, never represented as a live FX candle",()=>{
 const fx={id:"usdjpy",symbol:"JPY=X",frequency:"daily",sourceName:"European Central Bank",sourceUrl:"https://data.ecb.europa.eu/data/datasets/EXR/EXR.D.JPY.EUR.SP00.A"};
 const p=Array.from({length:150},(_,i)=>({time:(Date.parse("2026-11-25T00:00:00Z")-(149-i)*86400000)/1000,close:100+i/10}));
 const r=scanDirectEma(fx,p,new Date("2026-11-26T12:00:00Z"))!;
 assert.equal(r.scope.status,"SOURCE_DATED");assert.equal(r.scope.kind,"REFERENCE_FIXING");assert.equal(r.scope.expectedSession,null);
});
test("last respected close-band state confirms and invalidates only after opposite hold",()=>{
 const bars=(closes:number[])=>closes.map((close,i)=>({day:String(i+1),close,upper:105,lower:95}));
 assert.equal(replayRespectedBand(bars([110,100])),null);
 const active=replayRespectedBand(bars([110,100,108,90,90]))!;
 assert.equal(active.direction,"BULLISH");assert.equal(active.status,"ACTIVE");assert.equal(active.retestedOn,"2");
 const invalid=replayRespectedBand(bars([110,100,108,90,90,90]))!;
 assert.equal(invalid.status,"INVALIDATED");assert.equal(invalid.invalidatedOn,"6");
 assert.equal(replayRespectedBand(bars([90,100,90]))?.direction,"BEARISH");
});
