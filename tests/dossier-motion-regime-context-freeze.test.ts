import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { MarketDossierV2 } from "../lib/dossier-v2/contracts.ts";
import {
  buildDossierMotionRegimeContext,
} from "../lib/dossier-v2/presentation-adapter.ts";
import type { ResearchBrainOutputV1 } from "../lib/dossier-v2/research-brain-contracts.ts";

function dossier(items: unknown[]): MarketDossierV2 {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    contract_version: "market-dossier-v2/1",
    previous_dossier_id: null,
    as_of: "2026-10-06T00:00:00.000Z",
    freshness: {},
    research_gaps: [],
    payload: {
      motion_context_snapshot: {
        contract_version: "dossier-motion-context/1",
        items,
        omitted_count: 0,
      },
    },
    created_at: "2026-10-06T00:00:01.000Z",
  };
}

function output(decisions: unknown[]): ResearchBrainOutputV1 {
  return {
    motion_acceptance: {
      contract_version: "dossier-motion-acceptance/1",
      decisions,
    },
  } as unknown as ResearchBrainOutputV1;
}

const exactMotion = {
  motion_id: "motion-rates-1",
  motion_key: "rates:long-end",
  version_number: 3,
  occurred_at: "2026-10-05T23:00:00.000Z",
  observed_at: "2026-10-05T23:05:00.000Z",
  expires_at: "2026-10-07T23:05:00.000Z",
  category: "RATES",
  verification_state: "VERIFIED",
  headline: "Long-end yields remain elevated",
  what_happened: "Long yields remained high.",
  market_reaction: null,
  why_interesting: "Funding conditions remain restrictive.",
  big_picture_bridge: "Long yields -> financing -> valuation.",
  next_test: "Separate real-yield and term-premium channels.",
  primary_story_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  primary_regime_slug: "global-cost-of-capital",
  routing_class: "REGIME",
  attention: { materiality: 90, relevance: 95, novelty: 70 },
  origin_evidence_ref: "evidence-rates-1",
};

test("C1.5a1 freezes exact Regime-routed ACCEPT/REFINE judgement from the immutable Dossier snapshot", () => {
  const accepted = buildDossierMotionRegimeContext(
    dossier([exactMotion]),
    output([{
      motion_id: "motion-rates-1",
      decision: "REFINE",
      conclusion: "Long-end pressure remains a Regime-level funding constraint, but the causal channel is unresolved.",
      canonical_evidence_refs: ["evidence-rates-2", "evidence-rates-1", "evidence-rates-1"],
      destination_refs: ["REGIME:CURRENT", "RESEARCH_NOW"],
      rationale: "Canonical evidence supports the narrower Regime implication.",
      next_test: "Separate real yields from term premium.",
    }]),
  );

  assert.deepEqual(accepted, [{
    motionId: "motion-rates-1",
    decision: "REFINE",
    regimeSlug: "global-cost-of-capital",
    storyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    conclusion: "Long-end pressure remains a Regime-level funding constraint, but the causal channel is unresolved.",
    rationale: "Canonical evidence supports the narrower Regime implication.",
    nextTest: "Separate real yields from term premium.",
    canonicalEvidenceRefs: ["evidence-rates-1", "evidence-rates-2"],
    observedAt: "2026-10-05T23:05:00.000Z",
    versionNumber: 3,
  }]);
});

test("C1.5a1 fails closed without exact immutable Regime identity or explicit REGIME:CURRENT routing", () => {
  const noRegime = { ...exactMotion, motion_id: "motion-no-regime", primary_regime_slug: null };
  const rows = buildDossierMotionRegimeContext(
    dossier([exactMotion, noRegime]),
    output([
      {
        motion_id: "motion-rates-1",
        decision: "ACCEPT",
        conclusion: "Story-only conclusion.",
        canonical_evidence_refs: ["evidence-rates-1"],
        destination_refs: ["STORY:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
        rationale: "No Regime route.",
        next_test: null,
      },
      {
        motion_id: "motion-no-regime",
        decision: "ACCEPT",
        conclusion: "Missing exact Regime identity.",
        canonical_evidence_refs: ["evidence-rates-1"],
        destination_refs: ["REGIME:CURRENT"],
        rationale: "Cannot place this safely.",
        next_test: null,
      },
      {
        motion_id: "unknown-motion",
        decision: "ACCEPT",
        conclusion: "Mutable lookup would be required.",
        canonical_evidence_refs: ["evidence-rates-1"],
        destination_refs: ["REGIME:CURRENT"],
        rationale: "Must fail closed.",
        next_test: null,
      },
      {
        motion_id: "motion-rates-1",
        decision: "UNRESOLVED",
        conclusion: null,
        canonical_evidence_refs: ["evidence-rates-1"],
        destination_refs: ["REGIME:CURRENT"],
        rationale: "Not accepted.",
        next_test: "Research further.",
      },
    ]),
  );

  assert.deepEqual(rows, []);
});

test("C1.5a1 persists the bounded Motion packet snapshot instead of re-reading mutable Motion later", () => {
  const execution = readFileSync(
    new URL("../lib/dossier-v2/execution.ts", import.meta.url),
    "utf8",
  );
  const presentation = readFileSync(
    new URL("../lib/dossier-v2/presentation-adapter.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    execution,
    /motion_context_snapshot:\s*cloneJson\(packet\.motion_context \?\?/,
  );
  assert.match(
    presentation,
    /dossier\.payload\.motion_context_snapshot/,
  );
  assert.match(
    presentation,
    /decision\.destination_refs\.includes\("REGIME:CURRENT"\)/,
  );
  assert.doesNotMatch(presentation, /getCurrentMarketMotion|market_motion_items/);
});
