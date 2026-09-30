import test from "node:test";
import assert from "node:assert/strict";

import { buildGlobalRatesFxBridge } from "../lib/global-rates-fx-bridge.ts";
import type { RoutedDossierInvestigation } from "../lib/regime-investigations.ts";
import type { ProjectedRegime, ProjectedRegimeSubgroup } from "../lib/regimes.ts";

function subgroup(
  key: string,
  overrides: Partial<ProjectedRegimeSubgroup> = {},
): ProjectedRegimeSubgroup {
  return {
    key,
    label: key,
    accent: "green",
    whyItMatters: "test",
    mechanism: "test",
    state: "Unresolved",
    stateKind: "unresolved",
    stories: [],
    durableStories: [],
    contextStories: [],
    nodes: [],
    telemetry: [],
    latestAt: null,
    ...overrides,
  };
}

function regime(globalOverrides: Partial<ProjectedRegimeSubgroup> = {}): ProjectedRegime {
  return {
    slug: "global-cost-of-capital",
    title: "Sovereign Funding & Global Cost of Capital",
    shortTitle: "Cost of Capital",
    coreQuestion: "test",
    whyItMatters: "test",
    mechanism: "test",
    affectedMarkets: ["US10Y", "USDJPY", "JGB10Y"],
    state: "Rates restrictive · broader funding partial",
    stateKind: "unresolved",
    confidence: "PARTIAL",
    asOf: "2026-09-30T10:00:00Z",
    stories: [],
    durableStories: [],
    contextStories: [],
    latestNode: null,
    subgroups: [
      subgroup("fed-front-end", {
        telemetry: [{
          key: "FRONT_END",
          label: "Front-end pricing",
          state: "Restrictive",
          detail: "US 2Y remains elevated.",
          asOf: "2026-09-30T10:00:00Z",
          source: "rate-regime/1",
        }],
      }),
      subgroup("long-end", {
        telemetry: [{
          key: "LONG_END",
          label: "Long-end nominal yields",
          state: "Restrictive",
          detail: "US 10Y remains elevated.",
          asOf: "2026-09-30T10:00:00Z",
          source: "rate-regime/1",
        }],
      }),
      subgroup("global-rates", globalOverrides),
    ],
    hybridHref: "/hybrid-output?regime=global-cost-of-capital",
  };
}

test("global rates FX bridge refuses to infer Japan and USDJPY from US rates alone", () => {
  const bridge = buildGlobalRatesFxBridge({
    regime: regime(),
    investigations: [],
    liveReasoning: [],
  });
  assert.ok(bridge);
  assert.deepEqual(
    bridge.steps.map((step) => [step.key, step.state]),
    [
      ["us-rates", "observed"],
      ["ust-jgb-gap", "unresolved"],
      ["usdjpy", "unresolved"],
      ["japan-flows", "unresolved"],
      ["risk-carry", "unresolved"],
    ],
  );
  assert.match(bridge.steps[2].detail, /DXY is not a substitute/i);
});

test("global rates FX bridge upgrades only the links with canonical evidence", () => {
  const investigation = {
    id: "inv-duration",
    question: "Is the rates shock transmitting into credit and volatility?",
    whyItMatters: "Tests broad risk transmission.",
    currentExplanation: "Credit spreads remain contained relative to the rates move, so risk transmission is still incomplete.",
    expectedReaction: "Higher real yields should widen credit and lift volatility.",
    observedReaction: "Rates rose while credit widened only modestly.",
    researchNext: "Compare credit, breadth and MOVE/VIX with USDJPY.",
    confirmationCondition: "Credit and volatility broaden with persistent rates pressure.",
    invalidationCondition: "Rates retreat and credit tightens.",
    competingExplanations: [],
    missingEvidence: [],
    storyIds: [],
    thesisIds: [],
    regimeRoutes: [{ regime: "global-cost-of-capital", subgroup: "long-end", role: "supporting", score: 6 }],
  } as unknown as RoutedDossierInvestigation;

  const bridge = buildGlobalRatesFxBridge({
    regime: regime({
      nodes: [
        {
          id: "news-jgb-fx",
          title: "USDJPY rises as the UST-JGB 10Y yield gap widens",
          detail: "Comparable US and Japanese government-bond yields and dollar-yen are in the same observed record.",
          timestamp: "2026-09-30T10:10:00Z",
          state: "interpretation_pending",
          sourceKind: "news",
          verification: "official",
          storyId: null,
          storySlug: null,
          href: null,
          hybridHref: null,
        },
        {
          id: "news-flow",
          title: "Japan MOF intervention data updated",
          detail: "Official intervention and capital-flow evidence is now available.",
          timestamp: "2026-09-30T10:11:00Z",
          state: "interpretation_pending",
          sourceKind: "news",
          verification: "official",
          storyId: null,
          storySlug: null,
          href: null,
          hybridHref: null,
        },
      ],
      latestAt: "2026-09-30T10:11:00Z",
    }),
    investigations: [investigation],
    liveReasoning: [],
  });
  assert.ok(bridge);
  assert.deepEqual(
    bridge.steps.map((step) => [step.key, step.state]),
    [
      ["us-rates", "observed"],
      ["ust-jgb-gap", "observed"],
      ["usdjpy", "observed"],
      ["japan-flows", "observed"],
      ["risk-carry", "supported"],
    ],
  );
});
