import test from "node:test";
import assert from "node:assert/strict";
import {SECONDARY_QUOTE_SPECS,parseSecondary,recheckSecondary} from "../lib/bluebelly-secondary-quote-core.ts";
const now=new Date("2026-11-26T11:21:00Z");
const spec=SECONDARY_QUOTE_SPECS.find(s=>s.symbol==="JPY=X")!;
const make=(m:Record<string,unknown>={})=>({chart:{error:null,result:[{meta:{symbol:spec.symbol,instrumentType:spec.type,currency:spec.currency,regularMarketPrice:154,regularMarketTime:+now/1000-60,...m}}]}});
test("secondary quote requires exact native symbol, type, currency and timestamp",()=>{
 const q=parseSecondary(spec,make(),now);
 assert.equal(q.state,"recent");assert.equal(q.price,154);
 for(const m of [{symbol:"FXY"},{currency:"USD"},{instrumentType:"ETF"},{regularMarketTime:undefined},{regularMarketTime:+now/1000+60},{regularMarketPrice:0}]){
  assert.equal(parseSecondary(spec,make(m),now).state,"unavailable");
 }
 assert.equal(recheckSecondary(q,new Date(+now+31*60000)).state,"old");
 assert.equal(parseSecondary(spec,make({regularMarketTime:+now/1000-86400}),now).state,"old");
});
test("futures are explicitly named and never masquerade as spot",()=>{
 for(const s of SECONDARY_QUOTE_SPECS.filter(s=>s.type==="FUTURE"))assert.match(s.label,/futures/);
 assert.equal(new Set(SECONDARY_QUOTE_SPECS.map(s=>s.symbol)).size,SECONDARY_QUOTE_SPECS.length);
});
