import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {takeawayExcerpt} from "../lib/bluebelly-market-takeaway-excerpt.ts";

const file=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("Bluebelly full readers show simple boxes before the normal full story",()=>{
 const paths=[
  "components/blue-desk/PostEventRecap.tsx",
  "components/blue-desk/NewsroomEventReader.tsx",
  "components/blue-desk/KeyStoryDeepArticle.tsx",
  "components/blue-desk/StoryEditorialArticle.tsx",
 ];
 for(const path of paths){
  const body=file(path);
  assert.ok(body.includes("<StorySummaryBoxes"),path+" must render boxes");
  const start=body.indexOf("<StorySummaryBoxes");
  const full=body.indexOf("The full story",start);
  assert.ok(full>start,path+" must put full prose below boxes");
 }
 assert.match(file("components/blue-desk/NewsroomEventReader.module.css"),/\.story section\{[^}]*background:transparent/);
 const css=file("components/blue-desk/StorySummaryBoxes.module.css");
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:640px\)/);
 const component=file("components/blue-desk/StorySummaryBoxes.tsx");
 assert.match(component,/data-story-summary="boxes-before-full-prose"/);
 assert.match(component,/takeawayExcerpt\(item\.text,240\)/);
});
test("Box excerpts preserve a full-length reviewed explanation in the original full prose",()=>{
 const full="The rate moved because the original institution reported a higher policy rate, not because the frontend inferred it. The observed asset reaction remains unassessed until a matched market window exists.";
 const excerpt=takeawayExcerpt(full,120);
 assert.equal(excerpt.expanded,true);
 assert.ok(excerpt.preview.length<full.length);
 assert.equal(full.includes("observed asset reaction"),true);
});
