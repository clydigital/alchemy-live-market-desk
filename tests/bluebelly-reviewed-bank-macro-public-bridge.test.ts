import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectCompletedReviewedBankNews,projectCompletedOfficialMacroNews,type CompletedMacroRow} from "../lib/blue-desk-canonical-macro-news.ts";
import {reviewedPostEventForNews} from "../lib/bluebelly-post-event-recap.ts";

const now=new Date("2026-11-03T16:00:00Z");
const bank:CompletedMacroRow={
 id:"au-rba-2026-11-03",release_name:"RBA Monetary Policy Decision",
 agency:"Reserve Bank of Australia",release_date:"2026-11-03T03:30:00Z",
 reference_period:null,status:"completed",
 source_url:"https://www.rba.gov.au/media-releases/2026/mr-26-30.html",
 source_classification:"official_government",
 actual:"RBA cash rate target 4.85% (+25bp, raised)",
 actual_retrieved_at:"2026-11-03T15:11:39.874Z",
 ingestion_attempt_status:"completed",released_at:"2026-11-03T03:30:00Z"
};

test("completed official RBA + separately reviewed snapshot are joined read-only, without rewriting US original projector",()=>{
 const result=projectCompletedReviewedBankNews([bank],now,12,7);
 assert.equal(result.length,1);
 assert.equal(result[0].id,"official-reviewed-bank-au-rba-2026-11-03");
 assert.equal(result[0].sourceUrl,bank.source_url);
 assert.equal(result[0].verification,"SOURCE_VERIFIED");
 assert.ok(result[0].summary.includes("31 of 32 economists expected"));
 const analysis=reviewedPostEventForNews(result[0],now);
 assert.equal(analysis?.id,"rba-2026-11-03");
 assert.equal(analysis?.featuredStatus,"REVIEWED");
 assert.equal(analysis?.marketEffectStatus,"MECHANISM_ONLY");
 assert.equal(projectCompletedOfficialMacroNews([bank],now,12,7).length,0);
});

test("unknown, future, incomplete, unsourced or mismatched policy rows stay excluded",()=>{
 const changes=[
  {status:"released_pending_ingestion"},
  {ingestion_attempt_status:"failed_retryable"},
  {source_classification:"reporting"},
  {source_url:"https://www.rba.gov.au/media-releases/2026/mr-26-29.html"},
  {release_date:"2026-11-03T04:00:00Z"},
  {released_at:"2026-11-03T04:00:00Z"},
  {actual:"RBA cash rate target 4.60% (unchanged)"},
  {actual_retrieved_at:"2026-11-03T03:00:00Z"},
  {actual_retrieved_at:"2026-11-04T15:11:39Z"},
  {agency:"Reserve Bank of New Zealand"},
  {id:"au-rba-2026-12-08"}
 ];
 for(const change of changes)assert.deepEqual(projectCompletedReviewedBankNews([{...bank,...change}],now,12,7),[],JSON.stringify(change));
 assert.deepEqual(projectCompletedReviewedBankNews([bank],new Date("2026-11-03T03:29:00Z"),12,7),[]);
 assert.deepEqual(projectCompletedReviewedBankNews([bank],new Date("2026-11-11T16:00:00Z"),12,7),[]);
});

test("existing public server reads completed original rows once, never upgrades a private review digest",()=>{
 const server=readFileSync(new URL("../lib/blue-desk-canonical-macro-news-server.ts",import.meta.url),"utf8");
 assert.match(server,/projectCompletedReviewedBankNews\(rows,now,limit,lookbackDays\)/);
 assert.match(server,/\.eq\("status","completed"\)\.eq\("ingestion_attempt_status","completed"\)/);
 assert.match(server,/\.eq\("source_classification","official_government"\)/);
 assert.doesNotMatch(server,/blue_desk_macropulse_briefs|editorial_publications|notion/i);
});
