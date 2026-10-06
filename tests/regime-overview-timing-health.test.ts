import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildRegimeOverviewTimingHealth } from "../lib/regime-overview-timing-health.ts";
import type { RegimeLiveStoryReasoning } from "../lib/regime-live-reasoning.ts";
import type { ProjectedRegime, ProjectedStory } from "../lib/regimes.ts";

function story(id: string): ProjectedStory {
  return {
    id,
    slug: id,
    title: id,
    thesis: "thesis",
    question: "question",
    confidence: 70,
    lifecycle: "monitor",
    editorialVerdict: null,
    assets: [],
    versionId: `version-${id}`,
    versionNumber: 1,
    routes: [],
    maturity: "durable",
    contributesToState: true,
    maturityReason: "accepted",
    hybridHref: `/hybrid-output?story=${id}`,
  };
}

function reasoning(storyId: string, updatedAt: string | null): RegimeLiveStoryReasoning {
  return {
    storyId,
    hypothesisId: `hypothesis-${storyId}`,
    question: "question",
    statement: "statement",
    mechanism: "mechanism",
    confidence: 70,
    decisionState: "accepted",
    updatedAt,
    causalChain: [],
  };
}

function regime(input: {
  telemetryAt: string | null;
  storyId?: string;
}): ProjectedRegime {
  const projectedStory = story(input.storyId || "story-1");
  return {
    slug: "global-cost-of-capital",
    title: "Rates",
    shortTitle: "Rates",
    coreQuestion: "Question",
    whyItMatters: "Why",
    mechanism: "Mechanism",
    affectedMarkets: [],
    state: "Active",
    stateKind: "system1",
    confidence: "PARTIAL",
    asOf: input.telemetryAt,
    stories: [projectedStory],
    durableStories: [projectedStory],
    contextStories: [],
    latestNode: null,
    dossierContext: [],
    subgroups: [{
      key: "fed-front-end",
      label: "Fed / Front End",
      accent: "blue",
      whyItMatters: "Why",
      mechanism: "Mechanism",
      state: "Observed",
      stateKind: "system1",
      stories: [projectedStory],
      durableStories: [projectedStory],
      contextStories: [],
      nodes: [],
      telemetry: input.telemetryAt ? [{
        key: "policy",
        label: "Policy",
        state: "Observed",
        detail: "detail",
        asOf: input.telemetryAt,
        source: "rate-regime/1",
      }] : [],
      latestAt: input.telemetryAt,
    }],
    hybridHref: "/hybrid-output?regime=global-cost-of-capital",
  };
}

test("overview timing health keeps System 1, System 2 and pending skew separate", () => {
  const health = buildRegimeOverviewTimingHealth({
    regimes: [regime({ telemetryAt: "2026-10-07T00:50:00.000Z" })],
    liveReasoning: [reasoning("story-1", "2026-10-07T00:20:00.000Z")],
    now: "2026-10-07T01:00:00.000Z",
  });

  assert.equal(health.status, "pending");
  assert.equal(health.latestTelemetryAgeMinutes, 10);
  assert.equal(health.latestInterpretationAgeMinutes, 40);
  assert.equal(health.telemetryBearingSubgroups, 1);
  assert.equal(health.pendingInterpretationSubgroups, 1);
  assert.equal(health.noTimestampedInterpretationSubgroups, 0);
  assert.equal(health.oldestPendingLagMinutes, 30);
});

test("telemetry with no timestamped System 2 read remains degraded instead of appearing current", () => {
  const health = buildRegimeOverviewTimingHealth({
    regimes: [regime({ telemetryAt: "2026-10-07T00:30:00.000Z" })],
    liveReasoning: [],
    now: "2026-10-07T01:00:00.000Z",
  });

  assert.equal(health.status, "no_system2");
  assert.equal(health.pendingInterpretationSubgroups, 1);
  assert.equal(health.noTimestampedInterpretationSubgroups, 1);
  assert.equal(health.oldestPendingLagMinutes, 30);
  assert.equal(health.latestInterpretationAt, null);
});

test("overview timing health is current when System 2 is at least as recent as telemetry", () => {
  const health = buildRegimeOverviewTimingHealth({
    regimes: [regime({ telemetryAt: "2026-10-07T00:20:00.000Z" })],
    liveReasoning: [reasoning("story-1", "2026-10-07T00:25:00.000Z")],
    now: "2026-10-07T01:00:00.000Z",
  });

  assert.equal(health.status, "current");
  assert.equal(health.pendingInterpretationSubgroups, 0);
  assert.equal(health.oldestPendingLagMinutes, null);
});

test("Regime overview renders independent timing clocks without changing persisted projection schema", () => {
  const page = readFileSync(new URL("../app/regimes/page.tsx", import.meta.url), "utf8");
  const projection = readFileSync(new URL("../lib/regimes.ts", import.meta.url), "utf8");
  const helper = readFileSync(new URL("../lib/regime-overview-timing-health.ts", import.meta.url), "utf8");

  assert.match(page, /System 1 latest/);
  assert.match(page, /System 2 latest/);
  assert.match(page, /projector/);
  assert.match(page, /Telemetry ahead of System 2/);
  assert.match(page, /oldest gap/);
  assert.match(page, /getRegimeLiveReasoning/);
  assert.match(helper, /assessRegimeInterpretationFreshness/);
  assert.doesNotMatch(projection, /latestTelemetryAgeMinutes/);
  assert.doesNotMatch(projection, /latestInterpretationAgeMinutes/);
});
