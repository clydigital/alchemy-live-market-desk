import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildDossierMotionStoryRefreshRequests,
} from "../lib/dossier-v2/motion-story-refresh-request.ts";
import type {
  ResearchBrainMotionAssessment,
  ResearchBrainMotionAttention,
} from "../lib/dossier-v2/research-brain-contracts.ts";
import {
  resolveDossierMotionStoryWakeTarget,
} from "../lib/dossier-v2/motion-story-wake-target.ts";
import {
  buildDossierStoryReassessmentProposal,
} from "../lib/dossier-v2/motion-story-reassessment-proposal.ts";
import {
  buildDossierStoryCanonicalPersistenceHandoff,
} from "../lib/dossier-v2/story-reassessment-persistence-handoff.ts";
import {
  materialiseDossierStoryCanonicalReasoning,
  type DossierStoryCanonicalReasoningInput,
} from "../lib/dossier-v2/story-reassessment-reasoning-materialisation.ts";
import {
  buildDossierStoryCanonicalMutationPlan,
  type DossierStoryCanonicalMutationCurrentStory,
} from "../lib/dossier-v2/story-reassessment-canonical-mutation.ts";
import {
  materialiseCanonicalStoryReasoningV1,
} from "../lib/intelligence/story-reasoning.ts";
import {
  buildCanonicalEditionResponseContract,
  type EditionSnapshot,
} from "../lib/edition-replay.ts";

const DOSSIER_ID = "dossier-b48";
const MOTION_ID = "motion-b48";
const STORY_ID = "story-rates";
const PACKET_REF = "verified-macro:rates-b48";
const EVIDENCE_ID = "11111111-1111-4111-8111-111111111111";
const BASE_VERSION_ID = "22222222-2222-4222-8222-222222222222";
const WRITTEN_VERSION_ID = "33333333-3333-4333-8333-333333333333";
const LATER_VERSION_ID = "44444444-4444-4444-8444-444444444444";
const EVENT_AT = "2026-10-05T03:00:00.000Z";

function motion(
  overrides: Partial<ResearchBrainMotionAttention> = {},
): ResearchBrainMotionAttention {
  return {
    motion_id: MOTION_ID,
    headline: "MOTION-PROSE-MUST-REMAIN-NON-EVIDENTIARY",
    what_happened: "Motion context only.",
    market_reaction: null,
    why_interesting: "Motion context only.",
    big_picture_bridge: "Motion context only.",
    next_test: "Motion context only.",
    primary_story_id: STORY_ID,
    primary_regime_slug: "global-cost-of-capital",
    packet_evidence_id: PACKET_REF,
    verification_state: "VERIFIED",
    materiality: 95,
    relevance: 94,
    novelty: 82,
    ...overrides,
  };
}

function assessment(
  decision: ResearchBrainMotionAssessment["decision"] = "ACCEPT",
  overrides: Partial<ResearchBrainMotionAssessment> = {},
): ResearchBrainMotionAssessment {
  return {
    motion_id: MOTION_ID,
    decision,
    canonical_reassessment_scope:
      decision === "ACCEPT" || decision === "REFINE" ? "STORY" : "NONE",
    reason: "System 2 accepted only the canonical-evidence-bounded implication.",
    evidence_references: [PACKET_REF],
    story_implication: decision === "ACCEPT" || decision === "REFINE"
      ? "Reassess the exact Story against the cited canonical evidence."
      : null,
    regime_implication: null,
    investigation_next: null,
    refined_headline: decision === "REFINE" ? "Corrected evidence-bounded framing" : null,
    refined_why_interesting: decision === "REFINE"
      ? "Only the narrower evidence-supported mechanism survives."
      : null,
    refined_big_picture_bridge: decision === "REFINE"
      ? "Canonical evidence -> exact Story reassessment."
      : null,
    ...overrides,
  };
}

function currentStory(): DossierStoryCanonicalMutationCurrentStory {
  return {
    id: STORY_ID,
    current_thesis_version_id: BASE_VERSION_ID,
    title: "Long-end yields and the cost of capital",
    thesis: "Broad rates pressure keeps financial conditions restrictive.",
    status: "develop",
    confidence: 72,
    market_question: "Are long-end yields becoming a durable financing constraint?",
    dominant_narrative: "The cost of capital remains restrictive.",
    best_explanation: "Broad rates pressure remains the dominant mechanism.",
    strongest_support: "Prior canonical support.",
    strongest_contradiction: "Prior canonical contradiction.",
    priced_assessment: "Some persistence is already priced.",
    confirmation_trigger: "Long-end yields remain elevated.",
    invalidation_trigger: "Long-end yields fall materially.",
    next_catalyst: "Next inflation release",
    article_angle: "Rates and financing conditions",
    provisional_title: "Long-end yields and financing",
    article_verdict: "research_engine",
    assets: ["US10Y", "XAUUSD"],
  };
}

function reassessment(): DossierStoryCanonicalReasoningInput {
  return {
    synthesis: {
      lifecycleStatus: "developing",
      thesis: "Persistent long-end yields remain a restrictive financing constraint.",
      whatChanged: "Canonical rates evidence narrowed the transmission mechanism.",
      previousState: "The Story treated broad rates pressure as the dominant constraint.",
      currentState: "The evidence now points specifically to persistent long-end yields.",
      marketReaction: "Duration-sensitive assets remained pressured.",
      acceptedExplanation: "Persistent long-end yields continue to transmit through financing costs.",
      acceptedExplanationEvidenceIds: [EVIDENCE_ID],
      overlookedVariable: null,
      overlookedVariableEvidenceStatus: null,
      overlookedVariableEvidenceIds: [],
      marketMayBeRight: null,
      decisiveEvidenceIds: [EVIDENCE_ID],
    },
    hypothesis: {
      id: "hyp-b48-rates",
      statement: "Persistent long-end yields keep financing conditions restrictive.",
      mechanism: "Higher long-end yields raise the cost of capital and pressure duration-sensitive assets.",
      mechanismCode: "UNKNOWN",
      confidence: 78,
      evidenceForIds: [EVIDENCE_ID],
      evidenceAgainstIds: [],
      causalChain: [{
        from: "Persistent long-end yields",
        relationship: "raise",
        to: "cost of capital",
        evidenceState: "strongly_supported",
        evidenceIds: [EVIDENCE_ID],
      }],
      confirmationCriteria: ["Long-end yields stay elevated while financing conditions remain restrictive."],
      invalidationCriteria: ["Long-end yields fall materially and financing conditions ease."],
    },
    competingHypotheses: [],
    challenger: null,
    scenarios: [],
    evidence: [{
      id: EVIDENCE_ID,
      claim: "Canonical evidence shows long-end yields remained elevated.",
    }],
  };
}

function daily(
  id: string,
  publishedAt: string,
  payload: Record<string, unknown>,
): EditionSnapshot {
  return {
    id,
    research_run_id: `run-${id}`,
    supersedes_snapshot_id: null,
    snapshot_type: "daily_brief",
    payload,
    published_at: publishedAt,
  };
}

function runPureB48Chain(decision: "ACCEPT" | "REFINE" = "ACCEPT") {
  const requests = buildDossierMotionStoryRefreshRequests({
    dossierId: DOSSIER_ID,
    motionAttention: [motion()],
    assessments: [assessment(decision)],
  });
  assert.equal(requests.length, 1);

  const target = resolveDossierMotionStoryWakeTarget({
    request: requests[0]!,
    stories: [{ id: STORY_ID, status: "develop" }],
    evidenceRows: [{
      id: EVIDENCE_ID,
      external_evidence_id: PACKET_REF,
    }],
  });
  assert.ok(target);

  const story = currentStory();
  const proposal = buildDossierStoryReassessmentProposal({
    target,
    story: {
      id: story.id,
      current_thesis_version_id: story.current_thesis_version_id,
      thesis: story.thesis,
      status: story.status,
      confidence: story.confidence,
      market_question: story.market_question,
    },
  });
  assert.ok(proposal);

  const handoff = buildDossierStoryCanonicalPersistenceHandoff({
    proposal,
    current_thesis_version_id: BASE_VERSION_ID,
  });
  assert.ok(handoff);

  const materialisation = materialiseDossierStoryCanonicalReasoning({
    proposal,
    handoff,
    reassessment: reassessment(),
  });
  assert.ok(materialisation);

  const mutation = buildDossierStoryCanonicalMutationPlan({
    materialisation,
    currentStory: story,
    eventAt: EVENT_AT,
  });
  assert.ok(mutation);

  return {
    request: requests[0]!,
    target,
    proposal,
    handoff,
    materialisation,
    mutation,
  };
}

test("B4.8 ACCEPT traverses exact evidence -> Story -> reasoning -> canonical mutation without Motion becoming evidence", () => {
  const chain = runPureB48Chain("ACCEPT");

  assert.equal(chain.request.authority, "REEVALUATION_REQUEST_ONLY");
  assert.equal(chain.target.story_id, STORY_ID);
  assert.equal(chain.target.canonical_evidence_id, EVIDENCE_ID);
  assert.deepEqual(chain.proposal.required_canonical_evidence_ids, [EVIDENCE_ID]);
  assert.equal(chain.proposal.expected_base_version_id, BASE_VERSION_ID);
  assert.equal(chain.handoff.writer_route, "rpc/persist_canonical_story_reasoning");
  assert.equal(chain.handoff.expected_base_version_id, BASE_VERSION_ID);
  assert.deepEqual(chain.handoff.required_canonical_evidence_ids, [EVIDENCE_ID]);
  assert.equal(chain.materialisation.reasoning.contractVersion, "canonical-story-reasoning/v1");
  assert.deepEqual(chain.materialisation.required_canonical_evidence_ids, [EVIDENCE_ID]);
  assert.deepEqual(chain.mutation.event.metadata.canonicalEvidenceIds, [EVIDENCE_ID]);
  assert.equal(chain.mutation.expected_base_version_id, BASE_VERSION_ID);

  const thesisClaim = chain.materialisation.reasoning.claims.find((claim) => claim.type === "thesis");
  const factClaims = chain.materialisation.reasoning.claims.filter((claim) => claim.type === "fact");
  assert.ok(thesisClaim?.evidenceIds.includes(EVIDENCE_ID));
  assert.ok(factClaims.some((claim) => claim.evidenceIds.includes(EVIDENCE_ID)));

  const reasoningJson = JSON.stringify(chain.materialisation.reasoning);
  const storyPayloadJson = JSON.stringify(chain.mutation.story_payload);
  assert.equal(reasoningJson.includes("MOTION-PROSE-MUST-REMAIN-NON-EVIDENTIARY"), false);
  assert.equal(storyPayloadJson.includes("MOTION-PROSE-MUST-REMAIN-NON-EVIDENTIARY"), false);
});

test("B4.8 REFINE preserves corrected framing as context while canonical evidence remains the authority", () => {
  const chain = runPureB48Chain("REFINE");

  assert.equal(chain.request.decision, "REFINE");
  assert.equal(chain.target.refined_motion?.headline, "Corrected evidence-bounded framing");
  assert.equal(chain.proposal.refined_motion?.headline, "Corrected evidence-bounded framing");
  assert.deepEqual(chain.materialisation.required_canonical_evidence_ids, [EVIDENCE_ID]);

  const reasoningJson = JSON.stringify(chain.materialisation.reasoning);
  assert.equal(reasoningJson.includes("Corrected evidence-bounded framing"), false);
  assert.equal(reasoningJson.includes(EVIDENCE_ID), true);
});

test("B4.8 canonical writer output can be materialised and frozen into the exact publication version", () => {
  const chain = runPureB48Chain();

  // Simulate the immutable row produced by the existing canonical writer. The
  // database transaction is separately exercised by database-contracts.
  const immutableVersion = {
    id: WRITTEN_VERSION_ID,
    story_id: STORY_ID,
    version_number: 8,
    effective_at: EVENT_AT,
    title: chain.mutation.story_payload.title,
    market_question: chain.mutation.story_payload.market_question,
    status: chain.mutation.story_payload.status,
    confidence: chain.mutation.story_payload.confidence,
    thesis: chain.mutation.story_payload.thesis,
    snapshot: {
      canonicalMutationKey: chain.mutation.mutation_key,
      canonicalMutationKind: "existing_story_update",
      reasoning: chain.mutation.reasoning,
    },
  };

  const fullReasoning = materialiseCanonicalStoryReasoningV1(immutableVersion);
  assert.ok(fullReasoning);
  assert.equal(fullReasoning.storyId, STORY_ID);
  assert.equal(fullReasoning.storyVersionId, WRITTEN_VERSION_ID);
  assert.equal(fullReasoning.thesis, chain.mutation.story_payload.thesis);

  const historicalEdition = daily("edition-b48-n", "2026-10-05T03:15:00.000Z", {
    scheduleSlot: "morning",
    scheduledFor: "2026-10-05T03:15:00.000Z",
    canonicalStoryManifest: [{
      position: 1,
      snapshotId: "publication-story-b48-n",
      storyId: STORY_ID,
      thesisVersionId: WRITTEN_VERSION_ID,
      state: {
        id: STORY_ID,
        title: chain.mutation.story_payload.title,
        thesis: chain.mutation.story_payload.thesis,
        confidence: chain.mutation.story_payload.confidence,
        featuredRank: 1,
        thesisVersion: {
          id: WRITTEN_VERSION_ID,
          version: 8,
          effectiveAt: EVENT_AT,
          changeReason: "material_evidence_recalibration",
        },
      },
      reasoning: fullReasoning,
    }],
  });

  const laterCurrentEdition = daily("edition-b48-n1", "2026-10-05T04:15:00.000Z", {
    scheduleSlot: "evening",
    scheduledFor: "2026-10-05T04:15:00.000Z",
  });

  const laterMutableStory = {
    id: STORY_ID,
    title: "Later current Story",
    thesis: "Version N+1 thesis",
    confidence: 88,
    featuredRank: 1,
    thesisVersion: {
      id: LATER_VERSION_ID,
      version: 9,
      effectiveAt: "2026-10-05T04:00:00.000Z",
      changeReason: "later_reassessment",
    },
  };

  const replay = buildCanonicalEditionResponseContract({
    snapshots: [historicalEdition, laterCurrentEdition],
    editionId: historicalEdition.id,
    currentStoryStates: [laterMutableStory],
    currentFeaturedStoryStates: [laterMutableStory],
  });

  assert.equal(replay.isHistoricalReplay, true);
  assert.equal(replay.canonical.snapshotId, historicalEdition.id);
  assert.equal(
    (replay.canonical.storyStates[0]?.thesisVersion as { id?: string } | undefined)?.id,
    WRITTEN_VERSION_ID,
  );

  const replayedReasoning = replay.canonical.storyReasoningByStoryId[STORY_ID];
  assert.ok(replayedReasoning);
  assert.equal(replayedReasoning.storyVersionId, WRITTEN_VERSION_ID);
  assert.notEqual(replayedReasoning.storyVersionId, LATER_VERSION_ID);
  assert.equal(JSON.stringify(replayedReasoning), JSON.stringify(fullReasoning));
});

test("B4.8 source architecture exposes one Dossier mutation sink and no third thesis-version writer", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const dossierModules = [
    "motion-story-wake-target.ts",
    "motion-story-reassessment-proposal.ts",
    "story-reassessment-persistence-handoff.ts",
    "story-reassessment-reasoning-materialisation.ts",
    "story-reassessment-canonical-mutation.ts",
  ].map((name) => fs.readFileSync(path.join(root, "lib", "dossier-v2", name), "utf8"));

  for (const source of dossierModules) {
    assert.doesNotMatch(source, /insert\s+into\s+public\.story_thesis_versions/i);
    assert.doesNotMatch(source, /apply_intelligence_story_assessment_v2/);
    assert.doesNotMatch(source, /intelligenceRest\s*</);
  }

  const runtime = fs.readFileSync(path.join(root, "lib", "intelligence", "runtime.ts"), "utf8");
  const executorStart = runtime.indexOf("export async function executeDossierStoryCanonicalMutation");
  const executorEnd = runtime.indexOf("async function persistDerivedStoryThemes", executorStart);
  assert.notEqual(executorStart, -1);
  assert.ok(executorEnd > executorStart);
  const executor = runtime.slice(executorStart, executorEnd);

  assert.match(executor, /buildDossierStoryCanonicalMutationPlan/);
  assert.match(executor, /persistCanonicalStoryReasoning\(\{/);
  assert.doesNotMatch(executor, /story_thesis_versions/);
  assert.doesNotMatch(executor, /apply_intelligence_story_assessment_v2/);

  const writerStart = runtime.indexOf("async function persistCanonicalStoryReasoning");
  const writerEnd = runtime.indexOf("export async function executeDossierStoryCanonicalMutation", writerStart);
  const writer = runtime.slice(writerStart, writerEnd);
  assert.match(writer, /"rpc\/persist_canonical_story_reasoning"/);
});

test("B4.8 database and publication contracts preserve one exact reasoning-bearing version through replay", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const atomic = fs.readFileSync(
    path.join(root, "supabase", "migrations", "20260823183129_canonical_story_reasoning_atomic_persistence.sql"),
    "utf8",
  );
  const staleGuard = fs.readFileSync(
    path.join(root, "supabase", "migrations", "20261005051500_dossier_story_reasoning_stale_base_guard.sql"),
    "utf8",
  );
  const publication = fs.readFileSync(
    path.join(root, "supabase", "migrations", "20260823232940_canonical_story_publication_linkage_v1.sql"),
    "utf8",
  );
  const replay = fs.readFileSync(path.join(root, "lib", "edition-replay.ts"), "utf8");

  assert.match(atomic, /insert into public\.story_thesis_versions/);
  assert.match(atomic, /set current_thesis_version_id = new_version_id/);
  assert.match(atomic, /snapshot[\s\S]*'reasoning'/);
  assert.match(staleGuard, /expectedBaseVersionId/);
  assert.match(staleGuard, /old\.current_thesis_version_id/);

  assert.match(publication, /story\.current_thesis_version_id/);
  assert.match(publication, /materialise_story_reasoning_for_publication_v1\(current_version_id\)/);
  assert.match(publication, /canonicalStoryReasoning/);

  assert.match(replay, /storyReasoningByStoryId/);
  assert.match(replay, /entry\.reasoning/);
  assert.doesNotMatch(replay, /intelligenceRest/);
  assert.doesNotMatch(replay, /story_thesis_versions\?/);
});

test("B4.8 UNRESOLVED/REJECT still terminate before Story wake", () => {
  for (const decision of ["UNRESOLVED", "REJECT"] as const) {
    const requests = buildDossierMotionStoryRefreshRequests({
      dossierId: DOSSIER_ID,
      motionAttention: [motion()],
      assessments: [assessment(decision, {
        story_implication: null,
        investigation_next: decision === "UNRESOLVED" ? "Fund the next discriminator." : null,
      })],
    });
    assert.deepEqual(requests, []);
  }
});
