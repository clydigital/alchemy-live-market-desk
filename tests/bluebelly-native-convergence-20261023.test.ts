import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {officialEarningsEvents} from "../lib/forward-earnings-sources.ts";
import {storyIdentityBalls} from "../lib/blue-desk/story-identity.ts";
import {blueDeskHostAccess,blueDeskPresentationTarget} from "../lib/blue-desk-host.ts";

test("issuer-backed October / November earnings become visible in 30-day window",()=>{
  const events=officialEarningsEvents(new Date("2026-10-23T04:00:00Z"));
  for(const [ticker,date] of [["MSFT","2026-10-28"],["GOOGL","2026-10-28"],
    ["AMZN","2026-10-29"],["AAPL","2026-11-02"]]){
    const event=events.find(e=>e.affectedAssets.includes(ticker));
    assert.ok(event,ticker+" original IR earnings date must be present");
    assert.equal(event!.startAt?.slice(0,10),date);
    assert.match(event!.sourceUrl,/^https:\/\//);
    assert.equal(event!.eventType,"earnings");
    assert.equal(event!.verificationState,"official");
    assert.ok(storyIdentityBalls(event!.title,event!.decisiveVariable||"",5,event!.affectedAssets)
      .some(ball=>ball.kind==="company"),ticker+" company logo ball");
  }
});
test("Bluebelly presenter is native and includes article researcher plus chart checklist",()=>{
  const src=readFileSync(new URL("../app/blue-desk/presenter/page.tsx",import.meta.url),"utf8");
  assert.match(src,/<EditorialWorkbench priceCards=\{priceCards\} mode="presenter"/);
  assert.match(src,/<PresenterTechnicalChecks compact \/>/);
  assert.match(src,/getLatestEditorialSlate\(\)/);
  assert.match(src,/projectEditorialPriceCards/);
  assert.equal(blueDeskHostAccess("/presenter","bluebelly-desk.vercel.app"),"private");
  assert.equal(blueDeskPresentationTarget("/presenter","bluebelly-desk.vercel.app"),"/blue-desk/presenter");
  assert.equal(blueDeskHostAccess("/api/owner/editorial-generate","bluebelly-desk.vercel.app"),"private");
  assert.equal(blueDeskHostAccess("/api/cron/research/morning","bluebelly-desk.vercel.app"),"blocked");
});
test("Calendar renders company/country identities, sources, and date-only precision without fabricated earnings",()=>{
 const src=readFileSync(new URL("../app/blue-desk/calendar/page.tsx",import.meta.url),"utf8");
 assert.match(src,/getForwardEarningsEvents/);
 assert.match(src,/StoryIdentityBalls/);
 assert.match(src,/event\.sourceUrl/);
 assert.match(src,/DATE-ONLY RECORDS/);
});
