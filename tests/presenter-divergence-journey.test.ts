import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { DossierPresentationInvestigation } from "../lib/dossier-v2/presentation-adapter.ts";
import { buildPresenterDivergenceJourney } from "../lib/presenter-divergence-journey.ts";

function investigation(): DossierPresentationInvestigation {
  return {
    id: "inv-divergence",
    status: "open",
    question: "Why did gold rise after the hawkish policy surprise?",
    whyItMatters: "The answer determines whether rates transmission failed or another mechanism offset it.",
    currentExplanation: "The hawkish impulse was offset in the measured window; the leading mechanism remains provisional.",
    expectedReaction: "Real yields and the dollar should rise while gold falls.",
    observedReaction: "Gold rose while the dollar weakened after the trigger.",
    divergence: "MATERIAL",
    competingExplanations: ["Positioning may have amplified the reversal."],
    candidateExplanations: [
      {
        rank: 1,
        explanation: "The policy action was already priced and the forward path was less hawkish than feared.",
        evidenceForRefs: ["ev-us2y", "ev-dxy"],
        evidenceAgainstRefs: ["ev-real-yield"],
        confidence: "MEDIUM",
        discriminatingTest: "Check whether front-end repricing and DXY remain softer into the next session.",
      },
      {
        rank: 2,
        explanation: "Short covering dominated the initial gold reaction.",
        evidenceForRefs: ["ev-gold-volume"],
        evidenceAgainstRefs: [],
        confidence: "LOW",
        discriminatingTest: "Check whether the rally fades as positioning normalises.",
      },
    ],
    researchNext: "Compare next-session rates, DXY and gold persistence.",
    confirmationCondition: "Gold remains firm while real yields and DXY stay softer.",
    invalidationCondition: "Gold reverses as real yields and DXY resume the hawkish move.",
    evidenceRefs: ["ev-trigger", "ev-us2y", "ev-dxy", "ev-real-yield", "ev-gold-volume"],
    missingEvidence: ["Options positioning"],
    chartIds: [],
    storyIds: ["story-gold-rates"],
    thesisIds: ["thesis-gold-rates"],
    reactionChecks: [
      {
        checkId: "check-gold",
        instrument: "XAUUSD",
        expectedDirection: "DOWN",
        observedDirection: "UP",
        observedChangePct: 0.8,
        observedInstrument: "GLD",
        isProxy: true,
        reactionWindow: "30m",
        reactionPath: [
          {
            window: "4h",
            baselineAt: "2026-10-02T13:59:00Z",
            observedAt: "2026-10-02T18:00:00Z",
            baseline: 100,
            observed: 100.4,
            changePct: 0.4,
            observedDirection: "UP",
          },
          {
            window: "5m",
            baselineAt: "2026-10-02T13:59:00Z",
            observedAt: "2026-10-02T14:05:00Z",
            baseline: 100,
            observed: 100.2,
            changePct: 0.2,
            observedDirection: "UP",
          },
          {
            window: "30m",
            baselineAt: "2026-10-02T13:59:00Z",
            observedAt: "2026-10-02T14:30:00Z",
            baseline: 100,
            observed: 100.8,
            changePct: 0.8,
            observedDirection: "UP",
          },
        ],
        relation: "DIVERGENT",
        timingPrecision: "INTRADAY",
        triggerEvidenceRef: "ev-trigger",
        marketEvidenceRef: "ev-gold",
      },
    ],
    reactionCalibration: {
      basis: "SYSTEM1_REACTION_AUDIT",
      outcome: "DIVERGENT",
      precision: "INTRADAY",
      checkCount: 1,
      alignedCount: 0,
      divergentCount: 1,
      reactionWindows: ["5m", "30m", "4h"],
      expectationChanged: true,
      requiresReview: true,
    },
    journey: {
      currentId: "inv-divergence",
      previousId: "inv-divergence",
      matchedBy: "id",
      transition: "DIVERGENCE_DETECTED",
      previousDivergence: "UNRESOLVED",
      currentDivergence: "MATERIAL",
      previousStatus: "open",
      currentStatus: "open",
      previousExpectedReaction: "A hawkish surprise should lift real yields and the dollar and pressure gold.",
      currentExpectedReaction: "Real yields and the dollar should rise while gold falls.",
      expectationChanged: true,
      question: "Why did gold rise after the hawkish policy surprise?",
    },
  };
}

test("Presenter journey preserves pre-tape expectation and keeps changed wording separate", () => {
  const [item] = buildPresenterDivergenceJourney([investigation()]);

  assert.equal(
    item.priorExpectedReaction,
    "A hawkish surprise should lift real yields and the dollar and pressure gold.",
  );
  assert.equal(item.currentExpectedReaction, "Real yields and the dollar should rise while gold falls.");
  assert.equal(item.expectationChanged, true);
  assert.equal(item.observedReaction, "Gold rose while the dollar weakened after the trigger.");
  assert.equal(item.divergence, "MATERIAL");
});

test("Presenter journey preserves reaction chronology instead of model output order", () => {
  const [item] = buildPresenterDivergenceJourney([investigation()]);

  assert.deepEqual(
    item.reactionPaths[0].points.map((point) => point.window),
    ["5m", "30m", "4h"],
  );
  assert.equal(item.reactionPaths[0].instrument, "XAUUSD");
  assert.equal(item.reactionPaths[0].observedInstrument, "GLD");
  assert.equal(item.reactionPaths[0].isProxy, true);
  assert.equal(item.reactionPaths[0].relation, "DIVERGENT");
});

test("Presenter journey exposes evidence-linked competing mechanisms and falsification", () => {
  const [item] = buildPresenterDivergenceJourney([investigation()]);

  assert.equal(item.mechanisms.length, 2);
  assert.deepEqual(item.mechanisms[0].evidenceForRefs, ["ev-us2y", "ev-dxy"]);
  assert.deepEqual(item.mechanisms[0].evidenceAgainstRefs, ["ev-real-yield"]);
  assert.match(item.mechanisms[0].discriminatingTest, /front-end repricing/i);
  assert.match(item.invalidationCondition, /Gold reverses/i);
  assert.match(item.confirmationCondition, /Gold remains firm/i);
  assert.equal(item.fallbackCompetingExplanations.length, 0);
});

test("Presenter journey falls back to compact competing prose without inventing structured candidates", () => {
  const source = investigation();
  source.candidateExplanations = [];

  const [item] = buildPresenterDivergenceJourney([source]);

  assert.deepEqual(item.mechanisms, []);
  assert.deepEqual(item.fallbackCompetingExplanations, ["Positioning may have amplified the reversal."]);
});

test("Hybrid renders unresolved mechanisms compactly through the shared presentation classifier", () => {
  const component = readFileSync(new URL("../components/live-desk/PresenterDivergenceJourney.tsx", import.meta.url), "utf8");

  assert.match(component, /buildDivergenceLabPresentation/);
  assert.match(component, /MECHANISM UNRESOLVED/);
  assert.match(component, /Structured mechanism evidence was not preserved/);
  assert.match(component, /Candidate-specific evidence not yet attached/);
  assert.doesNotMatch(component, /None supplied/);
});

test("Hybrid Presenter surface stays read-only and does not call reasoning or Research Gap execution", () => {
  const page = readFileSync(new URL("../app/hybrid-output/page.tsx", import.meta.url), "utf8");
  const component = readFileSync(new URL("../components/live-desk/PresenterDivergenceJourney.tsx", import.meta.url), "utf8");
  const projection = readFileSync(new URL("../lib/presenter-divergence-journey.ts", import.meta.url), "utf8");
  const combined = [page, component, projection].join("\n");

  assert.match(page, /PresenterDivergenceJourney/);
  assert.match(component, /Hybrid does not invent one/);
  assert.doesNotMatch(combined, /executeResearchBrain|runIntelligenceEngine|persistMarketDossierV2/);
  assert.doesNotMatch(combined, /\/api\/research-gap|\/api\/admin\/research-gap/);
});


test("P1.2 Presenter prefers exact canonical Story reasoning and keeps Dossier fields as fallback only", () => {
  const component = readFileSync(
    new URL("../components/live-desk/PresenterDivergenceJourney.tsx", import.meta.url),
    "utf8",
  );
  const page = readFileSync(
    new URL("../app/hybrid-output/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(component, /canonicalByInvestigationId/);
  assert.match(component, /canonical\?\.currentExplanation \?\? item\.provisionalConclusion/);
  assert.match(component, /canonical\.competingExplanations/);
  assert.match(component, /Hybrid does not revive older Dossier candidates/);
  assert.match(component, /canonical\.whatToInspectNext\.canonical/);
  assert.match(component, /canonical\.confirmation\.canonical/);
  assert.match(component, /canonical\.invalidation\.canonical/);
  assert.match(component, /CANONICAL STORY/);
  assert.match(component, /DOSSIER FALLBACK/);

  assert.match(page, /presenterStorySourcesFromEditionPayload\(selectedPresenterEdition\?\.payload\)/);
  assert.match(page, /buildPresenterCanonicalStoryCases\(\{/);
  assert.match(page, /canonicalCases=\{presenterCanonicalCases\}/);
});

test("P1.2 Presenter canonical wiring remains read-only and edition-bound", () => {
  const page = readFileSync(
    new URL("../app/hybrid-output/page.tsx", import.meta.url),
    "utf8",
  );
  const component = readFileSync(
    new URL("../components/live-desk/PresenterDivergenceJourney.tsx", import.meta.url),
    "utf8",
  );
  const bridge = readFileSync(
    new URL("../lib/presenter-canonical-story-bridge.ts", import.meta.url),
    "utf8",
  );
  const combined = [page, component, bridge].join("\n");

  assert.match(page, /currentEdition\?\.payload/);
  assert.doesNotMatch(combined, /executeDossierStoryCanonicalMutation/);
  assert.doesNotMatch(combined, /persistCanonicalStoryReasoning/);
  assert.doesNotMatch(combined, /apply_intelligence_story_assessment_v2/);
  assert.doesNotMatch(combined, /runIntelligenceEngine|executeResearchBrain/);
});
