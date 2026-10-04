import type { DossierStoryReasoningMaterialisation } from "./story-reassessment-reasoning-materialisation.ts";
import { isValidUuid } from "./validation.ts";

export const DOSSIER_STORY_CANONICAL_MUTATION_VERSION =
  "dossier-story-canonical-mutation/1" as const;

export type DossierStoryCanonicalMutationCurrentStory = {
  id: string;
  current_thesis_version_id: string | null;
  title: string;
  thesis: string;
  status: string;
  confidence: number;
  market_question: string | null;
  dominant_narrative: string | null;
  best_explanation: string | null;
  strongest_support: string | null;
  strongest_contradiction: string | null;
  priced_assessment: string | null;
  confirmation_trigger: string | null;
  invalidation_trigger: string | null;
  next_catalyst: string | null;
  article_angle: string | null;
  provisional_title: string | null;
  article_verdict: string | null;
  assets: string[];
};

export type DossierStoryCanonicalMutationPlan = {
  contract_version: typeof DOSSIER_STORY_CANONICAL_MUTATION_VERSION;
  authority: "EXECUTE_WITH_CANONICAL_WRITER_ONLY";
  mutation_key: string;
  story_id: string;
  expected_base_version_id: string;
  story_payload: {
    title: string;
    thesis: string;
    status: string;
    confidence: number;
    market_question: string | null;
    dominant_narrative: string | null;
    best_explanation: string | null;
    strongest_support: string | null;
    strongest_contradiction: string | null;
    priced_assessment: string | null;
    confirmation_trigger: string | null;
    invalidation_trigger: string | null;
    next_catalyst: string | null;
    article_angle: string | null;
    provisional_title: string | null;
    article_verdict: string | null;
    assets: string[];
    updated_at: string;
  };
  reasoning: DossierStoryReasoningMaterialisation["reasoning"];
  event: {
    headline: string;
    detail: string;
    eventAt: string;
    metadata: {
      origin: "dossier_story_reassessment";
      dossierId: string;
      motionId: string;
      expectedBaseVersionId: string;
      canonicalEvidenceIds: string[];
      reasoningFingerprint: string;
    };
  };
};

function clean(value: string | null | undefined) {
  return (value ?? "").trim();
}

function uuidText(value: string): boolean {
  return isValidUuid(value);
}

function lifecycleStatus(value: DossierStoryReasoningMaterialisation["reasoning"]["lifecycle"]) {
  if (value === "confirmed") return "publish";
  if (value === "developing") return "develop";
  if (value === "invalidated" || value === "archived") return "archived";
  return "monitor";
}

function boundedConfidence(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Build the final canonical Story mutation payload from the fresh Story row and
 * the already validated B4.4 canonical reasoning snapshot.
 *
 * Motion/Dossier prose is not used to synthesize Story fields here.
 */
export function buildDossierStoryCanonicalMutationPlan(input: {
  materialisation: DossierStoryReasoningMaterialisation;
  currentStory: DossierStoryCanonicalMutationCurrentStory;
  eventAt: string;
}): DossierStoryCanonicalMutationPlan | null {
  const { materialisation, currentStory } = input;
  const eventAt = clean(input.eventAt);

  if (materialisation.authority !== "CANONICAL_REASONING_PAYLOAD_ONLY") return null;
  if (materialisation.reasoning_contract !== "canonical-story-reasoning/v1") return null;
  if (materialisation.reasoning.contractVersion !== "canonical-story-reasoning/v1") return null;

  const storyId = clean(currentStory.id);
  const expectedBaseVersionId = clean(materialisation.expected_base_version_id);
  const currentVersionId = clean(currentStory.current_thesis_version_id);
  if (!storyId || storyId !== materialisation.story_id) return null;
  if (!uuidText(expectedBaseVersionId) || !uuidText(currentVersionId)) return null;
  if (currentVersionId !== expectedBaseVersionId) return null;
  if (!eventAt || Number.isNaN(Date.parse(eventAt))) return null;

  const thesisClaims = materialisation.reasoning.claims.filter((claim) => claim.type === "thesis");
  if (thesisClaims.length !== 1) return null;
  const thesis = clean(thesisClaims[0]?.text);
  if (!thesis) return null;

  const leading = (materialisation.reasoning.explanationCandidates ?? [])
    .filter((candidate) => candidate.isLeading);
  if (leading.length !== 1) return null;
  const confidence = boundedConfidence(leading[0]!.confidence);

  const facts = materialisation.reasoning.claims.filter((claim) => claim.type === "fact");
  const strongestSupport = clean(facts[0]?.text) || clean(currentStory.strongest_support) || null;
  const strongestContradiction =
    clean(materialisation.reasoning.countercase.strongest)
    || clean(currentStory.strongest_contradiction)
    || null;
  const bestExplanation =
    clean(materialisation.reasoning.acceptedExplanation)
    || clean(leading[0]!.causalMechanism)
    || clean(currentStory.best_explanation)
    || null;

  const title = clean(currentStory.title);
  const assets = [...new Set(currentStory.assets.map(clean).filter(Boolean))];
  if (!title || !assets.length) return null;

  const requiredEvidenceIds = [...new Set(
    materialisation.required_canonical_evidence_ids.map(clean).filter(Boolean),
  )];
  if (!requiredEvidenceIds.length || requiredEvidenceIds.some((id) => !uuidText(id))) {
    return null;
  }

  return {
    contract_version: DOSSIER_STORY_CANONICAL_MUTATION_VERSION,
    authority: "EXECUTE_WITH_CANONICAL_WRITER_ONLY",
    mutation_key: materialisation.mutation_key,
    story_id: storyId,
    expected_base_version_id: expectedBaseVersionId,
    story_payload: {
      title,
      thesis,
      status: lifecycleStatus(materialisation.reasoning.lifecycle),
      confidence,
      market_question: clean(currentStory.market_question) || null,
      dominant_narrative: clean(currentStory.dominant_narrative) || null,
      best_explanation: bestExplanation,
      strongest_support: strongestSupport,
      strongest_contradiction: strongestContradiction,
      priced_assessment: clean(currentStory.priced_assessment) || null,
      confirmation_trigger: materialisation.reasoning.confirmation.map(clean).filter(Boolean).join("; ") || null,
      invalidation_trigger: materialisation.reasoning.invalidation.map(clean).filter(Boolean).join("; ") || null,
      next_catalyst: clean(materialisation.reasoning.nextTest?.label) || clean(currentStory.next_catalyst) || null,
      article_angle: clean(currentStory.article_angle) || null,
      provisional_title: clean(currentStory.provisional_title) || null,
      article_verdict: clean(currentStory.article_verdict) || null,
      assets,
      updated_at: new Date(eventAt).toISOString(),
    },
    reasoning: materialisation.reasoning,
    event: {
      headline: "Canonical Story reassessment applied",
      detail: "Dossier-triggered Story reassessment was materialised from canonical evidence and applied through the canonical reasoning transaction.",
      eventAt: new Date(eventAt).toISOString(),
      metadata: {
        origin: "dossier_story_reassessment",
        dossierId: materialisation.dossier_id,
        motionId: materialisation.motion_id,
        expectedBaseVersionId,
        canonicalEvidenceIds: requiredEvidenceIds,
        reasoningFingerprint: materialisation.reasoning_fingerprint,
      },
    },
  };
}
