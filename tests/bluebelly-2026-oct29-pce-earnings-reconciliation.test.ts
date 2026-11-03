import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getRecentVerifiedEarningsScorecards} from "../lib/blue-desk-earnings-results.ts";
import {getRecentOfficialMacroResults} from "../lib/blue-desk-official-macro-results.ts";
import {decisionTopics} from "../lib/bluebelly-decision-brief.ts";
import {buildPresenterCalendar} from "../lib/presenter-calendar.ts";
import {applySourceReviewedRbaDecision,type EconomicCalendarEvent} from "../lib/calendar.ts";
import {officialEarningsEvents} from "../lib/forward-earnings-sources.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";

const emptyCalendar=buildPresenterCalendar([],{events:[],coverage:"unavailable",warning:"fixture"},new Date("2026-10-30T01:00:00Z"));

test("BEA September PCE cannot appear before the official release or remain fresh indefinitely",()=>{
 assert.equal(getRecentOfficialMacroResults(new Date("2026-10-29T12:29:59Z")).length,0);
 const records=getRecentOfficialMacroResults(new Date("2026-10-30T01:00:00Z"));
 assert.deepEqual(records.map(r=>r.id),["bea-pce-september-2026"]);
 assert.match(records[0].fact,/3\.6%/);
 assert.match(records[0].fact,/3\.1%/);
 assert.match(records[0].fact,/real spending was essentially flat/);
 assert.match(records[0].sourceUrl,/bea\.gov\/news\/2026\/personal-income/);
 assert.equal(getRecentOfficialMacroResults(new Date("2026-11-07T01:00:00Z")).length,0);
});

test("material Oct 29 US after-close results are not silently omitted or pre-published",()=>{
 const before=getRecentVerifiedEarningsScorecards(new Date("2026-10-29T23:59:00Z"),7);
 assert.equal(before.some(x=>["AMZN","INTC","SNDK"].includes(x.ticker)),false);
 const after=getRecentVerifiedEarningsScorecards(new Date("2026-10-30T01:00:00Z"),7);
 assert.deepEqual(new Set(after.filter(x=>["AMZN","INTC","SNDK"].includes(x.ticker)).map(x=>x.ticker)),new Set(["AMZN","INTC","SNDK"]));
 for(const row of after.filter(x=>["AMZN","INTC","SNDK"].includes(x.ticker))){
   assert.equal(row.releaseDay,"2026-10-29");
   assert.equal(row.beatSource==="pre_release_consensus",false);
   assert.ok(row.sourceUrl.startsWith("https://"));
   assert.equal(row.metrics.length,4);
 }
 const amzn=after.find(x=>x.ticker==="AMZN")!;
 assert.match(amzn.metrics[2].value!,/42\.357bn/);
 assert.match(amzn.metrics[2].note||"",/TTM is NOT the single Q3/);
 assert.match(amzn.metrics[3].note||"",/210\.657bn/);
 const intc=after.find(x=>x.ticker==="INTC")!;
 assert.match(intc.outlook,/15\.0–16\.0bn/);
 assert.equal(intc.metrics[2].state,"not_verified");
 const sndk=after.find(x=>x.ticker==="SNDK")!;
 assert.match(sndk.metrics[0].comparison!,/61% QoQ/);
 assert.match(sndk.metrics[2].value!,/6\.309bn/);
 assert.match(sndk.metrics[2].note||"",/adjusted FCF/);
});

test("PCE becomes a dated decision-first lead without duplicating actual public news intake",()=>{
 const now=new Date("2026-10-30T01:00:00Z");
 const topics=decisionTopics([],emptyCalendar,now);
 assert.equal(topics[0].id,"bea-pce-september-2026");
 assert.match(topics[0].test,/25 November/);
 const news=[{id:"verified-bea",headline:"September PCE inflation reaches 3.6%",summary:"BEA September PCE price index",occurredAt:"2026-10-29T12:30:00Z",sourceName:"BEA",sourceUrl:"https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026"} as NewsBriefV1];
 assert.equal(decisionTopics(news,emptyCalendar,now).some(x=>x.id==="bea-pce-september-2026"),false);
 assert.equal(decisionTopics([],emptyCalendar,new Date("2026-11-10T01:00:00Z")).some(x=>x.id==="bea-pce-september-2026"),false);
});

test("CoreWeave November Q3 release is forward-only and Amazon editorial preview is clearly historical",()=>{
 const before=officialEarningsEvents(new Date("2026-11-02T12:00:00Z"));
 assert.ok(before.some(e=>e.affectedAssets.includes("CRWV") && e.startAt?.startsWith("2026-11-10")));
 assert.equal(officialEarningsEvents(new Date("2026-11-11T12:00:00Z")).some(e=>e.affectedAssets.includes("CRWV")),false);
 assert.equal(getRecentVerifiedEarningsScorecards(new Date("2026-10-30T01:00:00Z"),7).some(x=>x.ticker==="CRWV"),false);
 const previews=readFileSync(new URL("../components/blue-desk/AmazonFomcFeatures.tsx",import.meta.url),"utf8");
 assert.match(previews,/Preserved 29 October pre-results investor test/);
});

test("source-reviewed RBA Nov 3 result is gated by the original release clock and preserves provenance",()=>{
 const pending: EconomicCalendarEvent={
  id:"au-rba-2026-11-03",date:"2026-11-03",timeLabel:"14:30 AEDT",
  country:"Australia",g7Markets:["Australia"],event:"RBA monetary-policy decision and Statement on Monetary Policy",
  category:"Central bank",impact:"High",referencePeriod:null,status:"Scheduled",
  actual:null,consensus:null,previous:null,decidingQuestion:"Policy outlook?",
  affectedAssets:["AUD","AU02Y","ASX"],sourceName:"Reserve Bank of Australia",
  sourceUrl:"https://www.rba.gov.au/schedules-events/board-meeting-schedules.html",
  sourceKind:"official-schedule",
 };
 const before=applySourceReviewedRbaDecision([pending],new Date("2026-11-03T03:29:59Z"))[0];
 assert.equal(before.status,"Scheduled");
 assert.equal(before.actual,null);
 const reviewed=applySourceReviewedRbaDecision([pending],new Date("2026-11-03T03:30:00Z"))[0];
 assert.equal(reviewed.status,"Released");
 assert.equal(reviewed.actual,"4.85% cash-rate target (+25bp)");
 assert.equal(reviewed.previous,"4.60%");
 assert.equal(reviewed.consensus,null);
 assert.equal(reviewed.releasedAt,"2026-11-03T03:30:00.000Z");
 assert.match(reviewed.sourceUrl,/rba\.gov\.au\/media-releases\/2026\/mr-26-30\.html/);
 const calendar=buildPresenterCalendar([reviewed],{events:[],coverage:"unavailable",warning:null},new Date("2026-11-03T04:00:00Z"));
 assert.deepEqual(calendar.windows.released,["macro:au-rba-2026-11-03"]);
 const event=calendar.events[0];
 assert.equal(event.status,"released");
 assert.equal(event.scheduledAt,"2026-11-03T03:30:00.000Z");
 assert.equal(event.releasedAt,"2026-11-03T03:30:00.000Z");
 // A later real completed source receipt must not be overwritten by this fixed fallback.
 const canonical={...pending,status:"Released" as const,actual:"4.85%",sourceKind:"desk-record" as const,sourceUrl:"https://example.gov.au/release"};
 assert.deepEqual(applySourceReviewedRbaDecision([canonical],new Date("2026-11-04T00:00:00Z")),[canonical]);
});

test("2 Nov Apple/Palantir originals enter recent earnings only after the conservative source clock",()=>{
 const before=getRecentVerifiedEarningsScorecards(new Date("2026-11-02T23:59:59Z"),7);
 assert.equal(before.some(x=>x.ticker==="AAPL"||x.ticker==="PLTR"),false);
 const after=getRecentVerifiedEarningsScorecards(new Date("2026-11-03T01:00:00Z"),7);
 const aapl=after.find(x=>x.ticker==="AAPL")!;
 const pltr=after.find(x=>x.ticker==="PLTR")!;
 assert.ok(aapl&&pltr);
 assert.equal(aapl.releaseDay,"2026-11-02");
 assert.match(aapl.sourceUrl,/apple\.com\/newsroom\/2026\/11/);
 assert.match(aapl.metrics[0].value!,/114\.477bn/);
 assert.equal(aapl.metrics[2].state,"not_verified"); // CFO is not quarterly FCF
 assert.equal(aapl.beatSource,"unavailable");
 assert.equal(pltr.releaseDay,"2026-11-02");
 assert.match(pltr.sourceUrl,/sec\.gov\/Archives\/edgar/);
 assert.match(pltr.metrics[0].value!,/2\.313411bn/);
 assert.match(pltr.metrics[2].note||"",/nine-month cumulative/);
 assert.equal(pltr.beatSource,"unavailable");
 assert.equal(getRecentVerifiedEarningsScorecards(new Date("2026-12-04T00:00:00Z"),30)
   .some(x=>x.ticker==="AAPL"||x.ticker==="PLTR"),false);
});
