import assert from "node:assert/strict";
import test from "node:test";

import type { MarketDossierV2 } from "../lib/dossier-v2/contracts.ts";
import {
  buildResearchGapWorkQueue,
  loadLatestResearchGapWorkQueue,
  type CanonicalDivergenceResearchDebtRow,
} from "../lib/research-gap-worker.ts";

function dossier(): MarketDossierV2 {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    contract_version: "market-dossier-v2/1",
    previous_dossier_id: null,
    as_of: "2026-10-01T00:00:00.000Z",
    freshness: { warnings: [] },
    research_gaps: [],
    payload: { analytical_output: { research_now: [], investigations: [] } },
    created_at: "2026-10-01T00:01:00.000Z",
  };
}

function divergenceDebt(
  overrides: Partial<CanonicalDivergenceResearchDebtRow> = {},
): CanonicalDivergenceResearchDebtRow {
  return {
    debt_key: "divergence:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    severity: "high",
    status: "open",
    reason: "Material canonical divergence remains causally unresolved after Hypothesis.",
    next_action: "Recruit the first discriminator, then the second only if still unresolved.",
    next_check_at: "2026-10-01T01:00:00.000Z",
    metadata: {
      kind: "canonical_divergence_recruitment",
      contractVersion: "divergence-evidence-recruitment/1",
      divergenceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      marketBeliefId: "belief-rates",
      question: "Why did long-end yields stay elevated when they were expected to ease?",
      evidenceNeeded: [
        "real yields and breakevens around the divergence window",
        "curve, term-premium or meeting-pricing context only if the first test remains unresolved",
      ],
      magnitude: 82,
      persistenceScore: 76,
      resolutionState: "COMPETING_HYPOTHESES",
    },
    ...overrides,
  };
}

test("P2.2c adapts canonical divergence debt into the existing sequential Research Gap lifecycle", () => {
  const queue = buildResearchGapWorkQueue(
    dossier(),
    new Date("2026-10-01T01:00:00.000Z"),
    [],
    [divergenceDebt()],
  );

  const candidate = queue.candidates.find((item) => item.sourceRef.startsWith("divergence:"));
  assert.ok(candidate);
  assert.equal(candidate.sourceKind, "research_gap");
  assert.equal(candidate.nativeSignals.severity, "MATERIAL");
  assert.equal(candidate.nativeSignals.gapClass, "REFINEMENT");
  assert.equal(candidate.nativeSignals.divergence, "UNRESOLVED");
  assert.deepEqual(candidate.blockingRefs, [
    "DIVERGENCE:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "BELIEF:belief-rates",
  ]);

  assert.deepEqual(candidate.evidenceNeeded, [
    "real yields and breakevens around the divergence window",
  ]);
  assert.deepEqual(candidate.causalDiscriminatorPlan?.discriminators, [
    "real yields and breakevens around the divergence window",
    "curve, term-premium or meeting-pricing context only if the first test remains unresolved",
  ]);
  assert.equal(queue.sourceCounts.researchGaps, 1);
});

test("P2.2c malformed or non-open divergence debt fails closed", () => {
  const queue = buildResearchGapWorkQueue(
    dossier(),
    new Date("2026-10-01T01:00:00.000Z"),
    [],
    [
      divergenceDebt({ status: "resolved" }),
      divergenceDebt({ debt_key: "transcript:youtube:abc" }),
      divergenceDebt({ metadata: { kind: "other" } }),
      divergenceDebt({ metadata: { kind: "canonical_divergence_recruitment" } }),
    ],
  );

  assert.equal(queue.sourceCounts.researchGaps, 0);
  assert.equal(queue.candidates.length, 0);
});

test("P2.2c loader reads divergence debt but still does not read raw Market Motion", async () => {
  const calls: Array<[string, unknown]> = [];
  const row = dossier();

  const dossierQuery = {
    select(value: string) {
      calls.push(["dossier:select", value]);
      return this;
    },
    order(column: string, options: unknown) {
      calls.push([`dossier:order:${column}`, options]);
      return this;
    },
    limit(value: number) {
      calls.push(["dossier:limit", value]);
      return this;
    },
    async maybeSingle() {
      calls.push(["dossier:maybeSingle", true]);
      return { data: row, error: null };
    },
  };

  const debtQuery = {
    select(value: string) {
      calls.push(["debt:select", value]);
      return this;
    },
    eq(column: string, value: unknown) {
      calls.push([`debt:eq:${column}`, value]);
      return this;
    },
    like(column: string, value: unknown) {
      calls.push([`debt:like:${column}`, value]);
      return this;
    },
    order(column: string, options: unknown) {
      calls.push([`debt:order:${column}`, options]);
      return this;
    },
    async limit(value: number) {
      calls.push(["debt:limit", value]);
      return { data: [divergenceDebt()], error: null };
    },
  };

  const fakeClient = {
    from(table: string) {
      calls.push(["from", table]);
      if (table === "market_dossiers_v2") return dossierQuery;
      if (table === "research_debt") return debtQuery;
      throw new Error(`unexpected table ${table}`);
    },
  };

  const queue = await loadLatestResearchGapWorkQueue(
    fakeClient as never,
    new Date("2026-10-01T01:00:00.000Z"),
  );

  assert.equal(queue?.sourceCounts.researchGaps, 1);
  assert.ok(calls.some(([name, value]) => name === "debt:eq:status" && value === "open"));
  assert.ok(calls.some(([name, value]) => name === "debt:like:debt_key" && value === "divergence:%"));
  assert.ok(calls.some(([name, value]) => name === "debt:limit" && value === 12));
  assert.equal(calls.some(([name, value]) => name === "from" && value === "current_market_motion_items"), false);
});
