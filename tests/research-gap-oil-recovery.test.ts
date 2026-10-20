import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assessOilSourceRecovery } from "../lib/research-gap-oil-recovery.ts";
import type { OilSourceAccessResult, OilSourceAccessStatus } from "../lib/research-gap-oil-source-access.ts";

const at = "2026-10-21T04:00:00.000Z";
function source(status: OilSourceAccessStatus, benchmark: "WTI" | "BRENT" = "WTI"): OilSourceAccessResult {
  return {
    benchmark, status, sourceUrl: null, httpStatus: null, bytes: null,
    fetchedSha256: null, originalArchived: false, canonicalAdmitted: false,
  };
}
function review(statuses: OilSourceAccessStatus[], attemptCount = 1, outcome: "UNRESOLVED" | "CONFIRMING" = "UNRESOLVED") {
  return assessOilSourceRecovery({
    outcome, attemptCount, completedAt: at,
    sourceAccess: statuses.map((s, index) => source(s, index % 2 === 0 ? "WTI" : "BRENT")),
  });
}
test("transient publisher outages receive delayed conditional retry advice", () => {
  const first = review(["RATE_LIMITED", "FETCH_FAILED"], 1);
  assert.equal(first.decision, "RETRY_ON_NEW_DOSSIER");
  assert.equal(first.reason, "TRANSIENT_ACCESS");
  assert.equal(first.nextEligibleAt, "2026-10-21T16:00:00.000Z");
  assert.deepEqual(first.statuses, [
    { benchmark: "WTI", status: "RATE_LIMITED" },
    { benchmark: "BRENT", status: "FETCH_FAILED" },
  ]);
  assert.equal(review(["ARCHIVE_FAILED"], 2).nextEligibleAt, "2026-10-22T04:00:00.000Z");
});
test("missing dated originals get longer delay, and bounded attempts stop retries", () => {
  const missing = review(["NO_DATED_ORIGINAL_URL", "NOT_FOUND"]);
  assert.equal(missing.decision, "RETRY_ON_NEW_DOSSIER");
  assert.equal(missing.nextEligibleAt, "2026-10-22T04:00:00.000Z");
  const capped = review(["FETCH_FAILED"], 3);
  assert.equal(capped.decision, "HOLD_FOR_OPERATOR");
  assert.equal(capped.reason, "ATTEMPT_CAP");
  assert.equal(capped.nextEligibleAt, null);
});
test("rights, archive, unsafe source and completion never cause automatic requeue", () => {
  for (const status of ["AUTH_REQUIRED", "ACCESS_DENIED", "RETRIEVED_UNARCHIVED"] as const) {
    const decision = review(["FETCH_FAILED", status]);
    assert.equal(decision.decision, "HOLD_FOR_OPERATOR");
    assert.equal(decision.reason, "RIGHTS_REVIEW");
  }
  assert.equal(review(["ARCHIVED_UNVERIFIED"]).reason, "ARCHIVED_AWAITING_PARSER");
  for (const status of ["REDIRECT_BLOCKED", "WRONG_MEDIA_TYPE", "SOURCE_TOO_LARGE"] as const) {
    assert.equal(review([status]).reason, "SOURCE_NOT_ARCHIVABLE");
  }
  assert.equal(review(["FETCH_FAILED"], 1, "CONFIRMING").decision, "NO_RETRY");
  assert.equal(review([]).reason, "INVALID_DIAGNOSTICS");
});
test("server stores operational source recovery with verdict but never treats it as Evidence", () => {
  const route = readFileSync(new URL("../app/api/research-gap/execution/route.ts", import.meta.url), "utf8");
  assert.match(route, /sourceRecovery: assessOilSourceRecovery\(/);
  assert.match(route, /verdict: persistedVerdict/);
  assert.match(route, /verifiedCanonicalOilEvidence/);
  assert.doesNotMatch(route, /requeueResearchGapCase/);
  const recovery = readFileSync(new URL("../lib/research-gap-oil-recovery.ts", import.meta.url), "utf8");
  assert.doesNotMatch(recovery, /createSupabaseAdminClient|story_thesis_versions|intelligence_evidence/);
});
