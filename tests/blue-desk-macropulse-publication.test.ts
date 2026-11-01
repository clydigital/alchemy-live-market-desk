import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseDigestApproval,dispatchIsReviewable} from "../lib/blue-desk-macropulse-publication.ts";

const id="404519b6-7a94-8118-b347-d363f9b215a9",digest="f".repeat(64);
const approval={
 id,digestSha256:digest,checkedSources:true,checkedTimeWindows:true,
 checkedCountercase:true,approvePublicResearch:true,
};
const row={
 status:"review",digest_sha256:digest,
 source_published_at:"2026-11-01T12:00:00Z",
 source_retrieved_at:"2026-11-01T12:09:00Z",
 verification_label:"RESEARCH_DERIVED_UNADJUDICATED",
 source_links:[{url:"https://www.opec.org/opec_web/en/press_room/0000.htm",
  label:"Original OPEC release",kind:"PRIMARY_RELEASE"}],
};
const now=new Date("2026-11-02T00:00:00Z");
test("publication requires owner to explicitly check each independent gate",()=>{
 assert.deepEqual(parseDigestApproval(approval),approval);
 for(const key of ["checkedSources","checkedTimeWindows","checkedCountercase","approvePublicResearch"]){
  assert.equal(parseDigestApproval({...approval,[key]:false}),null);
 }
 assert.equal(parseDigestApproval({...approval,status:"published"}),null);
 assert.equal(parseDigestApproval({...approval,id:"x"}),null);
 assert.equal(parseDigestApproval({...approval,digestSha256:"short"}),null);
 assert.equal(parseDigestApproval(null),null);
});
test("only current, source-linked unadjudicated review rows may be published",()=>{
 assert.equal(dispatchIsReviewable(row,now),true);
 for(const x of [
  {status:"published"},{verification_label:"SOURCE_VERIFIED"},
  {digest_sha256:"bad"},
  {source_published_at:"2026-10-01T12:00:00Z"},
  {source_published_at:"2026-11-03T12:00:00Z"},
  {source_retrieved_at:"2026-10-31T12:00:00Z"},
  {source_links:[]},
  {source_links:[{url:"https://x.com/post/123",label:"Tweet",kind:"SOCIAL_LEAD"}]},
  {source_links:[{url:"http://localhost/secret",label:"Misleading",kind:"PRIMARY_RELEASE"}]},
 ]){
  assert.equal(dispatchIsReviewable({...row,...x},now),false,JSON.stringify(x));
 }
});
test("API is origin-gated, owner-authenticated, SHA-concurrent and readback-verified",()=>{
 const api=readFileSync(new URL("../app/api/owner/macropulse-briefs/route.ts",import.meta.url),"utf8");
 assert.match(api,/originHost!==host/);
 assert.match(api,/authenticated\(req\)/);
 assert.match(api,/app_access_allowlist/);
 assert.match(api,/parseDigestApproval/);
 assert.match(api,/dispatchIsReviewable/);
 assert.match(api,/\.eq\("digest_sha256",approval\.digestSha256\)/);
 assert.match(api,/\.eq\("status","review"\)/);
 assert.match(api,/reviewed_by:auth\.email/);
 assert.match(api,/Publication readback failed/);
 assert.doesNotMatch(api,/market_regimes|story_thesis_versions|intelligence_evidence/);
});
test("public readers stay RLS SELECT-only and never return review rows",()=>{
 const reader=readFileSync(new URL("../lib/blue-desk-macropulse-brief-server.ts",import.meta.url),"utf8");
 assert.match(reader,/\.eq\("status","published"\)/);
 assert.doesNotMatch(reader,/createSupabaseAdminClient/);
 const migration=readFileSync(new URL("../supabase/migrations/20261025220902_blue_desk_macropulse_briefs.sql",import.meta.url),"utf8");
 assert.match(migration,/using\(status='published'\)/);
 assert.match(migration,/revoke all on public\.blue_desk_macropulse_briefs/);
});
