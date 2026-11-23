import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const watch=readFileSync("components/blue-desk/RegimeNov23PceChallenge.tsx","utf8");
const regime=readFileSync("app/blue-desk/regime-watch/[lensId]/page.tsx","utf8");
const crash=readFileSync("app/blue-desk/crash-opportunity/page.tsx","utf8");

test("rolling US Econ Stat Watch replaced dated PCE verdict and preserves dated research only as archive",()=>{
 assert.match(watch,/US Economic Statistics Watch/);
 assert.match(watch,/data-us-econ-stat-watch="automatic-official-source-v1"/);
 assert.match(watch,/data-regime-research-status="RESEARCH_ONLY"/);
 assert.match(watch,/<details/);
 assert.match(watch,/2026-11-23-research-only/);
 assert.match(watch,/Historical research notes MUST NOT be read as fresh post-release verdicts/);
 assert.match(watch,/no automatic|No inferred institutional flows/i);
});
test("public macro analysis never includes private research, user positioning or canonical writes",()=>{
 assert.match(watch,/BEA official release schedule/);
 assert.match(watch,/BLS release schedule/);
 assert.match(watch,/DXY/);
 assert.doesNotMatch(watch,/service_role|createSupabaseAdminClient|insert\(|upsert\(|update\(|getPrivateReviewedCreatorArguments/);
});
test("automated watch is above historical archive on all five original consumer surfaces",()=>{
 const lensMount=regime.indexOf("<RegimeNov23PceChallenge");
 const archive=regime.indexOf('id="editorial-archive"');
 assert.ok(lensMount>0&&archive>lensMount);
 for(const s of ['"fed"','"bonds"','"ai"','"breadth"'])assert.match(regime,new RegExp(s));
 assert.ok(crash.includes('<RegimeNov23PceChallenge scope="cross" now={now} watch={usWatch??undefined}/>'));
 const first=crash.indexOf("<RegimeNov23PceChallenge");
 const live=crash.indexOf('id="live-decision"');
 assert.ok(first>0&&live>first);
});
