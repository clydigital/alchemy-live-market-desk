import test from "node:test";
import assert from "node:assert/strict";
import {expectedCompletedUsWeekdaySessionDay,privateDailySessionCoverage}
 from "../lib/bluebelly-daily-report-session.ts";

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
