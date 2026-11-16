import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {hormuzTopicFilter,isHormuzRelevant} from "../lib/bluebelly-hormuz-relevance.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Hormuz routing requires regional relevance and does not mistake an unrelated ceasefire for Iran news",()=>{
 for(const text of ["Iranian talks", "Strait of Hormuz", "Gulf of Oman incident", "Tehran position"])
  assert.equal(isHormuzRelevant(text),true);
 for(const text of ["Ukraine ceasefire", "Qatar earnings", "Sudan peace talks", "Iranianization"])
  assert.equal(isHormuzRelevant(text),false);
 const filter=hormuzTopicFilter(["headline","what_happened"]);
 assert.match(filter,/headline\.ilike\.%hormuz%/);
 assert.match(filter,/what_happened\.ilike\.%iran%/);
});
test("Hormuz reads the existing topic-filtered source receipts before global limits, then revalidates the existing page",()=>{
 const page=read("app/blue-desk/hormuz/page.tsx");
 assert.match(page,/getPublishedMacroPulseBriefs\(6,"hormuz"\)/);
 assert.match(page,/readBluebellyQualifiedNews\(now,18,"hormuz"\)/);
 assert.match(page,/<AutoRefreshMacroData\/>/);
 for(const file of ["lib/blue-desk-macropulse-brief-server.ts","lib/market-motion.ts","lib/blue-desk-original-press-news-server.ts"]){
  const source=read(file);
  const index=source.indexOf("query.or(hormuzTopicFilter");
  assert.ok(index>=0,file);
  assert.ok(source.indexOf(".limit(",index)>index,file);
 }
 const component=read("components/blue-desk/HormuzSituationBrief.tsx");
 assert.match(component,/data-hormuz-research-freshness/);
 assert.match(component,/data-hormuz-latest-lead="unverified"/);
 assert.match(component,/data-hormuz-reviewed-history="dated-only"/);
 assert.ok(component.indexOf('Negotiations & conflict')<component.indexOf('data-hormuz-reviewed-history'));
 assert.doesNotMatch(component,/\.insert\(|\.upsert\(|\.update\(/);
});
