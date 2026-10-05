import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  DossierPresentationInvestigation,
  DossierPresentationStory,
} from "../lib/dossier-v2/presentation-adapter.ts";
import { investigationMatchesRegimeSubgroup, routeDossierInvestigationToRegimes, routeDossierInvestigations } from "../lib/regime-investigations.ts";

function story(
  id: string,
  title: string,
  mechanism: string,
): DossierPresentationStory {
  return {
    id,
    title,
    whatChanged: title,
    whyItMatters: mechanism,
    mechanism,
    conclusion: mechanism,
    whatWouldChangeMind: "New evidence changes the mechanism.",
    epistemicLabel: "OBSERVED",
    evidenceRefs: [],
    investigationIds: [],
    chartIds: [],
  };
}

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
    candidateExplanations: [],
    researchNext: "Collect the missing evidence.",
    confirmationCondition: "Confirmation arrives.",
    invalidationCondition: "The mechanism reverses.",
    evidenceRefs: [],
    missingEvidence: [],
    chartIds: [],
    storyIds: [],
    thesisIds: [],
    reactionChecks: [],
    reactionCalibration: {
      basis: "SYSTEM1_REACTION_AUDIT",
      outcome: "UNRESOLVED",
      precision: "NONE",
      checkCount: 0,
      alignedCount: 0,
      divergentCount: 0,
      reactionWindows: [],
      expectationChanged: null,
      requiresReview: false,
    },
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

test("duration investigation routes through its linked analytical Dossier Story", () => {
  const linkedStory = story(
    "story:duration-broadening",
    "Duration and real-yield pressure has risen sharply",
    "Higher 10Y and 30Y real yields raise the long-end discount rate and tighten credit.",
  );
  const routes = routeDossierInvestigationToRegimes(
    investigation({
      id: "investigation:duration-transmission",
      question: "Could an unrelated formatting issue explain this?",
      storyIds: [linkedStory.id],
    }),
    [linkedStory],
  );

  assert.ok(routes.some((route) =>
    route.regime === "global-cost-of-capital" && route.subgroup === "long-end"
  ));
});

test("refined-product investigation routes through its linked Energy Story", () => {
  const linkedStory = story(
    "story:energy-product-vs-crude",
    "Refined-product stress remains stronger than crude",
    "Diesel, distillate inventories and crack spreads show physical product stress despite softer WTI.",
  );
  const routes = routeDossierInvestigationToRegimes(
    investigation({
      id: "investigation:energy-inflation",
      question: "Could this instead be a rates story?",
      storyIds: [linkedStory.id],
    }),
    [linkedStory],
  );

  assert.ok(routes.some((route) =>
    route.regime === "energy-security-inflation" && route.subgroup === "products"
  ));
});

test("investigation prose cannot invent a Regime route when linked Story identity is missing", () => {
  const routes = routeDossierInvestigationToRegimes(
    investigation({
      id: "investigation:orphan",
      question: "Are higher 10Y and 30Y real yields tightening credit and duration?",
      whyItMatters: "Long-end Treasury pressure could hit growth equities.",
      currentExplanation: "Real yields are rising and DXY is stronger.",
      researchNext: "Check US10Y, US30Y, MOVE and credit spreads.",
      storyIds: ["story:missing"],
    }),
    [],
  );

  assert.deepEqual(routes, []);
});


test("exact persistent Story identity still links an investigation when analytical routing is unavailable", () => {
  const [routed] = routeDossierInvestigations(
    [investigation({
      id: "investigation:persistent-story",
      storyIds: ["persistent-story-uuid"],
      question: "Could unrelated macro language appear here?",
    })],
    [],
  );

  assert.equal(
    investigationMatchesRegimeSubgroup(routed, {
      regime: "global-cost-of-capital",
      subgroup: "long-end",
      persistentStoryIds: ["persistent-story-uuid"],
    }),
    true,
  );
});

test("routed investigation preserves the exact analytical Dossier Story identities used for Regime placement", () => {
  const linkedStory = story(
    "story:duration-broadening",
    "Duration and real-yield pressure has risen sharply",
    "Higher 10Y and 30Y real yields raise the long-end discount rate and tighten credit.",
  );
  const [routed] = routeDossierInvestigations(
    [investigation({
      id: "investigation:duration-provenance",
      storyIds: [linkedStory.id, "story:missing"],
    })],
    [linkedStory],
  );

  assert.deepEqual(routed?.regimeRoutingStoryIds, [linkedStory.id]);
  assert.ok(routed?.regimeRoutes.some((route) =>
    route.regime === "global-cost-of-capital" && route.subgroup === "long-end"
  ));
});

test("missing analytical and persistent Story identity fails closed", () => {
  const [routed] = routeDossierInvestigations(
    [investigation({
      id: "investigation:no-route",
      storyIds: ["story:missing"],
      question: "Higher real yields, Treasury duration and credit are all mentioned here.",
    })],
    [],
  );

  assert.equal(
    investigationMatchesRegimeSubgroup(routed, {
      regime: "global-cost-of-capital",
      subgroup: "long-end",
      persistentStoryIds: ["different-story-uuid"],
    }),
    false,
  );
});
