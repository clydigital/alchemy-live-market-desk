import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {NOVEMBER_EIA_GAS_DEPTH,NOVEMBER_NVLINK_DEPTH,storyDepthForNews} from "../lib/bluebelly-key-story-depth.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";

const source=readFileSync(new URL("../components/blue-desk/BluebellyNewsWire.tsx",import.meta.url),"utf8");
const base:NewsBriefV1={
 contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",id:"1acd67c7-e804-48bf-9ee7-97a2f96be283",
 headline:"EIA raises November natural gas storage forecast after warm start to month",
 summary:"The full November 2026 Short-Term Energy Outlook is available on the EIA website.",
 sourceName:"U.S. Energy Information Administration",sourceKind:"official",verification:"SOURCE_VERIFIED",
 sourceUrl:"https://www.eia.gov/pressroom/releases/press594.php",
 occurredAt:"2026-11-10T17:00:00Z",observedAt:"2026-11-11T01:46:00Z",
};
test("Newsroom displays exact-event reviewed hooks instead of source-only text",()=>{
 assert.match(source,/import \{storyDepthForNews\} from/);
 assert.match(source,/SOURCE VERIFIED · REVIEWED KEY STORY/);
 assert.match(source,/storyDepthForNews\(card\.item\)\?\.hook\|\|card\.item\.summary/);
 assert.match(source,/data-market-consequence="reviewed-original-event"/);
 assert.match(source,/storyDepthForNews\(card\.item\)\?<ReviewedNewsConsequence news=\{card\.item\}\/>:<SourceOnlyConsequence news=\{card\.item\}\/>/);
 assert.equal(storyDepthForNews(base)?.title,NOVEMBER_EIA_GAS_DEPTH.title);
 assert.equal(storyDepthForNews({...base,id:"fdddf542-68f9-4576-9fde-812af424c724",
    sourceUrl:"https://nvidianews.nvidia.com/news/nvidia-rebellions-and-sk-telecom-announce-collaboration-to-advance-sovereign-ai-infrastructure-with-nvidia-nvlink-fusion",
    occurredAt:"2026-11-09T05:00:00Z"})?.title,NOVEMBER_NVLINK_DEPTH.title);
});
test("Unreviewed source notices keep their original provenance and checklist",()=>{
 assert.equal(storyDepthForNews({...base,id:"different"}),null);
 assert.match(source,/SourceOnlyConsequence/);
 assert.match(source,/Source-verified does not mean an accepted market cause or a canonical Story update/);
});
