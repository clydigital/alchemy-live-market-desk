import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const page=read("components/blue-desk/LeanWatch.tsx");
const style=read("components/blue-desk/lean-watch.module.css");
const route=read("app/blue-desk/key-stories/page.tsx");

test("default Watch shows three leading recorded theses and collapses the rest without changing source reads",()=>{
 assert.match(page,/data-bluebelly-watch="lean-readonly-v1"/);
 assert.match(page,/data-key-stories-reading="three-leading-then-expand"/);
 assert.match(page,/data-key-stories-leading="recorded-research-not-news"/);
 assert.match(page,/const cards=stories\.map\(story=>/);
 assert.match(page,/cards\.slice\(0,3\)/);
 assert.match(page,/cards\.length>3\?<details/);
 assert.match(page,/data-key-stories-more="collapsed-by-default"/);
 assert.match(page,/cards\.slice\(3\)/);
 assert.doesNotMatch(page,/<details[^>]+\sopen(?:\s|>|=)/);
 assert.match(route,/orderStoriesByLatestMotion\(tracked,linkedMotion,now\)\.slice\(0,8\)/);
 assert.match(route,/if\(!isFocusedStoryReader\)/);
});
test("each Story preserves its dated status, source context, countercase and original article URL",()=>{
 for(const marker of [
 "StoryStatusStrip status={story.status} slug={story.slug} updatedAt={story.updatedAt}",
 'data-watch-story={story.slug}',
 "story.nextTest","story.thesis","story.support","story.contradiction",
 "story.invalidation","story.confirmation",
 'Linked {story.latestMotionVerification==="VERIFIED"',
 "No new linked event displayed",
 "No approved public thesis snapshot is available",
 ]){
  assert.ok(page.includes(marker),marker);
 }
 assert.match(page,/details className=\{ui\.details\}/);
 assert.match(page,/Evidence and counterargument/);
 assert.match(page,/\?story=/);
 assert.match(page,/\?category=All#persistent-theses/);
 assert.match(page,/Read full thesis and source context/);
 assert.match(page,/dated research snapshots, not live trading signals/);
 assert.doesNotMatch(page,/supabaseAdmin|\.upsert\(|\.insert\(|\.update\(/);
});
test("grid is 3 / 2 / 1 across screen widths and progress disclosures are keyboard accessible",()=>{
 assert.match(style,/\.grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(style,/@media\(max-width:1060px\)/);
 assert.match(style, /\.grid,\.moreStories>\.grid\{grid-template-columns:repeat\(2/);
 assert.match(style,/@media\(max-width:760px\)/);
 assert.match(style,/\.grid,\.moreStories>\.grid\{grid-template-columns:1fr/);
 assert.match(style,/\.moreStories>summary:focus-visible/);
 assert.match(page,/className=\{ui\.moreStories\}/);
 assert.match(page,/className=\{ui\.heroRadar\} aria-hidden="true"/);
 assert.match(style,/var\(--bb-command-accent\)/);
 assert.match(style,/var\(--bb-card-quiet\)/);
});
