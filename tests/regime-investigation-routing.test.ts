import assert from "node:assert/strict";
import { test } from "node:test";

import type { DossierPresentationInvestigation } from "../lib/dossier-v2/presentation-adapter.ts";
import { routeDossierInvestigationToRegimes } from "../lib/regime-investigations.ts";

function investigation(
  overrides: Partial<DossierPresentationInvestigation> = {},
): DossierPresentationInvestigation {
  return {
    id: "investigation:test",
    status: "open",
    question: "What is the market mechanism?",
    whyItMatters: "It may change the current regime.",
    currentExplanation: "Current evidence is incomplete.",
    expectedReaction: null,
    observedReaction: null,
    divergence: "UNRESOLVED",
    competingExplanations: [],
    researchNext: "Collect the missing evidence.",
    confirmationCondition: "Confirmation arrives.",
    invalidationCondition: "The mechanism reverses.",
    evidenceRefs: [],
    missingEvidence: [],
    chartIds: [],
    storyIds: [],
    thesisIds: [],
    reactionChecks: [],
    journey: {
      currentId: "investigation:test",
      previousId: null,
      matchedBy: null,
      transition: "BASELINE",
      previousDivergence: null,
      currentDivergence: "UNRESOLVED",
      previousStatus: null,
      currentStatus: "open",
      previousExpectedReaction: null,
      currentExpectedReaction: null,
      expectationChanged: null,
      question: "What is the market mechanism?",
    },
    ...overrides,
  };
}

test("duration investigation routes to the long-end Regime subgroup without persistent Story UUIDs", () => {
  const routes = routeDossierInvestigationToRegimes(investigation({
    id: "investigation:duration-transmission",
    question: "Is US duration/real-yield pressure transmitting into credit, volatility and broad equity breadth?",
    whyItMatters: "Transmission would convert a rates-led reprice into broader cyclical tightening.",
    currentExplanation: "Nominal and real yields are higher while credit remains contained.",
    expectedReaction: "Credit spreads widen and breadth deteriorates.",
    researchNext: "Pull MOVE/VIX, global 10Y yields, breadth and credit.",
    storyIds: ["story:duration-broadening"],
    thesisIds: ["thesis-ai-capital-scarcity"],
  }));

  assert.ok(routes.some((route) =>
    route.regime === "global-cost-of-capital" && route.subgroup === "long-end"
  ));
});

test("refined-product investigation routes to Energy products", () => {
  const routes = routeDossierInvestigationToRegimes(investigation({
    id: "investigation:energy-inflation",
    question: "Will refined-product stress in distillate and crack spreads sustain inflation?",
    currentExplanation: "Distillate cracks remain elevated while WTI has softened.",
    expectedReaction: "Persistent product tightness should keep breakevens and yields supported.",
    researchNext: "Check refinery utilisation, inventories and the crack curve.",
    storyIds: ["story:energy-product-vs-crude"],
  }));

  assert.ok(routes.some((route) =>
    route.regime === "energy-security-inflation" && route.subgroup === "products"
  ));
});

test("unrelated investigation does not receive a Regime route", () => {
  const routes = routeDossierInvestigationToRegimes(investigation({
    question: "Did an unrelated source formatting issue recur?",
    whyItMatters: "This is operational metadata only.",
    currentExplanation: "The parser output needs inspection.",
    researchNext: "Inspect parser logs.",
  }));

  assert.deepEqual(routes, []);
});
