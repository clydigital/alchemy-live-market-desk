import test from "node:test";
import assert from "node:assert/strict";
import {nasdaqCompletedSessionRange,admitNasdaqSessionDay} from "../lib/bluebelly-nasdaq-session-range.ts";
import {expectedHomeEtfSession} from "../lib/bluebelly-home-etf-history.ts";
const stamp=(day:string)=>Date.parse(day+"T00:00:00Z")/1000;
test("request boundary may extend one day but observed session never does",()=>{
 const expected=expectedHomeEtfSession(new Date("2026-11-25T22:00:00Z"))!;
 assert.equal(expected,"2026-11-25");
 const range=nasdaqCompletedSessionRange(expected,470);
 assert.equal(range.to,"2026-11-26");
 assert.equal(admitNasdaqSessionDay(stamp("2026-11-25"),expected),true);
 assert.equal(admitNasdaqSessionDay(stamp("2026-11-26"),expected),false);
 assert.equal(admitNasdaqSessionDay(stamp("2026-11-27"),expected),false);
});
test("Thanksgiving and early-close calendar keep a stable completed session boundary",()=>{
 assert.equal(expectedHomeEtfSession(new Date("2026-11-26T22:00:00Z")),"2026-11-25");
 assert.equal(expectedHomeEtfSession(new Date("2026-11-27T18:14:00Z")),"2026-11-25");
 assert.equal(expectedHomeEtfSession(new Date("2026-11-27T18:16:00Z")),"2026-11-27");
 assert.equal(admitNasdaqSessionDay(stamp("2026-11-26"),"2026-11-27"),false);
 assert.equal(admitNasdaqSessionDay(stamp("2026-11-21"),"2026-11-27"),false);
 assert.throws(()=>nasdaqCompletedSessionRange("2026-11-26",470));
});
