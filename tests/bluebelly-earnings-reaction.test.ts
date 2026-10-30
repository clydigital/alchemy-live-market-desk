import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {auditEarningsReaction,getDatedEarningsReaction,type EarningsReactionPacket} from "../lib/bluebelly-earnings-reaction.ts";
import {selectPostEventRecaps} from "../lib/bluebelly-post-event-recap.ts";

const NOW=new Date("2026-10-30T02:00:00.000Z");
test("dated INTC, AMZN and SNDK reaction packets appear after the US close, without calling the earlier regular-session fall an earnings result",()=>{
 const packets=["intel-2026q3","amazon-2026q3","sandisk-fy2027q1"].map(id=>getDatedEarningsReaction(id,NOW));
 assert.ok(packets.every(Boolean));
 const [intel,amazon,sandisk]=packets as NonNullable<(typeof packets)[number]>[];
 assert.equal(intel.regularClose.usd,92.07);
 assert.equal(intel.regularClose.changePct,-3.62);
 assert.equal(intel.extendedChangePct,-22.99);
 assert.equal(amazon.regularClose.changePct,-4.25);
 assert.equal(amazon.extendedChangePct,-7.36);
 assert.equal(sandisk.regularClose.changePct,-5.32);
 assert.equal(sandisk.extendedChangePct,-3.80);
 for(const p of [intel,amazon,sandisk]){
  assert.equal(p.sessionDay,"2026-10-29");
  assert.equal(p.regularClose.at,"2026-10-29T20:00:00Z");
  assert.ok(Date.parse(p.extended.at)>Date.parse(p.regularClose.at));
  assert.ok(p.interpretation.length>45);
  assert.match(p.issuerUrl,/^https:\/\//);
  assert.match(p.extended.sourceUrl,/^https:\/\//);
 }
 assert.equal(sandisk.attribution,"UNRESOLVED_CAUSE");
 assert.match(sandisk.interpretation,/BEFORE the after-close results/i);
 assert.match(amazon.companyFact,/TRAILING-TWELVE-MONTH/);
 assert.match(intel.expectation,/17\.07bn/);
});

test("snapshots cannot appear before source review or masquerade as current results after 7 days",()=>{
 assert.equal(getDatedEarningsReaction("intel-2026q3",new Date("2026-10-29T22:00:00Z")),null);
 assert.equal(getDatedEarningsReaction("sandisk-fy2027q1",new Date("2026-11-07T00:00:00Z")),null);
 assert.equal(getDatedEarningsReaction("../private",NOW),null);
 assert.equal(getDatedEarningsReaction("unknown-2026q3",NOW),null);
});

test("reaction validator rejects broken times, unsigned sources and implausible prices",()=>{
 const original=getDatedEarningsReaction("intel-2026q3",NOW)!;
 const {extendedChangePct:_ignore,...base}=original;
 const malformed=[
  {...base,extended:{...base.extended,at:"2026-10-29T19:59:00Z"}},
  {...base,extended:{...base.extended,usd:0}},
  {...base,reportingUrl:"http://insecure.test/example"},
  {...base,issuerUrl:"https://name:pass@issuer.com/report"},
  {...base,companyFact:"No verified financial explanation"},
  {...base,regularClose:{...base.regularClose,at:"2026-10-29T21:00:00Z"}},
 ];
 for(const candidate of malformed){
  const check=auditEarningsReaction(candidate as EarningsReactionPacket,NOW);
  assert.equal(check.status,"REACTION_ANALYSIS_INCOMPLETE");
  assert.equal(check.reaction,null);
  assert.ok(check.missing.length>0);
 }
});

test("existing approved post-event reader carries dated afterhours reaction, source and uncertainty, without NewsBrief admission or a new writer",()=>{
 const recaps=selectPostEventRecaps([],NOW,8);
 for(const [id,ticker] of [["intel-2026q3","INTC"],["amazon-2026q3","AMZN"],["sandisk-fy2027q1","SNDK"]]){
  const recap=recaps.find(x=>x.id===id)!;
  assert.ok(recap);
  assert.equal(recap.kind,"earnings");
  assert.equal(recap.featuredStatus,"REVIEWED");
  assert.equal(recap.marketEffectStatus,"DATED_SECONDARY_AND_DAILY_DATA");
  assert.match(recap.marketEffects,new RegExp(ticker));
  assert.match(recap.marketEffects,/BEFORE the earnings announcement/);
  assert.match(recap.evidenceNote,/NOT an exact tick-for-tick/);
  assert.ok(recap.sourceUrls.some(x=>x.role==="market_data"));
  assert.ok(recap.sourceUrls.some(x=>x.role==="reporting"));
 }
 assert.match(recaps.find(x=>x.id==="sandisk-fy2027q1")!.evidenceNote,/unresolved/);
});

test("both existing public readers show the reaction or an honest REACTION_ANALYSIS_INCOMPLETE fallback",()=>{
 const news=readFileSync(new URL("../components/blue-desk/ShortNewsRecap.tsx",import.meta.url),"utf8");
 const earnings=readFileSync(new URL("../components/blue-desk/RecentEarningsScorecards.tsx",import.meta.url),"utf8");
 assert.match(news,/data-earnings-reaction="attributed-source-dated"/);
 assert.match(news,/data-earnings-reaction="REACTION_ANALYSIS_INCOMPLETE"/);
 assert.match(news,/SAME 4 PM close/);
 assert.match(earnings,/data-calendar-earnings-reaction="attributed-source-dated"/);
 assert.match(earnings,/data-calendar-earnings-reaction="REACTION_ANALYSIS_INCOMPLETE"/);
 assert.doesNotMatch(news,/createSupabaseAdminClient|\.from\("story_thesis_versions"\)|generateContent\(/);
});
