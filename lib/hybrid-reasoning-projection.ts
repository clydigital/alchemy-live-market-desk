import type { Story } from "./data.ts";
import type { DossierPresentationV1 } from "./dossier-v2/presentation-adapter.ts";
import type { StoryEvent, StoryThesisVersion } from "./persistence/contracts.ts";
import { routeStoryToRegimes } from "./regimes.ts";

export const HYBRID_REASONING_PROJECTION_V1 = "hybrid-reasoning-projection/1" as const;

export type HybridEvidenceClassification =
  | "CONFIRMING"
  | "CONTRADICTING"
  | "ACCELERATING"
  | "INVALIDATING"
  | "UNRESOLVED";

export type HybridScenarioKey = "A" | "B" | "C" | "D" | "E";

export type HybridScenarioProbabilities = Record<HybridScenarioKey, number>;

export type HybridStoryClassification = {
  storyId: string;
  storySlug: string;
  title: string;
  classification: HybridEvidenceClassification;
  reason: string;
  canonicalEvidenceCount: number;
  latestEventAt: string | null;
  latestVersionNumber: number | null;
};

export type HybridScenarioProjection = {
  starting: HybridScenarioProbabilities;
  current: HybridScenarioProbabilities;
  delta: HybridScenarioProbabilities;
  reasons: string[];
  guardedTails: string[];
};

export type HybridReasoningProjection = {
  contractVersion: typeof HYBRID_REASONING_PROJECTION_V1;
  asOf: string;
  storyClassifications: HybridStoryClassification[];
  scenarios: HybridScenarioProjection;
  mutationBoundary: {
    mode: "A3_QUEUE_ONLY";
    statement: string;
    path: string[];
  };
};

const STARTING_PRIORS: HybridScenarioProbabilities = {
  A: 30,
  B: 40,
  C: 20,
  D: 8,
  E: 2,
};

function atOrBefore(value: string, asOf: string) {
  const valueMs = Date.parse(value);
  const asOfMs = Date.parse(asOf);
  return Number.isFinite(valueMs) && Number.isFinite(asOfMs) && valueMs <= asOfMs;
}

function latestEvent(events: StoryEvent[], storyId: string, asOf: string) {
  return events
    .filter((event) => event.story_id === storyId && atOrBefore(event.event_at, asOf))
    .sort((left, right) => right.event_at.localeCompare(left.event_at) || right.recorded_at.localeCompare(left.recorded_at))[0] ?? null;
}

function latestVersion(versions: StoryThesisVersion[], storyId: string, asOf: string) {
  return versions
    .filter((version) => version.story_id === storyId && atOrBefore(version.effective_at, asOf))
    .sort((left, right) => right.version_number - left.version_number || right.effective_at.localeCompare(left.effective_at))[0] ?? null;
}

function classify(event: StoryEvent | null, version: StoryThesisVersion | null): Pick<HybridStoryClassification, "classification" | "reason"> {
  if (event?.event_type === "invalidation" || event?.event_type === "archive") {
    return { classification: "INVALIDATING", reason: "The latest canonical Story event invalidates or archives the thesis." };
  }
  if (event?.impact === "contradicts" || event?.event_type === "contradiction") {
    return { classification: "CONTRADICTING", reason: "The latest canonical Story event contradicts the current thesis." };
  }
  if (event?.impact === "amplifies") {
    return { classification: "ACCELERATING", reason: "The latest canonical Story event explicitly amplifies the existing mechanism." };
  }
  if (event?.impact === "supports" || event?.event_type === "confirmation") {
    return { classification: "CONFIRMING", reason: "The latest canonical Story event supports or confirms the current thesis." };
  }

  const status = (version?.status ?? "").toLowerCase();
  if (status.includes("invalid")) {
    return { classification: "INVALIDATING", reason: "The latest immutable Story version is invalidated." };
  }
  if (status.includes("weaken")) {
    return { classification: "CONTRADICTING", reason: "The latest immutable Story version is weakening." };
  }
  if (status.includes("confirm") || status.includes("publish")) {
    return { classification: "CONFIRMING", reason: "The latest immutable Story version remains confirmed." };
  }
  return { classification: "UNRESOLVED", reason: "Canonical Story state does not establish a directional evidence change." };
}

function transfer(
  probabilities: HybridScenarioProbabilities,
  from: HybridScenarioKey,
  to: HybridScenarioKey,
  requested: number,
) {
  if (requested <= 0) return 0;
  const amount = Math.min(requested, probabilities[from]);
  probabilities[from] -= amount;
  probabilities[to] += amount;
  return amount;
}

function scenarioFamily(story: Story) {
  const routes = routeStoryToRegimes(story);
  if (routes.some((route) =>
    route.regime === "global-cost-of-capital"
    && route.subgroup === "credit-financing"
    && route.role === "core"
  )) return "CREDIT" as const;

  if (routes.some((route) =>
    route.regime === "global-cost-of-capital"
    && ["treasury-fiscal", "long-end", "global-rates", "fed-front-end"].includes(route.subgroup)
  )) return "RATES" as const;

  if (routes.some((route) => route.regime === "us-china-ai")) return "AI" as const;
  return "OTHER" as const;
}

function classificationWeight(value: HybridEvidenceClassification) {
  if (value === "ACCELERATING") return 2;
  if (value === "CONFIRMING") return 1;
  if (value === "CONTRADICTING") return -1;
  if (value === "INVALIDATING") return -2;
  return 0;
}

function probabilitiesFor(
  dossier: DossierPresentationV1,
  classifications: HybridStoryClassification[],
  storiesById: ReadonlyMap<string, Story>,
): HybridScenarioProjection {
  const current = { ...STARTING_PRIORS };
  const reasons: string[] = [];

  if (dossier.header.regimeFamily === "RATES_LED_TIGHTENING") {
    const moved = transfer(current, "A", "B", 5);
    if (moved) reasons.push("Rates-led tightening moves " + moved + " pp from A to B.");
  } else if (dossier.header.regimeFamily === "GROWTH_SCARE_RISK_OFF") {
    const moved = transfer(current, "B", "C", 5);
    if (moved) reasons.push("Growth-scare risk-off moves " + moved + " pp from B to C.");
  }

  for (const item of classifications) {
    const story = storiesById.get(item.storyId);
    if (!story) continue;
    const weight = classificationWeight(item.classification);
    if (!weight) continue;

    const family = scenarioFamily(story);
    if (family === "CREDIT") {
      const amount = Math.abs(weight) * 2;
      const moved = weight > 0
        ? transfer(current, "B", "C", amount)
        : transfer(current, "C", "B", amount);
      if (moved) reasons.push(story.title + ": " + item.classification + " moves " + moved + " pp " + (weight > 0 ? "B → C." : "C → B."));
    } else if (family === "RATES" || family === "AI") {
      const amount = Math.abs(weight);
      const moved = weight > 0
        ? transfer(current, "A", "B", amount)
        : transfer(current, "B", "A", amount);
      if (moved) reasons.push(story.title + ": " + item.classification + " moves " + moved + " pp " + (weight > 0 ? "A → B." : "B → A."));
    }
  }

  const delta = {
    A: current.A - STARTING_PRIORS.A,
    B: current.B - STARTING_PRIORS.B,
    C: current.C - STARTING_PRIORS.C,
    D: current.D - STARTING_PRIORS.D,
    E: current.E - STARTING_PRIORS.E,
  };

  return {
    starting: { ...STARTING_PRIORS },
    current,
    delta,
    reasons,
    guardedTails: [
      "Scenario D does not gain probability automatically without canonical forced-selling, funding, redemption, collateral or covenant evidence.",
      "Scenario E does not gain probability automatically without the US-confidence combination: Treasury yields up, USD down and deteriorating auction / demand evidence.",
    ],
  };
}

export function buildHybridReasoningProjection(input: {
  dossier: DossierPresentationV1;
  stories: Story[];
  events: StoryEvent[];
  versions: StoryThesisVersion[];
}): HybridReasoningProjection {
  const storiesById = new Map(input.stories.map((story) => [story.id, story]));
  const classifications = input.dossier.whatMattersNow.stories.flatMap((dossierStory) => {
    const story = storiesById.get(dossierStory.id);
    if (!story) return [];

    const event = latestEvent(input.events, story.id, input.dossier.asOf);
    const version = latestVersion(input.versions, story.id, input.dossier.asOf);
    const result = classify(event, version);
    const evidenceCount = new Set([
      ...dossierStory.evidenceRefs,
      ...(event?.evidence_id ? [event.evidence_id] : []),
    ]).size;

    return [{
      storyId: story.id,
      storySlug: story.slug,
      title: dossierStory.title || story.title,
      classification: result.classification,
      reason: result.reason,
      canonicalEvidenceCount: evidenceCount,
      latestEventAt: event?.event_at ?? null,
      latestVersionNumber: version?.version_number ?? null,
    } satisfies HybridStoryClassification];
  });

  return {
    contractVersion: HYBRID_REASONING_PROJECTION_V1,
    asOf: input.dossier.asOf,
    storyClassifications: classifications,
    scenarios: probabilitiesFor(input.dossier, classifications, storiesById),
    mutationBoundary: {
      mode: "A3_QUEUE_ONLY",
      statement: "Hybrid classifies and presents canonical state but does not write Stories. Evidence-backed ACCEPT/REFINE wake requests continue through the existing A3 reevaluation queue and the normal Story engine remains the only writer of immutable thesis versions.",
      path: [
        "canonical evidence",
        "Dossier System 2 ACCEPT / REFINE",
        "A3 intelligence_reevaluation_queue",
        "canonical Story assessment",
        "story_thesis_versions",
        "Regime projection",
        "Hybrid presentation",
      ],
    },
  };
}
