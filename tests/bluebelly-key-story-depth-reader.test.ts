import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {OCTOBER_FED_DEPTH,storyDepthForNews,storyCoverageForNews} from "../lib/bluebelly-key-story-depth.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const qualified:NewsBriefV1={
 contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",
 id:"e378d91d-deb9-4148-88c5-ab6bf5ef367f",
 headline:"Federal Reserve issues FOMC statement",
 summary:"The FOMC kept rates unchanged at 3.75–4.00%.",
 sourceName:"Federal Reserve Board",sourceKind:"official",verification:"SOURCE_VERIFIED",
 sourceUrl:"https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm",
 occurredAt:"2026-10-28T18:00:00Z",observedAt:"2026-10-28T18:01:00Z",
};

test("original FOMC bookmark becomes an immutable editorial case without inventing a live receipt",()=>{
 const route=read("app/blue-desk/key-stories/page.tsx");
 assert.match(route,/params\?\.news==="e378d91d-deb9-4148-88c5-ab6bf5ef367f"/);
 assert.match(route,/data-bluebelly-news="depth-reviewed-original-event"/);
 assert.match(route,/<KeyStoryDeepArticle depth=\{OCTOBER_FED_DEPTH\}/);
 assert.match(route,/coverage=\{storyCoverageForNews\(event\)\}/);
 assert.match(route,/const event=recentNews\.find\(n=>n\.id===newsId\)/);
 assert.doesNotMatch(route,/createSupabaseAdminClient|service_role|generateContent\(/);
});

test("all other news retains provenance but is clearly marked as incomplete research",()=>{
 const v={...qualified,sourceUrl:"https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm"};
 assert.equal(storyDepthForNews(v),null);
 assert.equal(storyCoverageForNews(v).status,"SOURCE_ONLY");
 const generic=read("components/blue-desk/ShortNewsRecap.tsx");
 assert.match(generic,/data-bluebelly-news-recap="source-only-depth-incomplete"/);
 assert.match(generic,/Show the checks required for a full investigation/);
 assert.match(generic,/data-bluebelly-coverage="review-handoff-pending"/);
 assert.match(generic,/Research depth incomplete|RESEARCH DEPTH INCOMPLETE/);
 assert.match(generic,/validSource\(recap\.sourceUrl\)/);
});

test("FOMC explanation compares dated official readings without fake event-window causality",()=>{
 assert.ok(OCTOBER_FED_DEPTH.numbers.some(x=>x.label==="Committee vote"&&x.observed.includes("10–2")));
 assert.ok(OCTOBER_FED_DEPTH.numbers.some(x=>x.label==="10Y Treasury close"&&x.change.includes("+6bp")));
 assert.ok(OCTOBER_FED_DEPTH.missing.some(x=>x.includes("timestamp-matched")));
 const article=read("components/blue-desk/KeyStoryDeepArticle.tsx");
 assert.match(article,/Previous/);
 assert.match(article,/Actual/);
 assert.match(article,/What else could explain/);
 assert.match(article,/Measurements Bluebelly still lacks/);
 assert.match(article,/depth\.sources\.map/);
});

test("FOMC hero places original-event clock and Key Stories return beneath illustration, keeping headline first",()=>{
 const article=read("components/blue-desk/KeyStoryDeepArticle.tsx");
 const heroStart=article.indexOf('<header className={styles.hero}>');
 const headline=article.indexOf("<h1>{depth.title}</h1>",heroStart);
 const image=article.indexOf("<EditorialStoryArt",heroStart);
 const meta=article.indexOf('data-key-story-meta="under-illustration"',heroStart);
 const clock=article.indexOf("<DualTimestamp className={styles.eventTime}",meta);
 const back=article.indexOf('className={styles.backButton} href={backHref}',meta);
 const heroEnd=article.indexOf("</header>",heroStart);
 assert.ok(heroStart>=0&&heroStart<headline&&headline<image&&image<meta&&meta<clock&&clock<back&&back<heroEnd);
 assert.doesNotMatch(article.slice(0,heroStart),/Return to Key Stories/);
 assert.match(article.slice(headline,image),/QUICK MARKET BRIEF/);
 const css=read("components/blue-desk/KeyStoryDeepArticle.module.css");
 assert.match(css,/\.storyMeta\{/);
 assert.match(css,/\.backButton\{/);
 assert.match(css,/@media\(max-width:600px\)\{\.art\{display:flex/);
 assert.doesNotMatch(css,/@media\(max-width:600px\)\{\.art\{display:none/);
});
