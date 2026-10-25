import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessDailyResearchHealth} from "../lib/daily-report-research-health.ts";
import type {NotionResearchBundle} from "../lib/notion-market-research.ts";
import type {DailyResearchPacket} from "../lib/daily-report-research-packet.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";

const now=new Date("2026-10-26T01:00:00.000Z");
const source=(kind:"MACROPULSE"|"RESEARCH_GAP",title:string)=>({
 kind,title,pageId:"11111111-1111-4111-8111-111111111111",
 url:"https://www.notion.so/11111111111141118111111111111111",
 text:"Original-source research requires review",originalLinks:[],
 retrievedAt:now.toISOString(),
});
const valid:NotionResearchBundle={
 status:"READY_FOR_REVIEW",sources:[source("RESEARCH_GAP","PM Research Gap"),
 source("MACROPULSE","22:00 MYT"),source("MACROPULSE","20:00 MYT")],
 warnings:[],fetchedAt:now.toISOString(),
};
const packet:DailyResearchPacket={
 contractVersion:"daily-report-research/1",assembledAt:now.toISOString(),
 notionStatus:"READY_FOR_REVIEW",warnings:[],newsCount:1,
 sourceUrls:[],packet:"Private source packet",
 researchSourceCandidates:[
  {url:"https://www.federalreserve.gov/newsevents/pressreleases/monetary20261025a.htm",
   sourcePageUrl:"https://www.notion.so/123",kind:"MACROPULSE",
   verification:"EXACT_NEWS_SOURCE_MATCH",matchingNewsHeadline:"Fed releases policy decision"},
  {url:"https://x.com/someauthor/status/123",sourcePageUrl:"https://www.notion.so/123",
   kind:"MACROPULSE",verification:"UNVERIFIED_LINK",matchingNewsHeadline:null},
 ],
};
const news:NewsBriefV1={
 contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",
 id:"22222222-2222-4222-8222-222222222222",
 headline:"Fed releases policy decision",sourceName:"Federal Reserve Board",
 sourceKind:"official",sourceUrl:"https://www.federalreserve.gov/newsevents/pressreleases/monetary20261025a.htm",
 summary:"The original publisher issued a dated announcement; price reaction unknown.",
 occurredAt:"2026-10-25T21:00:00.000Z",observedAt:"2026-10-25T21:10:00.000Z",
 verification:"SOURCE_VERIFIED",
};

test("complete Notion intake is ready for analyst review, never publication",()=>{
 const health=assessDailyResearchHealth({now,notion:valid,packet,news:[news]});
 assert.equal(health.status,"READY_FOR_ANALYST_REVIEW");
 assert.equal(health.checks.fullPulseIncluded,true);
 assert.equal(health.checks.gateIncluded,true);
 assert.equal(health.news.within48h,1);
 assert.equal(health.sources.exactOriginalMatches,1);
 assert.equal(health.sources.unverifiedCandidateLinks,1);
 assert.match(health.nextActions.at(-1)||"",/unapproved analyst copy/);
 assert.ok(!JSON.stringify(health).includes("READY_FOR_PUBLICATION"));
});

test("missing Notion server token is explicitly blocked; verified external sources are preserved",()=>{
 const notion={...valid,status:"NOT_CONFIGURED" as const,sources:[],warnings:[
  "Notion server-side read-only token is not configured.",
 ]};
 const result=assessDailyResearchHealth({now,notion,packet,news:[news]});
 assert.equal(result.status,"NOTION_NOT_CONFIGURED");
 assert.equal(result.news.qualifiedCount,1);
 assert.equal(result.checks.notionAvailable,false);
 assert.match(result.nextActions[0],/NOTION_API_TOKEN/);
 assert.equal(result.sources.macroPulsePosts,0);
});

test("partial Gate, stale news, absent original-source matches report investigation gaps",()=>{
 const notion={...valid,status:"PARTIAL" as const,
  sources:[source("MACROPULSE","22:00 MYT")],
  warnings:["Research Gap incomplete; 27 unread"],
 };
 const stale={...news,occurredAt:"2026-10-19T21:00:00.000Z"};
 const draft={...packet,researchSourceCandidates:packet.researchSourceCandidates.map(c=>({
  ...c,verification:"UNVERIFIED_LINK" as const,matchingNewsHeadline:null,
 }))};
 const h=assessDailyResearchHealth({now,notion,packet:draft,news:[stale]});
 assert.equal(h.status,"COVERAGE_PARTIAL");
 assert.equal(h.checks.gateIncluded,false);
 assert.equal(h.news.within48h,0);
 assert.ok(h.nextActions.some(a=>a.includes("No recent independently")));
 assert.ok(h.nextActions.some(a=>a.includes("no exact independently verified")));
});

test("owner health travels only through private, allowlisted, no-store route",()=>{
 const route=readFileSync(new URL("../app/api/owner/daily-research/route.ts",import.meta.url),"utf8");
 const writer=readFileSync(new URL("../components/blue-desk/DailyReportWriter.tsx",import.meta.url),"utf8");
 assert.match(route,/blueDeskHostAccess\("\/api\/owner\/daily-research",host\)!=="private"/);
 assert.match(route,/session\.auth\.getUser\(\)/);
 assert.match(route,/app_access_allowlist/);
 assert.match(route,/assessDailyResearchHealth\(\{now,notion,packet,news\}\)/);
 assert.match(route,/sourcePages:notion\.sources/);
 assert.match(route,/private, no-store/);
 assert.doesNotMatch(route,/createSupabaseAdminClient|\.insert\(|\.update\(|\.upsert\(/);
 assert.match(writer,/data-research-health/);
 assert.match(writer,/Copy source-health diagnostic/);
 assert.match(writer,/Replace your edited research packet/);
});
