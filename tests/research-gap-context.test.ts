import assert from "node:assert/strict";
import test from "node:test";

import {
  adaptMacroPulseContext,
  adaptMarketMotionContext,
  buildResearchGapPlanContext,
  loadResearchGapPlanContext,
} from "../lib/research-gap-context.ts";
import type { MarketDossierV2 } from "../lib/dossier-v2/contracts.ts";
import type { ResearchGapCaseRow } from "../lib/research-gap-lifecycle.ts";

function dossier(id: string, previous: string | null, asOf: string): MarketDossierV2 {
  return {
    id,
    contract_version: "market-dossier-v2/1",
    previous_dossier_id: previous,
    as_of: asOf,
    freshness: {},
    research_gaps: [],
    payload: { analytical_output: { investigations: [] } },
    created_at: asOf,
  };
}

function gap(overrides: Partial<ResearchGapCaseRow> = {}): ResearchGapCaseRow {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    gap_key: "gap:investigation:duration",
    status: "CLAIMED",
    research_outcome: null,
    source_kind: "investigation",
    source_ref: "inv:duration",
    question: "Is duration stress broadening?",
    action: "Check rates transmission.",
    reason: null,
    evidence_needed: ["MOVE"],
    linked_investigation_ids: ["inv:duration"],
    linked_story_ids: ["story:rates"],
    blocking_refs: [],
    latest_work_id: "gap-work:current",
    latest_dossier_id: "33333333-3333-4333-8333-333333333333",
    latest_dossier_as_of: "2026-10-01T00:30:00.000Z",
    latest_priority_rank: 1,
    latest_priority_score: 80,
    first_seen_at: "2026-09-30T00:00:00.000Z",
    last_seen_at: "2026-10-01T00:30:00.000Z",
    occurrence_count: 3,
    claim_token: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    claimed_by: "worker-1",
    claimed_at: "2026-10-01T00:55:00.000Z",
    claim_expires_at: "2026-10-01T01:10:00.000Z",
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
    created_at: "2026-09-30T00:00:00.000Z",
    updated_at: "2026-10-01T00:55:00.000Z",
    ...overrides,
  };
}

const occurrence = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  gap_case_id: gap().id,
  dossier_id: gap().latest_dossier_id,
  dossier_as_of: gap().latest_dossier_as_of,
  work_id: gap().latest_work_id,
  source_kind: "investigation",
  source_ref: "inv:duration",
  priority_rank: 1,
  priority_score: 80,
  snapshot: { contractVersion: "research-gap-case-snapshot/1" },
  observed_at: "2026-10-01T00:31:00.000Z",
  created_at: "2026-10-01T00:31:00.000Z",
};

test("freezes occurrence authority plus the exact newest-three Dossier lineage", () => {
  const oldest = dossier("11111111-1111-4111-8111-111111111111", null, "2026-09-30T12:00:00.000Z");
  const prior = dossier("22222222-2222-4222-8222-222222222222", oldest.id, "2026-10-01T00:00:00.000Z");
  const current = dossier(gap().latest_dossier_id, prior.id, gap().latest_dossier_as_of);
  const context = buildResearchGapPlanContext({
    gap: gap(), occurrence, dossierLineage: [current, prior, oldest], frozenAt: "2026-10-01T01:00:00.000Z",
  });

  assert.deepEqual(context.dossierLineage.map((item) => item.id), [current.id, prior.id, oldest.id]);
  assert.deepEqual(context.sources.map((item) => [item.sourceType, item.authority]), [
    ["research_gap_occurrence", "operational_authority"],
    ["dossier_v2", "canonical"],
    ["dossier_v2", "context_only"],
    ["dossier_v2", "context_only"],
  ]);
});

test("fails closed for missing and cyclic predecessors", () => {
  const current = dossier(gap().latest_dossier_id, "22222222-2222-4222-8222-222222222222", gap().latest_dossier_as_of);
  assert.throws(() => buildResearchGapPlanContext({
    gap: gap(), occurrence, dossierLineage: [current], frozenAt: "2026-10-01T01:00:00.000Z",
  }), /missing predecessor/i);

  const prior = dossier("22222222-2222-4222-8222-222222222222", current.id, "2026-10-01T00:00:00.000Z");
  assert.throws(() => buildResearchGapPlanContext({
    gap: gap(), occurrence, dossierLineage: [current, prior], frozenAt: "2026-10-01T01:00:00.000Z",
  }), /cycle/i);
});

test("adapts MacroPulse deterministically as context-only", () => {
  const input = {
    id: "macropulse:2026-10-01-am",
    contractVersion: "macropulse/1",
    asOf: "2026-10-01T00:00:00.000Z",
    payload: { themes: ["rates", "oil"] },
  };
  const first = adaptMacroPulseContext(input);
  assert.deepEqual(first, adaptMacroPulseContext(input));
  assert.equal(first.authority, "context_only");
  assert.equal(first.sourceType, "macropulse");
  assert.notEqual(first.payload, input.payload);
});

test("adapts exact Market Motion as context-only", () => {
  const source = adaptMarketMotionContext({
    id: "motion-1",
    contractVersion: "market-motion/v1",
    asOf: "2026-10-01T00:40:00.000Z",
    payload: { motion_key: "event:rates:test", next_test: "Check the long end." },
  });
  assert.equal(source.sourceType, "market_motion");
  assert.equal(source.authority, "context_only");
  assert.equal(source.sourceId, "motion-1");
});

test("Motion-origin Gap loader freezes the exact immutable Motion row beside the canonical Dossier", async () => {
  const motionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const motionGap = gap({
    source_kind: "market_motion",
    source_ref: motionId,
    gap_key: "gap:motion:event:rates:test:branch:abc",
    question: "Check whether long-end stress persists.",
    action: "Investigate Motion: Check whether long-end stress persists.",
    evidence_needed: ["10Y/30Y real yields"],
    linked_investigation_ids: [],
  });
  const current = dossier(motionGap.latest_dossier_id, null, motionGap.latest_dossier_as_of);
  const motionOccurrence = {
    ...occurrence,
    gap_case_id: motionGap.id,
    dossier_id: motionGap.latest_dossier_id,
    dossier_as_of: motionGap.latest_dossier_as_of,
    work_id: motionGap.latest_work_id,
    source_kind: "market_motion",
    source_ref: motionId,
  };
  const motionRow = {
    id: motionId,
    contract_version: "market-motion/v1",
    observed_at: "2026-10-01T00:40:00.000Z",
    motion_key: "event:rates:test",
    next_test: "Check whether long-end stress persists.",
  };
  const tables: Record<string, Array<Record<string, unknown>>> = {
    research_gap_case_occurrences: [motionOccurrence],
    market_dossiers_v2: [current] as unknown as Array<Record<string, unknown>>,
    market_motion_items: [motionRow],
  };
  const client = {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const query = {
        select() { return query; },
        eq(column: string, value: unknown) { rows = rows.filter((row) => row[column] === value); return query; },
        async maybeSingle() { return { data: rows[0] ?? null, error: null }; },
      };
      return query;
    },
  };

  const context = await loadResearchGapPlanContext(
    motionGap,
    client as never,
    new Date("2026-10-01T01:00:00.000Z"),
  );
  assert.deepEqual(context.sources.map((item) => item.sourceType), [
    "research_gap_occurrence",
    "dossier_v2",
    "market_motion",
  ]);
  assert.equal(context.sources.at(-1)?.sourceId, motionId);
});

test("loader follows predecessor IDs and ignores an unrelated newer Dossier", async () => {
  const oldest = dossier("11111111-1111-4111-8111-111111111111", null, "2026-09-30T12:00:00.000Z");
  const prior = dossier("22222222-2222-4222-8222-222222222222", oldest.id, "2026-10-01T00:00:00.000Z");
  const current = dossier(gap().latest_dossier_id, prior.id, gap().latest_dossier_as_of);
  const unrelated = dossier("44444444-4444-4444-8444-444444444444", null, "2026-10-01T00:45:00.000Z");
  const tables: Record<string, Array<Record<string, unknown>>> = {
    research_gap_case_occurrences: [occurrence],
    market_dossiers_v2: [unrelated, current, prior, oldest] as unknown as Array<Record<string, unknown>>,
  };
  const client = {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const query = {
        select() { return query; },
        eq(column: string, value: unknown) { rows = rows.filter((row) => row[column] === value); return query; },
        async maybeSingle() { return { data: rows[0] ?? null, error: null }; },
      };
      return query;
    },
  };

  const context = await loadResearchGapPlanContext(gap(), client as never, new Date("2026-10-01T01:00:00.000Z"));
  assert.deepEqual(context.dossierLineage.map((item) => item.id), [current.id, prior.id, oldest.id]);
  assert.equal(context.dossierLineage.some((item) => item.id === unrelated.id), false);
});
