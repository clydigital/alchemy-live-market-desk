import test from "node:test";
import assert from "node:assert/strict";
import {rankClose,parseMassiveDay,parseTwelveDaily} from "../lib/bluebelly-provider-widget-data.ts";
test("Massive widget only admits known instruments and positive prices",()=>{
 assert.deepEqual(parseMassiveDay({status:"OK",results:[{T:"SPY",c:700},{T:"BAD",c:2},{T:"XLK",c:0}]},"2026-11-23"),{SPY:700});
 assert.deepEqual(parseMassiveDay({status:"ERROR",results:[{T:"SPY",c:700}]},"2026-11-23"),{});
});
test("Daily comparisons require a distinct prior session",()=>{
 assert.equal(rankClose("SPY",[{day:"2026-11-23",close:700}])?.change,null);
 assert.equal(rankClose("SPY",[{day:"2026-11-23",close:110},{day:"2026-11-20",close:100}])?.change?.toFixed(2),"10.00");
});
test("Twelve Data excludes current partial daily candle and rejects symbol mismatch",()=>{
 const root={status:"ok",meta:{symbol:"XAU/USD",interval:"1day"},values:[{datetime:"2026-11-24",close:"999"},{datetime:"2026-11-23",close:"3600"},{datetime:"2026-11-20",close:"3500"}]};
 const row=parseTwelveDaily(root,"XAU/USD","2026-11-24");
 assert.equal(row?.close,3600);assert.equal(row?.priorDay,"2026-11-20");
 assert.equal(parseTwelveDaily(root,"USD/JPY","2026-11-24"),null);
});
