import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildDossierStoryCanonicalMutationPlan,
  DOSSIER_STORY_CANONICAL_MUTATION_VERSION,
  type DossierStoryCanonicalMutationCurrentStory,
} from "../lib/dossier-v2/story-reassessment-canonical-mutation.ts";
import type { DossierStoryReasoningMaterialisation } from "../lib/dossier-v2/story-reassessment-reasoning-materialisation.ts";

const STORY_ID = "story-rates";
const BASE_VERSION_ID = "22222222-2222-4222-8222-222222222222";
const EVIDENCE_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_AT = "2026-10-05T00:00:00.000Z";

function materialisation(
  overrides: Partial<DossierStoryReasoningMaterialisation> = {},
): DossierStoryReasoningMaterialisation {
  return {
    contract_version: "dossier-story-reasoning-materialisation/1",
    authority: "CANONICAL_REASONING_PAYLOAD_ONLY",
    story_id: STORY_ID,
    dossier_id: "dossier-1",
    motion_id: "motion-1",
    expected_base_version_id: BASE_VERSION_ID,
    mutation_key: "dossier-story-reassessment:story-rates:base:stable",
    required_canonical_evidence_ids: [EVIDENCE_ID],
    reasoning_contract: "canonical-story-reasoning/v1",
    reasoning_fingerprint: "reasoning-fingerprint",
    reasoning: {
      contractVersion: "canonical-story-reasoning/v1",
      lifecycle: "developing",
      whatChanged: "Long-end persistence narrowed the mechanism.",
      previousState: "Broad rates pressure.",
      currentState: "Long-end pressure remains the active constraint.",
      marketReaction: null,
      acceptedExplanation: "Persistent long-end yields keep financing costs restrictive.",
      explanationCandidates: [{
        hypothesisId: "hyp-1",
        mechanismCode: "UNKNOWN",
        statement: "Persistent long-end yields remain restrictive.",
        causalMechanism: "Higher long-end yields raise financing costs.",
        confidence: 76,
        evidenceForIds: [EVIDENCE_ID],
        evidenceAgainstIds: [],
        isLeading: true,
      }],
      claims: [
        {
          id: `claim:fact:${EVIDENCE_ID}`,
          type: "fact",
          text: "Canonical evidence shows long-end yields remain elevated.",
          evidenceIds: [EVIDENCE_ID],
        },
        {
          id: "claim:thesis:1",
          type: "thesis",
          text: "Long-end yields remain a restrictive financing constraint.",
          evidenceIds: [EVIDENCE_ID],
        },
      ],
      causalChain: [],
      countercase: {
        strongest: "A durable growth slowdown could pull long-end yields lower.",
        evidenceIds: [],
        weakestLink: null,
        marketMayBeRight: null,
      },
      overlookedVariable: {
        text: null,
        evidenceState: null,
        evidenceIds: [],
      },
      assetImplications: [],
      confirmation: ["Long-end yields remain elevated."],
      invalidation: ["Long-end yields fall materially."],
      nextTest: null,
      visualPlan: [],
    },
    ...overrides,
  };
}

function story(
  overrides: Partial<DossierStoryCanonicalMutationCurrentStory> = {},
): DossierStoryCanonicalMutationCurrentStory {
  return {
    id: STORY_ID,
    current_thesis_version_id: BASE_VERSION_ID,
    title: "Higher yields raise the cost of capital",
    thesis: "Old thesis.",
    status: "develop",
    confidence: 70,
    market_question: "Are long-end yields becoming a durable financing constraint?",
    dominant_narrative: "Cost of capital remains restrictive.",
    best_explanation: "Old explanation.",
    strongest_support: "Old support.",
    strongest_contradiction: "Old contradiction.",
    priced_assessment: "Old pricing assessment.",
    confirmation_trigger: "Old confirmation.",
    invalidation_trigger: "Old invalidation.",
    next_catalyst: "Next CPI",
    article_angle: "Old article angle.",
    provisional_title: "Old provisional title",
    article_verdict: "research_engine",
    assets: ["US10Y", "XAUUSD"],
    ...overrides,
  };
}

test("B4.5 builds final Story payload from canonical reasoning plus fresh current Story", () => {
  const result = buildDossierStoryCanonicalMutationPlan({
    materialisation: materialisation(),
    currentStory: story(),
    eventAt: EVENT_AT,
  });

  assert.ok(result);
  assert.equal(result.contract_version, DOSSIER_STORY_CANONICAL_MUTATION_VERSION);
  assert.equal(result.authority, "EXECUTE_WITH_CANONICAL_WRITER_ONLY");
  assert.equal(result.story_id, STORY_ID);
  assert.equal(result.expected_base_version_id, BASE_VERSION_ID);
  assert.equal(result.story_payload.title, "Higher yields raise the cost of capital");
  assert.equal(result.story_payload.thesis, "Long-end yields remain a restrictive financing constraint.");
  assert.equal(result.story_payload.status, "develop");
  assert.equal(result.story_payload.confidence, 76);
  assert.equal(result.story_payload.best_explanation, "Persistent long-end yields keep financing costs restrictive.");
  assert.equal(result.story_payload.strongest_support, "Canonical evidence shows long-end yields remain elevated.");
  assert.equal(result.story_payload.strongest_contradiction, "A durable growth slowdown could pull long-end yields lower.");
  assert.equal(result.story_payload.confirmation_trigger, "Long-end yields remain elevated.");
  assert.equal(result.story_payload.invalidation_trigger, "Long-end yields fall materially.");
});

test("B4.5 preserves identity and non-reasoned Story fields instead of inventing replacements", () => {
  const result = buildDossierStoryCanonicalMutationPlan({
    materialisation: materialisation(),
    currentStory: story(),
    eventAt: EVENT_AT,
  });

  assert.ok(result);
  assert.equal(result.story_payload.market_question, story().market_question);
  assert.equal(result.story_payload.dominant_narrative, story().dominant_narrative);
  assert.equal(result.story_payload.priced_assessment, story().priced_assessment);
  assert.equal(result.story_payload.next_catalyst, story().next_catalyst);
  assert.equal(result.story_payload.article_angle, story().article_angle);
  assert.equal(result.story_payload.provisional_title, story().provisional_title);
  assert.equal(result.story_payload.article_verdict, story().article_verdict);
  assert.deepEqual(result.story_payload.assets, ["US10Y", "XAUUSD"]);
});

test("B4.5 event metadata carries exact stale-base and canonical evidence guards", () => {
  const result = buildDossierStoryCanonicalMutationPlan({
    materialisation: materialisation(),
    currentStory: story(),
    eventAt: EVENT_AT,
  });

  assert.ok(result);
  assert.deepEqual(result.event.metadata, {
    origin: "dossier_story_reassessment",
    dossierId: "dossier-1",
    motionId: "motion-1",
    expectedBaseVersionId: BASE_VERSION_ID,
    canonicalEvidenceIds: [EVIDENCE_ID],
    reasoningFingerprint: "reasoning-fingerprint",
  });
  assert.equal(result.event.eventAt, EVENT_AT);
});

test("B4.5 fresh Story pointer mismatch fails closed before writer execution", () => {
  assert.equal(buildDossierStoryCanonicalMutationPlan({
    materialisation: materialisation(),
    currentStory: story({
      current_thesis_version_id: "33333333-3333-4333-8333-333333333333",
    }),
    eventAt: EVENT_AT,
  }), null);
});

test("B4.5 exact Story mismatch fails closed", () => {
  assert.equal(buildDossierStoryCanonicalMutationPlan({
    materialisation: materialisation(),
    currentStory: story({ id: "story-other" }),
    eventAt: EVENT_AT,
  }), null);
});

test("B4.5 requires exactly one thesis claim", () => {
  const m = materialisation();
  m.reasoning.claims = m.reasoning.claims.filter((claim) => claim.type !== "thesis");

  assert.equal(buildDossierStoryCanonicalMutationPlan({
    materialisation: m,
    currentStory: story(),
    eventAt: EVENT_AT,
  }), null);

  const two = materialisation();
  two.reasoning.claims.push({
    id: "claim:thesis:2",
    type: "thesis",
    text: "Second thesis must fail.",
    evidenceIds: [EVIDENCE_ID],
  });
  assert.equal(buildDossierStoryCanonicalMutationPlan({
    materialisation: two,
    currentStory: story(),
    eventAt: EVENT_AT,
  }), null);
});

test("B4.5 requires exactly one leading explanation for confidence", () => {
  const none = materialisation();
  none.reasoning.explanationCandidates = [];
  assert.equal(buildDossierStoryCanonicalMutationPlan({
    materialisation: none,
    currentStory: story(),
    eventAt: EVENT_AT,
  }), null);

  const two = materialisation();
  two.reasoning.explanationCandidates!.push({
    ...two.reasoning.explanationCandidates![0]!,
    hypothesisId: "hyp-2",
    isLeading: true,
  });
  assert.equal(buildDossierStoryCanonicalMutationPlan({
    materialisation: two,
    currentStory: story(),
    eventAt: EVENT_AT,
  }), null);
});

test("B4.5 invalid event time fails closed", () => {
  assert.equal(buildDossierStoryCanonicalMutationPlan({
    materialisation: materialisation(),
    currentStory: story(),
    eventAt: "not-a-date",
  }), null);
});

test("B4.5 does not use Motion framing to construct Story fields", () => {
  const m = materialisation({
    motion_id: "MOTION-PROSE-NOT-A-STORY-FIELD",
  });
  const result = buildDossierStoryCanonicalMutationPlan({
    materialisation: m,
    currentStory: story(),
    eventAt: EVENT_AT,
  });

  assert.ok(result);
  const payload = JSON.stringify(result.story_payload);
  assert.equal(payload.includes("MOTION-PROSE-NOT-A-STORY-FIELD"), false);
});

test("B4.5 mutation planner is pure and has no database writer", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const source = fs.readFileSync(
    path.join(root, "lib", "dossier-v2", "story-reassessment-canonical-mutation.ts"),
    "utf8",
  );

  assert.doesNotMatch(source, /intelligenceRest/);
  assert.doesNotMatch(source, /story_thesis_versions/i);
  assert.doesNotMatch(source, /insert\s+into/i);
  assert.doesNotMatch(source, /apply_intelligence_story_assessment_v2/);
});
