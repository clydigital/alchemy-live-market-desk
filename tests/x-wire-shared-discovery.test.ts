import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {X_CORE_ROSTER} from "../lib/x-sweep-core.ts";
import {rankXWireMarketCandidates} from "../lib/x-wire-market-candidates.ts";
import {attachXWireResearchLeads} from "../lib/x-wire-scheduled-research-leads.ts";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";
import type {ResearchRunInput} from "../lib/research-update.ts";

const now=new Date("2026-10-28T00:00:00Z");
const source=(handle:string,id:number,text:string,time="2026-10-27T23:05:00Z",
 status="discovery")=>({
 id:String(2115210000000000000n+BigInt(id)),
 handle,url:"https://x.com/"+handle+"/status/"+String(2115210000000000000n+BigInt(id)),
 publishedAt:time,text,images:[],quoteUrl:null,attribution:"THIRD_PARTY_ONLY",intakeStatus:status
});
const run:ResearchRunInput={runKey:"xwire-market",scheduleSlot:"morning",
 scheduledFor:now.toISOString(),items:[],sourceChecks:[],summary:"other sources"};
test("KobeissiLetter stays unique and HormuzReport is enrolled as tenth source",()=>{
 assert.equal(X_CORE_ROSTER.length,10);
 assert.equal(X_CORE_ROSTER.filter(x=>x.handle==="KobeissiLetter").length,1);
 assert.equal(X_CORE_ROSTER.filter(x=>x.handle==="HormuzReport").length,1);
 assert.ok(!X_CORE_ROSTER.some(x=>x.handle.toLowerCase()==="zerohedge"));
});
test("market-catalyst ranking covers Hormuz and yields, with social claims never promoted",()=>{
 const posts=[
  source("HormuzReport",1,"BREAKING: Hormuz tanker shipping rates surge after a reported oil terminal incident."),
  source("KobeissiLetter",2,"US Treasury 10-year yield climbs while the Fed FOMC weighs interest rate cuts."),
  source("HFI_Research",3,"Brent crude and diesel refinery margins tighten across the Gulf region."),
  source("FirstSquawk",4,"Semiconductor earnings and AI capex outlook revise higher this quarter."),
  source("Bluekurtic",5,"Ordinary non-market remarks without any data or catalyst today."),
  source("zerohedge",6,"Brent oil tanker market report."),
  source("HormuzReport",7,"Strait of Hormuz tanker shipping report.","2026-10-22T20:00:00Z"),
  source("HormuzReport",8,"Hormuz tanker shipping details.","2026-10-27T23:05:00Z","deferred"),
 ];
 const ranked=rankXWireMarketCandidates(posts as never,now);
 assert.ok(ranked.some(x=>x.post.handle==="HormuzReport"&&x.theme==="energy_shipping"));
 assert.ok(ranked.some(x=>x.post.handle==="KobeissiLetter"&&x.theme==="macro_rates_fx"));
 assert.ok(ranked.some(x=>x.theme==="equities_ai"));
 assert.ok(!ranked.some(x=>x.post.handle==="zerohedge"));
 assert.ok(!ranked.some(x=>x.post.id===posts[7].id));
 const out=attachXWireResearchLeads(run,{
  posts:posts as never,storageHealthy:true,
  accounts:X_CORE_ROSTER.map(x=>({handle:x.handle,status:"healthy"})) as never
 },now);
 assert.ok(out.items.length>=4);
 assert.ok(out.items.every(x=>x.sourceQuality===35 &&
   x.recommendedAction==="collect_evidence" && x.evidence?.length===0));
 assert.ok(out.items.every(x=>x.itemKey.startsWith("x-wire-lead:")));
 assert.ok(out.items.some(x=>x.publisher==="X/@HormuzReport"));
});
test("dedupe and bounded account and category diversification remain enforceable",()=>{
 const posts=Array.from({length:30},(_,i)=>source("KobeissiLetter",i+10,
 "Treasury yields and Fed rate decision could affect markets."));
 const ranked=rankXWireMarketCandidates([...posts,posts[0]] as never,now,100);
 assert.ok(ranked.length<=3);
 assert.equal(new Set(ranked.map(x=>x.post.id)).size,ranked.length);
});
test("public reader is narrowly whitelisted; raw owner Wire stays private",()=>{
 assert.equal(blueDeskHostAccess("/api/x-wire/discovery","bluebelly-desk.vercel.app"),"public");
 assert.equal(blueDeskHostAccess("/api/x-wire/discovery/","bluebelly-desk.vercel.app"),"blocked");
 assert.equal(blueDeskHostAccess("/api/x-wire/discovery","alchemy-blue-desk.vercel.app"),"blocked");
 assert.equal(blueDeskHostAccess("/owner/x-wire","bluebelly-desk.vercel.app"),"private");
 const route=readFileSync(new URL("../app/api/x-wire/discovery/route.ts",import.meta.url),"utf8");
 assert.match(route,/sourceQuality|discoveryOnly:true|verifiedMarketClaims:0/);
 assert.match(route,/\.select\("post_id,handle,original_url,published_at,retrieved_at,body,intake_status"\)/);
 assert.match(route,/\.limit\(250\)/);
 assert.match(route,/\.slice\(0,240\)/);
 assert.match(route,/blueDeskHostAccess\(request\.nextUrl\.pathname,host\)/);
 assert.doesNotMatch(route,/getXWireDurable\(|\.rpc\(|\.upsert\(|\.insert\(|\.update\(|story_thesis_versions/);
});
