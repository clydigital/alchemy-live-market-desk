import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {recentBankDecisions,bankDecisionById,BANK_DECISION_LOOKBACK_HOURS} from "../lib/bluebelly-bank-decision-snapshots.ts";
import {recentReportedEditorial,reportedEditorialById} from "../lib/bluebelly-reported-editorial.ts";

const content=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const instant=new Date("2026-10-28T20:24:00.000Z");
test("original October 28 bank outcomes appear as a 48h bank-first tape, newest first",()=>{
 const rows=recentBankDecisions(instant,48);
 assert.equal(BANK_DECISION_LOOKBACK_HOURS,48);
 assert.deepEqual(rows.map(x=>x.id),["fed-2026-10-28","boc-2026-10-28","rbnz-2026-10-28"]);
 const fed=rows[0],canada=rows[1],nz=rows[2];
 assert.match(fed.observedStatement,/3\.75–4\.00%/);
 assert.match(fed.observedStatement,/10–2 vote/);
 assert.match(fed.sourceUrl,/federalreserve\.gov\/newsevents\/pressreleases\/monetary20261028a\.htm/);
 assert.match(canada.observedStatement,/25bp from 2\.25% to 2\.50%/);
 assert.match(canada.sourceUrl,/bankofcanada\.ca\/2026\/10\/fad-press-release-2026-10-28/);
 assert.match(nz.observedStatement,/four votes to three/);
 assert.match(nz.sourceUrl,/rbnz\.govt\.nz/);
 for(const row of rows){
   assert.match(row.expectedStatus,/pre-release|matched|surprise/i);
   assert.match(row.alternative,/\w/);
   assert.match(row.nextTest,/\w/);
   assert.ok(Date.parse(row.releaseAt)<=+instant);
 }
});
test("confirmed decision cards expire from the 48h lane and cannot be published before the source clock",()=>{
 assert.equal(recentBankDecisions(new Date("2026-10-27T23:00:00Z")).length,0);
 assert.deepEqual(recentBankDecisions(new Date("2026-10-30T01:01:00Z")).map(x=>x.id),
   ["fed-2026-10-28","boc-2026-10-28"]);
 assert.equal(recentBankDecisions(new Date("2026-11-07T00:00:00Z")).length,0);
 assert.equal(bankDecisionById("../../../owner",instant),null);
 assert.equal(bankDecisionById("fed-2026-10-28",new Date("2026-11-08T18:00:00Z")),null);
});
test("unconfirmed TPG discussions are labelled and expire, rather than turning into a confirmed deal",()=>{
 const reports=recentReportedEditorial(instant,48);
 assert.equal(reports.length,1);
 assert.match(reports[0].headline,/Report:/);
 assert.match(reports[0].reporting,/could not independently verify|could not verify/i);
 assert.match(reports[0].reporting,/not guaranteed/);
 assert.match(reports[0].countercase,/no deal|may end/i);
 assert.match(reports[0].sourceUrl,/live\.euronext\.com/);
 assert.equal(reportedEditorialById("tpg-ark-talks-2026-10-28",instant)?.id,reports[0].id);
 assert.equal(reportedEditorialById("../../admin",instant),null);
 assert.equal(recentReportedEditorial(new Date("2026-11-04T00:00:00Z")).length,0);
});
test("Binance original statement and Reuters market reaction enter the existing dated editorial lane without inventing a net loss",()=>{
 const now=new Date("2026-10-30T04:30:00Z");
 const item=reportedEditorialById("binance-security-incident-2026-10-30",now);
 assert.ok(item);
 assert.equal(item.kind,"VERIFIED_INCIDENT");
 assert.match(item.sourceUrl,/binance\.com/);
 assert.match(item.secondarySourceUrl||"",/reuters\.com/);
 assert.match(item.reporting,/estimated|estimates/i);
 assert.match(item.countercase,/final net loss|initial/i);
 assert.match(item.why,/NOT a confirmed final cash loss/);
 assert.ok(recentReportedEditorial(now,48).some(row=>row.id===item.id));
 assert.ok(!recentReportedEditorial(new Date("2026-11-04T04:30:00Z")).some(row=>row.id===item.id));
 const home=content("components/blue-desk/DecisionBrief.tsx");
 const timeline=content("components/blue-desk/Newsroom48hTimeline.tsx");
 const reader=content("components/blue-desk/NewsroomEventReader.tsx");
 assert.match(home,/data-bluebelly-live-crypto-incident="source-reviewed"/);
 assert.match(timeline,/EXCHANGE INCIDENT · OFFICIAL STATEMENT/);
 assert.match(reader,/BINANCE ORIGINAL STATEMENT/);
 assert.match(reader,/final net loss/);
});
test("Newsroom uses two evidence categories and never calls unconfirmed events canonical NewsBrief",()=>{
 const newsroom=content("app/blue-desk/newsroom/page.tsx");
 const timeline=content("components/blue-desk/Newsroom48hTimeline.tsx");
 const keyStories=content("app/blue-desk/key-stories/page.tsx");
 const reader=content("components/blue-desk/NewsroomEventReader.tsx");
 assert.match(newsroom,/recentBankDecisions\(now,48\)/);
 assert.match(newsroom,/recentReportedEditorial\(now,48\)/);
 assert.match(newsroom,/<Newsroom48hTimeline banks=\{bankDecisions\} reports=\{reported\}/);
 assert.match(newsroom,/getOriginalPressNews\(now,18,7\)/);
 assert.match(timeline,/BANK DECISION · OFFICIAL STATEMENT/);
 assert.match(timeline,/REPORTED TALKS · NOT CONFIRMED/);
 assert.match(timeline,/data-newsroom-window="48h"/);
 assert.match(timeline,/\?policy=/);
 assert.match(timeline,/\?reported=/);
 assert.match(timeline,/EditorialStoryArt/);
 assert.match(keyStories,/bankDecisionById\(params.policy,now\)/);
 assert.match(keyStories,/reportedEditorialById\(params.reported,now\)/);
 assert.match(reader,/SECONDARY REPORTING · NOT INDEPENDENTLY CONFIRMED/);
 assert.match(reader,/WHAT|What would prove this interpretation wrong\?/i);
 assert.match(reader,/THE MONEY QUESTION/);
 assert.doesNotMatch(timeline,/createSupabaseAdminClient|service_role|secretKey|story_thesis_versions/);
});
