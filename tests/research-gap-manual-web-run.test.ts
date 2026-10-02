import assert from "node:assert/strict";
import test from "node:test";

import type {
  ClaimedResearchGapCase,
  ResearchGapCaseRow,
} from "../lib/research-gap-lifecycle.ts";
import { buildResearchGapPlan } from "../lib/research-gap-plan.ts";
import { handleManualResearchGapWebRun } from "../lib/research-gap-manual-web-run.ts";

const claimToken = "22222222-2222-4222-8222-222222222222";

function gap(overrides: Partial<ClaimedResearchGapCase> = {}): ClaimedResearchGapCase {
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
    evidence_needed: [
      "10Y/30Y real-yield versus breakeven decomposition",
      "HY/IG and MOVE/VIX confirmation",
    ],
    linked_investigation_ids: ["inv:duration"],
    linked_story_ids: ["story:rates"],
    blocking_refs: [],
    latest_work_id: "gap-work:duration",
    latest_dossier_id: "33333333-3333-4333-8333-333333333333",
    latest_dossier_as_of: "2026-10-01T00:00:00.000Z",
    latest_priority_rank: 1,
    latest_priority_score: 88,
    first_seen_at: "2026-10-01T00:00:00.000Z",
    last_seen_at: "2026-10-01T00:00:00.000Z",
    occurrence_count: 1,
    claim_token: claimToken,
    claimed_by: "github-gap:123",
    claimed_at: "2026-10-01T00:05:00.000Z",
    claim_expires_at: "2026-10-01T00:35:00.000Z",
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

function request() {
  return new Request("https://example.com/api/admin/research-gap/run-one", {
    method: "POST",
    headers: { authorization: "Bearer oidc-token" },
  });
}

const authorize = async () => ({
  authorized: true as const,
  actor: "clydigital",
  githubRunId: "123",
  workflowSha: "a".repeat(40),
});

test("manual one-case executor claims, researches and completes without canonical handoff", async () => {
  const claimed = gap();
  let completedInput: Record<string, unknown> | null = null;
  let releaseCalls = 0;

  const response = await handleManualResearchGapWebRun(request(), {
    authorize,
    claim: async (input) => {
      assert.deepEqual(input, {
        workerId: "github-gap:123",
        batchSize: 1,
        leaseSeconds: 1800,
      });
      return [claimed];
    },
    loadContext: async () => ({} as never),
    buildPlan: (row, now) => buildResearchGapPlan(row, now),
    start: async (input) => ({
      ...claimed,
      status: "RESEARCHING",
      research_plan_version: input.planVersion,
      research_plan: input.plan,
    } as ResearchGapCaseRow),
    research: async (plan) => ({
      evidence: [{
        evidenceId: "ev-official",
        independenceKey: "treasury.gov",
        sourceClass: "official",
        sourceUrl: "https://home.treasury.gov/example",
        sourceTitle: "Treasury evidence",
        publisher: "U.S. Treasury",
        publishedAt: "2026-10-01T00:08:00Z",
        summary: "Direct evidence.",
        requirementIds: plan.requirements.map((item) => item.id),
        direction: "CONFIRMING",
        directness: "DIRECT",
        quality: 95,
        traceable: true,
        claim: "The long-end move is directly supported by the official decomposition.",
      }],
      branchCount: plan.budget.maxBranches,
      sourceCount: 3,
      branchQueries: ["a", "b", "c"],
      model: "test-model",
    }),
    complete: async (input) => {
      completedInput = input as unknown as Record<string, unknown>;
      return {
        ...claimed,
        status: "COMPLETED",
        research_outcome: input.outcome,
        verdict_version: input.verdictVersion,
        verdict: input.verdict,
        completed_at: input.completedAt || null,
      } as ResearchGapCaseRow;
    },
    release: async () => {
      releaseCalls += 1;
      return true;
    },
    now: () => new Date("2026-10-01T00:10:00Z"),
    logger: () => undefined,
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "completed");
  assert.equal(body.outcome, "CONFIRMING");
  assert.equal(body.handoff, "not_attempted_portion_9b");
  assert.equal(body.evidenceSnapshotVersion, "research-gap-evidence-snapshot/1");
  assert.equal(releaseCalls, 0);
  assert.ok(completedInput);
  assert.equal((completedInput!.verdict as any).evidenceSnapshot.length, 1);
});

test("manual executor releases the owned case when web research fails", async () => {
  const claimed = gap();
  let released: { caseId: string; claimToken: string } | null = null;

  const response = await handleManualResearchGapWebRun(request(), {
    authorize,
    claim: async () => [claimed],
    loadContext: async () => ({} as never),
    buildPlan: (row, now) => buildResearchGapPlan(row, now),
    start: async () => ({ ...claimed, status: "RESEARCHING" } as ResearchGapCaseRow),
    research: async () => {
      throw new Error("provider unavailable");
    },
    release: async (input) => {
      released = input;
      return true;
    },
    now: () => new Date("2026-10-01T00:10:00Z"),
    logger: () => undefined,
  });

  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.status, "failed");
  assert.equal(body.released, true);
  assert.deepEqual(released, {
    caseId: claimed.id,
    claimToken,
  });
});

test("manual executor exits cleanly when no Research Gap case is queued", async () => {
  const response = await handleManualResearchGapWebRun(request(), {
    authorize,
    claim: async () => [],
    logger: () => undefined,
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "empty");
});
