import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const challenge=readFileSync("components/blue-desk/RegimeNov23PceChallenge.tsx","utf8");
const regime=readFileSync("app/blue-desk/regime-watch/[lensId]/page.tsx","utf8");
const crash=readFileSync("app/blue-desk/crash-opportunity/page.tsx","utf8");

test("PCE challenger is separately dated, research-only and fails closed after release",()=>{
 assert.match(challenge,/2026-11-23-research-only/);
 assert.match(challenge,/data-regime-research-status="RESEARCH_ONLY"/);
 assert.match(challenge,/2026-11-25T13:30:00Z/);
 assert.match(challenge,/historical research note MUST NOT be read as a fresh post-release verdict/);
 assert.match(challenge,/consensus/);
 assert.match(challenge,/2Y/);
 assert.match(challenge,/DXY/);
});

test("DXY/PCE is source-linked and not mistaken for a trade or verified private transcript",()=>{
 assert.match(challenge,/investor.nvidia.com\/news/);
 assert.match(challenge,/bea.gov\/news\/schedule/);
 assert.match(challenge,/reuters.com/);
 assert.match(challenge,/market[s]?creener.com/);
 assert.match(challenge,/No inferred institutional flows/);
 assert.doesNotMatch(challenge,/service_role|createSupabaseAdminClient|insert\(|upsert\(|update\(|getPrivateReviewedCreatorArguments/);
});

test("new challenger is visible on relevant lenses and Crash page outside the historical archive",()=>{
 const lensMount=regime.indexOf("<RegimeNov23PceChallenge");
 const archive=regime.indexOf('id="editorial-archive"');
 assert.ok(lensMount>0&&archive>lensMount);
 for(const s of ['"fed"','"bonds"','"ai"','"breadth"'])assert.match(regime,new RegExp(s));
 assert.ok(crash.includes('<RegimeNov23PceChallenge scope="cross" now={now} event={pceEvent??undefined}/>'));
 const first=crash.indexOf("<RegimeNov23PceChallenge");
 const live=crash.indexOf('id="live-decision"');
 assert.ok(first>0&&live>first);
});
