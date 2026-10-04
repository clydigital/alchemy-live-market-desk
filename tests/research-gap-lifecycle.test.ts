import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  claimResearchGapCases,
  findResearchGapCasesForMotionIds,
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
      motionAttention: 0,
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
  const calls: Array<Record<string, unknown>> = [];
  const fakeClient = {
    async rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, "claim_research_gap_cases");
      calls.push(args);
      return { data: [], error: null };
    },
  };

  await claimResearchGapCases(
    { workerId: "gap-worker-a", batchSize: 99, leaseSeconds: 99_999 },
    fakeClient as never,
  );

  assert.equal(calls[0]?.p_worker_id, "gap-worker-a");
  assert.equal(calls[0]?.p_batch_size, 3);
  assert.equal(calls[0]?.p_lease_seconds, 1800);
});

test("release is ownership-token guarded", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const fakeClient = {
    async rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, "release_research_gap_case");
      calls.push(args);
      return { data: true, error: null };
    },
  };

  const released = await releaseResearchGapCase({
    caseId: "22222222-2222-4222-8222-222222222222",
    claimToken: "33333333-3333-4333-8333-333333333333",
  }, fakeClient as never);

  assert.equal(released, true);
  assert.equal(calls[0]?.p_case_id, "22222222-2222-4222-8222-222222222222");
  assert.equal(calls[0]?.p_claim_token, "33333333-3333-4333-8333-333333333333");
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


test("B3d.2 exact Motion Gap lookup fences source kind, Motion IDs and current Dossier", async () => {
  const calls: Array<[string, unknown]> = [];
  const rows = [{
    id: "gap-case-1",
    source_kind: "market_motion",
    source_ref: "motion-1",
    latest_dossier_id: "dossier-1",
    status: "QUEUED",
  }];

  const query = {
    select(value: string) {
      calls.push(["select", value]);
      return this;
    },
    eq(column: string, value: unknown) {
      calls.push([`eq:${column}`, value]);
      return this;
    },
    in(column: string, value: unknown) {
      calls.push([`in:${column}`, value]);
      return this;
    },
    neq(column: string, value: unknown) {
      calls.push([`neq:${column}`, value]);
      return this;
    },
    order(column: string, value: unknown) {
      calls.push([`order:${column}`, value]);
      return this;
    },
    async limit(value: number) {
      calls.push(["limit", value]);
      return { data: rows, error: null };
    },
  };

  const fakeClient = {
    from(table: string) {
      assert.equal(table, "research_gap_cases");
      return query;
    },
  };

  const result = await findResearchGapCasesForMotionIds({
    motionIds: ["motion-1", "motion-1", " ", "motion-2"],
    dossierId: "dossier-1",
  }, fakeClient as never);

  assert.deepEqual(result, rows);
  assert.ok(calls.some(([name, value]) => name === "eq:source_kind" && value === "market_motion"));
  assert.ok(calls.some(([name, value]) => name === "in:source_ref" && JSON.stringify(value) === JSON.stringify(["motion-1", "motion-2"])));
  assert.ok(calls.some(([name, value]) => name === "eq:latest_dossier_id" && value === "dossier-1"));
  assert.ok(calls.some(([name, value]) => name === "neq:status" && value === "CLOSED"));
});

test("B3d.2 exact Motion Gap lookup performs no database read for an empty Motion set", async () => {
  let touched = false;
  const fakeClient = {
    from() {
      touched = true;
      throw new Error("should not query");
    },
  };

  const result = await findResearchGapCasesForMotionIds({
    motionIds: [],
    dossierId: "dossier-1",
  }, fakeClient as never);

  assert.deepEqual(result, []);
  assert.equal(touched, false);
});
