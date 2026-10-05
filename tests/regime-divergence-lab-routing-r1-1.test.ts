import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type {
  DossierPresentationInvestigation,
} from "../lib/dossier-v2/presentation-adapter.ts";
import {
  buildRegimeDivergenceLabCases,
  REGIME_DIVERGENCE_LAB_ROUTE_VERSION,
} from "../lib/regime-divergence-lab.ts";
import {
  routeDossierInvestigations,
  type RoutedDossierInvestigation,
} from "../lib/regime-investigations.ts";

function investigation(
  overrides: Partial<DossierPresentationInvestigation> = {},
): DossierPresentationInvestigation {
  return {
    id: "investigation:test",
    status: "open",
    question: "Why did the tape diverge from expectation?",
    whyItMatters: "The mechanism determines whether the current Regime transmission is changing.",
    currentExplanation: "Evidence remains incomplete.",
    expectedReaction: "Long-end yields ease.",
    observedReaction: "Long-end yields stayed elevated.",
    divergence: "MATERIAL",
    competingExplanations: ["Term premium", "Positioning"],
    candidateExplanations: [{
      rank: 1,
      explanation: "Term premium remained elevated.",
      evidenceForRefs: ["ev-1"],
      evidenceAgainstRefs: [],
      confidence: "MEDIUM",
      discriminatingTest: "Check real yields and auction/supply evidence.",
    }],
    researchNext: "Check real yields and auction/supply evidence.",
    confirmationCondition: "Term-premium evidence strengthens.",
    invalidationCondition: "Long-end yields fall with no supply pressure.",
    evidenceRefs: ["ev-1"],
    missingEvidence: ["term premium"],
    chartIds: [],
    storyIds: [],
    thesisIds: [],
    reactionChecks: [],
    reactionCalibration: {
      basis: "SYSTEM1_REACTION_AUDIT",
      outcome: "DIVERGENT",
      precision: "NONE",
      checkCount: 0,
      alignedCount: 0,
      divergentCount: 0,
      reactionWindows: [],
      expectationChanged: false,
      requiresReview: true,
    },
    journey: {
      currentId: "investigation:test",
      previousId: "investigation:test",
      matchedBy: "id",
      transition: "DIVERGENCE_DETECTED",
      previousDivergence: "UNRESOLVED",
      currentDivergence: "MATERIAL",
      previousStatus: "open",
      currentStatus: "open",
      previousExpectedReaction: "Long-end yields ease.",
      currentExpectedReaction: "Long-end yields ease.",
      expectationChanged: false,
      question: "Why did the tape diverge from expectation?",
    },
    ...overrides,
  };
}

function routed(
  overrides: Partial<RoutedDossierInvestigation> = {},
): RoutedDossierInvestigation {
  return {
    ...investigation(),
    regimeRoutes: [],
    regimeRoutingStoryIds: [],
    ...overrides,
  };
}

test("R1.1 exact persistent Story identity is the preferred Regime Divergence Lab route", () => {
  const [item] = buildRegimeDivergenceLabCases({
    regime: "global-cost-of-capital",
    subgroup: "long-end",
    persistentStoryIds: ["persistent-story-uuid"],
    investigations: [routed({
      id: "investigation:persistent",
      storyIds: ["persistent-story-uuid"],
      regimeRoutes: [{
        regime: "global-cost-of-capital",
        subgroup: "long-end",
        role: "supporting",
        score: 4,
      }],
      regimeRoutingStoryIds: ["story:analytical-rates"],
    })],
  });

  assert.ok(item);
  assert.equal(item.contractVersion, REGIME_DIVERGENCE_LAB_ROUTE_VERSION);
  assert.equal(item.routeBasis, "PERSISTENT_STORY_ID");
  assert.deepEqual(item.routeStoryIds, ["persistent-story-uuid"]);
  assert.equal(item.presentationAuthority, "CONTEXT_ONLY");
  assert.equal(item.lab.mode, "full");
});

test("R1.1 linked analytical Dossier Story routing is a bounded presentation fallback", () => {
  const story = {
    id: "story:duration-broadening",
    title: "Duration and real-yield pressure remains elevated",
    whatChanged: "Long-end yields stayed high.",
    whyItMatters: "Higher real yields tighten financing conditions.",
    mechanism: "Real yields and term premium transmit into the cost of capital.",
    conclusion: "Long-end pressure remains a live constraint.",
    whatWouldChangeMind: "A durable reversal in real yields.",
    epistemicLabel: "SUPPORTED" as const,
    evidenceRefs: ["ev-1"],
    investigationIds: ["investigation:test"],
    chartIds: [],
  };
  const [routedItem] = routeDossierInvestigations([
    investigation({
      storyIds: [story.id],
    }),
  ], [story]);

  const [item] = buildRegimeDivergenceLabCases({
    regime: "global-cost-of-capital",
    subgroup: "long-end",
    persistentStoryIds: [],
    investigations: [routedItem!],
  });

  assert.ok(item);
  assert.equal(item.routeBasis, "ANALYTICAL_STORY_ROUTE");
  assert.deepEqual(item.routeStoryIds, [story.id]);
  assert.equal(item.presentationAuthority, "CONTEXT_ONLY");
});

test("R1.1 investigation prose alone cannot create a Regime Divergence Lab route", () => {
  const cases = buildRegimeDivergenceLabCases({
    regime: "global-cost-of-capital",
    subgroup: "long-end",
    persistentStoryIds: [],
    investigations: [routed({
      question: "Are higher real yields and Treasury supply tightening the long end?",
      whyItMatters: "This sounds exactly like the rates Regime.",
      currentExplanation: "Term premium may be rising.",
      storyIds: ["story:missing"],
      regimeRoutes: [],
      regimeRoutingStoryIds: [],
    })],
  });

  assert.deepEqual(cases, []);
});

test("R1.1 analytical route requires an actual linked Dossier Story provenance identity", () => {
  const cases = buildRegimeDivergenceLabCases({
    regime: "global-cost-of-capital",
    subgroup: "long-end",
    persistentStoryIds: [],
    investigations: [routed({
      storyIds: ["story:missing"],
      regimeRoutes: [{
        regime: "global-cost-of-capital",
        subgroup: "long-end",
        role: "supporting",
        score: 8,
      }],
      regimeRoutingStoryIds: [],
    })],
  });

  assert.deepEqual(cases, []);
});

test("R1.1 projection is read-only and Regime state remains Story/telemetry owned", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const projection = fs.readFileSync(
    path.join(root, "lib", "regime-divergence-lab.ts"),
    "utf8",
  );
  const workspace = fs.readFileSync(
    path.join(root, "components", "live-desk", "RegimeDetailWorkspace.tsx"),
    "utf8",
  );
  const regimes = fs.readFileSync(
    path.join(root, "lib", "regimes.ts"),
    "utf8",
  );

  assert.match(workspace, /buildRegimeDivergenceLabCases/);
  assert.match(workspace, /linked Dossier Story route/);
  assert.match(workspace, /context only/);
  assert.doesNotMatch(projection, /buildRegimeProjection|deriveInterpretedState/);
  assert.doesNotMatch(projection, /persist|update|insert|intelligenceRest|supabase|fetch\(/i);
  assert.doesNotMatch(regimes, /buildRegimeDivergenceLabCases/);
});
