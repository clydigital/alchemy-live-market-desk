import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {curateHomeSourceCoverage,HOMEPAGE_SOURCE_WINDOW_MS} from "../lib/bluebelly-home-48h-coverage.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";
import type {PublicSourceObservation} from "../lib/blue-desk-source-observations-projector.ts";
const now=new Date("2026-10-28T04:15:00Z");
function news(id:string,occurredAt:string,url="https://example.org/official/"+id):NewsBriefV1 {
 return {contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",id,headline:"Original verified release "+id,
  summary:"Source-qualified company report with a dated original release.",sourceName:"Official publisher",
  sourceUrl:url,sourceKind:"primary",occurredAt,observedAt:occurredAt,verification:"SOURCE_VERIFIED"};
}
function observation(id:string,eventAt:string,url="https://fred.stlouisfed.org/series/"+id):PublicSourceObservation{
 return {id,kind:"MARKET_OBSERVATION",description:"US original-source market measurement: dated and attributable.",
  sourceName:"FRED",sourceUrl:url,sourceTier:2,eventAt,recordedAt:now.toISOString()};
}
test("frontpage uses a rolling 48-hour event clock rather than midnight or ingestion timestamp",()=>{
 assert.equal(HOMEPAGE_SOURCE_WINDOW_MS,48*3600_000);
 const results=curateHomeSourceCoverage([
  news("prior-day","2026-10-27T03:00:00Z"), // previous Malaysia day; older than 24h, still within 48h
  news("exact-boundary","2026-10-26T04:15:00Z"),
  news("too-old","2026-10-26T04:14:59Z"),
  news("future","2026-10-28T04:15:01Z")
 ],[],now);
 assert.deepEqual(results.lead.map(x=>x.id),["prior-day","exact-boundary"]);
 assert.equal(results.newsCount,2);
});
test("one source-verified news report fills four empty hero cards with distinct dated source observations",()=>{
 const received=curateHomeSourceCoverage([news("lead","2026-10-27T16:00:00Z")],[
  observation("yield","2026-10-27T01:00:00Z"),
  observation("credit","2026-10-26T23:59:59Z"),
  observation("breadth","2026-10-26T21:00:00Z"),
  observation("stocks","2026-10-26T20:00:00Z"),
  observation("extra","2026-10-26T16:00:00Z"),
 ],now);
 assert.equal(received.lead.length,5);
 assert.equal(received.newsCount,1);
 assert.equal(received.observationCount,5);
 assert.deepEqual(received.lead.map(x=>x.kind),["NEWS","OBSERVATION","OBSERVATION","OBSERVATION","OBSERVATION"]);
 assert.equal(received.feed.length,1);
 assert.equal(received.feed[0]?.id,"extra");
});
test("one exact original release is never counted twice across news and observed sources",()=>{
 const url="https://example.org/official/dup";
 const result=curateHomeSourceCoverage([news("dup","2026-10-27T16:00:00Z",url)],[
  observation("also-dup","2026-10-27T16:00:00Z",url),
  observation("prior","2026-10-26T16:00:00Z")
 ],now);
 assert.equal(result.newsCount,1);
 assert.equal(result.observationCount,1);
 assert.equal(result.lead.length,2);
 assert.equal(result.lead[1].kind,"OBSERVATION");
});
test("news is never fabricated from observations and no pre-48h observations are admitted",()=>{
 const r=curateHomeSourceCoverage([],[
  observation("inside","2026-10-26T04:15:00Z"),
  observation("outside","2026-10-26T04:14:59Z"),
  observation("future","2026-10-28T04:15:01Z")
 ],now);
 assert.equal(r.newsCount,0);
 assert.equal(r.observationCount,1);
 assert.equal(r.lead[0].kind,"OBSERVATION");
 const source=readFileSync(new URL("../components/blue-desk/BluebellyNewsfront.tsx",import.meta.url),"utf8");
 assert.match(source,/ORIGINAL SOURCE RELEASE/);
 assert.match(source,/DATED MARKET DATA/);
 assert.match(source,/VERIFIED ANNOUNCEMENT/);
 assert.match(source,/Source date/);
 assert.match(source,/PRIOR 24H/);
 assert.doesNotMatch(source,/x_wire_posts|market_motion_items|createSupabaseAdminClient/);
 const page=readFileSync(new URL("../app/blue-desk/page.tsx",import.meta.url),"utf8");
 assert.match(page,/getPublicSourceObservations\(now,12\)/);
 assert.match(page,/observations=\{observations\}/);
});
