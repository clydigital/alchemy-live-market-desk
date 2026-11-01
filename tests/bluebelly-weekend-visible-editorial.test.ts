import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {currentReviewedPublicFocus,reviewedFocusIsRecent} from "../lib/bluebelly-reviewed-public-focus.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("reviewed public story has a bounded date-only window and no auto-promotion",()=>{
 const day=new Date("2026-11-02T00:00:00Z");
 const events=currentReviewedPublicFocus(day);
 assert.equal(events.length,1);
 assert.equal(events[0].eventDay,"2026-11-01");
 assert.match(events[0].href,/^\?feature=/);
 assert.match(events[0].fact,/not verified/i);
 assert.ok(reviewedFocusIsRecent(events[0].eventDay,day));
 assert.equal(currentReviewedPublicFocus(new Date("2026-10-31T23:00:00Z")).length,0);
 assert.equal(currentReviewedPublicFocus(new Date("2026-11-09T00:00:00Z")).length,0);
 assert.ok(!reviewedFocusIsRecent(events[0].eventDay,new Date("2026-11-04T00:00:00Z")));
});
test("Today and Newsroom share reviewed public story metadata without inventing a news event clock",()=>{
 const home=read("lib/bluebelly-decision-brief.ts");
 const newsroom=read("app/blue-desk/newsroom/page.tsx");
 const wire=read("components/blue-desk/BluebellyNewsWire.tsx");
 assert.match(home,/currentReviewedPublicFocus\(now\)/);
 assert.match(newsroom,/currentReviewedPublicFocus\(now\)/);
 assert.match(newsroom,/eventDay/);
 assert.match(wire,/source date only/);
 assert.match(home,/reviewedFocusIsRecent/);
});
test("Markets cross-links existing reviewed Hormuz story; physical monitor survives",()=>{
 const markets=read("app/blue-desk/markets/page.tsx");
 const hormuz=read("app/blue-desk/hormuz/page.tsx");
 assert.match(markets,/data-markets-reviewed-catalyst/);
 assert.match(markets,/currentReviewedPublicFocus\(now\)/);
 assert.match(hormuz,/HormuzCrossings monitor=/);
 assert.match(hormuz,/HormuzMediationFeature mode="preview"/);
 assert.match(hormuz,/newsroom\?q=hormuz/);
});
