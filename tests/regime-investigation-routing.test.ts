import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildDossierInvestigationRouteMap,
} from "../lib/regime-investigation-routing.ts";
import type {
  DossierPresentationInvestigation,
  DossierPresentationStory,
} from "../lib/dossier-v2/presentation-adapter.ts";

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
    whatWouldChangeMind: "New evidence.",
    epistemicLabel: "OBSERVED",
    evidenceRefs: [],
    investigationIds: [],
    chartIds: [],
  };
}

function investigation(
  id: string,
  storyIds: string[],
  question = "Could this be about something else?",
): DossierPresentationInvestigation {
  return {
    id,
    status: "open",
    question,
    whyItMatters: "Important.",
    currentExplanation: "Unresolved.",
    expectedReaction: null,
    observedReaction: null,
    divergence: "UNRESOLVED",
    competingExplanations: [],
    researchNext: "Check.",
    confirmationCondition: "Confirm.",
    invalidationCondition: "Invalidate.",
    evidenceRefs: [],
    missingEvidence: [],
    chartIds: [],
    storyIds,
    thesisIds: [],
  };
}

test("Dossier investigation routes through its linked analytical Story identity", () => {
  const routes = buildDossierInvestigationRouteMap({
    stories: [
      story(
        "story:duration-broadening",
        "Duration and real-yield pressure has risen sharply",
        "Higher 10Y and 30Y real yields raise the long-end discount rate and tighten credit.",
      ),
    ],
    investigations: [
      investigation("investigation:duration-transmission", ["story:duration-broadening"]),
    ],
  });

  assert.ok(
    routes["investigation:duration-transmission"]?.includes("global-cost-of-capital:long-end"),
  );
});

test("unlinked investigation prose cannot invent a Regime route", () => {
  const routes = buildDossierInvestigationRouteMap({
    stories: [],
    investigations: [
      investigation(
        "investigation:orphan",
        ["story:missing"],
        "Oil, gold and Treasury yields all moved.",
      ),
    ],
  });

  assert.deepEqual(routes["investigation:orphan"], []);
});
