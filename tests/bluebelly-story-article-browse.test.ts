import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {blueDeskHostAccess,blueDeskPresentationTarget} from "../lib/blue-desk-host.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("categorised Key Stories remains inside the currently approved exact public path",()=>{
 const page=read("app/blue-desk/key-stories/page.tsx");
 assert.match(page,/PUBLIC_STORY_CATEGORIES/);
 assert.match(page,/visibleTheses/);
 assert.match(page,/categoryFilters/);
 assert.match(page,/data-persistent-thesis-ledger="source-identity"/);
 assert.match(page,/\?category=/);
 assert.match(page,/\?story=/);
 assert.match(page,/StoryEditorialArticle story=\{selected\}/);
 assert.match(page,/\^\[a-z0-9-\]\{1,150\}\$/);
 assert.equal(blueDeskHostAccess("/key-stories","bluebelly-desk.vercel.app"),"public");
 assert.equal(blueDeskPresentationTarget("/key-stories","bluebelly-desk.vercel.app"),"/blue-desk/key-stories");
 assert.equal(blueDeskHostAccess("/key-stories-internal","bluebelly-desk.vercel.app"),"blocked");
});

test("Story reader is explicit about missing sequence and evidence; no invented price reaction",()=>{
 const article=read("components/blue-desk/StoryEditorialArticle.tsx");
 const css=read("components/blue-desk/StoryEditorialArticle.module.css");
 assert.match(article,/01 · THE SETUP/);
 assert.match(article,/02 · THE ARGUMENT/);
 assert.match(article,/03 · FOLLOW THE MONEY/);
 assert.match(article,/04 · THE CATCH/);
 assert.match(article,/05 · THE DECIDING TEST/);
 assert.match(article,/independently sourced event-by-event chronology/);
 assert.match(article,/per-claim original-source ledger/);
 assert.match(article,/matched, source-dated price reaction/);
 assert.match(article,/story\.updatedAt/);
 assert.match(css,/@media\(max-width:560px\)/);
});

test("all Story cards open the approved query-mode reader; old hash links remain addressable",()=>{
 const home=read("app/blue-desk/page.tsx");
 const page=read("app/blue-desk/key-stories/page.tsx");
 assert.match(home,/\+"\?story="\+/);
 assert.doesNotMatch(home,/\+"#thesis-"\+/);
 assert.match(page,/id=\{"thesis-"\+thesis\.slug\}/);
 assert.match(page,/searchParams\?:Promise/);
});
