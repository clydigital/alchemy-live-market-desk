import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseFxTimeline, xWireRequestWindow } from "../lib/x-wire-pagination.ts";
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
test("raw queue only exposes private host and never touches canonical research paths",()=>{
  assert.equal(blueDeskHostAccess("/owner/x-wire","bluebelly-desk.vercel.app"),"blocked");
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

test("later-page provider failure preserves partial X data and continuation cursor",()=>{
 const code=readFileSync(new URL("../lib/x-wire-durable.ts",import.meta.url),"utf8");
 assert.match(code,/const hadPartialData=fetched>0/);
 assert.match(code,/health:hadPartialData\?"partial"/);
 assert.match(code,/page_cursor:hadPartialData\?cursor:claim\.resume_cursor/);
 assert.match(code,/window_start_at:hadPartialData\?window\.startAt:claim\.resume_start_at/);
 assert.match(code,/next_attempt_at:plus\(now,hadPartialData\?5:30\)/);
});
