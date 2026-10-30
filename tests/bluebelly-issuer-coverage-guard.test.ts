import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getDueOfficialEarningsCandidates} from "../lib/forward-earnings-sources.ts";
import {getUnreconciledPublicEarnings} from "../lib/bluebelly-earnings-coverage.ts";

test("official earnings coverage guard does not flag future announced calls as misses",()=>{
 const earlier=new Date("2026-10-29T12:00:00Z");
 const due=getDueOfficialEarningsCandidates(earlier);
 assert.equal(due.some(r=>["AMZN","SNDK","INTC"].includes(r.ticker)),false);
 const gaps=getUnreconciledPublicEarnings(earlier);
 assert.equal(gaps.some(r=>["AMZN","SNDK","INTC"].includes(r.ticker)),false);
});

test("29 Oct verified released outcomes are reconciled but missing earlier issuer result cards stay visible",()=>{
 const now=new Date("2026-10-30T01:00:00Z");
 const due=getDueOfficialEarningsCandidates(now);
 assert.ok(["AMZN","SNDK","INTC","GOOGL","MSFT"].every(t=>due.some(r=>r.ticker===t)));
 const missing=getUnreconciledPublicEarnings(now);
 assert.deepEqual(new Set(missing.map(r=>r.ticker)),new Set(["GOOGL","MSFT"]));
 assert.ok(missing.every(r=>r.status==="RESULT_BOARD_REVIEW_NEEDED"));
 assert.ok(missing.every(r=>r.originalScheduleUrl.startsWith("https://")));
});

test("CoreWeave after its Nov 10 issuer call is visible as unreconciled, not prematurely claimed reported",()=>{
 assert.equal(getUnreconciledPublicEarnings(new Date("2026-11-10T19:00:00Z")).some(r=>r.ticker==="CRWV"),false);
 const next=getUnreconciledPublicEarnings(new Date("2026-11-11T02:00:00Z"));
 assert.ok(next.some(r=>r.ticker==="CRWV"));
});

test("released Daily Report includes source-reviewed compact links plus visible missing-result warning",()=>{
 const ui=readFileSync(new URL("../components/blue-desk/DecisionBrief.tsx",import.meta.url),"utf8");
 assert.match(ui,/data-bluebelly-released-reading="links-only"/);
 assert.match(ui,/releasedMacro\.filter\(r=>!postEventRecaps\.some/);
 assert.match(ui,/releasedEarnings\.filter\(r=>!postEventRecaps\.some/);
 const released=ui.split('<section data-bluebelly-released-reading="links-only">')[1]?.split("</section>")[0]||"";
 assert.match(released,/<li className=\{s\.releasedRow\}/);
 assert.doesNotMatch(released,/<article|<small|<details|data-earnings-coverage-gap/);
 assert.match(ui,/data-earnings-coverage-gap="issuer-schedule-reconciliation"/);
 assert.match(ui,/These issuer-announced reporting dates have passed/);
 assert.match(ui,/report&&missingIssuerResults\.length/);
 const stories=readFileSync(new URL("../app/blue-desk/key-stories/page.tsx",import.meta.url),"utf8");
 assert.match(stories,/earningsReceipt \? \{/);
 assert.match(stories,/getRecentVerifiedEarningsScorecards\(now,7\)/);
});
