import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {OCTOBER_FED_DEPTH,SEPTEMBER_JOLTS_DEPTH,storyCoverageForNews,storyDepthForNews} from "../lib/bluebelly-key-story-depth.ts";
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

const jolts:NewsBriefV1={
 contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",
 id:"official-macro-us-bls-2026-11-03-jolts-september-2026",
 headline:"Job Openings and Labor Turnover Survey for September 2026 — official result",
 summary:"Job Openings and Labor Turnover Survey for September 2026 (September 2026): Job openings 7.5M. Original government actual; expectations and market reactions are not established by this record.",
 sourceName:"U.S. Bureau of Labor Statistics · official result",
 sourceUrl:"https://www.bls.gov/news.release/archives/jolts_11032026.htm",
 sourceKind:"official",occurredAt:"2026-11-03T15:00:00.000Z",
 observedAt:"2026-11-03T15:11:39.874Z",
 verification:"SOURCE_VERIFIED",
};
test("source-qualified JOLTS escaped fallback is rescued with independently dated 2 November consensus, not fabricated causal pricing",()=>{
 const depth=storyDepthForNews(jolts);
 assert.equal(depth,SEPTEMBER_JOLTS_DEPTH);
 assert.equal(storyCoverageForNews(jolts).status,"RESEARCH_ENRICHED");
 assert.ok(depth.numbers.some(m=>m.label==="September job openings"&&m.expected.includes("7.134M")&&m.observed.includes("7.523M")&&m.change.includes("+0.389M")));
 assert.ok(depth.numbers.some(m=>m.label==="August revision"&&m.change.includes("+0.111M")));
 assert.ok(depth.numbers.some(m=>m.label==="Quits"&&m.observed.includes("3.365M")));
 assert.match(depth.chronology.join(" "),/recovered retrospectively/);
 assert.match(depth.marketTape.join(" "),/not a controlled JOLTS event-window reaction/);
 assert.ok(depth.missing.some(m=>/internally frozen/i.test(m)));
 assert.ok(depth.sources.some(m=>m.url.includes("econoday.com")&&m.role.includes("Retrospectively")));
 assert.ok(depth.sources.some(m=>m.url.includes("bls.gov")));
});
test("JOLTS recovery is exact-identity and original-source gated; similar or unverified events remain source-only",()=>{
 const variants=[
  {...jolts,id:"unrelated-jolts"},
  {...jolts,sourceUrl:"https://www.bls.gov/news.release/archives/jolts_09292026.htm"},
  {...jolts,sourceUrl:"https://untrusted.example/jolts_11032026.htm"},
  {...jolts,summary:"Job openings 7.2M"},
  {...jolts,verification:"UNVERIFIED" as NewsBriefV1["verification"]},
  {...jolts,sourceKind:"creator"},
  {...jolts,occurredAt:"2026-11-04T15:00:00Z"},
  {...jolts,observedAt:"2026-11-03T14:59:00Z"},
 ];
 for(const item of variants){
  assert.equal(storyDepthForNews(item),null);
  assert.equal(storyCoverageForNews(item).status,"SOURCE_ONLY");
 }
});

test("shared deep-story reader never inserts Fed-only prose in JOLTS", () => {
 const article=source("components/blue-desk/KeyStoryDeepArticle.tsx");
 const forbidden=[
  "What was the market expecting before the Fed spoke?",
  "Six measurements tell a different story from",
  "The vote reveals more than the unchanged rate",
  "Why might the yield curve steepen after a hold?",
  "Hold ≠ no change",
  "The rate was unchanged. The dissent",
  "Read the related full-length FOMC narrative",
  "Previous, expected and actual FOMC evidence",
 ];
 for(const phrase of forbidden) assert.ok(!article.includes(phrase),phrase);
 assert.ok(article.includes("depth.numbers.slice(0,3)"));
 assert.ok(article.includes("depth.theQuestion"));
 assert.ok(article.includes("depth.whatChanged[0]"));
 assert.ok(article.includes("receipt?.sourceName"));
 assert.ok(article.includes("depth.missing[0]"));
 assert.match(article,/What else could explain/);
 assert.match(article,/Measurements Bluebelly still lacks/);
});
