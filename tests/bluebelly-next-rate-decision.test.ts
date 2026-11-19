import test from "node:test";
import assert from "node:assert/strict";
import {buildFedRateWatch,nextFomcDecision} from "../lib/bluebelly-next-rate-decision.ts";
import type {PresenterCalendarEvent} from "../lib/presenter-calendar.ts";

const now = new Date("2026-11-19T10:00:00Z");
const row = (id: string, symbol: string, observations: [string,number][]) => ({id,symbol,frequency:"daily",sourceName:"FRED",sourceUrl:`https://fred.stlouisfed.org/series/${symbol}`,points:observations.map(([day,close])=>({time:Date.parse(day)/1000,close}))});
test("FRED levels and change in basis points use completed dated observations",()=>{
  const [yield2,rate] = buildFedRateWatch([row("us2y","DGS2",[["2026-11-17",3.75],["2026-11-18",3.82],["2026-11-19",99]]),row("fed-funds-effective","DFF",[["2026-11-17",3.64],["2026-11-18",3.64]])],now);
  assert.equal(yield2.level,3.82);assert.equal(yield2.changeBp,7);assert.equal(yield2.asOf,"2026-11-18");assert.equal(rate.changeBp,0);
});
test("stale, missing or conflicting rates never supply a daily change",()=>{
  const [a,b] = buildFedRateWatch([row("us2y","DGS2",[["2026-11-01",3.7]]),row("fed-funds-effective","DFF",[["2026-11-18",3.7],["2026-11-18",3.8]])],now);
  assert.equal(a.level,null);assert.equal(a.changeBp,null);assert.equal(b.level,null);
});
test("selects next future official FOMC decision, not minutes or desk records",()=>{
  const event=(title:string,scheduledAt:string,verificationState="official")=>({kind:"economic",status:"scheduled",title,scheduledAt,verificationState} as PresenterCalendarEvent);
  const e=event("FOMC decision and projections","2026-12-09T19:00:00Z");
  assert.equal(nextFomcDecision([event("FOMC minutes","2026-11-25T19:00:00Z"),event("FOMC decision","2026-11-18T19:00:00Z"),event("FOMC rate decision","2026-11-25T19:00:00Z","desk_record"),e],now),e);
});
