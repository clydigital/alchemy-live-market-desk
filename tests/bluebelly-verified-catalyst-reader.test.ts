import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectLivingMarketTopics} from "../lib/blue-desk-living-topics.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";
import {blueDeskHostAccess,blueDeskPresentationTarget} from "../lib/blue-desk-host.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const news=(id:string,occurredAt:string):NewsBriefV1=>({
 contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",id,
 headline:"Brent oil tanker passage interrupted by Gulf disruption",
 summary:"An official market source describes a new shipping disruption that could alter physical crude availability.",
 occurredAt,observedAt:occurredAt,sourceName:"Original dated market source",
 sourceUrl:"https://example.org/report/"+id,sourceKind:"official",verification:"SOURCE_VERIFIED",
});
test("verified news themes preserve actual original source order rather than infer historical events",()=>{
 const topics=projectLivingMarketTopics([
  news("recent","2026-10-27T10:00:00Z"),
  news("older","2026-10-27T08:00:00Z"),
 ],8);
 assert.equal(topics.length,1);
 assert.equal(topics[0].id,"oil-gulf-energy");
 assert.deepEqual(topics[0].updates.map(x=>x.id),["recent","older"]);
 const reader=read("components/blue-desk/VerifiedCatalystArticle.tsx");
 assert.match(reader,/sort\(\(a,b\)=>Date\.parse\(a\.occurredAt\)-Date\.parse\(b\.occurredAt\)\)/);
 assert.match(reader,/event\.sourceUrl/);
 assert.match(reader,/event\.sourceName/);
 assert.match(reader,/event\.occurredAt/);
 assert.match(reader,/One source-verified event is available/);
 assert.match(reader,/not a complete historical timeline/);
 assert.match(reader,/matched/);
 assert.doesNotMatch(reader,/generateContent|story_thesis_versions|createSupabaseAdminClient|fetch\(/);
});
test("Key Stories drilldown reuses exact approved public path, with expired theme unavailable",()=>{
 const page=read("app/blue-desk/key-stories/page.tsx");
 assert.match(page,/params\?\.catalyst/);
 assert.match(page,/topics\.find\(topic=>topic\.id===catalystId\)/);
 assert.match(page,/data-catalyst-unavailable="true"/);
 assert.match(page,/VerifiedCatalystArticle topic=\{selected\}/);
 assert.match(page,/\?catalyst=/);
 assert.match(page,/encodeURIComponent\(topic\.id\)/);
 assert.match(page,/projectLivingMarketTopics\(news\)/);
 assert.match(page,/selectVerifiedNewsBriefs\(raw, now, 18\)/);
 assert.match(page,/combineQualifiedNews\(motionNews,originalPress,18\)/);
 assert.equal(blueDeskHostAccess("/key-stories","bluebelly-desk.vercel.app"),"public");
 assert.equal(blueDeskPresentationTarget("/key-stories","bluebelly-desk.vercel.app"),"/blue-desk/key-stories");
 assert.equal(blueDeskHostAccess("/catalyst/internal","bluebelly-desk.vercel.app"),"blocked");
});
test("five-act catalyst reader preserves true event/interpretation distinction",()=>{
 const reader=read("components/blue-desk/VerifiedCatalystArticle.tsx");
 const css=read("components/blue-desk/VerifiedCatalystArticle.module.css");
 for(const act of ["THE REAL EVENTS","THE LEARNING MOMENT","FOLLOW THE MONEY","THE COMPLICATION","THE NEXT DECIDING QUESTION"])
  assert.ok(reader.includes(act));
 assert.match(reader,/topic\.humanStake/);
 assert.match(reader,/topic\.marketMechanism/);
 assert.match(reader,/topic\.guidingQuestion/);
 assert.match(reader,/not a complete historical timeline/);
 assert.match(reader,/plausible mechanism is not a measured reaction/i);
 assert.match(css,/@media\(max-width:640px\)/);
});
