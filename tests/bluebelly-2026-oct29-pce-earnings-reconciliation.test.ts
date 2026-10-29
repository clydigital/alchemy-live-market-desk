import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getRecentVerifiedEarningsScorecards} from "../lib/blue-desk-earnings-results.ts";
import {getRecentOfficialMacroResults} from "../lib/blue-desk-official-macro-results.ts";
import {decisionTopics} from "../lib/bluebelly-decision-brief.ts";
import {buildPresenterCalendar} from "../lib/presenter-calendar.ts";
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
