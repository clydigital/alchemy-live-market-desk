import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectOriginalPressNews} from "../lib/blue-desk-original-press-news.ts";
import {OFFICIAL_PRESS_FEEDS} from "../lib/official-press-news-intake.ts";

const file=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("decision-first topic links keep the user inside the source-gated Bluebelly reader",()=>{
 const brief=file("lib/bluebelly-decision-brief.ts");
 const card=file("components/blue-desk/DecisionBrief.tsx");
 const route=file("app/blue-desk/key-stories/page.tsx");
 assert.match(brief,/href:'\?news='\+encodeURIComponent\(t\.updates\[0\]\.id\)/);
 assert.match(brief,/href:'\?brief='\+encodeURIComponent\(result\.id\)/);
 assert.match(brief,/href:'\?brief='\+encodeURIComponent\(event\.id\)/);
 assert.match(card,/<Link href=\{reader\+t\.href\}>/);
 assert.doesNotMatch(card,/href=\{t\.href\?reader\+t\.href:t\.sourceUrl\}/);
 assert.match(route,/data-bluebelly-news="single-receipt-reader"/);
 assert.match(route,/data-bluebelly-news="decision-recap-reader"/);
 assert.match(route,/const event=recentNews\.find\(n=>n\.id===newsId\)/);
 assert.match(route,/getRecentVerifiedEarningsScorecards\(now,7\)/);
 assert.doesNotMatch(route,/createSupabaseAdminClient|generateContent\(/);
});

test("short narrative contains conditional learning, visible SVG and original-source evidence",()=>{
 const art=file("components/blue-desk/EditorialStoryArt.tsx");
 const recap=file("components/blue-desk/ShortNewsRecap.tsx");
 const old=file("components/blue-desk/BluebellyNewsfront.tsx");
 assert.match(recap,/01 \/ THE SETUP/);
 assert.match(recap,/02 \/ THE NEW INFORMATION/);
 assert.match(recap,/03 \/ THE LEARNING MOMENT/);
 assert.match(recap,/04 \/ THE CATCH/);
 assert.match(recap,/EditorialStoryArt headline=\{recap\.title\}/);
 assert.match(recap,/validSource\(recap\.sourceUrl\)/);
 assert.match(recap,/market response is inferred before the verified release/);
 assert.match(recap,/pre-release vintage match/);
 assert.match(art,/<svg/);
 assert.match(old,/\?news=/);
 assert.doesNotMatch(old,/latestNews\.sourceUrl.*latestNews\.headline/);
});

test("older official receipts have a bounded seven-day display window and stay distinct from current 48h news",()=>{
 const server=file("lib/blue-desk-original-press-news-server.ts");
 const projector=file("lib/blue-desk-original-press-news.ts");
 const home=file("app/blue-desk/page.tsx");
 const report=file("app/blue-desk/daily-report/page.tsx");
 assert.match(server,/lookbackDays<1\|\|lookbackDays>7/);
 assert.match(projector,/lookbackDays\*86400000/);
 assert.match(home,/getOriginalPressNews\(now,18,7\)/);
 assert.match(report,/getOriginalPressNews\(now,18,7\)/);
 assert.match(home,/const verifiedNews = recentNews\.filter/);
 assert.match(report,/const news = recentNews\.filter/);
 assert.match(file("app/blue-desk/key-stories/page.tsx"),/EARLIER REPORT/);
 assert.ok(OFFICIAL_PRESS_FEEDS.length>=5);
 // Genuine source receipts still require the publisher, URL identity, clock,
 // proof reason and matching original HTML; no arbitrary headline admission.
 assert.match(projector,/item\.review_reason!==PROOF_REASON/);
 assert.match(projector,/feedFor\(url\)/);
 assert.match(projector,/evidence\.some\(link=>/);
});
