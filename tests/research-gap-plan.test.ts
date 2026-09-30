import assert from "node:assert/strict";
import test from "node:test";

import type { ResearchGapCaseRow } from "../lib/research-gap-lifecycle.ts";
import {
  buildResearchGapPlan,
  evaluateResearchGapEvidence,
  type ResearchGapEvidenceAssessment,
} from "../lib/research-gap-plan.ts";

function gap(overrides: Partial<ResearchGapCaseRow> = {}): ResearchGapCaseRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    gap_key: "gap:investigation:inv:duration",
    status: "CLAIMED",
    research_outcome: null,
    source_kind: "investigation",
    source_ref: "inv:duration",
    question: "Is duration stress broadening beyond the front end?",
    action: "Decompose long-end yields and verify cross-asset transmission.",
    reason: "Tests whether rates stress is becoming broader financial tightening.",
    evidence_needed: ["10Y/30Y real-yield versus breakeven decomposition", "HY/IG and MOVE/VIX confirmation"],
    linked_investigation_ids: ["inv:duration"],
    linked_story_ids: ["story:rates"],
    blocking_refs: ["REGIME:CURRENT"],
    latest_work_id: "gap-work:duration",
    latest_dossier_id: "22222222-2222-4222-8222-222222222222",
    latest_dossier_as_of: "2026-10-01T00:00:00.000Z",
    latest_priority_rank: 1,
    latest_priority_score: 88,
    first_seen_at: "2026-10-01T00:00:00.000Z",
    last_seen_at: "2026-10-01T00:00:00.000Z",
    occurrence_count: 1,
    claim_token: "33333333-3333-4333-8333-333333333333",
    claimed_by: "worker-1",
    claimed_at: "2026-10-01T00:05:00.000Z",
    claim_expires_at: "2026-10-01T00:15:00.000Z",
    attempt_count: 1,
    completed_at: null,
    handed_off_at: null,
    closed_at: null,
    research_plan_version: null,
    research_plan: null,
    research_started_at: null,
    verdict_version: null,
    verdict: null,
    handoff_run_key: null,
    handoff_canonical_status: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:05:00.000Z",
    ...overrides,
  };
}

function assessment(
  plan: ReturnType<typeof buildResearchGapPlan>,
  overrides: Partial<ResearchGapEvidenceAssessment> = {},
): ResearchGapEvidenceAssessment {
  return {
    evidenceId: "ev-1",
    independenceKey: "source-1",
    sourceClass: "official",
    sourceUrl: "https://example.com/evidence",
    requirementIds: plan.requirements.map((item) => item.id),
    direction: "CONFIRMING",
    directness: "DIRECT",
    quality: 94,
    traceable: true,
    claim: "The evidence directly supports the tested mechanism.",
    ...overrides,
  };
}

test("Research Gap plan is bounded, deterministic and preserves explicit missing-evidence branches", () => {
  const first = buildResearchGapPlan(gap(), new Date("2026-10-01T00:06:00Z"));
  const second = buildResearchGapPlan(gap(), new Date("2026-10-01T00:07:00Z"));

  assert.equal(first.contractVersion, "research-gap-plan/1");
  assert.equal(first.planId, second.planId);
  assert.equal(first.requirements.length, 2);
  assert.deepEqual(
    first.requirements.map((item) => item.description),
    ["10Y/30Y real-yield versus breakeven decomposition", "HY/IG and MOVE/VIX confirmation"],
  );
  assert.equal(first.priorExpectation, null);
  assert.equal(first.budget.maxSources, 8);
  assert.equal(first.budget.maxBranches, 3);
  assert.ok(first.requirements.every((item) => item.preferredSourceClasses.includes("market_data")));
});

test("one authoritative direct source can resolve CONFIRMING only when all requirements are covered", () => {
  const plan = buildResearchGapPlan(gap());
  const verdict = evaluateResearchGapEvidence({
    plan,
    evidence: [assessment(plan)],
    branchCount: 1,
    now: new Date("2026-10-01T00:10:00Z"),
  });

  assert.equal(verdict.outcome, "CONFIRMING");
  assert.equal(verdict.shouldStop, true);
  assert.equal(verdict.stopReason, "direction_resolved");
  assert.equal(verdict.missingRequirementIds.length, 0);
  assert.equal(verdict.authoritativeConfirming, true);
});

test("missing required evidence keeps research open even with a strong source", () => {
  const plan = buildResearchGapPlan(gap());
  const verdict = evaluateResearchGapEvidence({
    plan,
    evidence: [assessment(plan, {
      requirementIds: [plan.requirements[0]!.id],
    })],
    branchCount: 1,
  });

  assert.equal(verdict.outcome, "UNRESOLVED");
  assert.equal(verdict.shouldStop, false);
  assert.deepEqual(verdict.missingRequirementIds, [plan.requirements[1]!.id]);
  assert.match(verdict.nextResearch[0] || "", /HY\/IG/i);
});

test("strong independent evidence on both sides stops as UNRESOLVED rather than forcing a story", () => {
  const plan = buildResearchGapPlan(gap());
  const verdict = evaluateResearchGapEvidence({
    plan,
    evidence: [
      assessment(plan, {
        evidenceId: "confirm",
        independenceKey: "official-a",
        direction: "CONFIRMING",
      }),
      assessment(plan, {
        evidenceId: "contradict",
        independenceKey: "official-b",
        sourceUrl: "https://example.org/evidence",
        direction: "CONTRADICTING",
      }),
    ],
    branchCount: 2,
  });

  assert.equal(verdict.outcome, "UNRESOLVED");
  assert.equal(verdict.shouldStop, true);
  assert.equal(verdict.stopReason, "conflicting_strong_evidence");
});

test("complete strong neutral evidence resolves NO_CHANGE", () => {
  const plan = buildResearchGapPlan(gap());
  const verdict = evaluateResearchGapEvidence({
    plan,
    evidence: [assessment(plan, {
      direction: "NEUTRAL",
      evidenceId: "neutral",
    })],
    branchCount: 1,
  });

  assert.equal(verdict.outcome, "NO_CHANGE");
  assert.equal(verdict.shouldStop, true);
  assert.equal(verdict.stopReason, "no_change_resolved");
});

test("bounded research stops UNRESOLVED when source budget is exhausted", () => {
  const plan = buildResearchGapPlan(gap());
  const evidence = Array.from({ length: plan.budget.maxSources }, (_, index) => assessment(plan, {
    evidenceId: `weak-${index}`,
    independenceKey: `weak-source-${index}`,
    sourceUrl: `https://example.com/evidence-${index}`,
    direction: "UNRESOLVED",
    directness: "INDIRECT",
    quality: 70,
  }));

  const verdict = evaluateResearchGapEvidence({ plan, evidence, branchCount: 2 });

  assert.equal(verdict.outcome, "UNRESOLVED");
  assert.equal(verdict.shouldStop, true);
  assert.equal(verdict.stopReason, "budget_exhausted");
});
