import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DESK_EDITORIAL_EDITION,DESK_EDITORIAL_UPDATES,DESK_WATCHLIST} from "../lib/bluebelly-current-editorial.ts";
import {editorialCalendarDay,isEditorialUpdatedToday} from "../lib/bluebelly-editorial-freshness.ts";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const now=new Date("2026-11-04T10:30:00.000Z");

test("an Updated today badge requires an actual revision of an earlier edition, never retrieval or deployment",()=>{
 assert.equal(editorialCalendarDay(now),"2026-11-04");
 assert.equal(isEditorialUpdatedToday("2026-11-02","2026-11-04T09:58:00Z",now),true);
 assert.equal(isEditorialUpdatedToday("2026-11-04","2026-11-04T09:58:00Z",now),false);
 assert.equal(isEditorialUpdatedToday("2026-11-02","2026-11-03T13:00:00Z",now),false);
 assert.equal(isEditorialUpdatedToday("2026-11-02",null,now),false);
 assert.equal(isEditorialUpdatedToday("2026-11-02","2026-11-04T19:00:00Z",now),false);
 assert.equal(isEditorialUpdatedToday("2026-11-02","2026-11-04T09:58:00Z",new Date("2026-11-04T16:02:00Z")),false);
 assert.equal(isEditorialUpdatedToday("2026-11-02","2026-11-04T09:58:00Z",new Date("2026-11-03T15:59:00Z")),false);
});

test("public slate is source-dated and distinguishes revised midterms from genuinely new AMD and Riksbank material",()=>{
 assert.equal(DESK_EDITORIAL_EDITION,"2026-11-04");
 assert.equal(DESK_EDITORIAL_UPDATES.length,3);
 assert.ok(DESK_WATCHLIST.length>=3);
 for(const item of DESK_EDITORIAL_UPDATES){
  assert.match(item.sourceUrl,/^https:\/\//);
  assert.match(item.readerHref,/^\//);
  assert.match(item.sourceDay,/^2026-11-0[34]$/);
  assert.ok(item.nextTest.length>30);
 }
 assert.equal(DESK_EDITORIAL_UPDATES.filter(item=>isEditorialUpdatedToday(item.initialPublishedOn,item.editorialUpdatedAt,now)).length,1);
});

test("Today, Newsroom, Research, Markets, Regime Watch and public navigation retain dated editorial",()=>{
 for(const path of ["app/blue-desk/page.tsx","app/blue-desk/newsroom/page.tsx",
  "app/blue-desk/research/page.tsx","app/blue-desk/markets/page.tsx",
  "app/blue-desk/regime-watch/page.tsx",
  "components/blue-desk/BlueDeskHeader.tsx"]){
  assert.match(read(path),/CurrentMarketUpdates/,"Missing current editorial at "+path);
 }
 const key=read("app/blue-desk/key-stories/page.tsx");
 assert.match(key,/market-desk-4-nov-2026/);
 assert.match(key,/NovemberDeskStory/);
 assert.match(read("components/blue-desk/BluebellyNewsWire.tsx"),/isEditorialUpdatedToday/);
 assert.match(read("lib/bluebelly-public-research-library.ts"),/editorialUpdatedAt:"2026-11-04T09:58:00Z"/);
 assert.match(read("components/blue-desk/MidtermRallyFeature.tsx"),/partial post-election rebound|The reversal matters/);
});

test("source and editor status never become canonical evidence or private/public leakage",()=>{
 const data=read("lib/bluebelly-current-editorial.ts");
 const component=read("components/blue-desk/CurrentMarketUpdates.tsx");
 assert.doesNotMatch(data+component,/app\.notion\.com\/p\/|research_intake_items|service_role|SUPABASE_SERVICE/);
 assert.match(read("lib/bluebelly-public-newsroom-feed.ts"),/REUTERS-REPORTED TAPE · DATED EDITORIAL/);
 assert.match(read("lib/bluebelly-bank-decision-snapshots.ts"),/riksbank-2026-11-04/);
 assert.equal(blueDeskHostAccess("/owner/research","bluebelly-desk.vercel.app"),"private");
 assert.equal(blueDeskHostAccess("/key-stories","bluebelly-desk.vercel.app"),"public");
});
