import assert from "node:assert/strict";
import test from "node:test";

import type { MarketDossierV2 } from "../lib/dossier-v2/contracts.ts";
import {
  buildDeterministicDossierPatch,
  decideDossierDelta,
  type DossierDeltaContext,
} from "../lib/dossier-v2/delta-gate.ts";
import type { DossierV2InputPacket } from "../lib/dossier-v2/input-packet.ts";
import {
  RESEARCH_BRAIN_CONTRACT_VERSION,
  THESIS_LEDGER_V2_CONTRACT_VERSION,
  type MarketLens,
  type ResearchBrainOutputV1,
} from "../lib/dossier-v2/research-brain-contracts.ts";

const previousAsOf = "2026-09-25T13:05:18.055Z";
const currentAsOf = "2026-09-26T09:00:00.000Z";

function lenses(): Record<string, MarketLens> {
  return Object.fromEntries([
    "US_RATES",
    "BONDS",
    "TECH_AI",
    "OIL_WAR_INFLATION",
    "USD",
    "GOLD",
    "CREDIT",
    "BREADTH",
  ].map((lens_name) => [lens_name, {
    lens_name,
    observed_reaction: null,
    observed_reaction_evidence_refs: [],
    interpretation: "The prior validated lens remains in force until new canonical evidence changes it.",
    contradiction_references: [],
    unresolved_signals: [],
  }])) as Record<string, MarketLens>;
}

function packet(): DossierV2InputPacket {
  return {
    packet_id: "packet:delta-current",
    contract_version: "dossier-v2-input/1",
    as_of: currentAsOf,
    previous_dossier_id: "11111111-1111-4111-8111-111111111111",
    observed_evidence: [
      {
        evidence_id: "ev:rates:official",
        epistemic_label: "OBSERVED",
        claim_or_fact: "The official rates observation changed.",
        category: "RATES",
        source_type: "OFFICIAL_DATA",
        available_at: "2026-09-26T08:30:00.000Z",
        provenance: [{
          source_type: "OFFICIAL_DATA",
          source_id: "rates-official",
          publisher: "Official Rates Source",
        }],
      },
      {
        evidence_id: "ev:rates:market",
        epistemic_label: "OBSERVED",
        claim_or_fact: "The market rates observation confirmed the move.",
        category: "RATES",
        source_type: "MARKET_DATA",
        available_at: "2026-09-26T08:31:00.000Z",
        metrics: { support_direction: "supporting" },
        provenance: [{
          source_type: "MARKET_DATA",
          source_id: "rates-market",
          publisher: "Market Feed",
        }],
      },
    ],
    research_leads: [],
    prior_analytical_state: {
      previous_dossier_id: "11111111-1111-4111-8111-111111111111",
      as_of: previousAsOf,
      prior_claims: [],
      thesis_ledger: {
        contract_version: "thesis-ledger/1",
        entries: [{
          thesis_id: "thesis:rates",
          contract_version: "thesis-ledger/1",
          title: "Rates remain the macro constraint",
          statement: "Long-duration rates pressure remains the main macro constraint.",
          state: "confirmed",
          version: 1,
          created_at: previousAsOf,
          updated_at: previousAsOf,
          lineage: [],
        }],
      },
    },
    development_clusters: [],
    creator_themes: [],
    catalysts: [],
    thesis_ledger: {
      contract_version: "thesis-ledger/1",
      entries: [{
        thesis_id: "thesis:rates",
        contract_version: "thesis-ledger/1",
        title: "Rates remain the macro constraint",
        statement: "Long-duration rates pressure remains the main macro constraint.",
        state: "confirmed",
        version: 1,
        created_at: previousAsOf,
        updated_at: previousAsOf,
        lineage: [],
      }],
    },
    freshness_warnings: [],
    research_gaps: [],
    diagnostics: {
      omitted_clusters_count: 0,
      omitted_evidence_count: 0,
      omitted_leads_count: 0,
      omitted_creator_themes_count: 0,
      omitted_creator_claims_count: 0,
      omitted_catalysts_count: 0,
      omitted_prior_claims_count: 0,
      omitted_thesis_entries_count: 0,
      omitted_research_gaps_count: 0,
      byte_limit_truncation_applied: false,
      notes: [],
    },
  };
}

function priorOutput(): ResearchBrainOutputV1 {
  return {
    contract_version: RESEARCH_BRAIN_CONTRACT_VERSION,
    packet_id: "packet:delta-prior",
    as_of: previousAsOf,
    main_thread: {
      thread_id: "thread:rates",
      headline: "Rates remain the dominant market constraint",
      answer: "Long-duration rates pressure is still the main macro constraint.",
      regime_implication: "Duration remains vulnerable while broader transmission is incomplete.",
      regime_family: "RATES_LED_TIGHTENING",
      epistemic_label: "SUPPORTED",
      evidence_references: ["ev:rates:official", "ev:rates:market"],
      supporting_story_ids: ["story-rates"],
      contradiction_references: [],
      what_would_change_mind: "A sustained reversal in rates with broader risk confirmation.",
    },
    major_stories: [{
      story_id: "story-rates",
      title: "Long-end rates remain restrictive",
      what_changed: "Long-end rates remained elevated.",
      why_it_matters: "Higher duration costs constrain risk assets.",
      headline_decomposition: "Rates remain the primary macro pressure.",
      causal_mechanism: "Higher long-end yields tighten financial conditions.",
      market_evidence: {
        confirming: ["ev:rates:official", "ev:rates:market"],
        contradicting: [],
        unresolved: [],
      },
      conclusion: "Rates remain restrictive.",
      what_would_change_mind: "A sustained reversal lower in yields.",
      linked_thesis_ids: ["thesis:rates"],
      linked_investigation_ids: [],
      linked_chart_task_ids: [],
      epistemic_label: "SUPPORTED",
      evidence_ids: ["ev:rates:official", "ev:rates:market"],
    }],
    chart_investigation_queue: { core: [], optional: [] },
    investigations: [],
    market_verdict: {
      verdict_id: "verdict:rates",
      lenses: lenses(),
      cross_asset_readthrough: "Rates remain the main macro constraint while transmission is incomplete.",
      epistemic_label: "SUPPORTED",
      dominant_confirmation: "Rates remain elevated.",
      dominant_contradiction: "Credit transmission remains incomplete.",
    },
    research_now: [],
    stock_radar: [],
    developing_themes: [],
    creator_theme_expansions: [],
    thesis_ledger: {
      contract_version: THESIS_LEDGER_V2_CONTRACT_VERSION,
      entries: [{
        thesis_id: "thesis:rates",
        contract_version: THESIS_LEDGER_V2_CONTRACT_VERSION,
        root_thesis_id: "thesis:rates",
        parent_thesis_id: null,
        successor_thesis_id: null,
        title: "Rates remain the macro constraint",
        statement: "Long-duration rates pressure remains the main macro constraint.",
        state: "confirmed",
        version: 1,
        created_at: previousAsOf,
        updated_at: previousAsOf,
        lineage: [],
        state_reason: "Rates remain restrictive.",
        current_evidence_refs: ["ev:rates:official", "ev:rates:market"],
        observed_market_reaction: null,
        next_catalyst_or_tripwire: "A sustained reversal lower in yields.",
        arguments: [],
      }],
    },
    contradictions_detected: [],
    research_gaps: [],
    diagnostics: {
      degraded: false,
      degradation_reasons: [],
      omitted_or_demoted_items: [],
      missing_input_categories: [],
      model_repair_used: false,
      notes: [],
    },
  };
}

function previousDossier(): MarketDossierV2 {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    contract_version: "market-dossier-v2/1",
    previous_dossier_id: null,
    as_of: previousAsOf,
    freshness: {},
    research_gaps: [],
    payload: {
      contract_version: RESEARCH_BRAIN_CONTRACT_VERSION,
      packet_id: "packet:delta-prior",
      analytical_output: priorOutput(),
    },
    created_at: "2026-09-25T13:06:00.000Z",
  };
}

function patchContext(): DossierDeltaContext {
  return {
    available: true,
    warning: null,
    states: [{
      story_id: "story-rates",
      lifecycle_status: "confirmed",
      publication_eligible: true,
      qualification_score: 91,
      thesis_signature: "rates-v2",
      causal_mechanism: "Higher long-end yields keep duration-sensitive financial conditions restrictive.",
      affected_assets: ["US10Y", "SPX"],
      decisive_evidence_ids: ["ev:rates:official", "ev:rates:market"],
      source_ancestry_group_ids: ["official-rates", "market-feed"],
      confirmation_criteria: ["Long yields remain elevated."],
      invalidation_criteria: ["Long yields reverse lower on a sustained basis."],
      next_catalysts: ["Next inflation release"],
      novelty_class: "existing_story_update",
      research_synthesis: "The rates constraint strengthened without broad credit stress.",
      market_belief: "Markets continue to price duration pressure as the main constraint.",
      divergence_summary: null,
      strongest_support: "Official and market rates evidence agree.",
      strongest_contradiction: "Credit remains contained.",
      last_material_update_at: "2026-09-26T08:40:00.000Z",
      last_evidence_at: "2026-09-26T08:31:00.000Z",
      last_evaluated_at: "2026-09-26T08:45:00.000Z",
    }],
    stories: [{
      id: "story-rates",
      title: "Long-end rates remain restrictive",
      thesis: "Long-duration rates pressure remains the main macro constraint.",
      market_question: "Is the rates shock transmitting beyond duration?",
      best_explanation: "Long-end yields remain restrictive while credit transmission is incomplete.",
      strongest_support: "Official and market rates evidence agree.",
      strongest_contradiction: "Credit remains contained.",
      confirmation_trigger: "Long yields stay elevated.",
      invalidation_trigger: "Long yields reverse lower on a sustained basis.",
      next_catalyst: "Next inflation release",
      assets: ["US10Y", "SPX"],
      confidence: 91,
    }],
  };
}

test("Dossier delta gate returns NO_CHANGE when evidence changes but canonical Stories do not", () => {
  const decision = decideDossierDelta({
    packet: packet(),
    previousDossier: previousDossier(),
    context: { available: true, states: [], stories: [], warning: null },
  });

  assert.equal(decision.action, "NO_CHANGE");
  assert.equal(decision.postIntelligenceModelCallBudget, 0);
  assert.equal(decision.newObservedEvidence, 2);
});

test("Dossier delta gate selects zero-token PATCH for one qualified canonical Story change", () => {
  const decision = decideDossierDelta({
    packet: packet(),
    previousDossier: previousDossier(),
    context: patchContext(),
  });

  assert.equal(decision.action, "PATCH");
  assert.equal(decision.postIntelligenceModelCallBudget, 0);
  assert.deepEqual(decision.changedStoryIds, ["story-rates"]);
});

test("deterministic PATCH updates Story and thesis state without another model call", () => {
  const currentPacket = packet();
  const prior = previousDossier();
  const context = patchContext();
  const decision = decideDossierDelta({
    packet: currentPacket,
    previousDossier: prior,
    context,
  });

  const patch = buildDeterministicDossierPatch({
    packet: currentPacket,
    previousDossier: prior,
    context,
    decision,
  });

  assert.deepEqual(patch.errors, []);
  assert.ok(patch.output);
  assert.equal(patch.output?.packet_id, currentPacket.packet_id);
  assert.equal(patch.output?.as_of, currentPacket.as_of);
  assert.equal(
    patch.output?.major_stories[0]?.conclusion,
    "The rates constraint strengthened without broad credit stress.",
  );
  assert.equal(patch.output?.thesis_ledger.entries[0]?.version, 2);
  assert.match(
    patch.output?.diagnostics.notes.join(" ") || "",
    /no post-intelligence model call/i,
  );
});

test("Dossier delta gate escalates invalidation of a represented Story to REBASE", () => {
  const context = patchContext();
  context.states[0] = {
    ...context.states[0],
    lifecycle_status: "invalidated",
    publication_eligible: false,
  };

  const decision = decideDossierDelta({
    packet: packet(),
    previousDossier: previousDossier(),
    context,
  });

  assert.equal(decision.action, "REBASE");
  assert.equal(decision.postIntelligenceModelCallBudget, 2);
  assert.match(decision.reason, /invalidated|archived/i);
});
