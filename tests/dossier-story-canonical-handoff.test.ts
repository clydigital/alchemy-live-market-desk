import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildDossierStoryCanonicalPersistenceHandoff,
  CANONICAL_STORY_REASONING_CONTRACT,
  CANONICAL_STORY_REASONING_WRITER_ROUTE,
  DOSSIER_STORY_CANONICAL_HANDOFF_VERSION,
} from "../lib/dossier-v2/story-reassessment-persistence-handoff.ts";
import type { DossierStoryReassessmentProposal } from "../lib/dossier-v2/motion-story-reassessment-proposal.ts";

const STORY_ID = "story-rates";
const BASE_VERSION_ID = "22222222-2222-4222-8222-222222222222";
const EVIDENCE_ID = "11111111-1111-4111-8111-111111111111";

function proposal(
  overrides: Partial<DossierStoryReassessmentProposal> = {},
): DossierStoryReassessmentProposal {
  return {
    contract_version: "dossier-story-reassessment-proposal/1",
    authority: "PROPOSAL_ONLY",
    proposal_kind: "REASSESS_EXISTING_STORY",
    dossier_id: "dossier-1",
    motion_id: "motion-1",
    story_id: STORY_ID,
    decision: "ACCEPT",
    canonical_reassessment_scope: "STORY",
    expected_base_version_id: BASE_VERSION_ID,
    baseline: {
      thesis: "Higher long-end yields keep financial conditions restrictive.",
      status: "developing",
      confidence: 72,
      market_question: "Are higher long-end yields becoming a durable cost-of-capital regime?",
    },
    packet_evidence_reference: "verified-macro:rates-1",
    required_canonical_evidence_ids: [EVIDENCE_ID],
    dossier_reason: "System 2 accepted the evidence-bounded implication.",
    story_implication: "Reassess whether the current rates thesis still holds.",
    regime_implication: null,
    investigation_next: "Check the next rates discriminator.",
    refined_motion: null,
    requested_update: {
      action: "REASSESS_WITH_CANONICAL_EVIDENCE",
      implication: "Reassess whether the current rates thesis still holds.",
    },
    ...overrides,
  };
}

test("B4.3 valid proposal hands off only to the existing canonical Story writer", () => {
  const result = buildDossierStoryCanonicalPersistenceHandoff({
    proposal: proposal(),
    current_thesis_version_id: BASE_VERSION_ID,
  });

  assert.ok(result);
  assert.equal(result.contract_version, DOSSIER_STORY_CANONICAL_HANDOFF_VERSION);
  assert.equal(result.authority, "HANDOFF_ONLY");
  assert.equal(result.mutation_kind, "existing_story_update");
  assert.equal(result.writer_route, CANONICAL_STORY_REASONING_WRITER_ROUTE);
  assert.equal(result.writer_route, "rpc/persist_canonical_story_reasoning");
  assert.equal(result.required_reasoning_contract, CANONICAL_STORY_REASONING_CONTRACT);
  assert.equal(result.required_reasoning_contract, "canonical-story-reasoning/v1");
  assert.equal(result.story_id, STORY_ID);
  assert.equal(result.expected_base_version_id, BASE_VERSION_ID);
  assert.deepEqual(result.required_canonical_evidence_ids, [EVIDENCE_ID]);
});

test("B4.3 stale current Story pointer fails closed", () => {
  assert.equal(buildDossierStoryCanonicalPersistenceHandoff({
    proposal: proposal(),
    current_thesis_version_id: "33333333-3333-4333-8333-333333333333",
  }), null);
});

test("B4.3 missing or invalid current Story pointer fails closed", () => {
  assert.equal(buildDossierStoryCanonicalPersistenceHandoff({
    proposal: proposal(),
    current_thesis_version_id: null,
  }), null);

  assert.equal(buildDossierStoryCanonicalPersistenceHandoff({
    proposal: proposal(),
    current_thesis_version_id: "not-a-version-id",
  }), null);
});

test("B4.3 invalid proposal base version fails closed", () => {
  assert.equal(buildDossierStoryCanonicalPersistenceHandoff({
    proposal: proposal({ expected_base_version_id: "not-a-version-id" }),
    current_thesis_version_id: "not-a-version-id",
  }), null);
});

test("B4.3 requires canonical evidence UUIDs", () => {
  assert.equal(buildDossierStoryCanonicalPersistenceHandoff({
    proposal: proposal({
      required_canonical_evidence_ids: ["research-intake:rates-1"],
    }),
    current_thesis_version_id: BASE_VERSION_ID,
  }), null);
});

test("B4.3 preserves the proposal's exact canonical evidence identity", () => {
  const result = buildDossierStoryCanonicalPersistenceHandoff({
    proposal: proposal({
      required_canonical_evidence_ids: [EVIDENCE_ID],
    }),
    current_thesis_version_id: BASE_VERSION_ID,
  });

  assert.ok(result);
  assert.deepEqual(result.required_canonical_evidence_ids, [EVIDENCE_ID]);
});

test("B4.3 mutation identity is deterministic for the same proposal and base version", () => {
  const first = buildDossierStoryCanonicalPersistenceHandoff({
    proposal: proposal(),
    current_thesis_version_id: BASE_VERSION_ID,
  });
  const second = buildDossierStoryCanonicalPersistenceHandoff({
    proposal: proposal(),
    current_thesis_version_id: BASE_VERSION_ID,
  });

  assert.ok(first);
  assert.ok(second);
  assert.equal(first.mutation_key, second.mutation_key);
  assert.equal(first.proposal_fingerprint, second.proposal_fingerprint);
});

test("B4.3 mutation identity changes when the immutable base version changes", () => {
  const otherBase = "44444444-4444-4444-8444-444444444444";
  const first = buildDossierStoryCanonicalPersistenceHandoff({
    proposal: proposal(),
    current_thesis_version_id: BASE_VERSION_ID,
  });
  const second = buildDossierStoryCanonicalPersistenceHandoff({
    proposal: proposal({ expected_base_version_id: otherBase }),
    current_thesis_version_id: otherBase,
  });

  assert.ok(first);
  assert.ok(second);
  assert.notEqual(first.mutation_key, second.mutation_key);
  assert.notEqual(first.proposal_fingerprint, second.proposal_fingerprint);
});

test("B4.3 mutation identity changes when canonical evidence changes", () => {
  const otherEvidence = "55555555-5555-4555-8555-555555555555";
  const first = buildDossierStoryCanonicalPersistenceHandoff({
    proposal: proposal(),
    current_thesis_version_id: BASE_VERSION_ID,
  });
  const second = buildDossierStoryCanonicalPersistenceHandoff({
    proposal: proposal({ required_canonical_evidence_ids: [otherEvidence] }),
    current_thesis_version_id: BASE_VERSION_ID,
  });

  assert.ok(first);
  assert.ok(second);
  assert.notEqual(first.mutation_key, second.mutation_key);
  assert.notEqual(first.proposal_fingerprint, second.proposal_fingerprint);
});

test("B4.3 REFINE and STORY_AND_REGIME remain routing metadata only", () => {
  const result = buildDossierStoryCanonicalPersistenceHandoff({
    proposal: proposal({
      decision: "REFINE",
      canonical_reassessment_scope: "STORY_AND_REGIME",
      refined_motion: {
        headline: "Corrected rates framing",
        why_interesting: "Only the evidence-bounded mechanism survives.",
        big_picture_bridge: "Rates -> financing -> valuation.",
      },
      regime_implication: "Regime reassessment may later be warranted.",
    }),
    current_thesis_version_id: BASE_VERSION_ID,
  });

  assert.ok(result);
  assert.equal(result.decision, "REFINE");
  assert.equal(result.canonical_reassessment_scope, "STORY_AND_REGIME");
  assert.equal(result.authority, "HANDOFF_ONLY");
});

test("B4.3 handoff contains no Story or reasoning payload capable of writing a version", () => {
  const result = buildDossierStoryCanonicalPersistenceHandoff({
    proposal: proposal(),
    current_thesis_version_id: BASE_VERSION_ID,
  });

  assert.ok(result);
  assert.equal("storyPayload" in result, false);
  assert.equal("reasoning" in result, false);
  assert.equal("event" in result, false);
  assert.equal("current_thesis_version_id" in result, false);
});

test("B4.3 source contains no direct database writer or thesis-version insert", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const source = fs.readFileSync(
    path.join(root, "lib", "dossier-v2", "story-reassessment-persistence-handoff.ts"),
    "utf8",
  );

  assert.doesNotMatch(source, /intelligenceRest\s*</);
  assert.doesNotMatch(source, /story_thesis_versions/i);
  assert.doesNotMatch(source, /current_thesis_version_id\s*=/);
  assert.doesNotMatch(source, /insert\s+into/i);
  assert.match(source, /rpc\/persist_canonical_story_reasoning/);
});

test("B4.3 canonical runtime already uses the same writer route", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const runtime = fs.readFileSync(
    path.join(root, "lib", "intelligence", "runtime.ts"),
    "utf8",
  );

  assert.match(
    runtime,
    /intelligenceRest<CanonicalStoryPersistenceResult\[]>\("rpc\/persist_canonical_story_reasoning"/,
  );
  assert.match(runtime, /p_mutation_key:\s*mutationKey/);
  assert.match(runtime, /p_story_id:\s*storyId/);
  assert.match(runtime, /p_reasoning:\s*reasoning/);
});

test("B4.3 documents that the existing canonical writer atomically versions and moves the pointer", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const migration = fs.readFileSync(
    path.join(
      root,
      "supabase",
      "migrations",
      "20260823183129_canonical_story_reasoning_atomic_persistence.sql",
    ),
    "utf8",
  );

  assert.match(migration, /insert into public\.story_thesis_versions/);
  assert.match(
    migration,
    /update public\.stories story[\s\S]*set current_thesis_version_id = new_version_id/,
  );
  assert.match(
    migration,
    /where version\.snapshot ->> 'canonicalMutationKey' = mutation_key_value/,
  );
});
