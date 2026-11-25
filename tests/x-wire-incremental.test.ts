import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseXWireDeltaWindow,xWireDeltaPage} from "../lib/x-wire-incremental.ts";
import {xWireFreshCheckComplete,xWireAcquisitionPriority,xWireLiveFreshnessHours,xWireNeedsRetry,X_WIRE_HISTORICAL_GAP_ERROR} from "../lib/x-wire-pagination.ts";
import {rankXWireMarketCandidates} from "../lib/x-wire-market-candidates.ts";

const now=new Date("2026-11-26T00:00:00Z");
test("delta is bounded, stable across continuation, and rejects malformed windows",()=>{
 const since="2026-11-25T22:00:00Z",until=now.toISOString();
 assert.deepEqual(parseXWireDeltaWindow(new URLSearchParams({since,until}),now),{since:new Date(since).toISOString(),until,afterId:null});
 const rows=Array.from({length:41},(_,i)=>({post_id:String(BigInt("2125600000000000000")+BigInt(i))}));
 const result=xWireDeltaPage(rows);
 assert.equal(result.page.length,40);assert.equal(result.more,true);assert.equal(result.nextAfterId,rows[39].post_id);
 assert.equal(xWireDeltaPage(rows.slice(40)).nextAfterId,null);
 assert.equal(parseXWireDeltaWindow(new URLSearchParams({since,until,afterId:result.nextAfterId!}),now)?.afterId,rows[39].post_id);
 for(const p of [{since:"bad"},{since:"2026-11-20T00:00:00Z"},{since,until:"2026-11-27T00:00:00Z"},{since,afterId:"2125600000000000000"},{since,until,afterId:"bad"},{}])assert.equal(parseXWireDeltaWindow(new URLSearchParams(p as Record<string,string>),now),null);
});
test("Kobeissi is first in acquisition, stale accounts retain oldest-first ordering, historical gaps do not negate live completion",()=>{
 assert.deepEqual(xWireAcquisitionPriority("KobeissiLetter",null),[0,0]);
 assert.deepEqual(xWireAcquisitionPriority("SaraEisen",null),[1,0]);
 assert.ok(xWireAcquisitionPriority("OddStats","2026-11-25T23:00:00Z")[1]>0);
 const row={health:"partial",last_error:X_WIRE_HISTORICAL_GAP_ERROR,page_cursor:null,last_completed_at:"2026-11-25T23:00:00Z"};
 assert.equal(xWireFreshCheckComplete(row,now,xWireLiveFreshnessHours("KobeissiLetter")),true);
 assert.equal(xWireNeedsRetry({...row,last_completed_at:"2026-11-25T21:00:00Z"},now,2),true);
 assert.equal(xWireNeedsRetry({...row,page_cursor:"pending"},now,2),true);
});
test("Kobeissi ranking priority is opt-in and only for a material eligible post",()=>{
 const row=(handle:string,i:number,text:string)=>({handle,id:String(BigInt("2125600000000000000")+BigInt(i)),url:"https://x.com/"+handle+"/status/"+String(BigInt("2125600000000000000")+BigInt(i)),text,publishedAt:"2026-11-25T23:00:00Z",images:[],quoteUrl:null,attribution:"THIRD_PARTY_ONLY" as const,intakeStatus:"discovery"});
 const data=[row("Bluekurtic",1,"SPY moving average and historical breadth signal in 16 prior trading days"),row("KobeissiLetter",2,"Treasury yields and the Fed FOMC interest rate decision")];
 assert.equal(rankXWireMarketCandidates(data,now,12,{prioritizeKobeissi:true})[0].post.handle,"KobeissiLetter");
 assert.notEqual(rankXWireMarketCandidates(data,now,12,{prioritizeKobeissi:true}).length,0);
});
test("source code keeps bounded read-only redaction, registration and quota safeguards",()=>{
 const route=readFileSync(new URL("../app/api/x-wire/discovery/route.ts",import.meta.url),"utf8");
 assert.match(route,/REDACTED_DISCOVERY_ONLY/);assert.match(route,/\.limit\(41\)/);assert.match(route,/\.eq\("intake_status","discovery"\)/);
 assert.match(route,/\.slice\(0,240\)/);assert.doesNotMatch(route,/\.upsert\(|\.insert\(|\.update\(|\.rpc\(/);
 const collector=readFileSync(new URL("../lib/x-wire-durable.ts",import.meta.url),"utf8");
 assert.ok(collector.indexOf("Post deduplication lookup failed")<collector.indexOf("quota.total++"));
 assert.match(collector,/GLOBAL_NETWORK_BUDGET_MS/);assert.match(collector,/response.status===429/);
 assert.match(collector,/ignoreDuplicates:true/);assert.match(collector,/orderedRoster/);
});
