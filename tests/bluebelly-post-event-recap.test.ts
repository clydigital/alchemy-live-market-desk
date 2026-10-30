import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {findPostEventRecap,selectPostEventRecaps} from "../lib/bluebelly-post-event-recap.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";

const now=new Date("2026-10-29T19:00:00Z");
test("Fed post-event recap leads verified bank and released earnings, not preview",()=>{
 const items=selectPostEventRecaps([],now,6);
 assert.equal(items[0].id,"fed-2026-10-28");
 assert.equal(items[0].featuredStatus,"REVIEWED");
 assert.equal(items[0].marketEffectStatus,"DATED_SECONDARY_AND_DAILY_DATA");
 assert.ok(items[0].sourceUrls.some(s=>s.role==="reporting"));
 assert.ok(items[0].sourceUrls.some(s=>s.role==="market_data"));
 assert.ok(items.some(x=>x.kind==="earnings"&&x.id==="sk-hynix-2026q3"));
 assert.ok(items.some(x=>x.id==="boc-2026-10-28"));
 assert.ok(items.every(x=>x.detailsHref.startsWith("?postEvent=")));
});
test("do not prepublish an event or silently keep expired recaps",()=>{
 assert.ok(!selectPostEventRecaps([],new Date("2026-10-28T17:50:00Z"),8).some(x=>x.id==="fed-2026-10-28"));
 assert.ok(!selectPostEventRecaps([],new Date("2026-11-08T19:00:00Z"),8).some(x=>x.id==="fed-2026-10-28"));
 assert.equal(findPostEventRecap("../../../secret",[],now),null);
});
test("unknown verified original earnings receipt stays source-only",()=>{
 const news:NewsBriefV1={
  contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",id:"future-issuer-1",
  headline:"Example Inc announces quarterly earnings results",
  summary:"The issuer reports this quarter's earnings in an original company release.",
  sourceName:"Example Investor Relations",sourceUrl:"https://example.com/news/results",sourceKind:"official",
  occurredAt:"2026-10-29T12:00:00Z",observedAt:"2026-10-29T13:00:00Z",verification:"SOURCE_VERIFIED"
 };
 const item=selectPostEventRecaps([news],now,8).find(x=>x.id==="receipt-future-issuer-1");
 assert.ok(item);
 assert.equal(item?.featuredStatus,"SOURCE_ONLY");
 assert.equal(item?.marketEffectStatus,"MECHANISM_ONLY");
 assert.match(item!.marketEffects,/unverified/);
 assert.ok(!selectPostEventRecaps([{...news,sourceKind:"reporting"}],now,8).some(x=>x.id===item?.id));
});
test("homepage and bounded reader wire post-event recap without changing owner auth",()=>{
 const home=readFileSync(new URL("../app/blue-desk/page.tsx",import.meta.url),"utf8");
 const hero=readFileSync(new URL("../components/blue-desk/DecisionBrief.tsx",import.meta.url),"utf8");
 const reader=readFileSync(new URL("../app/blue-desk/key-stories/page.tsx",import.meta.url),"utf8");
 assert.match(home,/selectPostEventRecaps\(recentNews,now,8\)/);
 assert.doesNotMatch(hero,/<PostEventRecapFeature/);
 assert.match(readFileSync(new URL("../app/blue-desk/newsroom/page.tsx",import.meta.url),"utf8"),/selectPostEventRecaps\(news,now,8\)/);
 assert.match(reader,/findPostEventRecap\(recapId,\[\],now\)/);
 assert.match(reader,/data-key-story="post-event-source-reviewed"/);
});

test("fresh official result displaces an older reviewed policy recap as the next research candidate",()=>{
 const later=new Date("2026-11-01T18:00:00Z");
 const next:NewsBriefV1={
  contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",id:"new-release",
  headline:"Another Inc announces quarterly earnings results",
  summary:"The issuer has published original third-quarter earnings and a current outlook.",
  sourceName:"Issuer IR",sourceUrl:"https://example.com/q3/earnings",sourceKind:"official",
  occurredAt:"2026-11-01T14:00:00Z",observedAt:"2026-11-01T15:00:00Z",
  verification:"SOURCE_VERIFIED"
 };
 assert.equal(selectPostEventRecaps([next],later,4)[0].id,"receipt-new-release");
 assert.equal(selectPostEventRecaps([next],later,4)[0].featuredStatus,"SOURCE_ONLY");
});
