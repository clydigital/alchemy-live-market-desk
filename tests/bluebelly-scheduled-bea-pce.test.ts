import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {beaPceReleaseUrl,parseBeaPceActual} from "../lib/macro/bea-pce-actual.ts";
import {buildOfficialMacroReleaseSeedRows,resolveOfficialActual} from "../lib/macro/official-actuals.ts";
import type {EconomicCalendarEvent} from "../lib/calendar.ts";
import type {OfficialMacroRelease} from "../lib/macro/official-actuals.ts";

const original=String.raw`<html><h1>Personal Income and Outlays, September 2026</h1>
 <p>EMBARGOED UNTIL RELEASE AT 8:30 a.m. EDT, Thursday, October 29, 2026</p>
 <p>From the preceding month, the PCE price index for September increased 0.5 percent.
 Excluding food and energy, the PCE price index increased 0.3 percent.</p>
 <p>From the same month one year ago, the PCE price index for September increased 3.6 percent.
 Excluding food and energy, the PCE price index increased 3.1 percent from one year ago.</p></html>`;
const bea:OfficialMacroRelease={
 id:"us-bea-2026-10-29-personal-income-outlays-sep-2026",
 agency:"U.S. Bureau of Economic Analysis",release_name:"Personal Income and Outlays",
 reference_period:"September 2026",release_date:"2026-10-29T12:30:00.000Z",
 actual:null,status:"released_pending_ingestion",source_url:"https://www.bea.gov/news/schedule",
};

test("BEA only accepts the exact reference-month original release and all four actual rates",()=>{
 assert.equal(beaPceReleaseUrl(bea.release_name,bea.reference_period),
 "https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026");
 assert.deepEqual(parseBeaPceActual(bea.release_name,bea.reference_period,original),{
  headlineMom:0.5,headlineYoy:3.6,coreMom:0.3,coreYoy:3.1,
  actual:"Headline PCE +0.5% m/m; +3.6% y/y; Core PCE +0.3% m/m; +3.1% y/y",
 });
 for(const bad of [
  original.replace("September 2026</h1>","August 2026</h1>"),
  original.replace("3.1 percent",""),
  original.replace("3.6 percent","99.9 percent"),
  "<h1>Personal Income and Outlays, September 2026</h1> Release scheduled, actual pending",
 ]){
  assert.equal(parseBeaPceActual(bea.release_name,bea.reference_period,bad),null);
 }
 assert.equal(parseBeaPceActual(bea.release_name,"October 2026",original),null);
 assert.equal(beaPceReleaseUrl("GDP","September 2026"),null);
});

test("BEA source reads are first party, date-locked and return measured core/headline rate",async()=>{
 const transport=(async (url:RequestInfo|URL)=>{
  assert.equal(String(url),"https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026");
  return new Response(original,{status:200,headers:{"content-type":"text/html"}});
 }) as typeof fetch;
 const r=await resolveOfficialActual(bea,transport);
 assert.equal(r.sourceUrl,"https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026");
 assert.match(r.actual,/Core PCE \+0.3% m\/m; \+3.1% y\/y/);
});

test("official 2026 BEA dates seed the existing macro collector, with DST-correct clocks",()=>{
 const calendarText=readFileSync(new URL("../lib/calendar.ts",import.meta.url),"utf8");
 assert.match(calendarText,/verifiedBeaPceSchedule/);
 const event=(date:string,period:string):EconomicCalendarEvent=>({
  id:"bea:"+date,date,timeLabel:"08:30 ET",country:"United States",
  g7Markets:["United States"],event:"Personal Income and Outlays",
  category:"Inflation",impact:"High",referencePeriod:period,
  status:"Scheduled",actual:null,consensus:null,previous:null,
  decidingQuestion:"PCE versus Fed",affectedAssets:["USD"],
  sourceName:"U.S. Bureau of Economic Analysis",sourceUrl:"https://www.bea.gov/news/schedule",
  sourceKind:"official-schedule",
 });
 const rows=buildOfficialMacroReleaseSeedRows([
  event("2026-10-29","September 2026"),event("2026-11-25","October 2026"),
 ],new Date("2026-10-30T00:00:00Z"));
 assert.equal(rows.length,2);
 assert.equal(rows[0].series_key,"bea-pce");
 assert.equal(rows[0].status,"released_pending_ingestion");
 assert.equal(rows[0].release_date,"2026-10-29T12:30:00.000Z");
 assert.equal(rows[1].status,"scheduled");
 assert.equal(rows[1].release_date,"2026-11-25T13:30:00.000Z");
 assert.equal(buildOfficialMacroReleaseSeedRows([{
  ...event("2026-11-25","October 2026"),sourceUrl:"https://fake.example/schedule",
 }],new Date("2026-10-30T00:00:00Z")).length,0);
});
