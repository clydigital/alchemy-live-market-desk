import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {OCTOBER_FED_DEPTH,storyCoverageForNews,storyDepthForNews} from "../lib/bluebelly-key-story-depth.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";
const source=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

const verified:NewsBriefV1={
 contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",
 id:"e378d91d-deb9-4148-88c5-ab6bf5ef367f",
 headline:"Federal Reserve issues FOMC statement",
 summary:"The Committee maintains its target range of 3.75–4.00%.",
 sourceName:"Federal Reserve Board",
 sourceUrl:"https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm",
 sourceKind:"official",occurredAt:"2026-10-28T18:00:00.000Z",
 observedAt:"2026-10-28T18:01:00.000Z",
 verification:"SOURCE_VERIFIED"
};

test("official October 28 FOMC evidence packet provides previous, expected, actual and difference",()=>{
 const x=storyDepthForNews(verified);
 assert.ok(x);
 assert.equal(x,OCTOBER_FED_DEPTH);
 assert.ok(x.numbers.length>=6);
 for(const m of x.numbers){
  assert.ok(m.baseline&&m.expected&&m.observed&&m.change&&m.basis);
  assert.ok(m.sourceUrl.startsWith("https://"));
 }
 assert.match(x.whatChanged.join(" "),/two hike dissents/i);
 assert.match(x.missing.join(" "),/timestamp-matched/);
 assert.equal(storyCoverageForNews(verified).status,"RESEARCH_ENRICHED");
});

test("a reused Fed hostname or changed release clock cannot inherit October facts",()=>{
 const alternate={...verified,sourceUrl:"https://www.federalreserve.gov/newsevents/pressreleases/monetary20261029a.htm"};
 const old={...verified,occurredAt:"2025-10-28T18:00:00Z"};
 const unrelated={...verified,sourceUrl:"https://www.example.com/press/release"};
 for(const item of [alternate,old,unrelated]){
  assert.equal(storyDepthForNews(item),null);
  assert.equal(storyCoverageForNews(item).status,"SOURCE_ONLY");
  assert.ok(storyCoverageForNews(item).missing.length>=4);
 }
});

test("evidence read is independent of private research, LLM and direct admin credentials",()=>{
 for(const path of ["lib/bluebelly-key-story-depth.ts","components/blue-desk/KeyStoryDeepArticle.tsx"]){
  const body=source(path);
  assert.doesNotMatch(body,/createSupabaseAdminClient|service_role|OPENAI_API_KEY|generateContent\(|notion\.fetch|fetch\(.*notion/i);
 }
 const article=source("components/blue-desk/KeyStoryDeepArticle.tsx");
 assert.match(article,/<table/);
 assert.match(article,/before · expected · actual|Previous/);
 assert.match(article,/What else could explain/);
 assert.match(article,/Measurements Bluebelly still lacks/);
});
