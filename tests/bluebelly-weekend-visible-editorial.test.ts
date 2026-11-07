import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {currentReviewedPublicFocus,reviewedFocusIsRecent} from "../lib/bluebelly-reviewed-public-focus.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("retired proposal is not repromoted as current news",()=>{
 assert.deepEqual(currentReviewedPublicFocus(new Date("2026-11-02T00:00:00Z")),[]);
 assert.deepEqual(currentReviewedPublicFocus(new Date("2026-11-08T00:00:00Z")),[]);
 assert.ok(!reviewedFocusIsRecent("2026-11-01",new Date("2026-11-04T00:00:00Z")));
});
test("Today and Newsroom share reviewed public story metadata without inventing a news event clock",()=>{
 const home=read("lib/bluebelly-decision-brief.ts");
 const newsroom=read("app/blue-desk/newsroom/page.tsx");
 const wire=read("components/blue-desk/BluebellyNewsWire.tsx");
 assert.match(home,/currentReviewedPublicFocus\(now\)/);
 assert.match(newsroom,/publicNewsroomEditorials/);
 const shared=read("lib/bluebelly-public-newsroom-feed.ts");
 assert.match(shared,/currentReviewedPublicFocus\(now\)/);
 assert.match(shared,/eventDay/);
 assert.match(wire,/source date only/);
 assert.match(home,/reviewedFocusIsRecent/);
});
test("Markets can show bounded reviewed stories, while Hormuz uses a separate situation brief",()=>{
 const markets=read("app/blue-desk/markets/page.tsx");
 const hormuz=read("app/blue-desk/hormuz/page.tsx");
 assert.match(markets,/data-markets-reviewed-catalyst/);
 assert.match(markets,/currentReviewedPublicFocus\(now\)/);
 assert.match(hormuz,/HormuzCrossings monitor=/);
 assert.match(hormuz,/HormuzSituationBrief newsroomHref=/);
 assert.match(hormuz,/newsroom\?q=hormuz/);
});
