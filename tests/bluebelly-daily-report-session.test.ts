import test from "node:test";
import assert from "node:assert/strict";
import {expectedCompletedUsWeekdaySessionDay,privateDailySessionCoverage,completedUsSessionCalendarBasis}
 from "../lib/bluebelly-daily-report-session.ts";
import {scheduledUsEquityCloseHourET,usEquitySessionCalendarBasis}
 from "../lib/bluebelly-us-equity-trading-calendar.ts";

test("weekend keeps Friday's last completed US session, regardless of Malaysia calendar day",()=>{
 assert.equal(expectedCompletedUsWeekdaySessionDay(new Date("2026-11-01T00:15:00Z")),"2026-10-30");
 assert.equal(expectedCompletedUsWeekdaySessionDay(new Date("2026-11-01T12:15:00Z")),"2026-10-30");
 assert.equal(expectedCompletedUsWeekdaySessionDay(new Date("2026-11-02T12:15:00Z")),"2026-10-30");
});
test("only the completed 16:00 ET weekday is due, across US DST transitions",()=>{
 assert.equal(expectedCompletedUsWeekdaySessionDay(new Date("2026-10-30T19:59:00Z")),"2026-10-29");
 assert.equal(expectedCompletedUsWeekdaySessionDay(new Date("2026-10-30T20:00:00Z")),"2026-10-30");
 assert.equal(expectedCompletedUsWeekdaySessionDay(new Date("2026-11-02T20:59:00Z")),"2026-10-30");
 assert.equal(expectedCompletedUsWeekdaySessionDay(new Date("2026-11-02T21:00:00Z")),"2026-11-02");
 assert.equal(expectedCompletedUsWeekdaySessionDay(new Date("2026-11-03T01:00:00Z")),"2026-11-02");
 assert.equal(expectedCompletedUsWeekdaySessionDay(new Date("bad")) ,null);
});
test("report delivery health reflects actual saved ET report day rather than MYT today",()=>{
 assert.equal(privateDailySessionCoverage("2026-10-30","2026-10-30"),"current");
 assert.equal(privateDailySessionCoverage("2026-10-29","2026-10-30"),"behind");
 assert.equal(privateDailySessionCoverage(null,"2026-10-30"),"missing");
 assert.equal(privateDailySessionCoverage("2026-11-01","2026-10-30"),"newer_than_expected");
 assert.equal(privateDailySessionCoverage("bad","2026-10-30"),"unknown");
 assert.equal(privateDailySessionCoverage("2026-10-30",null),"unknown");
});

test("official NYSE holidays skip the nonexistent 2026 Thanksgiving and Christmas cash sessions",()=>{
 const at=expectedCompletedUsWeekdaySessionDay;
 assert.equal(at(new Date("2026-11-26T22:00:00Z")),"2026-11-25");
 assert.equal(at(new Date("2026-12-25T22:00:00Z")),"2026-12-24");
 assert.equal(at(new Date("2026-04-03T20:00:00Z")),"2026-04-02");
 assert.equal(at(new Date("2026-07-03T20:00:00Z")),"2026-07-02");
});

test("NYSE early closes count as completed at 13:00 Eastern, not 16:00",()=>{
 const at=expectedCompletedUsWeekdaySessionDay;
 assert.equal(at(new Date("2026-11-27T17:59:00Z")),"2026-11-25");
 assert.equal(at(new Date("2026-11-27T18:00:00Z")),"2026-11-27");
 assert.equal(at(new Date("2026-12-24T17:59:00Z")),"2026-12-23");
 assert.equal(at(new Date("2026-12-24T18:00:00Z")),"2026-12-24");
 assert.equal(scheduledUsEquityCloseHourET("2026-11-27"),13);
 assert.equal(scheduledUsEquityCloseHourET("2026-11-26"),null);
});

test("official 2027/2028 holiday, observed-day and 13:00 July 2028 rules",()=>{
 const at=expectedCompletedUsWeekdaySessionDay;
 assert.equal(at(new Date("2027-06-18T21:00:00Z")),"2027-06-17");
 assert.equal(at(new Date("2027-11-26T18:00:00Z")),"2027-11-26");
 assert.equal(at(new Date("2028-07-03T16:59:00Z")),"2028-06-30");
 assert.equal(at(new Date("2028-07-03T17:00:00Z")),"2028-07-03");
 assert.equal(at(new Date("2028-07-04T20:00:00Z")),"2028-07-03");
 assert.equal(scheduledUsEquityCloseHourET("2028-01-03"),16);
});

test("outside verified NYSE years preserve legacy weekday estimate with explicit provenance",()=>{
 assert.equal(usEquitySessionCalendarBasis("2029-11-22"),"WEEKDAY_ESTIMATE");
 assert.equal(completedUsSessionCalendarBasis(new Date("2026-11-27T18:00:00Z")),
  "OFFICIAL_NYSE_2026_2028");
 assert.equal(scheduledUsEquityCloseHourET("bad"),null);
 assert.equal(scheduledUsEquityCloseHourET("2026-02-30"),null);
});
