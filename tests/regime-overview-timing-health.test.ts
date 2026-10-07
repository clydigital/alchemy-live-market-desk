import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildRegimeOverviewTimingHealth } from "../lib/regime-overview-timing-health.ts";
import type { RegimeStoryInterpretationClock } from "../lib/regime-live-reasoning.ts";
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

function clock(
  storyId: string,
  evaluatedAt: string | null,
  hasPrimaryHypothesis = evaluatedAt !== null,
): RegimeStoryInterpretationClock {
  return {
    storyId,
    evaluatedAt,
    basis: hasPrimaryHypothesis && evaluatedAt ? "story_review" : "unavailable",
    hasPrimaryHypothesis,
  };
}

function regime(input: {
  telemetryAt: string | null;
  storyId?: string;
  storyBacked?: boolean;
  contextOnly?: boolean;
  additionalDurableIds?: string[];
}): ProjectedRegime {
  const projectedStory = story(input.storyId || "story-1");
  const storyBacked = input.storyBacked !== false;
  const durableStories = storyBacked
    ? [projectedStory, ...(input.additionalDurableIds || []).map(story)]
    : [];
  const contextStories = !storyBacked && input.contextOnly ? [projectedStory] : [];
  const stories = [...durableStories, ...contextStories];
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
    stories,
    durableStories,
    contextStories,
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
      stories,
      durableStories,
      contextStories,
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

test("overview timing health uses accepted Story review time for genuine pending skew", () => {
  const health = buildRegimeOverviewTimingHealth({
    regimes: [regime({ telemetryAt: "2026-10-07T00:50:00.000Z" })],
    interpretationClocks: [clock("story-1", "2026-10-07T00:20:00.000Z")],
    now: "2026-10-07T01:00:00.000Z",
  });

  assert.equal(health.status, "pending");
  assert.equal(health.latestTelemetryAgeMinutes, 10);
  assert.equal(health.latestInterpretationAgeMinutes, 40);
  assert.equal(health.telemetryBearingSubgroups, 1);
  assert.equal(health.storyBackedTelemetrySubgroups, 1);
  assert.equal(health.nonDurableTelemetrySubgroups, 0);
  assert.equal(health.pendingInterpretationSubgroups, 1);
  assert.equal(health.noTimestampedInterpretationSubgroups, 0);
  assert.equal(health.oldestPendingLagMinutes, 30);
});

test("readable primary hypothesis without a review timestamp remains degraded", () => {
  const health = buildRegimeOverviewTimingHealth({
    regimes: [regime({ telemetryAt: "2026-10-07T00:30:00.000Z" })],
    interpretationClocks: [clock("story-1", null, true)],
    now: "2026-10-07T01:00:00.000Z",
  });

  assert.equal(health.status, "no_system2");
  assert.equal(health.pendingInterpretationSubgroups, 1);
  assert.equal(health.noTimestampedInterpretationSubgroups, 1);
  assert.equal(health.nonDurableTelemetrySubgroups, 0);
  assert.equal(health.oldestPendingLagMinutes, 30);
  assert.equal(health.latestInterpretationAt, null);
});

test("unchanged Story review can make interpretation current without rewriting hypothesis wording", () => {
  const health = buildRegimeOverviewTimingHealth({
    regimes: [regime({ telemetryAt: "2026-10-07T00:20:00.000Z" })],
    interpretationClocks: [clock("story-1", "2026-10-07T00:25:00.000Z")],
    now: "2026-10-07T01:00:00.000Z",
  });

  assert.equal(health.status, "current");
  assert.equal(health.pendingInterpretationSubgroups, 0);
  assert.equal(health.oldestPendingLagMinutes, null);
});

test("sensor-only subgroup is coverage debt, not a fake stale Story interpretation", () => {
  const health = buildRegimeOverviewTimingHealth({
    regimes: [regime({
      telemetryAt: "2026-10-07T00:30:00.000Z",
      storyBacked: false,
    })],
    interpretationClocks: [],
    now: "2026-10-07T01:00:00.000Z",
  });

  assert.equal(health.status, "partial_coverage");
  assert.equal(health.telemetryBearingSubgroups, 1);
  assert.equal(health.storyBackedTelemetrySubgroups, 0);
  assert.equal(health.nonDurableTelemetrySubgroups, 1);
  assert.equal(health.contextOnlyTelemetrySubgroups, 0);
  assert.equal(health.sensorOnlyTelemetrySubgroups, 1);
  assert.equal(health.pendingInterpretationSubgroups, 0);
  assert.equal(health.noTimestampedInterpretationSubgroups, 0);
  assert.equal(health.oldestPendingLagMinutes, null);
});

test("mapped seed or episode Stories remain context-only instead of being promoted for coverage", () => {
  const health = buildRegimeOverviewTimingHealth({
    regimes: [regime({
      telemetryAt: "2026-10-07T00:30:00.000Z",
      storyBacked: false,
      contextOnly: true,
    })],
    interpretationClocks: [],
    now: "2026-10-07T01:00:00.000Z",
  });

  assert.equal(health.status, "partial_coverage");
  assert.equal(health.storyBackedTelemetrySubgroups, 0);
  assert.equal(health.nonDurableTelemetrySubgroups, 1);
  assert.equal(health.contextOnlyTelemetrySubgroups, 1);
  assert.equal(health.sensorOnlyTelemetrySubgroups, 0);
  assert.equal(health.pendingInterpretationSubgroups, 0);
});

test("a reviewed Story with no resolved primary hypothesis cannot count as current System 2", () => {
  const health = buildRegimeOverviewTimingHealth({
    regimes: [regime({ telemetryAt: "2026-10-07T00:20:00.000Z" })],
    interpretationClocks: [clock("story-1", "2026-10-07T00:30:00.000Z", false)],
    now: "2026-10-07T01:00:00.000Z",
  });

  assert.equal(health.status, "no_system2");
  assert.equal(health.missingCausalSubgroups, 1);
  assert.equal(health.partialCausalSubgroups, 0);
  assert.equal(health.missingCausalStoryPlacements, 1);
  assert.equal(health.pendingInterpretationSubgroups, 0);
  assert.equal(health.latestInterpretationAt, null);
});

test("a mixed durable subgroup keeps its available causal clock but flags partial coverage", () => {
  const health = buildRegimeOverviewTimingHealth({
    regimes: [regime({
      telemetryAt: "2026-10-07T00:20:00.000Z",
      additionalDurableIds: ["story-no-hypothesis"],
    })],
    interpretationClocks: [
      clock("story-1", "2026-10-07T00:30:00.000Z"),
      clock("story-no-hypothesis", "2026-10-07T00:35:00.000Z", false),
    ],
    now: "2026-10-07T01:00:00.000Z",
  });
  assert.equal(health.status, "partial_coverage");
  assert.equal(health.missingCausalSubgroups, 0);
  assert.equal(health.partialCausalSubgroups, 1);
  assert.equal(health.missingCausalStoryPlacements, 1);
  assert.equal(health.pendingInterpretationSubgroups, 0);
  assert.equal(health.latestInterpretationAt, "2026-10-07T00:30:00.000Z");
});

test("Regime timing UI reads Story evaluation clock without changing projection schema", () => {
  const page = readFileSync(new URL("../app/regimes/page.tsx", import.meta.url), "utf8");
  const detailPage = readFileSync(new URL("../app/regimes/[slug]/page.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../components/live-desk/RegimeDetailWorkspace.tsx", import.meta.url), "utf8");
  const liveReasoning = readFileSync(new URL("../lib/regime-live-reasoning.ts", import.meta.url), "utf8");
  const projection = readFileSync(new URL("../lib/regimes.ts", import.meta.url), "utf8");
  const helper = readFileSync(new URL("../lib/regime-overview-timing-health.ts", import.meta.url), "utf8");

  assert.match(page, /System 1 latest/);
  assert.match(page, /latest Story review/);
  assert.match(page, /Telemetry ahead of Story review/);
  assert.match(page, /Telemetry without durable Story/);
  assert.match(page, /Subgroups with no causal hypothesis/);
  assert.match(page, /Partial causal Story coverage/);
  assert.match(page, /seed\/early\/episode\/reasoning gap/);
  assert.match(page, /getRegimeStoryInterpretationClocks/);
  assert.match(detailPage, /getRegimeStoryInterpretationClocks/);
  assert.match(workspace, /latest accepted Story review/);
  assert.match(workspace, /TELEMETRY \+ CONTEXT STORIES — NO DURABLE STORY DRIVER/);
  assert.match(workspace, /SYSTEM 1 ONLY — NO MAPPED STORY DRIVER/);
  assert.match(workspace, /NO READABLE PRIMARY CAUSAL HYPOTHESIS/);
  assert.match(workspace, /PARTIAL CAUSAL COVERAGE/);
  assert.match(workspace, /hypothesis updated/);
  assert.match(liveReasoning, /last_evaluated_at/);
  assert.match(liveReasoning, /basis: "story_review"/);
  assert.match(liveReasoning, /!hypothesisUpdatedAt\.has\(state\.primary_hypothesis_id\)/);
  assert.match(liveReasoning, /hasPrimaryHypothesis: false/);
  assert.match(helper, /assessRegimeInterpretationFreshness/);
  assert.doesNotMatch(projection, /latestTelemetryAgeMinutes/);
  assert.doesNotMatch(projection, /latestInterpretationAgeMinutes/);
});
