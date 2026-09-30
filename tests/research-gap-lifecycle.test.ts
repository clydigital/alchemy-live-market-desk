import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  claimResearchGapCases,
  releaseResearchGapCase,
  syncResearchGapPriorityQueue,
} from "../lib/research-gap-lifecycle.ts";
import type {
  PrioritisedResearchGap,
  ResearchGapPriorityQueue,
} from "../lib/research-gap-prioritizer.ts";

function item(overrides: Partial<PrioritisedResearchGap> = {}): PrioritisedResearchGap {
  return {
    workId: "gap-work:dossier-specific",
    gapKey: "gap:investigation:inv:duration",
    sourceKind: "investigation",
    sourceRef: "inv:duration",
    dossierId: "11111111-1111-4111-8111-111111111111",
    dossierAsOf: "2026-10-01T00:00:00.000Z",
    question: "Is duration stress broadening?",
    action: "Pull credit and volatility confirmation.",
    reason: "Tests transmission.",
    evidenceNeeded: ["MOVE", "VIX"],
    linkedInvestigationIds: ["inv:duration"],
    linkedStoryIds: ["story:rates"],
    blockingRefs: [],
    nativeSignals: {
      severity: null,
      gapClass: null,
      expectedInformationGain: null,
      researchNowRank: null,
      investigationStatus: "open",
      divergence: "UNRESOLVED",
    },
    priorityRank: 1,
    priorityScore: 72,
    scoreBreakdown: {
      blocker: 0,
      informationGain: 0,
      nativeRank: 0,
      investigationState: 16,
      linkage: 8,
      evidenceNeed: 4,
    },
    selectionReason: ["unresolved/divergent investigation"],
    ...overrides,
  };
}

function queue(selected: PrioritisedResearchGap[]): ResearchGapPriorityQueue {
  return {
    contractVersion: "research-gap-priority-queue/1",
    generatedAt: "2026-10-01T00:05:00.000Z",
    dossierId: "11111111-1111-4111-8111-111111111111",
    dossierAsOf: "2026-10-01T00:00:00.000Z",
    selected,
    suppressed: [],
    diagnostics: {
      maxSelected: 3,
      sourceCandidateCount: selected.length,
      selectedCount: selected.length,
      duplicateCoverageSuppressed: 0,
      cutoffSuppressed: 0,
      policy: [],
    },
  };
}

test("lifecycle sync persists the stable gap key rather than the Dossier-scoped work ID", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const fakeClient = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return {
        data: [{
          id: "22222222-2222-4222-8222-222222222222",
          gap_key: args.p_gap_key,
          status: "QUEUED",
          latest_work_id: args.p_work_id,
          occurrence_count: 1,
        }],
        error: null,
      };
    },
  };

  const result = await syncResearchGapPriorityQueue(
    queue([item()]),
    fakeClient as never,
    new Date("2026-10-01T00:10:00Z"),
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.name, "upsert_research_gap_case");
  assert.equal(calls[0]?.args.p_gap_key, "gap:investigation:inv:duration");
  assert.equal(calls[0]?.args.p_work_id, "gap-work:dossier-specific");
  assert.equal(result.cases[0]?.gap_key, "gap:investigation:inv:duration");
});

test("claim requests are tightly bounded before reaching the atomic database RPC", async () => {
  let seen: Record<string, unknown> | null = null;
  const fakeClient = {
    async rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, "claim_research_gap_cases");
      seen = args;
      return { data: [], error: null };
    },
  };

  await claimResearchGapCases(
    { workerId: "gap-worker-a", batchSize: 99, leaseSeconds: 99_999 },
    fakeClient as never,
  );

  assert.equal(seen?.p_worker_id, "gap-worker-a");
  assert.equal(seen?.p_batch_size, 3);
  assert.equal(seen?.p_lease_seconds, 1800);
});

test("release is ownership-token guarded", async () => {
  let seen: Record<string, unknown> | null = null;
  const fakeClient = {
    async rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, "release_research_gap_case");
      seen = args;
      return { data: true, error: null };
    },
  };

  const released = await releaseResearchGapCase({
    caseId: "22222222-2222-4222-8222-222222222222",
    claimToken: "33333333-3333-4333-8333-333333333333",
  }, fakeClient as never);

  assert.equal(released, true);
  assert.equal(seen?.p_case_id, "22222222-2222-4222-8222-222222222222");
  assert.equal(seen?.p_claim_token, "33333333-3333-4333-8333-333333333333");
});

test("lifecycle machine endpoint is whitelisted and supports sync, claim and release", () => {
  const config = readFileSync(new URL("../lib/supabase/config.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/research-gap/lifecycle/route.ts", import.meta.url), "utf8");

  assert.match(config, /MACHINE_AUTH_PATHS[\s\S]*"\/api\/research-gap\/lifecycle"/);
  assert.match(route, /input\.action === "sync"/);
  assert.match(route, /input\.action === "claim"/);
  assert.match(route, /input\.action === "release"/);
  assert.match(route, /acceptsResearchAuthorization/);
});
