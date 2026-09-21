import assert from "node:assert/strict";
import test from "node:test";

import type { MarketDossierV2 } from "../lib/dossier-v2/contracts.ts";
import type { ResearchBrainOutputV1 } from "../lib/dossier-v2/research-brain-contracts.ts";
import {
  selectDossierV2Presentation,
  selectExactDossierV2Presentation,
} from "../lib/dossier-v2/presentation-reader.ts";

function brain({
  degraded = false,
  state = "confirmed",
  version = 2,
}: {
  degraded?: boolean;
  state?: "confirmed" | "weakened" | "invalidated" | "unresolved" | "evolved";
  version?: number;
} = {}): ResearchBrainOutputV1 {
  return {
    contract_version: "research-brain/1",
    packet_id: "packet",
    as_of: "2026-09-21T12:45:41.378Z",
    main_thread: {
      thread_id: "thread-1",
      headline: degraded ? "Research Brain degraded" : "Energy, rates and semis define the current regime.",
      answer: degraded ? "Primary reasoning unavailable." : "Cross-asset state is supported.",
      regime_implication: degraded ? "UNRESOLVED" : "Energy and rates remain the main constraints.",
      epistemic_label: degraded ? "SPECULATIVE" : "SUPPORTED",
      evidence_references: degraded ? [] : ["ev-1"],
      supporting_story_ids: degraded ? [] : ["story-1"],
      contradiction_references: [],
      what_would_change_mind: "New evidence.",
    },
    major_stories: degraded ? [] : [{
      story_id: "story-1",
      title: "Energy strength",
      what_changed: "WTI rose.",
      why_it_matters: "Inflation pressure.",
      headline_decomposition: "WTI higher.",
      causal_mechanism: "Energy transmits into inflation.",
      market_evidence: { confirming: ["ev-1"], contradicting: [], unresolved: [] },
      conclusion: "Energy is firm.",
      what_would_change_mind: "WTI reversal.",
      linked_thesis_ids: ["thesis-1"],
      linked_investigation_ids: ["inv-1"],
      linked_chart_task_ids: ["chart-1"],
      epistemic_label: "OBSERVED",
      evidence_ids: ["ev-1"],
    }],
    chart_investigation_queue: { core: [], optional: [] },
    investigations: [],
    market_verdict: {
      verdict_id: "verdict-1",
      lenses: {},
      cross_asset_readthrough: degraded ? "Degraded." : "Energy and rates dominate.",
      epistemic_label: degraded ? "SPECULATIVE" : "SUPPORTED",
      dominant_confirmation: degraded ? "None" : "Energy",
      dominant_contradiction: "None",
    },
    research_now: [],
    stock_radar: [],
    developing_themes: [],
    creator_theme_expansions: [],
    thesis_ledger: {
      contract_version: "thesis-ledger/2",
      entries: [{
        thesis_id: "thesis-1",
        contract_version: "thesis-ledger/2",
        root_thesis_id: "thesis-1",
        parent_thesis_id: null,
        successor_thesis_id: null,
        title: "Energy thesis",
        statement: "Energy remains firm.",
        state,
        version,
        created_at: "2026-09-20T00:00:00Z",
        updated_at: "2026-09-21T12:45:41.378Z",
        lineage: [],
        state_reason: "Evidence changed.",
        current_evidence_refs: degraded ? [] : ["ev-1"],
        observed_market_reaction: degraded ? null : "WTI higher",
        next_catalyst_or_tripwire: "EIA",
      }],
    },
    contradictions_detected: [],
    research_gaps: degraded ? [{
      gap_id: "gap-degraded",
      category: "RESEARCH_BRAIN_DEGRADED",
      description: "Model pass degraded.",
      severity: "MATERIAL",
    }] : [],
    diagnostics: {
      degraded,
      degradation_reasons: degraded ? ["Model pass degraded."] : [],
      omitted_or_demoted_items: [],
      missing_input_categories: [],
      model_repair_used: false,
      notes: [],
    },
  };
}

function dossier({
  id,
  asOf,
  previousDossierId = null,
  output = brain(),
}: {
  id: string;
  asOf: string;
  previousDossierId?: string | null;
  output?: ResearchBrainOutputV1;
}): MarketDossierV2 {
  return {
    id,
    contract_version: "market-dossier-v2/1",
    previous_dossier_id: previousDossierId,
    as_of: asOf,
    freshness: { warnings: [] },
    research_gaps: [...output.research_gaps],
    payload: {
      contract_version: output.contract_version,
      packet_id: output.packet_id,
      analytical_output: {
        ...output,
        as_of: asOf,
      },
    },
    created_at: asOf,
  };
}

const HEALTHY_ID = "11111111-1111-4111-8111-111111111111";
const DEGRADED_ID = "22222222-2222-4222-8222-222222222222";
const OLDER_ID = "33333333-3333-4333-8333-333333333333";

test("reader selects the latest healthy Dossier as current", () => {
  const result = selectDossierV2Presentation([
    dossier({ id: HEALTHY_ID, asOf: "2026-09-21T12:45:00Z" }),
    dossier({ id: OLDER_ID, asOf: "2026-09-21T10:00:00Z" }),
  ]);

  assert.equal(result.status, "current");
  assert.equal(result.selectedDossierId, HEALTHY_ID);
  assert.equal(result.latestDossierId, HEALTHY_ID);
  assert.equal(result.usingFallback, false);
  assert.equal(result.notice.tone, "ready");
});

test("reader falls back to the previous healthy Dossier when latest is degraded", () => {
  const healthy = dossier({
    id: HEALTHY_ID,
    asOf: "2026-09-21T12:45:00Z",
  });
  const degraded = dossier({
    id: DEGRADED_ID,
    asOf: "2026-09-21T13:00:00Z",
    previousDossierId: HEALTHY_ID,
    output: brain({ degraded: true }),
  });

  const result = selectDossierV2Presentation([healthy, degraded]);

  assert.equal(result.status, "fallback_previous_healthy");
  assert.equal(result.latestDossierId, DEGRADED_ID);
  assert.equal(result.selectedDossierId, HEALTHY_ID);
  assert.equal(result.usingFallback, true);
  assert.equal(result.notice.tone, "warn");
  assert.match(result.notice.detail, /latest Dossier is degraded/i);
});

test("reader falls back when latest analytical payload is malformed", () => {
  const healthy = dossier({
    id: HEALTHY_ID,
    asOf: "2026-09-21T12:45:00Z",
  });
  const malformed = dossier({
    id: DEGRADED_ID,
    asOf: "2026-09-21T13:00:00Z",
    previousDossierId: HEALTHY_ID,
  });
  malformed.payload = {};

  const result = selectDossierV2Presentation([healthy, malformed]);

  assert.equal(result.status, "fallback_previous_healthy");
  assert.equal(result.latestDossierId, DEGRADED_ID);
  assert.equal(result.selectedDossierId, HEALTHY_ID);
  assert.match(result.notice.detail, /could not be rendered safely/i);
});

test("reader exposes the degraded latest Dossier only when no healthy fallback exists", () => {
  const degraded = dossier({
    id: DEGRADED_ID,
    asOf: "2026-09-21T13:00:00Z",
    output: brain({ degraded: true }),
  });

  const result = selectDossierV2Presentation([degraded]);

  assert.equal(result.status, "degraded_latest");
  assert.equal(result.selectedDossierId, DEGRADED_ID);
  assert.equal(result.presentation?.health.degraded, true);
  assert.equal(result.notice.tone, "warn");
});

test("reader reports unavailable when no persisted Dossier exists", () => {
  const result = selectDossierV2Presentation([]);

  assert.equal(result.status, "unavailable");
  assert.equal(result.presentation, null);
  assert.equal(result.notice.tone, "error");
});

test("selected healthy presentation receives its prior Dossier for thesis diffs", () => {
  const previous = dossier({
    id: OLDER_ID,
    asOf: "2026-09-21T10:00:00Z",
    output: brain({ state: "unresolved", version: 1 }),
  });
  const current = dossier({
    id: HEALTHY_ID,
    asOf: "2026-09-21T12:45:00Z",
    previousDossierId: OLDER_ID,
    output: brain({ state: "confirmed", version: 2 }),
  });

  const result = selectDossierV2Presentation([current, previous]);

  assert.equal(result.status, "current");
  assert.equal(result.presentation?.thesisChanges.length, 1);
  assert.equal(result.presentation?.thesisChanges[0].change, "state_changed");
  assert.equal(result.presentation?.thesisChanges[0].previousState, "unresolved");
  assert.equal(result.presentation?.thesisChanges[0].state, "confirmed");
});


test("exact historical replay never falls forward to a newer healthy Dossier", () => {
  const degradedHistorical = dossier({
    id: DEGRADED_ID,
    asOf: "2026-09-21T11:00:00Z",
    previousDossierId: OLDER_ID,
    output: brain({ degraded: true }),
  });
  const newerHealthy = dossier({
    id: HEALTHY_ID,
    asOf: "2026-09-21T12:45:00Z",
  });

  const currentSelection = selectDossierV2Presentation([newerHealthy, degradedHistorical]);
  const historicalSelection = selectExactDossierV2Presentation(degradedHistorical, null, DEGRADED_ID);

  assert.equal(currentSelection.selectedDossierId, HEALTHY_ID);
  assert.equal(historicalSelection.status, "historical_exact");
  assert.equal(historicalSelection.requestedDossierId, DEGRADED_ID);
  assert.equal(historicalSelection.selectedDossierId, DEGRADED_ID);
  assert.equal(historicalSelection.presentation?.health.degraded, true);
  assert.equal(historicalSelection.usingFallback, false);
  assert.match(historicalSelection.notice.detail, /exact immutable historical Dossier/i);
});

test("exact historical replay uses the historical predecessor for thesis diffs", () => {
  const previous = dossier({
    id: OLDER_ID,
    asOf: "2026-09-21T10:00:00Z",
    output: brain({ state: "unresolved", version: 1 }),
  });
  const exact = dossier({
    id: HEALTHY_ID,
    asOf: "2026-09-21T12:45:00Z",
    previousDossierId: OLDER_ID,
    output: brain({ state: "confirmed", version: 2 }),
  });

  const result = selectExactDossierV2Presentation(exact, previous, HEALTHY_ID);

  assert.equal(result.status, "historical_exact");
  assert.equal(result.presentation?.thesisChanges.length, 1);
  assert.equal(result.presentation?.thesisChanges[0].previousState, "unresolved");
  assert.equal(result.presentation?.thesisChanges[0].state, "confirmed");
});

test("missing exact historical Dossier fails closed instead of substituting current state", () => {
  const result = selectExactDossierV2Presentation(null, null, DEGRADED_ID);

  assert.equal(result.status, "unavailable");
  assert.equal(result.requestedDossierId, DEGRADED_ID);
  assert.equal(result.presentation, null);
  assert.equal(result.usingFallback, false);
});
