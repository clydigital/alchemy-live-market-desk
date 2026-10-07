import type {
  DossierPresentationInvestigation,
  DossierPresentationV1,
} from "./presentation-adapter.ts";
import type {
  HybridEvidenceClassification,
  HybridReasoningProjection,
  HybridStoryClassification,
} from "../hybrid-reasoning-projection.ts";
import type { ProjectedRegime } from "../regimes.ts";

export const D7_CROSS_LAYER_DIVERGENCE_VERSION =
  "d7-cross-layer-divergence/1" as const;

export type D7DivergenceState =
  | "ALIGNMENT"
  | "CONTRADICTION"
  | "LAG"
  | "UNRESOLVED";

export type D7DivergenceSeverity = "LOW" | "MEDIUM" | "HIGH";

export type D7DivergencePair =
  | "DOSSIER_STORY"
  | "STORY_REGIME"
  | "REGIME_HYBRID"
  | "DOSSIER_MARKET"
  | "STORY_MARKET"
  | "EXPECTATION_MARKET";

export type D7DivergenceCase = {
  id: string;
  pair: D7DivergencePair;
  state: D7DivergenceState;
  severity: D7DivergenceSeverity;
  reason: string;
  analyticalStoryId: string | null;
  persistentStoryId: string | null;
  investigationId: string | null;
  regimeSlug: string | null;
  evidenceRefs: string[];
  researchEligible: boolean;
};

export type D7StoryReviewClock = {
  storyId: string;
  evaluatedAt: string | null;
  basis: "story_review" | "hypothesis_update" | "unavailable";
  hasPrimaryHypothesis: boolean;
};

export type D7CrossLayerDivergenceSnapshot = {
  contractVersion: typeof D7_CROSS_LAYER_DIVERGENCE_VERSION;
  asOf: string;
  cases: D7DivergenceCase[];
  summary: Record<D7DivergenceState, number>;
  mutationBoundary: {
    mode: "READ_ONLY";
    statement: string;
  };
};

type Direction = NonNullable<
  DossierPresentationV1["evidenceSufficiency"]
>["stories"][number]["direction"];

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

function caseId(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(":");
}

function evidenceDirectionPolarity(direction: Direction) {
  if (direction === "STRENGTHEN") return 1;
  if (direction === "WEAKEN") return -1;
  return 0;
}

function storyClassificationPolarity(
  classification: HybridEvidenceClassification,
) {
  if (classification === "CONFIRMING" || classification === "ACCELERATING") {
    return 1;
  }
  if (
    classification === "CONTRADICTING"
    || classification === "INVALIDATING"
  ) {
    return -1;
  }
  return 0;
}

function severityForInvestigation(
  investigation: DossierPresentationInvestigation,
): D7DivergenceSeverity {
  if (investigation.divergence === "MATERIAL") return "HIGH";
  if (investigation.divergence === "PARTIAL") return "MEDIUM";
  return "LOW";
}

function stateFromReaction(
  outcome: DossierPresentationInvestigation["reactionCalibration"]["outcome"],
): D7DivergenceState {
  if (outcome === "ALIGNED") return "ALIGNMENT";
  if (outcome === "DIVERGENT") return "CONTRADICTION";
  return "UNRESOLVED";
}

function reactionEvidenceRefs(investigation: DossierPresentationInvestigation) {
  return unique(
    investigation.reactionChecks.flatMap((check) => [
      check.triggerEvidenceRef,
      check.marketEvidenceRef,
    ]),
  );
}

function dossierStoryCases(
  dossier: DossierPresentationV1,
  reviewClocks: D7StoryReviewClock[],
): D7DivergenceCase[] {
  const sufficiency = dossier.evidenceSufficiency?.stories ?? [];
  const reviewByStory = new Map(
    reviewClocks.map((item) => [item.storyId, item]),
  );
  const dossierAsOf = Date.parse(dossier.asOf);

  return sufficiency.map((item) => {
    const persistentStoryId = item.persistentStoryId ?? null;
    const dossierPolarity = evidenceDirectionPolarity(item.direction);
    const reviewClock = persistentStoryId
      ? reviewByStory.get(persistentStoryId) ?? null
      : null;
    const reviewedAt = reviewClock?.evaluatedAt
      ? Date.parse(reviewClock.evaluatedAt)
      : Number.NaN;
    const acceptedReviewCoversDossier =
      reviewClock?.basis === "story_review"
      && reviewClock.hasPrimaryHypothesis
      && Number.isFinite(reviewedAt)
      && Number.isFinite(dossierAsOf)
      && reviewedAt >= dossierAsOf;

    let state: D7DivergenceState = "UNRESOLVED";
    let reason =
      "The Dossier does not have enough directional evidence to require Story synchronization.";

    if (!persistentStoryId) {
      reason =
        "The analytical Dossier Story has no exact persistent Story binding.";
    } else if (item.direction === "UNRESOLVED") {
      reason = "The Dossier evidence delta itself is unresolved.";
    } else if (dossierPolarity === 0) {
      state = "ALIGNMENT";
      reason =
        "The Dossier has no directional evidence delta requiring a new Story adjudication.";
    } else if (acceptedReviewCoversDossier) {
      state = "ALIGNMENT";
      reason =
        "The directional Dossier evidence delta has already received an accepted canonical Story review at or after this Dossier snapshot.";
    } else {
      state = "LAG";
      reason =
        "The Dossier has a directional evidence delta that has not yet received an accepted canonical Story review at or after this Dossier snapshot.";
    }

    const evidenceRefs = unique([
      ...item.activeSupportingEvidenceRefs,
      ...item.activeContradictingEvidenceRefs,
      ...item.acceleratingEvidenceRefs,
    ]);

    return {
      id: caseId(["d7", "dossier-story", item.analyticalStoryId]),
      pair: "DOSSIER_STORY",
      state,
      severity: state === "LAG" ? "MEDIUM" : "LOW",
      reason,
      analyticalStoryId: item.analyticalStoryId,
      persistentStoryId,
      investigationId: null,
      regimeSlug: null,
      evidenceRefs,
      // Dossier→Story synchronization belongs to the existing A3 Story-review
      // path. D7 surfaces lag but must not create a second web-research path.
      researchEligible: false,
    };
  });
}

function storyRegimeCases(
  hybrid: HybridReasoningProjection,
  regimes: ProjectedRegime[],
): D7DivergenceCase[] {
  const regimeMembership = new Map<
    string,
    { contributes: boolean; regimes: Set<string> }
  >();

  for (const regime of regimes) {
    for (const story of regime.stories) {
      const current = regimeMembership.get(story.id) ?? {
        contributes: false,
        regimes: new Set<string>(),
      };
      current.regimes.add(regime.slug);
      current.contributes = current.contributes || story.contributesToState;
      regimeMembership.set(story.id, current);
    }
  }

  return hybrid.storyClassifications.map((classification) => {
    const membership = regimeMembership.get(classification.storyId) ?? null;
    const polarity = storyClassificationPolarity(classification.classification);
    let state: D7DivergenceState = "UNRESOLVED";
    let reason =
      "Canonical Story state does not establish a directional Regime comparison.";

    if (!membership || membership.regimes.size === 0) {
      reason =
        "The exact persistent Story is not represented in any current Regime projection.";
    } else if (classification.classification === "UNRESOLVED") {
      reason = "Canonical Story state remains unresolved.";
    } else if (polarity > 0 && membership.contributes) {
      state = "ALIGNMENT";
      reason =
        "A strengthening canonical Story is already contributing to Regime state.";
    } else if (polarity > 0 && !membership.contributes) {
      state = "LAG";
      reason =
        "The canonical Story strengthened but remains context-only in Regime state.";
    } else if (polarity < 0 && membership.contributes) {
      state = "LAG";
      reason =
        "The canonical Story weakened or invalidated while Regime state still counts it as contributing.";
    } else if (polarity < 0 && !membership.contributes) {
      state = "ALIGNMENT";
      reason =
        "A weakening canonical Story is already excluded from Regime state contribution.";
    }

    return {
      id: caseId(["d7", "story-regime", classification.storyId]),
      pair: "STORY_REGIME",
      state,
      severity: state === "LAG" ? "MEDIUM" : "LOW",
      reason,
      analyticalStoryId: null,
      persistentStoryId: classification.storyId,
      investigationId: null,
      regimeSlug:
        membership && membership.regimes.size === 1
          ? [...membership.regimes][0]!
          : null,
      evidenceRefs: [],
      researchEligible: state === "LAG",
    };
  });
}

function hasTransfer(
  hybrid: HybridReasoningProjection,
  donor: "A" | "B" | "C" | "D" | "E",
  recipient: "A" | "B" | "C" | "D" | "E",
) {
  return hybrid.scenarios.transfers.some(
    (item) =>
      item.donor === donor && item.recipient === recipient && item.amount > 0,
  );
}

function regimeHybridCase(
  dossier: DossierPresentationV1,
  hybrid: HybridReasoningProjection,
): D7DivergenceCase {
  const family = dossier.header.regimeFamily;
  let state: D7DivergenceState = "UNRESOLVED";
  let reason =
    "The current Regime family has no deterministic Hybrid transition contract.";

  if (family === "RATES_LED_TIGHTENING") {
    if (hasTransfer(hybrid, "A", "B")) {
      state = "ALIGNMENT";
      reason =
        "Rates-led tightening is reflected by the governed A → B Hybrid transfer.";
    } else if (hasTransfer(hybrid, "B", "A")) {
      state = "CONTRADICTION";
      reason =
        "Hybrid moved B → A while the Dossier Regime remains rates-led tightening.";
    } else {
      state = "LAG";
      reason =
        "Rates-led tightening is active but Hybrid did not apply its governed A → B transition.";
    }
  } else if (family === "GROWTH_SCARE_RISK_OFF") {
    if (hasTransfer(hybrid, "B", "C")) {
      state = "ALIGNMENT";
      reason =
        "Growth-scare risk-off is reflected by the governed B → C Hybrid transfer.";
    } else if (hasTransfer(hybrid, "C", "B")) {
      state = "CONTRADICTION";
      reason =
        "Hybrid moved C → B while the Dossier Regime remains growth-scare risk-off.";
    } else {
      state = "LAG";
      reason =
        "Growth-scare risk-off is active but Hybrid did not apply its governed B → C transition.";
    }
  }

  return {
    id: caseId(["d7", "regime-hybrid", family]),
    pair: "REGIME_HYBRID",
    state,
    severity:
      state === "CONTRADICTION"
        ? "HIGH"
        : state === "LAG"
          ? "MEDIUM"
          : "LOW",
    reason,
    analyticalStoryId: null,
    persistentStoryId: null,
    investigationId: null,
    regimeSlug: family,
    evidenceRefs: [],
    researchEligible: state === "CONTRADICTION" || state === "LAG",
  };
}

function dossierMarketCase(
  dossier: DossierPresentationV1,
): D7DivergenceCase {
  const outcome = dossier.longitudinalAdjudication?.reactionOutcome ?? null;
  let state: D7DivergenceState = "UNRESOLVED";
  let reason =
    "No exact-prior Dossier market adjudication is available for comparison.";

  if (outcome === "CONFIRMED") {
    state = "ALIGNMENT";
    reason =
      "Measured market reactions confirmed the prior Dossier expectations.";
  } else if (outcome === "CONTRADICTED") {
    state = "CONTRADICTION";
    reason =
      "Measured market reactions contradicted the prior Dossier expectations.";
  } else if (outcome === "PARTIALLY_CONFIRMED") {
    reason =
      "Measured market reactions only partially confirmed the prior Dossier expectations.";
  } else if (outcome === "UNRESOLVED") {
    reason =
      "Measured market reactions remain insufficient to adjudicate the prior Dossier expectations.";
  }

  return {
    id: "d7:dossier-market",
    pair: "DOSSIER_MARKET",
    state,
    severity: state === "CONTRADICTION" ? "HIGH" : "LOW",
    reason,
    analyticalStoryId: null,
    persistentStoryId: null,
    investigationId: null,
    regimeSlug: null,
    evidenceRefs: unique(
      dossier.investigationAudit.flatMap(reactionEvidenceRefs),
    ),
    researchEligible: state === "CONTRADICTION",
  };
}

function expectationMarketCases(
  dossier: DossierPresentationV1,
): D7DivergenceCase[] {
  return dossier.investigationAudit
    .filter((item) => item.expectedReaction !== null)
    .map((item) => {
      const state = stateFromReaction(item.reactionCalibration.outcome);
      return {
        id: caseId(["d7", "expectation-market", item.id]),
        pair: "EXPECTATION_MARKET" as const,
        state,
        severity: severityForInvestigation(item),
        reason:
          state === "ALIGNMENT"
            ? "Observed market reaction aligned with the governed expectation."
            : state === "CONTRADICTION"
              ? "Observed market reaction diverged from the governed expectation."
              : "The governed expectation cannot yet be decisively compared with market reaction.",
        analyticalStoryId: null,
        persistentStoryId: null,
        investigationId: item.id,
        regimeSlug: null,
        evidenceRefs: reactionEvidenceRefs(item),
        researchEligible:
          state === "CONTRADICTION"
          || (
            state === "UNRESOLVED"
            && item.divergence !== "NONE"
          ),
      };
    });
}

function storyMarketCases(
  dossier: DossierPresentationV1,
): D7DivergenceCase[] {
  const byAnalyticalId = new Map(
    dossier.whatMattersNow.stories.map((story) => [story.id, story]),
  );
  const byPersistentId = new Map(
    dossier.whatMattersNow.stories.flatMap((story) =>
      story.persistentStoryId
        ? [[story.persistentStoryId, story] as const]
        : []
    ),
  );

  const cases: D7DivergenceCase[] = [];

  for (const investigation of dossier.investigationAudit) {
    if (investigation.expectedReaction === null) continue;
    const state = stateFromReaction(investigation.reactionCalibration.outcome);

    for (const linkedStoryId of unique(investigation.storyIds)) {
      const story =
        byAnalyticalId.get(linkedStoryId)
        ?? byPersistentId.get(linkedStoryId)
        ?? null;
      const persistentStoryId = story?.persistentStoryId ?? null;
      cases.push({
        id: caseId([
          "d7",
          "story-market",
          investigation.id,
          linkedStoryId,
        ]),
        pair: "STORY_MARKET",
        state: persistentStoryId ? state : "UNRESOLVED",
        severity: severityForInvestigation(investigation),
        reason: persistentStoryId
          ? state === "ALIGNMENT"
            ? "Market reaction aligned with an expectation linked to this exact persistent Story."
            : state === "CONTRADICTION"
              ? "Market reaction contradicted an expectation linked to this exact persistent Story."
              : "Market reaction linked to this exact persistent Story remains unresolved."
          : "The linked analytical Story has no exact persistent Story binding.",
        analyticalStoryId: story?.id ?? linkedStoryId,
        persistentStoryId,
        investigationId: investigation.id,
        regimeSlug: null,
        evidenceRefs: reactionEvidenceRefs(investigation),
        researchEligible:
          Boolean(persistentStoryId)
          && (
            state === "CONTRADICTION"
            || (
              state === "UNRESOLVED"
              && investigation.divergence !== "NONE"
            )
          ),
      });
    }
  }

  return cases;
}

export function buildD7CrossLayerDivergence(input: {
  dossier: DossierPresentationV1;
  hybrid: HybridReasoningProjection;
  regimes: ProjectedRegime[];
  storyReviewClocks?: D7StoryReviewClock[];
}): D7CrossLayerDivergenceSnapshot {
  const cases = [
    ...dossierStoryCases(input.dossier, input.storyReviewClocks ?? []),
    ...storyRegimeCases(input.hybrid, input.regimes),
    regimeHybridCase(input.dossier, input.hybrid),
    dossierMarketCase(input.dossier),
    ...storyMarketCases(input.dossier),
    ...expectationMarketCases(input.dossier),
  ];

  const summary: Record<D7DivergenceState, number> = {
    ALIGNMENT: 0,
    CONTRADICTION: 0,
    LAG: 0,
    UNRESOLVED: 0,
  };
  for (const item of cases) summary[item.state] += 1;

  return {
    contractVersion: D7_CROSS_LAYER_DIVERGENCE_VERSION,
    asOf: input.dossier.asOf,
    cases,
    summary,
    mutationBoundary: {
      mode: "READ_ONLY",
      statement:
        "D7 compares governed Dossier, Story, Regime, Hybrid and measured-market state. It does not mutate any layer or create evidence.",
    },
  };
}
