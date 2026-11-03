import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {projectCompletedOfficialMacroNews,type CompletedMacroRow} from "../lib/blue-desk-canonical-macro-news.ts";

const releaseAt="2026-11-03T15:00:00.000Z";
const now=new Date("2026-11-03T18:00:00.000Z");
const base:CompletedMacroRow={
 id:"us-bls-2026-11-03-jolts-september-2026",
 release_name:"Job Openings and Labor Turnover Survey for September 2026",
 agency:"U.S. Bureau of Labor Statistics",
 release_date:releaseAt,reference_period:"September 2026",
 status:"completed",source_classification:"official_government",
 ingestion_attempt_status:"completed",actual:"Job openings 7.4M",
 released_at:releaseAt,actual_retrieved_at:"2026-11-03T15:12:00.000Z",
 source_url:"https://www.bls.gov/news.release/archives/jolts_11032026.htm",
};

test("a genuinely completed original government actual becomes one factual source-only Newsroom item",()=>{
 const list=projectCompletedOfficialMacroNews([base],now);
 assert.equal(list.length,1);
 assert.equal(list[0].id,"official-macro-us-bls-2026-11-03-jolts-september-2026");
 assert.equal(list[0].verification,"SOURCE_VERIFIED");
 assert.equal(list[0].sourceKind,"official");
 assert.equal(list[0].sourceUrl,base.source_url);
 assert.equal(list[0].observedAt,base.actual_retrieved_at);
 assert.equal(list[0].occurredAt,releaseAt);
 assert.match(list[0].summary,/Job openings 7\.4M/);
 assert.match(list[0].summary,/market reactions are not established/);
 assert.doesNotMatch(list[0].summary,/stocks (?:rallied|fell)|priced in|interest rates must|market headwind/);
 const many=projectCompletedOfficialMacroNews([base,base],now);
 assert.equal(many.length,1,"same canonical government original must not duplicate");
});
test("no provisional, future, stale, non-original or unverified release can enter the source-only public reader",()=>{
 const bad:CompletedMacroRow[]=[
 {...base,actual:null},{...base,status:"released_pending_ingestion"},
 {...base,ingestion_attempt_status:"failed_retryable"},
 {...base,actual_retrieved_at:null},
 {...base,source_classification:"official_secondary"},
 {...base,source_url:"https://www.bls.gov/news.release/archives/jolts_11022026.htm"},
 {...base,source_url:"https://fraudulent.example/news.release/archives/jolts_11032026.htm"},
 {...base,agency:"Private news analyst"},
 {...base,release_date:"2026-11-04T15:00:00Z",released_at:"2026-11-04T15:00:00Z"},
 {...base,release_date:"2026-10-01T15:00:00Z",released_at:"2026-10-01T15:00:00Z"},
 {...base,actual:"Job openings 7.4M <script>danger</script>"},
 {...base,actual:"Job openings 99.9M"},
 {...base,reference_period:"August 2026"},
 {...base,released_at:"2026-11-02T15:00:00Z"},
 {...base,actual_retrieved_at:"2026-11-03T14:00:00Z"},
 {...base,actual_retrieved_at:"2026-11-05T14:00:00Z"},
 ];
 for(const [i,row] of bad.entries())
  assert.deepEqual(projectCompletedOfficialMacroNews([row],now),[],String(i));
 assert.deepEqual(projectCompletedOfficialMacroNews([base],new Date("invalid")),[]);
});
test("official BEA PCE must reconcile all four distinct actuals with matched original month",()=>{
 const pce:CompletedMacroRow={
  ...base,id:"us-bea-2026-10-29-personal-income-outlays-sep-2026",
  release_name:"Personal Income and Outlays",
  agency:"U.S. Bureau of Economic Analysis",
  release_date:"2026-10-29T12:30:00.000Z",
  released_at:"2026-10-29T12:30:00.000Z",
  actual_retrieved_at:"2026-10-29T13:20:00.000Z",
  reference_period:"September 2026",
  actual:"Headline PCE +0.5% m/m; +3.6% y/y; Core PCE +0.3% m/m; +3.1% y/y",
  source_url:"https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026",
 };
 assert.equal(projectCompletedOfficialMacroNews([pce],now).length,1);
 assert.deepEqual(projectCompletedOfficialMacroNews([{...pce,actual:"Headline PCE +0.5% m/m; Core PCE +0.3% m/m"}],now),[]);
 assert.deepEqual(projectCompletedOfficialMacroNews([{...pce,source_url:pce.source_url!.toString().replace("september","october")}],now),[]);
});
test("the exact same publicly qualified source projection is reused by Today, Newsroom and Key Stories",()=>{
 for(const path of ["../app/blue-desk/page.tsx","../app/blue-desk/newsroom/page.tsx","../app/blue-desk/key-stories/page.tsx"]){
  const source=readFileSync(new URL(path,import.meta.url),"utf8");
  assert.match(source,/getCompletedOfficialMacroNews\(now,18,7\)/);
  assert.match(source,/getOriginalPressNews\(now,18,7\)/);
  assert.match(source,/combineQualifiedNews/);
 }
 const server=readFileSync(new URL("../lib/blue-desk-canonical-macro-news-server.ts",import.meta.url),"utf8");
 assert.match(server,/import "server-only"/);
 assert.match(server,/\.eq\("status","completed"\)/);
 assert.match(server,/\.eq\("ingestion_attempt_status","completed"\)/);
 assert.match(server,/\.not\("actual","is",null\)/);
 assert.match(server,/getRecentOfficialMacroResults/);
 assert.doesNotMatch(server,/insert\(|update\(|upsert\(|createSupabaseAdminClient\(\)\.auth/);
});
