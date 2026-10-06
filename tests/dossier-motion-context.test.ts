import assert from "node:assert/strict";
import test from "node:test";

import {
  attachDossierMotionContext,
  selectPromotedMotionEvidenceIdsForDossier,
} from "../lib/dossier-v2/motion-context.ts";
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
    category: "MACRO",
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

  const canonicalMetadataLinked = attachDossierMotionContext(
    before,
    [
      motion({
        id: "motion-metadata",
        motion_key: "event:rates:motion-metadata",
        evidence_id: null,
        metadata: { promotionEvidenceId: "canonical-uuid-1" },
      }),
    ],
    new Map([["canonical-uuid-1", "ev:canonical:1"]]),
  ).motion_context?.items[0];
  assert.equal(canonicalMetadataLinked?.origin_evidence_ref, "ev:canonical:1");

  const invalidMetadataLinked = attachDossierMotionContext(before, [
    motion({
      id: "motion-metadata-invalid",
      motion_key: "event:rates:motion-metadata-invalid",
      evidence_id: null,
      metadata: { promotionEvidenceId: "ev:not-in-packet" },
    }),
  ]).motion_context?.items[0];
  assert.equal(invalidMetadataLinked?.origin_evidence_ref, null);

  assert.equal("source_url" in (first ?? {}), false);
  assert.equal("source_name" in (first ?? {}), false);
});

test("promoted Motion evidence selector pins only chronology-safe selected canonical UUIDs", () => {
  const ids = selectPromotedMotionEvidenceIdsForDossier([
    motion({
      id: "selected-a",
      materiality: 95,
      metadata: { promotionEvidenceId: "canonical-a" },
    }),
    motion({
      id: "selected-b",
      materiality: 94,
      metadata: { promotionEvidenceId: "canonical-b" },
    }),
    motion({
      id: "selected-c",
      materiality: 93,
      metadata: { promotionEvidenceId: "canonical-c" },
    }),
    motion({
      id: "below-cap",
      materiality: 92,
      metadata: { promotionEvidenceId: "canonical-d" },
    }),
    motion({
      id: "future",
      observed_at: "2026-10-04T04:00:00.000Z",
      materiality: 99,
      metadata: { promotionEvidenceId: "canonical-future" },
    }),
    motion({
      id: "plain",
      lifecycle_state: "MOTION",
      effective_state: "MOTION",
      materiality: 100,
      metadata: { promotionEvidenceId: "canonical-plain" },
    }),
  ], AS_OF);

  assert.deepEqual(ids, ["canonical-a", "canonical-b", "canonical-c"]);
});

test("A2 Motion context excludes future and unpromoted rows", () => {
  const result = attachDossierMotionContext(packet(), [
    motion({ id: "future", observed_at: "2026-10-04T04:00:00.000Z" }),
    motion({ id: "plain", lifecycle_state: "MOTION", effective_state: "MOTION" }),
    motion({ id: "accepted" }),
  ]);

  assert.deepEqual(result.motion_context?.items.map((item) => item.motion_id), ["accepted"]);
});


test("B2 Dossier context admits Story Regime and Investigation-candidate promoted Motion", () => {
  const result = attachDossierMotionContext(packet(), [
    motion({
      id: "story-route",
      motion_key: "event:story",
      primary_story_id: "story-rates",
      primary_regime_slug: "global-cost-of-capital",
      materiality: 93,
    }),
    motion({
      id: "regime-route",
      motion_key: "event:regime",
      primary_story_id: null,
      primary_regime_slug: "global-cost-of-capital",
      materiality: 92,
    }),
    motion({
      id: "investigation-route",
      motion_key: "event:investigation",
      primary_story_id: null,
      primary_regime_slug: null,
      next_test: "Compare dealer positioning with independent duration and volatility evidence.",
      materiality: 91,
    }),
  ]);

  assert.deepEqual(
    result.motion_context?.items.map((item) => [item.motion_id, item.routing_class]),
    [
      ["story-route", "STORY"],
      ["regime-route", "REGIME"],
      ["investigation-route", "INVESTIGATION_CANDIDATE"],
    ],
  );
});

test("B2 Dossier context excludes promoted Motion with no valid routing class", () => {
  const result = attachDossierMotionContext(packet(), [
    motion({
      id: "generic-orphan",
      primary_story_id: null,
      primary_regime_slug: null,
      next_test: "Seek independent or primary-source confirmation, then test whether the market reaction persists.",
    }),
    motion({
      id: "specific-orphan",
      primary_story_id: null,
      primary_regime_slug: null,
      next_test: "Compare primary evidence with the observed rates reaction.",
    }),
  ]);

  assert.deepEqual(
    result.motion_context?.items.map((item) => item.motion_id),
    ["specific-orphan"],
  );
  assert.equal(result.motion_context?.items[0]?.routing_class, "INVESTIGATION_CANDIDATE");
});
