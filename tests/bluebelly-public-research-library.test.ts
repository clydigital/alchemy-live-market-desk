import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 PUBLIC_RESEARCH_CATEGORIES,PUBLIC_RESEARCH_INDEX,
 MANUAL_RESEARCH_AUTOPROMOTION_ENABLED,selectPublicResearch,
} from "../lib/bluebelly-public-research-library.ts";
import {blueDeskHostAccess,blueDeskPresentationTarget} from "../lib/blue-desk-host.ts";

const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Public Research only indexes finite, previously available dated editorial readers",()=>{
 assert.equal(PUBLIC_RESEARCH_INDEX.length,10);
 const ids=new Set<string>();
 for(const entry of PUBLIC_RESEARCH_INDEX){
   assert.ok(!ids.has(entry.id),"duplicate edition "+entry.id);
   ids.add(entry.id);
   assert.match(entry.asOf,/^2026-10-(?:27|28|29|30)$|^2026-11-0[124]$/);
   assert.ok(entry.href.startsWith("/features/")||entry.href.startsWith("/key-stories?feature=")||entry.href==="/earnings-week");
   assert.ok(!/owner|api|notion|pdf|draft|reports\/|https?:/i.test(entry.href));
   assert.ok(entry.summary.length>35);
 }
 assert.equal(PUBLIC_RESEARCH_INDEX[0].id,"market-desk-4-nov");
 assert.ok(PUBLIC_RESEARCH_INDEX.some(x=>x.id==="midterm-seasonality"&&x.asOf==="2026-11-02"&&x.editorialUpdatedAt));
 assert.equal(PUBLIC_RESEARCH_INDEX.at(-1)?.asOf,"2026-10-27");
 assert.equal(MANUAL_RESEARCH_AUTOPROMOTION_ENABLED,false);
});

test("Public Research searches real title, categories, topics and historical context",()=>{
 assert.ok(PUBLIC_RESEARCH_CATEGORIES.includes("Rates & Bonds"));
 assert.deepEqual(selectPublicResearch("korea","All").map(x=>x.id),["asia-equities"]);
 assert.deepEqual(selectPublicResearch("brent","All").map(x=>x.id),["hormuz-mediation"]);
 assert.ok(selectPublicResearch("","Rates & Bonds").every(x=>x.category==="Rates & Bonds"));
 assert.equal(selectPublicResearch("no-such-research-item-xyz","All").length,0);
 assert.deepEqual(selectPublicResearch("AMZN","not-a-category").map(x=>x.id),["amazon-cash-test"]);
 assert.deepEqual(selectPublicResearch("","invalid-category").map(x=>x.id),PUBLIC_RESEARCH_INDEX.map(x=>x.id));
});

test("Research route is a public-safe index, owner research continues to require authentication",()=>{
 const host="bluebelly-desk.vercel.app";
 assert.equal(blueDeskHostAccess("/research",host),"public");
 assert.equal(blueDeskHostAccess("/blue-desk/research",host),"public");
 assert.equal(blueDeskPresentationTarget("/research",host),"/blue-desk/research");
 assert.equal(blueDeskHostAccess("/research/anything",host),"blocked");
 for(const route of ["/owner/research","/api/owner/daily-research"]){
  assert.equal(blueDeskHostAccess(route,host),"private");
 }
 assert.equal(blueDeskHostAccess("/owner/research/anything",host),"blocked");
 const page=read("app/blue-desk/research/page.tsx");
 assert.match(page,/data-bluebelly-research-index="public-approved-dated"/);
 assert.match(page,/selectPublicResearch/);
 assert.match(page,/type="search"/);
 assert.match(page,/PUBLIC_RESEARCH_CATEGORIES/);
 assert.match(page,/Research as of/);
 assert.doesNotMatch(page,/fetchTodayNotionResearch|createSupabaseAdminClient|process\.env|owner\/daily-research/);
});

test("Homepage has no fixed October manual feature slot and links to historical Research",()=>{
 const home=read("app/blue-desk/page.tsx");
 const nav=read("components/blue-desk/BlueDeskHeader.tsx");
 assert.match(home,/data-home-research-archive-link="dated-not-live"/);
 assert.doesNotMatch(home,/data-featured-manual-research="two-independent-stories"/);
 assert.doesNotMatch(home,/DEEP RESEARCH · 27 OCTOBER 2026 SNAPSHOT/);
 assert.match(nav,/const PUBLIC_MORE = \[[\s\S]*?\["Research Library", "\/research"\]/);
 assert.match(nav,/\["Research Library", "\/owner\/research"\]/);
});
