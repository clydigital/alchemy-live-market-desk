import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {OCTOBER_FED_DEPTH,SEPTEMBER_JOLTS_DEPTH,NOVEMBER_EIA_GAS_DEPTH,NOVEMBER_NVLINK_DEPTH,storyDepthForNews} from "../lib/bluebelly-key-story-depth.ts";
import {reviewedImpactForDepth,UNASSESSED_MARKET_FRAME} from "../lib/bluebelly-editorial-market-framework.ts";
import {JENSEN_GOVERNANCE_WATCH,isJensenGovernanceWatchWindow} from "../lib/bluebelly-jensen-governance-watch.ts";
import {MARKET_RESEARCH_GAPS} from "../lib/bluebelly-market-research-gaps.ts";
import {getManualSweeps} from "../lib/bluebelly-manual-sweeps.ts";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Four source-reviewed Key Story depths use explicit, original-source-tied market impact assessment",()=>{
 for(const depth of [OCTOBER_FED_DEPTH,SEPTEMBER_JOLTS_DEPTH,NOVEMBER_EIA_GAS_DEPTH,NOVEMBER_NVLINK_DEPTH]){
  const frame=reviewedImpactForDepth(depth);
  assert.ok(frame,depth.title);
  assert.equal(frame?.assetValence,"MIXED_BY_EXPOSURE");
  assert.match(frame!.uncertaintyWhy,/.{25,}/);
  assert.ok(depth.sources.some(s=>s.url===frame!.sourceUrl));
  assert.notEqual(frame!.beneficiaries,frame!.pressured);
  assert.match(frame!.supplyEffect,/.{25,}/);
  assert.match(frame!.demandEffect,/.{25,}/);
  assert.match(frame!.financingEffect,/.{25,}/);
 }
});

test("Missing tape evidence cannot be labelled a measured divergence",()=>{
 for(const depth of [NOVEMBER_EIA_GAS_DEPTH,NOVEMBER_NVLINK_DEPTH]){
  const x=reviewedImpactForDepth(depth)!;
  assert.equal(x.tapeStatus,"NOT_MEASURED");
  assert.equal(x.divergence,"UNTESTED");
 }
 const x=NOVEMBER_NVLINK_DEPTH.impact!;
 assert.equal(reviewedImpactForDepth({...NOVEMBER_NVLINK_DEPTH,impact:{...x,divergence:"DIVERGENT"}}),null);
 assert.equal(reviewedImpactForDepth({...NOVEMBER_NVLINK_DEPTH,impact:{...x,sourceUrl:"https://example.com"}}),null);
 assert.match(UNASSESSED_MARKET_FRAME.text,/not a trading signal/);
});

test("Public UI distinguishes reviewed conditional analyses from source-only and unreviewed thesis claims",()=>{
 const article=read("components/blue-desk/KeyStoryDeepArticle.tsx");
 const impact=read("components/blue-desk/MarketImpactFramework.tsx");
 const newswire=read("components/blue-desk/BluebellyNewsWire.tsx");
 const story=read("components/blue-desk/StoryEditorialArticle.tsx");
 const short=read("components/blue-desk/ShortNewsRecap.tsx");
 assert.match(article,/<MarketImpactFramework depth=\{depth\}\/>/);
 assert.match(impact,/data-bluebelly-interpretation=\{impact\?"source-reviewed-conditional":"not-adjudicated"\}/);
 assert.match(impact,/Expected reaction versus the tape/);
 assert.match(impact,/Supply, demand and financing transmission/);
 assert.match(newswire,/reviewedImpactForDepth/);
 assert.match(newswire,/Source-verified does not mean an accepted market cause/);
 assert.match(story,/data-story-market-framework="evidence-incomplete"/);
 assert.match(short,/data-market-consequence="source-only-unassessed"/);
 assert.match(short,/Supply and demand:/);
 assert.doesNotMatch(read("lib/bluebelly-editorial-market-framework.ts"),/\.includes\("hawkish"\)|sentimentScore|generateText\(/);
});

test("NVIDIA CEO watch distinguishes independent board statements from attributed board reporting",()=>{
 const v=JENSEN_GOVERNANCE_WATCH;
 assert.match(v.reviewedOn,/2026-11-13/);
 assert.match(v.status,/CEO TRANSITION CONFIRMED/);
 assert.equal(v.official.length,3);
 assert.ok(v.official.some(x=>x.url.includes("nvidianews.nvidia.com/news/nvidia-announces-ceo-transition")));
 assert.match(v.reported.text,/resignation is now confirmed/i);
 assert.match(v.market.uncertainty,/MIXED/);
 assert.match(v.market.supplyDemand,/does not by itself cancel GPU orders/);
 assert.match(v.market.price,/09:45 ET/);
 assert.ok(isJensenGovernanceWatchWindow(new Date("2026-11-12T12:00:00Z")));
 assert.ok(!isJensenGovernanceWatchWindow(new Date("2026-11-22T00:00:00Z")));
 const page=read("app/blue-desk/newsroom/page.tsx");
 const component=read("components/blue-desk/JensenGovernanceWatch.tsx");
 assert.match(page,/isJensenGovernanceWatchWindow\(now\)/);
 assert.match(component,/data-governance-watch="source-dated-not-live-board-status"/);
 assert.match(component,/reported personal allegations and any security compromise remain unproven/);
 assert.doesNotMatch(component,/createSupabaseAdminClient/);
});

test("All eleven researched market candidates remain in private queue with bounded provenance",()=>{
 assert.equal(MARKET_RESEARCH_GAPS.length,11);
 assert.equal(new Set(MARKET_RESEARCH_GAPS.map(x=>x.id)).size,11);
 assert.ok(MARKET_RESEARCH_GAPS.some(x=>x.id==="coreweave-q3"));
 assert.ok(MARKET_RESEARCH_GAPS.some(x=>x.id==="msci-nov26"));
 for(const row of MARKET_RESEARCH_GAPS){
  assert.ok(row.signal.length>30 && row.unresolved.length>30 && row.next.length>25);
  if(row.sourceStatus==="ORIGINAL_PENDING")assert.equal(row.sourceUrl,null);
  else assert.match(row.sourceUrl||"",/^https:\/\//);
 }
 const owner=read("app/owner/research/page.tsx"),publicPage=read("app/blue-desk/newsroom/page.tsx");
 assert.match(owner,/<MarketResearchGapQueue \/>/);
 assert.doesNotMatch(publicPage,/MarketResearchGapQueue|bluebelly-market-research-gaps/);
});

test("Three extra original reports enter dated manual sweeps without automatic publication",()=>{
 const now=new Date("2026-11-12T17:00:00Z");
 for(const [topic,idFragment] of [["ai","coreweave"],["energy","siemens"],["breadth","msci"]] as const){
  assert.ok(getManualSweeps(topic,now,3).some(s=>s.id.includes(idFragment) && s.findings.some(f=>f.status==="SOURCE_CORROBORATED")));
 }
 const publicPage=read("app/blue-desk/newsroom/page.tsx");
 assert.match(publicPage,/getManualSweeps\(topic,now,2\)/);
 assert.match(publicPage,/editor-committed-source-labelled/);
 assert.match(publicPage,/An attributed lead is still a lead/);
});

test("New sweep separates original November releases from attributed housing numbers",()=>{
 const now=new Date("2026-11-12T16:55:00Z");
 assert.ok(getManualSweeps("ai",now,3).some(s=>s.id.includes("nebius")&&s.findings.some(f=>f.status==="SOURCE_CORROBORATED")));
 assert.ok(getManualSweeps("fed",now,3).some(s=>s.id.includes("claims")&&s.findings.some(f=>f.status==="SOURCE_CORROBORATED")));
 assert.ok(getManualSweeps("housing",now,3).some(s=>s.findings.some(f=>f.status==="RESEARCH_LEAD")));
 const page=read("app/blue-desk/newsroom/page.tsx");
 assert.match(page,/\["hormuz","energy","ai","fed","bonds","breadth","housing"\]/);
 assert.match(page,/\.slice\(0,12\)/);
});
