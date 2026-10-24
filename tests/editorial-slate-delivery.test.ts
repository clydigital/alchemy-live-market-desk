import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEditorialSlate } from "../lib/editorial-slate-core.ts";
import { blueDeskHostAccess } from "../lib/blue-desk-host.ts";

const url="https://www.bls.gov/news.release/cpi.t01.htm";
const idea=(rank:number)=>({
  rank,title:"Oil and rates story "+rank,format:"OB",
  hook:"Brent reacts after a verified report",catalystTimeline:"Source event 2026-10-23 04:00 UTC",
  priceReaction:"UNKNOWN — no matching official close",
  expectation:"Normally supply risk could lift energy prices",
  mechanism:"Supply fears can transmit to diesel inflation",
  countercase:"Demand destruction or no confirmed disruption",
  nextTrigger:"Watch independently confirmed traffic and 5-session price",
  chartGuidance:["Brent daily 20 EMA band and last five sessions"],
  sourceUrls:[url,"javascript:alert(1)"],missingProof:"No event-timed price reaction"
});
const row={day_myt:"2026-10-23",produced_at:"2026-10-23T01:10:00Z",
  verification_status:"partial",notes:"Original releases checked; price gap",
  sources:[url],ideas:[idea(1),idea(2),idea(3)]};
test("an original three-angle dated slate remains unverified and sanitises URLs",()=>{
  const slate=parseEditorialSlate(row,"2026-10-23T03:00:00Z");
  assert.ok(slate);
  assert.equal(slate.ideas.length,3);
  assert.equal(slate.verificationStatus,"partial");
  assert.equal(slate.ageLabel,"TODAY");
  assert.deepEqual(slate.ideas[0].sourceUrls,[url]);
  assert.equal(slate.ideas[0].priceReaction,"UNKNOWN — no matching official close");
});
test("fails closed when slate record incomplete, corrupt or old",()=>{
  assert.equal(parseEditorialSlate({...row,ideas:[idea(1)]},"2026-10-23T03:00:00Z"),null);
  assert.equal(parseEditorialSlate({...row,verification_status:"published"},"2026-10-23T03:00:00Z"),null);
  assert.equal(parseEditorialSlate({...row,produced_at:"garbage"},"2026-10-23T03:00:00Z"),null);
  const old=parseEditorialSlate({...row,day_myt:"2026-10-20"},"2026-10-23T03:00:00Z");
  assert.match(old!.ageLabel,/PREVIOUS SLATE/);
});
test("private article model endpoint on Bluebelly still demands the owner login and same origin",()=>{
  assert.equal(blueDeskHostAccess("/api/owner/editorial-generate","bluebelly-desk.vercel.app"),"private");
  assert.equal(blueDeskHostAccess("/api/owner/editorial-generate","alchemy-live-market-desk.vercel.app"),"private");
  const route=readFileSync(new URL("../app/api/owner/editorial-generate/route.ts",import.meta.url),"utf8");
  assert.match(route,/session\.auth\.getUser\(\)/);
  assert.match(route,/app_access_allowlist/);
  assert.match(route,/req\.headers\.get\("origin"\)/);
  assert.match(route,/no-store/);
  const middleware=readFileSync(new URL("../middleware.ts",import.meta.url),"utf8");
  assert.match(middleware,/bluebellyOwnerApi/);
  assert.match(middleware,/getClaims\(\)/);
  assert.equal(blueDeskHostAccess("/api/owner/editorial-generate","alchemy-blue-desk.vercel.app"),"blocked");
  assert.doesNotMatch(route,/SUPABASE_SERVICE_ROLE_KEY|story_thesis_versions|research_intake_items/);
});
test("private slate grants remain service-role-only with three-idea constraint",()=>{
  const sql=readFileSync(new URL("../supabase/migrations/20261023123000_blue_desk_editorial_slate_handoff.sql",import.meta.url),"utf8");
  assert.match(sql,/jsonb_array_length\(ideas\)=3/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on table public\.blue_desk_editorial_slates from public,anon,authenticated/);
  assert.match(sql,/to service_role/);
});
