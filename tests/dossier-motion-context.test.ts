import assert from "node:assert/strict";
import test from "node:test";

import { attachDossierMotionContext } from "../lib/dossier-v2/motion-context.ts";
import type { DossierV2InputPacket } from "../lib/dossier-v2/input-packet.ts";
import type { MarketMotionRecord } from "../lib/market-motion.ts";

const AS_OF = "2026-10-04T03:00:00.000Z";

function packet(): DossierV2InputPacket {
  return {
    packet_id: "before-motion",
    contract_version: "dossier-v2-input/1",
    as_of: AS_OF,
    previous_dossier_id: null,
    observed_evidence: [{
      evidence_id: "ev:canonical:1",
      epistemic_label: "OBSERVED",
      claim_or_fact: "Canonical evidence exists independently of Motion.",
      category: "MACRO",
      source_type: "OFFICIAL_DATA",
      available_at: "2026-10-04T02:00:00.000Z",
      provenance: [{ source_type: "OFFICIAL_DATA", source_id: "official-1" }],
    }],
    research_leads: [],
    prior_analytical_state: {
      previous_dossier_id: null,
      as_of: null,
      prior_claims: [],
      thesis_ledger: null,
    },
    development_clusters: [],
    creator_themes: [],
    catalysts: [],
    thesis_ledger: null,
    rate_context: { evidence: [] },
    freshness_warnings: [],
    evidence_states: [],
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

function motion(overrides: Partial<MarketMotionRecord> = {}): MarketMotionRecord {
  return {
    id: "motion-1",
    motion_key: "event:rates:motion-1",
    version_number: 2,
    previous_version_id: "motion-0",
    contract_version: "market-motion/v1",
    research_run_id: "run-1",
    source_id: "source-1",
    evidence_id: "ev:not-in-packet",
    primary_story_id: "story-rates",
    primary_regime_slug: "us-china-ai",
    lifecycle_state: "PROMOTED",
    effective_state: "PROMOTED",
    category: "RATES",
    verification_state: "VERIFIED",
    headline: "Rates framing deserves attention",
    what_happened: "A promoted Motion item points System 2 toward the rates move.",
    market_reaction: "Rates moved.",
    why_interesting: "The framing may matter.",
    big_picture_bridge: "Rates → financial conditions",
    next_test: "Test it against canonical evidence.",
    promotion_reason: "Canonical Story changed.",
    tickers: ["US10Y"],
    source_name: "Reuters",
    source_url: "https://www.reuters.com/example",
    source_kind: "reporting",
    materiality: 92,
    relevance: 90,
    novelty: 80,
    occurred_at: "2026-10-04T02:15:00.000Z",
    observed_at: "2026-10-04T02:20:00.000Z",
    expires_at: "2026-10-06T02:20:00.000Z",
    metadata: {},
    created_at: "2026-10-04T02:20:00.000Z",
    ...overrides,
  };
}

test("A2 Motion context is bounded, rehashed and never manufactures an evidence reference", () => {
  const before = packet();
  const result = attachDossierMotionContext(before, [
    motion(),
    motion({ id: "motion-2", motion_key: "event:rates:motion-2", evidence_id: "ev:canonical:1", materiality: 91 }),
    motion({ id: "motion-3", motion_key: "event:rates:motion-3", materiality: 90 }),
    motion({ id: "motion-4", motion_key: "event:rates:motion-4", materiality: 89 }),
  ]);

  assert.notEqual(result.packet_id, before.packet_id);
  assert.equal(result.motion_context?.items.length, 3);
  assert.equal(result.motion_context?.omitted_count, 1);

  const first = result.motion_context?.items.find((item) => item.motion_id === "motion-1");
  assert.equal(first?.origin_evidence_ref, null);

  const canonicalLinked = result.motion_context?.items.find((item) => item.motion_id === "motion-2");
  assert.equal(canonicalLinked?.origin_evidence_ref, "ev:canonical:1");

  assert.equal("source_url" in (first ?? {}), false);
  assert.equal("source_name" in (first ?? {}), false);
});

test("A2 Motion context excludes future and unpromoted rows", () => {
  const result = attachDossierMotionContext(packet(), [
    motion({ id: "future", observed_at: "2026-10-04T04:00:00.000Z" }),
    motion({ id: "plain", lifecycle_state: "MOTION", effective_state: "MOTION" }),
    motion({ id: "accepted" }),
  ]);

  assert.deepEqual(result.motion_context?.items.map((item) => item.motion_id), ["accepted"]);
});
