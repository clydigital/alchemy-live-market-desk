import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {rankXWireMarketCandidates} from "../lib/x-wire-market-candidates.ts";
import {attachXWireResearchLeads} from "../lib/x-wire-scheduled-research-leads.ts";
import type {ResearchRunInput} from "../lib/research-update.ts";

const now=new Date("2026-11-08T00:00:00Z");
const post=(id:string,status:string,publishedAt:string)=>({
 id,handle:"FirstSquawk",url:"https://x.com/FirstSquawk/status/"+id,
 publishedAt,text:"Treasury bond yields and the Federal Reserve policy decision may affect equity valuations today.",
 images:[],quoteUrl:null,attribution:"THIRD_PARTY_ONLY",intakeStatus:status,
});
const pending=post("2119000000000000001","deferred","2026-11-04T09:00:00Z");
const recent=post("2119000000000000002","discovery","2026-11-07T21:00:00Z");

test("normal selection never admits deferred or stale posts",()=>{
 assert.equal(rankXWireMarketCandidates([pending,recent] as never,now).length,1);
 assert.equal(rankXWireMarketCandidates([pending] as never,now).length,0);
});
test("seven-day deferred lane is opt-in, capped, never market verification",()=>{
 const old=post("2119000000000000003","deferred","2026-10-28T01:00:00Z");
 const selected=rankXWireMarketCandidates([pending,old] as never,now,3,
  {allowDeferred:true,maxAgeHours:168});
 assert.equal(selected.length,1);
 assert.equal(selected[0].post.id,pending.id);
 const run:ResearchRunInput={runKey:"backlog",scheduleSlot:"morning",
  scheduledFor:now.toISOString(),items:[],sourceChecks:[],summary:""};
 const wire={posts:[pending] as never,accounts:[] as never,storageHealthy:true};
 const out=attachXWireResearchLeads(run,wire,now,3,{allowDeferred:true,maxAgeHours:168});
 assert.equal(out.items.length,1);
 assert.equal(out.items[0].recommendedAction,"collect_evidence");
 assert.deepEqual(out.items[0].evidence,[]);
 assert.match(out.items[0].summary||"",/UNVERIFIED X CLAIM/);
 assert.match(out.summary||"",/DEFERRED_BACKLOG/);
});
test("existing schedule reserves 9 fresh plus 3 deferred; persisted X URLs are excluded",()=>{
 const sched=readFileSync(new URL("../lib/firecrawl-scheduled-research.ts",import.meta.url),"utf8");
 const reader=readFileSync(new URL("../lib/x-wire-deferred-research.ts",import.meta.url),"utf8");
 assert.match(sched,/attachXWireResearchLeads\(originalFilings,wire,now,9\)/);
 assert.match(sched,/now,3,\{allowDeferred:true,maxAgeHours:168\}/);
 assert.match(reader,/\.eq\("intake_status","deferred"\)/);
 assert.match(reader,/\.ilike\("publisher","X\/@%"\)/);
 assert.match(reader,/!prior\.has\(p\.original_url\)/);
 assert.doesNotMatch(reader,/\.update\(|\.upsert\(|\.rpc\(|story_thesis_versions/);
});
