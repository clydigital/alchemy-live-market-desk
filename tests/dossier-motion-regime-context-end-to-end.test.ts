import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { MarketDossierV2 } from "../lib/dossier-v2/contracts.ts";
import { buildDossierV2Presentation } from "../lib/dossier-v2/presentation-adapter.ts";
import { materialProjectionSignature } from "../lib/regime-engine.ts";
import { buildRegimeProjection } from "../lib/regimes.ts";

const DOSSIER_ID = "11111111-1111-4111-8111-111111111111";

function brainOutput(withDecision: boolean) {
  return {
    contract_version: "research-brain/1",
    packet_id: "packet-c1-5",
    as_of: "2026-10-06T00:00:00.000Z",
    diagnostics: {
      degraded: false,
      degradation_reasons: [],
      missing_input_categories: [],
      model_repair_used: false,
      notes: [],
      omitted_or_demoted_items: [],
    },
    contradictions_detected: [],
    main_thread: {
      thread_id: "thread-1",
      headline: "Rates remain restrictive.",
      answer: "Long-end funding pressure remains relevant.",
      regime_implication: "Funding conditions remain restrictive.",
      regime_family: "MIXED_TRANSITION",
      epistemic_label: "SUPPORTED",
      evidence_references: ["evidence-rates-1"],
      supporting_story_ids: [],
      contradiction_references: [],
      what_would_change_mind: "A durable long-end reversal.",
    },
    major_stories: [],
    chart_investigation_queue: { core: [], optional: [] },
    investigations: [],
    market_verdict: {
      verdict_id: "verdict-1",
      lenses: {},
      cross_asset_readthrough: "Rates remain the main transmission channel.",
      epistemic_label: "SUPPORTED",
      dominant_confirmation: "Long-end yields remain elevated.",
      dominant_contradiction: "None.",
    },
    motion_acceptance: {
      contract_version: "dossier-motion-acceptance/1",
      decisions: withDecision
        ? [{
            motion_id: "motion-rates-1",
            decision: "REFINE",
            conclusion: "Long-end pressure remains a Regime-level funding constraint, but the causal channel is unresolved.",
            canonical_evidence_refs: ["evidence-rates-1"],
            destination_refs: ["REGIME:CURRENT"],
            rationale: "Canonical evidence supports the narrower Regime implication.",
            next_test: "Separate real yields from term premium.",
          }]
        : [],
    },
    research_now: [],
    stock_radar: [],
    developing_themes: [],
    creator_theme_expansions: [],
    thesis_ledger: { contract_version: "thesis-ledger/2", entries: [] },
    research_gaps: [],
  } as any;
}

function dossier(withDecision: boolean): MarketDossierV2 {
  return {
    id: DOSSIER_ID,
    contract_version: "market-dossier-v2/1",
    previous_dossier_id: null,
    as_of: "2026-10-06T00:00:00.000Z",
    freshness: { warnings: [], evidence_states: [] },
    research_gaps: [],
    payload: {
      contract_version: "research-brain/1",
      packet_id: "packet-c1-5",
      motion_context_snapshot: {
        contract_version: "dossier-motion-context/1",
        omitted_count: 0,
        items: [{
          motion_id: "motion-rates-1",
          motion_key: "rates:long-end",
          version_number: 3,
          occurred_at: "2026-10-05T23:00:00.000Z",
          observed_at: "2026-10-05T23:05:00.000Z",
          expires_at: "2026-10-07T23:05:00.000Z",
          category: "RATES",
          verification_state: "VERIFIED",
          headline: "Raw Motion wording is not Regime truth.",
          what_happened: "Long yields remained elevated.",
          market_reaction: null,
          why_interesting: "Raw Motion rationale.",
          big_picture_bridge: "Raw Motion bridge.",
          next_test: "Separate real-yield and term-premium channels.",
          primary_story_id: null,
          primary_regime_slug: "global-cost-of-capital",
          routing_class: "REGIME",
          attention: { materiality: 90, relevance: 95, novelty: 70 },
          origin_evidence_ref: "evidence-rates-1",
        }],
      },
      analytical_output: brainOutput(withDecision),
    },
    created_at: "2026-10-06T00:00:01.000Z",
  };
}

function project(presentation: ReturnType<typeof buildDossierV2Presentation>) {
  return buildRegimeProjection({
    stories: [],
    events: [],
    versions: [],
    newsThreads: [],
    statements: [],
    dossier: presentation,
  });
}

test("C1.5 closure: immutable Dossier System-2 judgement reaches exact Regime as context only", () => {
  const presentation = buildDossierV2Presentation(dossier(true));
  const projected = project(presentation);
  const rates = projected.find((item) => item.slug === "global-cost-of-capital");
  const ai = projected.find((item) => item.slug === "us-china-ai");

  assert.ok(rates);
  assert.ok(ai);
  assert.equal(presentation.motionRegimeContext?.length, 1);
  assert.equal(presentation.motionRegimeContext?.[0]?.regimeSlug, "global-cost-of-capital");

  assert.equal(rates.dossierContext?.length, 1);
  assert.equal(rates.dossierContext?.[0]?.sourceKind, "dossier_motion");
  assert.equal(rates.dossierContext?.[0]?.state, "context");
  assert.equal(rates.dossierContext?.[0]?.verification, "dossier-system2:refine");
  assert.equal(
    rates.dossierContext?.[0]?.title,
    "Long-end pressure remains a Regime-level funding constraint, but the causal channel is unresolved.",
  );
  assert.equal(
    rates.dossierContext?.[0]?.title.includes("Raw Motion wording"),
    false,
  );
  assert.deepEqual(ai.dossierContext, []);
});

test("C1.5 closure: accepted Regime context remains outside material Regime state", () => {
  const withContext = project(buildDossierV2Presentation(dossier(true)));
  const withoutContext = project(buildDossierV2Presentation(dossier(false)));

  const before = withoutContext.find((item) => item.slug === "global-cost-of-capital");
  const after = withContext.find((item) => item.slug === "global-cost-of-capital");
  assert.ok(before);
  assert.ok(after);

  assert.equal(after.state, before.state);
  assert.equal(after.stateKind, before.stateKind);
  assert.equal(after.confidence, before.confidence);
  assert.deepEqual(
    materialProjectionSignature(after),
    materialProjectionSignature(before),
  );
});

test("C1.5 closure: Live presentation labels System-2 Dossier context as non-state", () => {
  const board = readFileSync(
    new URL("../components/live-desk/RegimeBoard.tsx", import.meta.url),
    "utf8",
  );
  const strip = readFileSync(
    new URL("../components/live-desk/MarketRegimeStrip.tsx", import.meta.url),
    "utf8",
  );
  const detail = readFileSync(
    new URL("../components/live-desk/RegimeDetailWorkspace.tsx", import.meta.url),
    "utf8",
  );

  assert.match(board, /SYSTEM 2 DOSSIER CONTEXT · NON-STATE/);
  assert.match(strip, /System 2 Dossier context · non-state/);
  assert.match(detail, /SYSTEM 2 · DOSSIER CONTEXT/);
  assert.match(detail, /Non-state · cannot change Regime state by itself/);
  assert.match(detail, /durable Stories and System 1 telemetry still determine the structural state/);
});
