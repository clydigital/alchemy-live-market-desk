import assert from "node:assert/strict";
import test from "node:test";
import {
  RBA_BOARD_SCHEDULE,RBA_DECISION_INDEX,
  rbaScheduledReleaseTimestamp,parseRbaDecisionIndex,parseOfficialRbaDecision,
  sourceForRbaDecision,
} from "../lib/macro/official-rba-rate-decision.ts";
import {
  buildOfficialMacroReleaseSeedRows,officialActualSourceUrl,resolveOfficialActual,
  type OfficialMacroRelease,
} from "../lib/macro/official-actuals.ts";
import type {EconomicCalendarEvent} from "../lib/calendar.ts";

const source="https://www.rba.gov.au/media-releases/2026/mr-26-30.html";
const releaseAt="2026-11-03T03:30:00.000Z";
const original=`<main><h1>Media Release Statement by the Monetary Policy Board: Monetary Policy Decision</h1>
<span itemprop="issueNumber">2026-30</span><time class="rss-mr-date" datetime="2026-11-03T14:30+11:00">3&nbsp;November 2026</time>
<p>At its meeting today, the Board decided to increase the cash rate target by 25&nbsp;basis points to 4.85&nbsp;per&nbsp;cent.</p>
<p>Today's policy decision was by majority: six members voted to increase the cash rate target by 25 basis points to 4.85 per cent; three members voted to leave the cash rate target unchanged at 4.60 per cent.</p></main>`;
const index=`<h1>Monetary Policy Decisions – 2026</h1><ul>
<li><a href="${source}">3 November 2026</a></li>
<li><a href="https://www.rba.gov.au/media-releases/2026/mr-26-27.html">29 September 2026</a></li>
</ul>`;
const rbaEvent=(sourceUrl=source):EconomicCalendarEvent=>({
 id:"au-rba-2026-11-03",date:"2026-11-03",timeLabel:"14:30 AEDT",country:"Australia",
 g7Markets:["Australia"],event:"RBA monetary-policy decision and Statement on Monetary Policy",
 category:"Central bank",impact:"High",referencePeriod:null,status:"Released",
 actual:"4.85% cash-rate target (+25bp)",consensus:null,previous:"4.60%",
 decidingQuestion:"Is persistent inflation sufficient reason to raise rates?",
 affectedAssets:["AUD","AU02Y","ASX"],sourceName:"Reserve Bank of Australia · 3 Nov 2026 policy decision",
 sourceUrl,sourceKind:"official-live",releasedAt:releaseAt,
});
const release=(sourceUrl=source):OfficialMacroRelease=>({
 id:"au-rba-2026-11-03",release_name:"RBA monetary-policy decision and Statement on Monetary Policy",
 agency:"Reserve Bank of Australia",release_date:releaseAt,reference_period:null,
 status:"released_pending_ingestion",actual:null,source_url:sourceUrl,
});
const reader=(pairs:Record<string,string>):typeof fetch=>((async(input)=>{
 const url=String(input);const content=pairs[url];
 if(!content)return new Response("No official original",{status:404});
 return new Response(content,{status:200,headers:{"content-type":"text/html"}});
}) as typeof fetch);

test("RBA 14:30 AEDT/AEST timestamps are DST-correct and reject wrong seasonal clocks",()=>{
 assert.equal(rbaScheduledReleaseTimestamp("2026-11-03","14:30 AEDT"),releaseAt);
 assert.equal(rbaScheduledReleaseTimestamp("2026-09-29","14:30 AEST"),"2026-09-29T04:30:00.000Z");
 assert.equal(rbaScheduledReleaseTimestamp("2026-11-03","14:30 AEST"),null);
 assert.equal(rbaScheduledReleaseTimestamp("2026-09-29","14:30 AEDT"),null);
 assert.equal(rbaScheduledReleaseTimestamp("2026-11-03","Time TBC"),null);
});
test("existing scheduler seeds one pending RBA event, but source-reviewed public fallback does not become an ingested actual",()=>{
 const rows=buildOfficialMacroReleaseSeedRows([rbaEvent()],new Date("2026-11-03T03:31:00.000Z"));
 assert.equal(rows.length,1);
 const item=rows[0];
 assert.equal(item.id,"au-rba-2026-11-03");
 assert.equal(item.release_date,releaseAt);
 assert.equal(item.status,"released_pending_ingestion");
 assert.equal(item.agency,"Reserve Bank of Australia");
 assert.equal(item.frequency,"Decision");
 assert.equal(item.reference_period,null);
 assert.equal(item.local_timezone,"Australia/Sydney");
 assert.equal(item.source_url,source); // original link is a lead, not a verified actual
 assert.equal(Object.hasOwn(item,"actual"),false);
 assert.equal(buildOfficialMacroReleaseSeedRows([rbaEvent()],
  new Date("2026-09-01T00:00:00.000Z")).length,0);
 const pending=buildOfficialMacroReleaseSeedRows([rbaEvent(RBA_BOARD_SCHEDULE)],
  new Date("2026-11-02T12:00:00.000Z"));
 assert.equal(pending[0].status,"scheduled");
 assert.equal(pending[0].source_url,RBA_BOARD_SCHEDULE);
});
test("official index must link the exact monetary-policy date to the RBA original",()=>{
 assert.equal(parseRbaDecisionIndex(index,"2026-11-03"),source);
 assert.equal(parseRbaDecisionIndex(index,"2026-10-28"),null);
 assert.equal(parseRbaDecisionIndex('[3 November 2026]('+source+')',"2026-11-03"),source);
 assert.equal(parseRbaDecisionIndex(index.replace(source,"https://example.com/2026/mr-26-30.html"),"2026-11-03"),null);
});
test("original release contains a timestamp-, issue- and rate-matched actual, but no consensus surprise",async()=>{
 const parsed=parseOfficialRbaDecision(original,source,releaseAt);
 assert.ok(parsed);
 assert.deepEqual(parsed,{
   actual:"RBA cash rate target 4.85% (+25bp, raised)",previous:"4.60%",
   sourceUrl:source,releasedAt:releaseAt,
 });
 assert.equal(officialActualSourceUrl(release()),source);
 assert.equal(sourceForRbaDecision(release(RBA_BOARD_SCHEDULE)),RBA_DECISION_INDEX);
 const resolved=await resolveOfficialActual(release(),reader({[source]:original}));
 assert.deepEqual(resolved,parsed);
 const fromIndex=await resolveOfficialActual(release(RBA_BOARD_SCHEDULE),
  reader({[RBA_DECISION_INDEX]:index,[source]:original}));
 assert.deepEqual(fromIndex,parsed);
 assert.equal("consensus" in resolved,false);
});
test("RBA source mismatch or earlier announcement cannot silently complete an actual",async()=>{
 assert.equal(parseOfficialRbaDecision(original.replace("2026-30","2026-29"),source,releaseAt),null);
 assert.equal(parseOfficialRbaDecision(original.replace("2026-11-03T14:30+11:00","2026-09-29T14:30+10:00"),source,releaseAt),null);
 assert.equal(parseOfficialRbaDecision(original.replace("4.85","4.x"),source,releaseAt),null);
 assert.equal(parseOfficialRbaDecision(original,"https://example.com/mr-26-30.html",releaseAt),null);
 const spoof={...release(),id:"au-rba-2026-11-02"};
 assert.equal(officialActualSourceUrl(spoof),null);
 await assert.rejects(()=>resolveOfficialActual(release(RBA_BOARD_SCHEDULE),
  reader({[RBA_DECISION_INDEX]:index.replace(source,"https://example.com/2026/mr-26-30.html")})),
  /RBA_ORIGINAL_LINK_NOT_PUBLISHED_FOR_DATE/);
});
test("reader-format original fallback still requires issue number, local date, correct quote and original URL",()=>{
 const md=`# Media Release Statement by the Monetary Policy Board: Monetary Policy Decision
Number2026-30
Date3 November 2026
At its meeting today, the Board decided to increase the cash rate target by 25 basis points to 4.85 per cent.`;
 assert.equal(parseOfficialRbaDecision(md,source,releaseAt)?.actual,
  "RBA cash rate target 4.85% (+25bp, raised)");
 assert.equal(parseOfficialRbaDecision(md.replace("3 November","2 November"),source,releaseAt),null);
});
