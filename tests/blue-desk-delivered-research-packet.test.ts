import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {buildDailyResearchPacket} from "../lib/daily-report-research-packet.ts";
import type {DeliveredMacroPulseBrief} from "../lib/blue-desk-delivered-research.ts";

const now="2026-10-25T22:28:00.000Z";
const delivered:DeliveredMacroPulseBrief={
 id:"f5a0cb2f-9beb-484f-8cf9-de8f33c89fe7",
 source_page_id:"404519b6-7a94-8118-b347-d363f9b215a9",
 source_pulse_id:"2026-10-26-0200-centcom-hormuz-cumulative-milestone-x-vintage-audit",
 source_page_url:"https://www.notion.so/404519b67a948118b347d363f9b215a9",
 source_published_at:"2026-10-25T18:00:00.000Z",
 source_retrieved_at:"2026-10-25T18:02:21.307Z",
 headline:"CENTCOM's Hormuz milestone does not settle oil risk",
 standfirst:"An attributed US military source reports cumulative transit totals; no independent daily physical flow is established.",
 what_changed:"CENTCOM's attributed original announcement is not an independently counted daily cargo or event-matched price observation.",
 why_it_matters:"Potentially safer cargo movement could reduce insurance and oil-market risk premiums, but only if independent physical observations agree.",
 countercase:"As a participant, CENTCOM may report supported transits using a different time window and incomplete vessel classification.",
 watch_next:"Match dated UKMTO and destination cargo data before inferring market normalisation.",
 source_links:[{url:"https://www.dvidshub.net/news/577799/centcom-commander-visits-strait-hormuz-during-milestone-week",label:"DVIDS primary official statement",kind:"PRIMARY_RELEASE"}],
 status:"review",verification_label:"RESEARCH_DERIVED_UNADJUDICATED",
};
const notion={
 status:"NOT_CONFIGURED" as const,sources:[],
 warnings:["Notion server-side token absent"],fetchedAt:now,
};
test("owner draft delivery enriches the packet but never upgrades Notion or News verification",()=>{
 const p=buildDailyResearchPacket({now,notion,news:[],calendar:[],prices:[],editorialBriefs:[delivered]});
 assert.equal(p.notionStatus,"NOT_CONFIGURED");
 assert.equal(p.newsCount,0);
 assert.equal(p.deliveredBriefCount,1);
 assert.match(p.packet,/NOTION COVERAGE: NOT_CONFIGURED/);
 assert.match(p.packet,/PRIVATELY DELIVERED MACROPULSE EDITORIAL BRIEFS/);
 assert.match(p.packet,/UNAPPROVED REVIEW DRAFT/);
 assert.match(p.packet,/RESEARCH_DERIVED_UNADJUDICATED/);
 assert.match(p.packet,/NOT independently verified News/);
 assert.match(p.packet,/No current Notion material accessible/);
 assert.match(p.packet,/No source-verified recent news found/);
 assert.match(p.packet,/WHY IT MOVED/);
 assert.match(p.packet,/WHY IT MATTERS/);
 assert.match(p.packet,/3-5 distinct source-supported news picks/);
 assert.ok(p.sourceUrls.includes(delivered.source_page_url));
 assert.ok(p.sourceUrls.includes(delivered.source_links[0].url));
 assert.equal(p.researchSourceCandidates.length,1);
 assert.equal(p.researchSourceCandidates[0].verification,"UNVERIFIED_LINK");
 assert.equal(p.researchSourceCandidates[0].kind,"MACROPULSE");
});
test("empty delivery leaves the source health gap intact",()=>{
 const p=buildDailyResearchPacket({now,notion,news:[],calendar:[],prices:[]});
 assert.equal(p.deliveredBriefCount,0);
 assert.doesNotMatch(p.packet,/PRIVATELY DELIVERED MACROPULSE EDITORIAL BRIEFS/);
 assert.equal(p.notionStatus,"NOT_CONFIGURED");
});
test("private delivered drafts are only loaded behind existing authorised account identity",()=>{
 const api=readFileSync(new URL("../app/api/owner/daily-research/route.ts",import.meta.url),"utf8");
 const service=readFileSync(new URL("../lib/blue-desk-delivered-research-server.ts",import.meta.url),"utf8");
 const publicReader=readFileSync(new URL("../lib/blue-desk-macropulse-brief-server.ts",import.meta.url),"utf8");
 assert.match(api,/blueDeskHostAccess/);
 assert.match(api,/session\.auth\.getUser\(\)/);
 assert.match(api,/app_access_allowlist/);
 assert.ok(api.indexOf("session.auth.getUser()")<api.indexOf("getOwnerDeliveredResearchBriefs(6)"));
 assert.match(api,/status:"PRIVATE_RESEARCH_INPUT_NOT_INDEPENDENTLY_VERIFIED"/);
 assert.match(service,/createSupabaseAdminClient/);
 assert.match(service,/\.in\("status",\["review","published"\]\)/);
 assert.match(service,/source_published_at/);
 assert.doesNotMatch(publicReader,/getOwnerDeliveredResearchBriefs/);
});
