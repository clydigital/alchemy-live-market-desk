import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  assessStoryCatalyst,
  catalystDisplayLabel,
  shouldRecalibrateExpiredCatalyst,
} from "../lib/story-hygiene.ts";

const root = path.resolve(import.meta.dirname, "..");

test("legacy dated catalysts become expired even after a later Story evaluation", () => {
  const assessment = assessStoryCatalyst({
    nextCatalyst: "U.S. CPI and Real Earnings on 12 August 2026, followed by PPI on 13 August.",
    now: new Date("2026-09-28T06:30:00.000Z"),
  });
  assert.equal(assessment.status, "expired");
  assert.equal(assessment.recalibrationRequired, true);
  assert.match(catalystDisplayLabel(assessment) || "", /^Expired ·/);
  assert.equal(shouldRecalibrateExpiredCatalyst({
    assessment,
    lastEvaluatedAt: "2026-09-26T19:57:32.000Z",
    now: new Date("2026-09-28T06:30:00.000Z"),
  }), true);
});

test("recently reviewed expired catalyst observes the recalibration cooldown", () => {
  const assessment = assessStoryCatalyst({
    nextCatalyst: "12 August 2026 CPI",
    now: new Date("2026-09-28T06:30:00.000Z"),
  });
  assert.equal(shouldRecalibrateExpiredCatalyst({
    assessment,
    lastEvaluatedAt: "2026-09-28T06:00:00.000Z",
    now: new Date("2026-09-28T06:30:00.000Z"),
  }), false);
});

test("undated monitoring catalysts remain ongoing rather than being guessed stale", () => {
  const assessment = assessStoryCatalyst({
    nextCatalyst: "Fed-funds futures, US02Y/US05Y, real yields, breakevens and Treasury issuance.",
    now: new Date("2026-09-28T06:30:00.000Z"),
  });
  assert.equal(assessment.status, "ongoing");
  assert.equal(assessment.recalibrationRequired, false);
});

test("canonical nextTest status outranks legacy label parsing", () => {
  const version = {
    snapshot: {
      canonicalStoryReasoning: {
        nextTest: {
          label: "Next official release",
          status: "resolved",
          dueAt: "2026-09-20T12:00:00Z",
          expiresAt: null,
        },
      },
    },
  } as any;
  const assessment = assessStoryCatalyst({
    nextCatalyst: "12 August 2026 CPI",
    version,
    now: new Date("2026-09-28T06:30:00.000Z"),
  });
  assert.equal(assessment.status, "resolved");
  assert.equal(assessment.label, "Next official release");
  assert.equal(assessment.source, "canonical_next_test");
});

test("expiry migration may clear stale catalyst without changing thesis confidence", () => {
  const sql = fs.readFileSync(
    path.join(root, "supabase", "migrations", "20260928062500_story_catalyst_expiry_recalibration.sql"),
    "utf8",
  );
  assert.match(sql, /current_catalyst_expired/);
  assert.match(sql, /review_context -> 'expiredCatalysts'/);
  assert.match(sql, /new_next_catalyst := null/);
  assert.match(sql, /'status', 'expired'/);
  assert.match(sql, /operational_refresh_allowed := true/);
  assert.match(sql, /new_confidence := case when material_allowed/);
  assert.match(sql, /new_thesis := story_row\.thesis/);
  assert.match(sql, /new_title := story_row\.title/);
  assert.match(sql, /candidate_valid[\s\S]*accepted_next_test/);
});
