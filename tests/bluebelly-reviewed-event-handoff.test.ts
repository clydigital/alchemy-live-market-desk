import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {reviewedPostEventForNews} from "../lib/bluebelly-post-event-recap.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";

const at=new Date("2026-11-03T16:00:00Z");
const source:NewsBriefV1={
 contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",
 id:"rba-original-verified-20261103",verification:"SOURCE_VERIFIED",
 headline:"RBA raises the cash rate target to 4.85% on 3 November",
 summary:"Reserve Bank of Australia original policy release and board vote confirmed.",
 sourceName:"Reserve Bank of Australia",sourceKind:"official",
 sourceUrl:"https://www.rba.gov.au/media-releases/2026/mr-26-30.html",
 occurredAt:"2026-11-03T03:30:00Z",observedAt:"2026-11-03T03:35:00Z"
};

test("already reviewed 3 November RBA original bypasses repetitive source-only checklist",()=>{
 const item=reviewedPostEventForNews(source,at);
 assert.equal(item?.id,"rba-2026-11-03");
 assert.equal(item?.featuredStatus,"REVIEWED");
 assert.equal(item?.marketEffectStatus,"MECHANISM_ONLY");
 assert.match(item!.whatHappened,/4\.85%/);
 assert.match(item!.evidenceNote,/No timestamp-matched AUD\/AU02Y event-window/);
 assert.ok(item!.sourceUrls.some(s=>s.role==="reporting"&&s.url.includes("2026-rba-rate-hike-expected")));
 assert.match(item!.whatHappened,/31 of 32 economists expected a 25bp rise/);
 const route=readFileSync(new URL("../app/blue-desk/key-stories/page.tsx",import.meta.url),"utf8");
 assert.ok(route.indexOf("reviewedPostEventForNews(event,now)")<route.indexOf("storyDepthForNews(event)"));
 assert.match(route,/data-bluebelly-news="matched-reviewed-post-event"/);
 assert.match(route,/<PostEventRecapArticle recap=\{reviewed\}/);
});

test("already reviewed issuer result reuses exact original and preserves unverified consensus",()=>{
 const item=reviewedPostEventForNews({...source,
  id:"apple-release-verified",sourceName:"Apple Investor Relations",
  headline:"Apple reports fourth-quarter results",
  sourceUrl:"https://www.apple.com/newsroom/2026/11/apple-reports-fourth-quarter-results/",
  occurredAt:"2026-11-02T23:00:00Z",observedAt:"2026-11-02T23:05:00Z"
 },at);
 assert.equal(item?.id,"apple-fy2026q4");
 assert.equal(item?.kind,"earnings");
 assert.match(item!.whatHappened,/No preserved, same-basis pre-release analyst consensus/);
 assert.ok(item!.sourceUrls.some(s=>s.role==="official"));
});

test("receipt identity and publication clock are required, not just similar issuer words",()=>{
 const variants=[
  {...source,sourceUrl:"https://www.rba.gov.au/media-releases/2026/mr-26-29.html"},
  {...source,sourceKind:"reporting"},
  {...source,sourceUrl:"http://www.rba.gov.au/media-releases/2026/mr-26-30.html"},
  {...source,occurredAt:"2026-10-03T03:30:00Z",observedAt:"2026-10-03T03:35:00Z"},
  {...source,occurredAt:"2026-11-03T23:00:00Z",observedAt:"2026-11-03T23:02:00Z"},
  {...source,observedAt:"2026-11-03T03:00:00Z"}
 ];
 for(const variant of variants)assert.equal(reviewedPostEventForNews(variant,at),null);
 const beforeIssuerRelease=new Date("2026-11-02T23:30:00Z");
 const apple={...source,sourceUrl:"https://www.apple.com/newsroom/2026/11/apple-reports-fourth-quarter-results/",
  occurredAt:"2026-11-02T23:00:00Z",observedAt:"2026-11-02T23:05:00Z"};
 assert.equal(reviewedPostEventForNews(apple,beforeIssuerRelease),null);
});

test("genuinely unmatched news retains explicit limits, not a default public full story",()=>{
 const item=reviewedPostEventForNews({...source,
  sourceUrl:"https://www.rba.gov.au/media-releases/2026/mr-26-31.html"},at);
 assert.equal(item,null);
 const reader=readFileSync(new URL("../components/blue-desk/ShortNewsRecap.tsx",import.meta.url),"utf8");
 assert.match(reader,/data-bluebelly-coverage="review-handoff-pending"/);
 assert.match(reader,/Show the checks required for a full investigation/);
 assert.doesNotMatch(reader,/What must be researched before calling this the full story\?/);
});
