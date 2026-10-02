import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { RoutedDossierInvestigation } from "../lib/regime-investigations.ts";
import type { RegimeLiveStoryReasoning } from "../lib/regime-live-reasoning.ts";
import { buildUnderstandLiveBridge } from "../lib/regime-understand-live-bridge.ts";
import type { ProjectedRegimeSubgroup } from "../lib/regimes.ts";

function subgroup(): ProjectedRegimeSubgroup {
  return {
    key: "long-end",
    label: "Long End / Term Premium",
    accent: "orange",
    whyItMatters: "The 10Y/30Y anchor mortgages, corporate finance and discount rates.",
    mechanism: "Inflation + supply + real yields + term premium → 10Y/30Y → economy-wide cost of capital.",
    state: "Restrictive / tighter",
    stateKind: "system1",
    stories: [{
      id: "story-1",
      slug: "rates-story",
      title: "Treasury supply keeps duration pressure elevated",
      thesis: "Long-end financing pressure remains durable.",
      question: "Is supply still lifting term premium?",
      confidence: 78,
      lifecycle: "active",
      editorialVerdict: "persist",
      assets: ["US10Y", "US30Y"],
      versionId: "version-1",
      versionNumber: 2,
      routes: [],
      maturity: "durable",
      contributesToState: true,
      maturityReason: "Accepted persistent Story.",
      hybridHref: "/hybrid-output?story=rates-story",
    }],
    durableStories: [{
      id: "story-1",
      slug: "rates-story",
      title: "Treasury supply keeps duration pressure elevated",
      thesis: "Long-end financing pressure remains durable.",
      question: "Is supply still lifting term premium?",
      confidence: 78,
      lifecycle: "active",
      editorialVerdict: "persist",
      assets: ["US10Y", "US30Y"],
      versionId: "version-1",
      versionNumber: 2,
      routes: [],
      maturity: "durable",
      contributesToState: true,
      maturityReason: "Accepted persistent Story.",
      hybridHref: "/hybrid-output?story=rates-story",
    }],
    contextStories: [],
    nodes: [{
      id: "event-1",
      title: "Weak auction lifts long yields",
      detail: "The latest auction tailed and long-end yields rose.",
      timestamp: "2026-10-02T19:00:00Z",
      state: "supports",
      sourceKind: "story_event",
      verification: "supports",
      storyId: "story-1",
      storySlug: "rates-story",
      href: "/stories/rates-story#event-1",
      hybridHref: "/hybrid-output?event=event-1",
    }],
    telemetry: [{
      key: "LONG_END",
      label: "Long end",
      state: "Restrictive",
      detail: "30Y yields remain elevated.",
      asOf: "2026-10-02T19:05:00Z",
      source: "rate-regime/1",
    }],
    latestAt: "2026-10-02T19:05:00Z",
  };
}

function reasoning(): RegimeLiveStoryReasoning[] {
  return [{
    storyId: "story-1",
    hypothesisId: "hyp-1",
    question: "Is Treasury absorption lifting the term premium?",
    statement: "Duration supply remains difficult to absorb.",
    mechanism: "Heavy coupon supply → higher required yield → tighter borrowing conditions.",
    confidence: 82,
    decisionState: "provisional",
    updatedAt: "2026-10-02T19:10:00Z",
    causalChain: [
      {
        from: "Treasury supply",
        relationship: "raises required compensation",
        to: "long-end yields",
        evidenceState: "strongly_supported",
        evidenceCount: 3,
      },
      {
        from: "long-end yields",
        relationship: "transmit into",
        to: "borrowing costs",
        evidenceState: "inferred",
        evidenceCount: 1,
      },
    ],
  }];
}

function investigation(divergence: RoutedDossierInvestigation["divergence"], id: string): RoutedDossierInvestigation {
  return {
    id,
    status: "open",
    question: "Is duration pressure transmitting into broader financial conditions?",
    whyItMatters: "Transmission determines whether the rates shock reaches risk assets.",
    currentExplanation: "Transmission is incomplete.",
    expectedReaction: "Credit spreads widen and breadth weakens.",
    observedReaction: "Credit remains contained.",
    divergence,
    competingExplanations: [],
    candidateExplanations: [],
    researchNext: "Check credit, housing and equity breadth.",
    confirmationCondition: "Credit spreads widen as yields remain elevated.",
    invalidationCondition: "Long yields fall and credit stays contained.",
    evidenceRefs: [],
    missingEvidence: [],
    chartIds: [],
    storyIds: ["story-1"],
    thesisIds: [],
    reactionChecks: [],
    reactionCalibration: {
      basis: "SYSTEM1_REACTION_AUDIT",
      outcome: divergence === "MATERIAL" ? "DIVERGENT" : "UNRESOLVED",
      precision: "NONE",
      checkCount: 0,
      alignedCount: 0,
      divergentCount: 0,
      reactionWindows: [],
      expectationChanged: false,
      requiresReview: divergence !== "NONE",
    },
    journey: {
      currentId: id,
      previousId: id,
      matchedBy: "id",
      transition: "UNCHANGED",
      previousDivergence: divergence,
      currentDivergence: divergence,
      previousStatus: "open",
      currentStatus: "open",
      previousExpectedReaction: "Credit spreads should widen.",
      currentExpectedReaction: "Credit spreads widen and breadth weakens.",
      expectationChanged: true,
      question: "Is duration pressure transmitting into broader financial conditions?",
    },
    regimeRoutes: [],
  };
}

test("UNDERSTAND to LIVE bridge preserves governed structure and persisted live reasoning", () => {
  const bridge = buildUnderstandLiveBridge({
    subgroup: subgroup(),
    liveReasoning: reasoning(),
    investigations: [investigation("PARTIAL", "inv-1")],
  });

  assert.match(bridge.structuralMechanism, /term premium/);
  assert.equal(bridge.liveStory?.storyId, "story-1");
  assert.match(bridge.liveStory?.mechanism ?? "", /Heavy coupon supply/);
  assert.equal(bridge.latestContribution?.id, "event-1");
  assert.equal(bridge.coverage.supportedEdgeCount, 1);
  assert.equal(bridge.coverage.inferredEdgeCount, 1);
});

test("bridge selects the highest-severity exact linked investigation as the next test", () => {
  const bridge = buildUnderstandLiveBridge({
    subgroup: subgroup(),
    liveReasoning: reasoning(),
    investigations: [
      investigation("PARTIAL", "inv-partial"),
      investigation("MATERIAL", "inv-material"),
      { ...investigation("MATERIAL", "inv-other-story"), storyIds: ["story-other"] },
    ],
  });

  assert.equal(bridge.nextTest?.investigationId, "inv-material");
  assert.equal(bridge.nextTest?.expectedReaction, "Credit spreads should widen.");
  assert.match(bridge.nextTest?.invalidationCondition ?? "", /Long yields fall/);
});

test("bridge fails closed when no durable Story has persisted reasoning or an exact linked investigation", () => {
  const bridge = buildUnderstandLiveBridge({
    subgroup: subgroup(),
    liveReasoning: [{ ...reasoning()[0], storyId: "story-other" }],
    investigations: [{ ...investigation("MATERIAL", "inv-other"), storyIds: ["story-other"] }],
  });

  assert.equal(bridge.liveStory, null);
  assert.equal(bridge.nextTest, null);
  assert.equal(bridge.latestContribution?.id, "event-1");
});

test("UNDERSTAND to LIVE UI remains read-only and does not trigger research or persistence", () => {
  const workspace = readFileSync(new URL("../components/live-desk/RegimeDetailWorkspace.tsx", import.meta.url), "utf8");
  const component = readFileSync(new URL("../components/live-desk/RegimeUnderstandLiveBridge.tsx", import.meta.url), "utf8");
  const projection = readFileSync(new URL("../lib/regime-understand-live-bridge.ts", import.meta.url), "utf8");
  const combined = [workspace, component, projection].join("\n");

  assert.match(workspace, /RegimeUnderstandLiveBridge/);
  assert.match(component, /UNDERSTAND → LIVE/);
  assert.match(component, /LIVE does not invent a test/);
  assert.doesNotMatch(combined, /executeResearchBrain|runIntelligenceEngine|persistMarketDossierV2/);
  assert.doesNotMatch(combined, /\/api\/research-gap|\/api\/admin\/research-gap/);
});
