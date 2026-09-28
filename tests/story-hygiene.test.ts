import assert from "node:assert/strict";
import test from "node:test";

import type { StoryThesisVersion } from "../lib/persistence/contracts.ts";
import {
  assessStoryCatalyst,
  catalystDisplayLabel,
  catalystTimestamp,
  shouldRecalibrateExpiredCatalyst,
} from "../lib/story-hygiene.ts";

function version(snapshot: Record<string, unknown>): StoryThesisVersion {
  return {
    id: "version-1",
    story_id: "story-1",
    event_id: null,
    version_number: 1,
    title: "Test Story",
    thesis: "Test thesis",
    status: "publish",
    confidence: 70,
    market_question: null,
    dominant_narrative: null,
    best_explanation: null,
    strongest_support: null,
    strongest_contradiction: null,
    priced_assessment: null,
    confirmation_trigger: null,
    invalidation_trigger: null,
    next_catalyst: null,
    article_angle: null,
    provisional_title: null,
    article_verdict: null,
    assets: [],
    snapshot,
    change_reason: "test",
    effective_at: "2026-09-28T00:00:00Z",
    created_by: null,
    created_at: "2026-09-28T00:00:00Z",
  } as StoryThesisVersion;
}

test("legacy natural-language catalyst dates are parsed deterministically", () => {
  assert.equal(
    new Date(catalystTimestamp("U.S. CPI on 12 August 2026")!).toISOString(),
    "2026-08-12T12:00:00.000Z",
  );
  assert.equal(catalystTimestamp("Monitor yields and credit spreads"), null);
});

test("legacy dated catalyst becomes expired after the event date", () => {
  const assessment = assessStoryCatalyst({
    nextCatalyst: "U.S. CPI on 12 August 2026",
    now: new Date("2026-09-28T06:00:00Z"),
  });
  assert.equal(assessment.status, "expired");
  assert.equal(assessment.recalibrationRequired, true);
  assert.match(catalystDisplayLabel(assessment) || "", /^Expired ·/);
});

test("future legacy catalyst remains upcoming", () => {
  const assessment = assessStoryCatalyst({
    nextCatalyst: "PCE release 30 October 2026",
    now: new Date("2026-09-28T06:00:00Z"),
  });
  assert.equal(assessment.status, "upcoming");
  assert.equal(assessment.recalibrationRequired, false);
});

test("persisted canonical reasoning under snapshot.reasoning owns next-test state", () => {
  const assessment = assessStoryCatalyst({
    nextCatalyst: null,
    version: version({
      reasoning: {
        contractVersion: "canonical-story-reasoning/v1",
        nextTest: {
          label: "Next EIA weekly release",
          status: "expired",
          dueAt: null,
          expiresAt: "2026-09-27T12:00:00Z",
        },
      },
    }),
    now: new Date("2026-09-28T06:00:00Z"),
  });
  assert.equal(assessment.source, "canonical_next_test");
  assert.equal(assessment.label, "Next EIA weekly release");
  assert.equal(assessment.status, "expired");
});

test("legacy canonicalStoryReasoning snapshots remain readable", () => {
  const assessment = assessStoryCatalyst({
    nextCatalyst: null,
    version: version({
      canonicalStoryReasoning: {
        nextTest: {
          label: "FOMC decision",
          status: "upcoming",
          dueAt: "2026-10-01T18:00:00Z",
          expiresAt: null,
        },
      },
    }),
    now: new Date("2026-09-28T06:00:00Z"),
  });
  assert.equal(assessment.status, "upcoming");
  assert.equal(assessment.label, "FOMC decision");
});

test("expired recalibration has a deterministic cooldown", () => {
  const assessment = assessStoryCatalyst({
    nextCatalyst: "12 August 2026 CPI",
    now: new Date("2026-09-28T06:00:00Z"),
  });
  assert.equal(shouldRecalibrateExpiredCatalyst({
    assessment,
    lastEvaluatedAt: "2026-09-26T00:00:00Z",
    now: new Date("2026-09-28T06:00:00Z"),
  }), true);
  assert.equal(shouldRecalibrateExpiredCatalyst({
    assessment,
    lastEvaluatedAt: "2026-09-28T05:00:00Z",
    now: new Date("2026-09-28T06:00:00Z"),
  }), false);
});
