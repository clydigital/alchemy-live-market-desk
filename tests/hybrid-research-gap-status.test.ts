import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { MarketDossierV2 } from "../lib/dossier-v2/contracts.ts";
import { buildResearchGapWorkQueue } from "../lib/research-gap-worker.ts";
import { loadHybridResearchGapStatus } from "../lib/hybrid-research-gap-status.ts";

const SAFE_SELECT = "gap_key,status,source_kind,source_ref,linked_investigation_ids,linked_story_ids,latest_dossier_id,latest_dossier_as_of,updated_at";

function dossier(overrides: Partial<MarketDossierV2> = {}): MarketDossierV2 {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    contract_version: "market-dossier-v2/1",
    previous_dossier_id: null,
    as_of: "2026-10-01T00:00:00.000Z",
    freshness: { warnings: [] },
    research_gaps: [{
      gap_id: "gap:credit-confirmation",
      category: "INVESTIGATION_EVIDENCE",
      description: "Need current HY/IG confirmation.",
      severity: "MATERIAL",
      gap_class: "BLOCKER",
      blocking_refs: ["STORY:story:rates-duration-stress"],
    }],
    payload: {
      analytical_output: {
        research_now: [{
          rank: 1,
          action: "Decompose the full Treasury curve.",
          reason: "Separate Fed path from term premium.",
          expected_information_gain: "High",
          linked_investigations: ["inv:duration-transmission"],
          linked_stories: ["story:rates-duration-stress"],
          blocking_evidence: ["Bund/JGB 10Y/30Y"],
        }],
        investigations: [{
          investigation_id: "inv:duration-transmission",
          status: "open",
          question: "Is duration stress transmitting into credit?",
          research_next: "Pull MOVE/VIX and HY/IG.",
          why_it_matters: "Tests broader financial tightening.",
          missing_evidence: ["MOVE/VIX", "HY/IG"],
          linked_story_ids: ["story:rates-duration-stress"],
          divergence: "UNRESOLVED",
        }],
      },
    },
    created_at: "2026-10-01T00:01:00.000Z",
    ...overrides,
  };
}

function lifecycleRow(
  gapKey: string,
  sourceKind: "research_gap" | "research_now" | "investigation" | "market_motion",
  status: "NEW" | "QUEUED" | "CLAIMED" | "RESEARCHING" | "COMPLETED" | "HANDED_OFF" | "CLOSED",
  overrides: Record<string, unknown> = {},
) {
  return {
    gap_key: gapKey,
    status,
    source_kind: sourceKind,
    source_ref: sourceKind === "investigation" ? "inv:duration-transmission" : "source-ref",
    linked_investigation_ids: sourceKind === "investigation" ? ["inv:duration-transmission"] : [],
    linked_story_ids: ["story:rates-duration-stress"],
    latest_dossier_id: "11111111-1111-4111-8111-111111111111",
    latest_dossier_as_of: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T01:00:00.000Z",
    research_outcome: "CONTRADICTING",
    verdict: { outcome: "CONTRADICTING" },
    research_plan: { steps: ["hidden"] },
    confidence: 0.99,
    finding: "Must never reach Hybrid.",
    ...overrides,
  };
}

function fakeClientFor(input: {
  exactDossier: MarketDossierV2;
  lifecycleRows: Array<Record<string, unknown>>;
  calls: Array<[string, unknown]>;
}) {
  const dossierQuery = {
    select(value: string) {
      input.calls.push(["dossier:select", value]);
      return this;
    },
    eq(column: string, value: unknown) {
      input.calls.push([`dossier:eq:${column}`, value]);
      return this;
    },
    async maybeSingle() {
      input.calls.push(["dossier:maybeSingle", true]);
      return { data: input.exactDossier, error: null };
    },
  };
  const gapQuery = {
    select(value: string) {
      input.calls.push(["gap:select", value]);
      return this;
    },
    async in(column: string, values: string[]) {
      input.calls.push([`gap:in:${column}`, [...values]]);
      return {
        data: input.lifecycleRows.filter((row) =>
          values.includes(String(row.gap_key ?? ""))),
        error: null,
      };
    },
  };
  return {
    from(table: string) {
      if (table === "market_dossiers_v2") return dossierQuery;
      if (table === "research_gap_cases") return gapQuery;
      throw new Error(`unexpected table ${table}`);
    },
  };
}

test("B3 Hybrid status uses the exact selected Dossier identity", async () => {
  const exact = dossier();
  const keys = buildResearchGapWorkQueue(exact).candidates.map((item) => item.gapKey);
  const calls: Array<[string, unknown]> = [];
  const fakeClient = fakeClientFor({
    exactDossier: exact,
    lifecycleRows: [lifecycleRow(keys[0]!, "research_gap", "QUEUED")],
    calls,
  });

  const projection = await loadHybridResearchGapStatus(exact.id, fakeClient as never);

  assert.equal(projection?.dossierId, exact.id);
  assert.ok(calls.some(([name, value]) => name === "dossier:eq:id" && value === exact.id));
  assert.equal(calls.some(([name]) => String(name).startsWith("dossier:order:")), false);
});

test("B3 Hybrid status query selects lifecycle metadata only", async () => {
  const exact = dossier();
  const keys = buildResearchGapWorkQueue(exact).candidates.map((item) => item.gapKey);
  const calls: Array<[string, unknown]> = [];
  const fakeClient = fakeClientFor({
    exactDossier: exact,
    lifecycleRows: [lifecycleRow(keys[0]!, "research_gap", "COMPLETED")],
    calls,
  });

  await loadHybridResearchGapStatus(exact.id, fakeClient as never);

  const select = calls.find(([name]) => name === "gap:select")?.[1];
  assert.equal(select, SAFE_SELECT);
  const selected = String(select);
  for (const forbidden of [
    "research_outcome",
    "verdict",
    "research_plan",
    "confidence",
    "finding",
    "live_implication",
  ]) {
    assert.equal(selected.includes(forbidden), false, forbidden);
  }

  const source = readFileSync(new URL("../lib/hybrid-research-gap-status.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /ResearchGapCaseRow/);
  assert.doesNotMatch(source, /listResearchGapCases/);
});

test("B3 Hybrid status joins lifecycle by exact current-Dossier gap key only", async () => {
  const exact = dossier();
  const candidates = buildResearchGapWorkQueue(exact).candidates;
  const investigation = candidates.find((item) => item.sourceKind === "investigation")!;
  const calls: Array<[string, unknown]> = [];
  const fakeClient = fakeClientFor({
    exactDossier: exact,
    lifecycleRows: [
      lifecycleRow(investigation.gapKey, "investigation", "RESEARCHING"),
      lifecycleRow("gap:different-key", "investigation", "HANDED_OFF", {
        linked_investigation_ids: [...investigation.linkedInvestigationIds],
        linked_story_ids: [...investigation.linkedStoryIds],
      }),
      lifecycleRow("gap:motion:historical", "market_motion", "HANDED_OFF", {
        linked_investigation_ids: [...investigation.linkedInvestigationIds],
        linked_story_ids: [...investigation.linkedStoryIds],
      }),
    ],
    calls,
  });

  const projection = await loadHybridResearchGapStatus(exact.id, fakeClient as never);

  assert.deepEqual(projection?.items.map((item) => item.gapKey), [investigation.gapKey]);
  assert.equal(projection?.items[0]?.sourceKind, "investigation");
  assert.equal(projection?.items[0]?.lifecycleStatus, "RESEARCHING");
});

test("B3 Hybrid status projects COMPLETED and HANDED_OFF without research conclusions", async () => {
  const exact = dossier();
  const candidates = buildResearchGapWorkQueue(exact).candidates;
  const calls: Array<[string, unknown]> = [];
  const fakeClient = fakeClientFor({
    exactDossier: exact,
    lifecycleRows: [
      lifecycleRow(candidates[0]!.gapKey, "research_gap", "COMPLETED"),
      lifecycleRow(candidates[1]!.gapKey, "research_now", "HANDED_OFF"),
    ],
    calls,
  });

  const projection = await loadHybridResearchGapStatus(exact.id, fakeClient as never);

  assert.deepEqual(
    projection?.items.map((item) => item.lifecycleStatus),
    ["COMPLETED", "HANDED_OFF"],
  );
  assert.equal(projection?.counts.COMPLETED, 1);
  assert.equal(projection?.counts.HANDED_OFF, 1);

  for (const item of projection?.items ?? []) {
    assert.equal("researchOutcome" in item, false);
    assert.equal("research_outcome" in item, false);
    assert.equal("verdict" in item, false);
    assert.equal("finding" in item, false);
    assert.equal("confidence" in item, false);
  }
});

test("B3 Hybrid status invents no lifecycle state when no exact case exists", async () => {
  const exact = dossier();
  const calls: Array<[string, unknown]> = [];
  const fakeClient = fakeClientFor({
    exactDossier: exact,
    lifecycleRows: [],
    calls,
  });

  const projection = await loadHybridResearchGapStatus(exact.id, fakeClient as never);

  assert.deepEqual(projection?.items, []);
  assert.deepEqual(projection?.counts, {});
});
