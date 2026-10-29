import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {EDITORIAL_TOPICS,EDITORIAL_REGIME_LENSES,editorialNewsTopics,groupPublicResearch} from "../lib/bluebelly-editorial-architecture.ts";
import {blueDeskHostAccess,blueDeskPresentationTarget} from "../lib/blue-desk-host.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";
const file=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
function report(headline:string,summary:string):Pick<NewsBriefV1,"headline"|"summary">{return {headline,summary};}
test("seven destinations; exact public newsroom and regimes; owner stays private",()=>{
 const header=file("components/blue-desk/BlueDeskHeader.tsx");
 for(const s of ["Today","Newsroom","Regime Watch","Markets","Calendar","Daily Report","Presenter Prep"])assert.match(header,new RegExp('"'+s+'"'));
 for(const p of ["/newsroom","/regime-watch","/blue-desk/newsroom","/blue-desk/regime-watch"]){
  assert.equal(blueDeskHostAccess(p,"bluebelly-desk.vercel.app"),"public");
  assert.equal(blueDeskHostAccess(p,"alchemy-live-market-desk.vercel.app"),"public");
  assert.equal(blueDeskHostAccess(p+"/","bluebelly-desk.vercel.app"),"blocked");
 }
 assert.equal(blueDeskPresentationTarget("/newsroom","bluebelly-desk.vercel.app"),"/blue-desk/newsroom");
 assert.equal(blueDeskPresentationTarget("/regime-watch","bluebelly-desk.vercel.app"),"/blue-desk/regime-watch");
 assert.equal(blueDeskHostAccess("/owner/presenter","bluebelly-desk.vercel.app"),"private");
 assert.equal(blueDeskHostAccess("/owner/research","bluebelly-desk.vercel.app"),"private");
});
test("topics allow multi-tagging and unmatched reports remain other",()=>{
 assert.equal(EDITORIAL_TOPICS.length,8);
 assert.deepEqual(editorialNewsTopics(report("Fed announces Treasury bond purchase","Original rate decision")),["policy","bonds"]);
 assert.deepEqual(editorialNewsTopics(report("Other event","Government statement on unspecified matter")),["other"]);
 assert.ok(editorialNewsTopics(report("AI chip maker earnings report","Issuer revenue and cash flow")).includes("earnings"));
});
test("nine research lenses only index public historical Story snapshots",()=>{
 assert.equal(EDITORIAL_REGIME_LENSES.length,9);
 const groups=groupPublicResearch([]);
 assert.equal(groups.length,9);
 assert.ok(groups.every(x=>x.stories.length===0));
 const read=file("app/blue-desk/regime-watch/page.tsx");
 assert.match(read,/getPublicThesisLedger/);
 assert.doesNotMatch(read,/createSupabaseAdminClient|story_thesis_versions|system2|market_regime_current/i);
 const home=file("components/blue-desk/BluebellyNewsfront.tsx");
 assert.match(home,/VERIFIED ANNOUNCEMENT/);
 assert.match(home,/DATED MARKET DATA/);
 assert.doesNotMatch(home,/x_wire_posts|market_motion_items|createSupabaseAdminClient/);
});
test("Newsroom keeps the original verified public admission contract",()=>{
 const page=file("app/blue-desk/newsroom/page.tsx");
 assert.match(page,/selectVerifiedNewsBriefs/);
 assert.match(page,/getOriginalPressNews/);
 assert.match(page,/combineQualifiedNews/);
 const wire=file("components/blue-desk/BluebellyNewsWire.tsx");
 assert.match(wire,/SOURCE VERIFIED/);
 assert.match(wire,/item\.sourceUrl/);
 assert.match(wire,/item\.occurredAt/);
 assert.match(wire,/aria-pressed/);
 assert.doesNotMatch(wire,/createClient|supabase|publishReport|writeResearch/);
});
