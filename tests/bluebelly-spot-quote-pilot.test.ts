import test from "node:test";
import assert from "node:assert/strict";
import {parseSpotQuote} from "../lib/bluebelly-spot-quote-core.ts";
const now=new Date("2026-11-26T11:21:00Z");
test("crypto ticker requires source trade time and positive price",()=>{
 assert.equal(parseSpotQuote("BTC/USD",{price:"80000",time:"2026-11-26T11:20:00Z"},now).state,"fresh");
 assert.equal(parseSpotQuote("ETH/USD",{price:"3000",time:"2026-11-26T11:10:00Z"},now).state,"stale");
 assert.equal(parseSpotQuote("ETH/USD",{price:"3000"},now).price,null);
 assert.equal(parseSpotQuote("ETH/USD",{price:"3000",time:"2026-11-26T11:22:00Z"},now).state,"unavailable");
 assert.equal(parseSpotQuote("ETH/USD",{price:"0",time:"2026-11-26T11:20:00Z"},now).price,null);
});
test("gold uses documented source state and time, not generated timestamp",()=>{
 assert.equal(parseSpotQuote("XAU/USD",{spot_usd_oz:4000,data_state:{status:"stale",as_of:"2026-11-26T11:20:00Z"}},now).state,"stale");
 assert.equal(parseSpotQuote("XAU/USD",{spot_usd_oz:4000,data_state:{status:"fresh",as_of:"2026-11-26T10:20:00Z"}},now).state,"stale");
 assert.equal(parseSpotQuote("XAU/USD",{spot_usd_oz:4000,updated_at:now.toISOString()},now).price,null);
 assert.equal(parseSpotQuote("XAU/USD",{spot_usd_oz:4000,data_state:{status:"unavailable",as_of:now.toISOString()}},now).price,null);
});
