import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseFxTimeline, xWireRequestWindow, xWireRecoveryAnchor } from "../lib/x-wire-pagination.ts";
import { blueDeskHostAccess } from "../lib/blue-desk-host.ts";

const now="2026-10-23T06:00:00.000Z";
function sample(patch:Record<string,unknown>={}) {
  return { type:"status", id:"2113177723749420001", author:{screen_name:"HFI_Research"},
    text:"Attributed oil-market commentary",created_at:"2026-10-23T05:20:00Z",
    media:{photos:[{url:"https://pbs.twimg.com/media/abc.jpg"}]},...patch };
}
test("does not advance a full-coverage checkpoint while a page cursor remains",()=>{
  const s=xWireRequestWindow(now,"2026-10-22T06:00:00Z","opaque+next","2026-10-22T04:30:00Z");
  assert.equal(s.resumed,true);
  assert.equal(s.cursor,"opaque+next");
  assert.equal(s.startAt,"2026-10-22T04:30:00.000Z");
  const gap=xWireRequestWindow(now,"2026-10-18T06:00:00Z",null,null);
  assert.equal(gap.gap,true);
  assert.equal(gap.startAt,"2026-10-20T06:00:00.000Z");
});
test("normal 150-minute first window and 30-minute overlap recover an incomplete 24h gap",()=>{
  const first=xWireRequestWindow(now,null,null,null);
  assert.equal(first.startAt,"2026-10-23T03:30:00.000Z");
  const missed=xWireRequestWindow(now,"2026-10-22T06:00:00Z",null,null);
  assert.equal(missed.startAt,"2026-10-22T05:30:00.000Z");
});
test("page retains attributed post, exact original URL and media provenance",()=>{
  const p=parseFxTimeline({code:200,results:[sample()],cursor:{bottom:"endopaque"}},
    "HFI_Research","2026-10-23T03:30:00Z",now);
  assert.equal(p.posts.length,1);
  assert.equal(p.posts[0].url,"https://x.com/HFI_Research/status/2113177723749420001");
  assert.equal(p.posts[0].images.length,1);
  assert.equal(p.posts[0].attribution,"THIRD_PARTY_ONLY");
  assert.equal(p.nextCursor,"endopaque");
});
test("rejects spoofed author, undated post, malformed envelope and future claims",()=>{
  const p=parseFxTimeline({code:200,results:[
    sample({author:{screen_name:"other"}}),
    sample({created_at:"bad",created_timestamp:null}),
    sample({created_at:"2030-01-01T00:00:00Z"}),
    sample({id:"2113177723749420002"}),
  ],cursor:{bottom:null}},"HFI_Research","2026-10-23T03:30:00Z",now);
  assert.equal(p.posts.length,1);assert.equal(p.malformed,3);
  assert.throws(()=>parseFxTimeline({code:500,results:[]},"HFI_Research",now,now));
});
test("raw queue is protected on Bluebelly and owner hosts and never touches canonical research paths",()=>{
  assert.equal(blueDeskHostAccess("/owner/x-wire","bluebelly-desk.vercel.app"),"private");
  assert.equal(blueDeskHostAccess("/owner/x-wire/","bluebelly-desk.vercel.app"),"blocked");
  assert.equal(blueDeskHostAccess("/owner/x-wire","alchemy-blue-desk.vercel.app"),"blocked");
  assert.equal(blueDeskHostAccess("/owner/x-wire","alchemy-live-market-desk.vercel.app"),"private");
  const sql=readFileSync(new URL("../supabase/migrations/20261023230000_x_wire_durable_intake.sql",import.meta.url),"utf8");
  assert.match(sql,/enable row level security/g);
  assert.match(sql,/revoke all on table public\.x_wire_accounts,public\.x_wire_posts from public,anon,authenticated/);
  assert.match(sql,/on conflict \(handle\) do nothing/);
  assert.match(sql,/claim_x_wire_account/);
  const source=readFileSync(new URL("../lib/x-wire-durable.ts",import.meta.url),"utf8");
  assert.match(source,/lease_token/);
  assert.match(source,/ignoreDuplicates:true/);
  assert.match(source,/page_cursor:cursor/);
  assert.doesNotMatch(source,/story_thesis_versions|collect_evidence|Notion/);
});

test("excluded account is rejected even when provider rows are passed directly",()=>{
  assert.throws(()=>parseFxTimeline({code:200,results:[sample({author:{screen_name:"zerohedge"}})]},
    "zerohedge","2026-10-23T03:30:00Z",now),/explicitly excluded/);
  const quote=sample({quote:{id:"2113177723749420101",author:{screen_name:"zerohedge"}}});
  const clean=parseFxTimeline({code:200,results:[quote]},"HFI_Research","2026-10-23T03:30:00Z",now);
  assert.equal(clean.posts.length,1);
  assert.equal(clean.posts[0].quoteUrl,null);
  const db=readFileSync(new URL("../lib/x-wire-durable.ts",import.meta.url),"utf8");
  const migration=readFileSync(new URL("../supabase/migrations/20261026124200_x_wire_zerohedge_exclusion.sql",import.meta.url),"utf8");
  assert.match(db,/if\(isExcludedXWireHandle\(handle\)\)return/);
  assert.match(db,/\.not\("handle","ilike","zerohedge"\)/);
  assert.match(migration,/lower\(handle\) = 'zerohedge'/);
  assert.match(migration,/lower\(a\.handle\) <> 'zerohedge'/);
  assert.match(migration,/intake_status = 'rejected'/);
});



test("recoverable incomplete history anchors retry, expired history does not monopolise new scans",()=>{
 assert.equal(xWireRecoveryAnchor(now,null,"2026-10-23T01:00:00Z"),"2026-10-23T01:00:00.000Z");
 assert.equal(xWireRecoveryAnchor(now,"2026-10-23T04:00:00Z","2026-10-23T02:00:00Z"),"2026-10-23T02:00:00.000Z");
 assert.equal(xWireRecoveryAnchor(now,"2026-10-23T04:00:00Z","2026-10-19T00:00:00Z"),"2026-10-23T04:00:00Z");
 assert.equal(xWireRecoveryAnchor(now,null,"not-a-timestamp"),null);
});
test("strict lookback exhaustion succeeds before an unnecessary provider cursor call",()=>{
 const page=parseFxTimeline({code:200,results:[
  sample({id:"2113177723749420002"}),
  sample({id:"2113177723749420003",created_at:"2026-10-23T03:20:00Z"})
 ],cursor:{bottom:"may-404"}},
 "HFI_Research","2026-10-23T03:30:00Z",now);
 assert.equal(page.reachedWindowStart,true);
 assert.equal(page.posts.length,1);
 assert.equal(page.nextCursor,"may-404");
});


test("reposts are excluded without poisoning chronological proof from valid original statuses",()=>{
 const originalRecent=sample({id:"2113177723749420101",created_at:"2026-10-23T05:20:00Z"});
 const reshareOfOldPost=sample({id:"2113177723749420102",created_at:"2026-10-12T08:00:00Z",
  reposted_by:{screen_name:"HFI_Research"}});
 const originalOld=sample({id:"2113177723749420103",created_at:"2026-10-23T03:20:00Z"});
 const page=(items:unknown[])=>parseFxTimeline({code:200,results:items,
  cursor:{bottom:"provider-next"}},"HFI_Research","2026-10-23T03:30:00Z",now);
 const covered=page([originalRecent,reshareOfOldPost,originalOld]);
 assert.equal(covered.reachedWindowStart,true);
 assert.deepEqual(covered.posts.map(x=>x.id),["2113177723749420101"]);
 assert.equal(page([originalRecent,reshareOfOldPost]).reachedWindowStart,false);
});

test("small upstream timestamp inversions are tolerated, large pinned jumps are not",()=>{
 const recent=sample({id:"2113177723749420002",created_at:"2026-10-23T05:20:00Z"});
 const old=sample({id:"2113177723749420003",created_at:"2026-10-23T03:20:00Z"});
 const swapped=sample({id:"2113177723749420004",created_at:"2026-10-23T03:20:30Z"});
 const fakePinned=sample({id:"2113177723749420005",created_at:"2026-10-23T04:40:00Z"});
 const page=(rows:unknown[])=>parseFxTimeline({code:200,results:rows,cursor:{bottom:"more"}},
  "HFI_Research","2026-10-23T03:30:00Z",now);
 assert.equal(page([recent,old,swapped]).reachedWindowStart,true);
 assert.equal(page([recent,old,fakePinned]).reachedWindowStart,false);
 assert.equal(page([recent,old,swapped]).posts.length,1);
});
test("spoofed, pinned and reposted old items never prove lookback coverage",()=>{
 const younger=sample({id:"2113177723749420002"});
 const older=sample({id:"2113177723749420003",created_at:"2026-10-23T03:20:00Z"});
 const sorted=[younger,older];
 for(const rows of [
  [older,younger],
  [younger,{...older,author:{screen_name:"spoof"}}],
  [younger,{...older,reposted_by:{screen_name:"HFI_Research"}}],
  [younger,{...older,id:"not-a-post"}],
  [younger,{...older,text:""}],
 ]) {
  const page=parseFxTimeline({code:200,results:rows,cursor:{bottom:"more"}},
   "HFI_Research","2026-10-23T03:30:00Z",now);
  assert.equal(page.reachedWindowStart,false);
 }
 assert.equal(sorted.length,2);
});


test("high-volume accounts have deeper paging under a per-source runtime ceiling",()=>{
 const source=readFileSync(new URL("../lib/x-wire-durable.ts",import.meta.url),"utf8");
 assert.match(source,/const PAGE_LIMIT = 6/);
 assert.match(source,/const MAX_SCAN_MS = 18_000/);
 assert.match(source,/if\(page>0 && Date\.now\(\)-startedAt>=MAX_SCAN_MS\)break/);
 assert.match(source,/page_cursor:cursor,window_start_at:window\.startAt/);
});

test("persisted green source cannot stay healthy when its checkpoint is stale",()=>{
 const source=readFileSync(new URL("../lib/x-wire-durable.ts",import.meta.url),"utf8");
 assert.match(source,/HEALTH_COMPLETION_MAX_AGE_HOURS = 15/);
 assert.match(source,/const stale=found\.health==="healthy"/);
 assert.match(source,/found\.uncovered_before\|\|stale\?"partial"/);
});

test("ambiguous FxEmbed continuation 404 resets the poisoned cursor but retains a coverage gap",()=>{
 const source=readFileSync(new URL("../lib/x-wire-durable.ts",import.meta.url),"utf8");
 assert.match(source,/response\.status===404 && cursor/);
 assert.match(source,/uncovered_before:missingBefore\|\|window\.startAt/);
 assert.match(source,/health:"partial"/);
 assert.match(source,/page_cursor:null,window_start_at:null,next_attempt_at:plus\(now,5\)/);
 assert.match(source,/const complete=parsed\.reachedWindowStart \|\|/);
 assert.match(source,/const completeGapMarker = \{uncovered_before:unresolvedGap\}/);
 assert.doesNotMatch(source,/response\.status===404 && cursor[\s\S]{0,700}health:"healthy"/);
});



test("a filtered first-page 404 gets exactly one same-host unfiltered retry",()=>{
 const source=readFileSync(new URL("../lib/x-wire-durable.ts",import.meta.url),"utf8");
 assert.match(source,/if\(response\.status===404 && !cursor\)/);
 assert.match(source,/const fallback=new URL\(url\.toString\(\)\)/);
 assert.match(source,/fallback\.searchParams\.delete\("since"\)/);
 assert.match(source,/response=await fetchImpl\(fallback\.toString\(\)/);
 assert.match(source,/const recentlyActive404=message==="HTTP 404"/);
 assert.doesNotMatch(source,/fallback\.hostname\s*=/);
});
test("repeating a provider cursor cannot permanently trap an account",()=>{
 const source=readFileSync(new URL("../lib/x-wire-durable.ts",import.meta.url),"utf8");
 assert.match(source,/const invalidCursor=message==="Repeated pagination cursor"/);
 assert.match(source,/invalidCursor\?\{uncovered_before:missingBefore\|\|window\.startAt\}/);
 assert.match(source,/page_cursor:invalidCursor\?null/);
});
test("later-page provider failure preserves partial X data and continuation cursor",()=>{
 const code=readFileSync(new URL("../lib/x-wire-durable.ts",import.meta.url),"utf8");
 assert.match(code,/const hadPartialData=fetched>0/);
 assert.match(code,/health:invalidCursor\|\|hadPartialData\?"partial"/);
 assert.match(code,/page_cursor:invalidCursor\?null:hadPartialData\?cursor:claim\.resume_cursor/);
 assert.match(code,/window_start_at:invalidCursor\?null:hadPartialData\?window\.startAt:claim\.resume_start_at/);
 assert.match(code,/next_attempt_at:plus\(now,invalidCursor\|\|hadPartialData\|\|recentlyActive404\?5:30\)/);
});
