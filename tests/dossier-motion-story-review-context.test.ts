import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { MarketDossierV2 } from "../lib/dossier-v2/contracts.ts";
import {
  buildDossierMotionStoryReviewContext,
  parseDossierMotionQueueReason,
} from "../lib/dossier-v2/story-review-context.ts";

const dossierId = "11111111-1111-4111-8111-111111111111";
const storyId = "22222222-2222-4222-8222-222222222222";
const evidenceId = "33333333-3333-4333-8333-333333333333";
const motionId = "44444444-4444-4444-8444-444444444444";
const queueReason =
  `dossier_motion_acceptance:${dossierId}:${motionId}:REFINE | motion_primary_story`;

function dossier(): MarketDossierV2 {
  return {
    id: dossierId,
    contract_version: "market-dossier-v2/1",
    previous_dossier_id: null,
    as_of: "2026-10-06T01:00:00.000Z",
    freshness: {},
    research_gaps: [],
    payload: {
      motion_context_snapshot: {
        contract_version: "dossier-motion-context/1",
        items: [{
          motion_id: motionId,
          motion_key: "rates:long-end",
          version_number: 4,
          occurred_at: "2026-10-06T00:30:00.000Z",
          observed_at: "2026-10-06T00:35:00.000Z",
          expires_at: "2026-10-08T00:35:00.000Z",
          category: "RATES",
          verification_state: "VERIFIED",
          headline: "RAW MOTION HEADLINE THAT MUST NOT REACH STORY REVIEW",
          what_happened: "Raw Motion event prose.",
          market_reaction: null,
          why_interesting: "Raw Motion why.",
          big_picture_bridge: "Raw Motion bridge.",
          next_test: "Raw Motion test.",
          primary_story_id: storyId,
          primary_regime_slug: "global-cost-of-capital",
          routing_class: "STORY",
          attention: { materiality: 92, relevance: 95, novelty: 68 },
          origin_evidence_ref: "packet-evidence-1",
        }],
        omitted_count: 0,
      },
      analytical_output: {
        motion_acceptance: {
          contract_version: "dossier-motion-acceptance/1",
          decisions: [{
            motion_id: motionId,
            decision: "REFINE",
            conclusion: "Long-end pressure matters, but the Story should test the narrower funding-transmission claim.",
            canonical_evidence_refs: ["packet-evidence-1"],
            destination_refs: [`STORY:${storyId}`],
            rationale: "Canonical evidence supports reassessment of the narrower Story claim.",
            next_test: "Test whether tighter long-end funding conditions transmit into credit and valuation.",
          }],
        },
      },
      reevaluation_propagation: {
        contract_version: "dossier-reevaluation-propagation/1",
        items: [{
          motion_id: motionId,
          decision: "REFINE",
          canonical_evidence_ref: "packet-evidence-1",
          canonical_evidence_id: evidenceId,
          target_story_id: storyId,
          target_story_slug: "rates-duration-stress",
          target_regime_slug: null,
          route_kind: "motion_primary_story",
          priority: 87,
          route_reason: "motion_primary_story",
        }],
        omitted_count: 0,
        warnings: [],
      },
    },
    created_at: "2026-10-06T01:00:01.000Z",
  };
}

test("C1.4a parses only exact Motion-origin A3 queue reasons", () => {
  assert.deepEqual(parseDossierMotionQueueReason(queueReason), {
    dossierId,
    motionId,
    decision: "REFINE",
    routeReason: "motion_primary_story",
  });
  assert.equal(
    parseDossierMotionQueueReason(
      `dossier_story_evidence:${dossierId}:story:CONFIRMING`,
    ),
    null,
  );
  assert.equal(
    parseDossierMotionQueueReason(
      `dossier_motion_acceptance:${dossierId}:${motionId}:UNRESOLVED`,
    ),
    null,
  );
});

test("C1.4a recovers System-2 framing only through exact frozen propagation identity", () => {
  const context = buildDossierMotionStoryReviewContext({
    dossier: dossier(),
    queueReason,
    targetStoryId: storyId,
    canonicalEvidenceId: evidenceId,
  });

  assert.deepEqual(context, {
    contractVersion: "dossier-motion-story-review-context/1",
    authority: "CONTEXT_ONLY",
    dossierId,
    motionId,
    decision: "REFINE",
    targetStoryId: storyId,
    canonicalEvidenceId: evidenceId,
    routeKind: "motion_primary_story",
    routeReason: "motion_primary_story",
    primaryStoryId: storyId,
    primaryRegimeSlug: "global-cost-of-capital",
    system2Conclusion:
      "Long-end pressure matters, but the Story should test the narrower funding-transmission claim.",
    system2Rationale:
      "Canonical evidence supports reassessment of the narrower Story claim.",
    nextTest:
      "Test whether tighter long-end funding conditions transmit into credit and valuation.",
  });

  const serialised = JSON.stringify(context);
  assert.doesNotMatch(serialised, /RAW MOTION HEADLINE|Raw Motion event prose|Raw Motion why|Raw Motion bridge/);
});

test("C1.4a fails closed on Story, Evidence, route or immutable identity mismatch", () => {
  const base = dossier();

  assert.equal(buildDossierMotionStoryReviewContext({
    dossier: base,
    queueReason,
    targetStoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    canonicalEvidenceId: evidenceId,
  }), null);

  assert.equal(buildDossierMotionStoryReviewContext({
    dossier: base,
    queueReason,
    targetStoryId: storyId,
    canonicalEvidenceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  }), null);

  assert.equal(buildDossierMotionStoryReviewContext({
    dossier: base,
    queueReason: queueReason.replace("motion_primary_story", "regime:global-cost-of-capital|role:core"),
    targetStoryId: storyId,
    canonicalEvidenceId: evidenceId,
  }), null);

  const withoutMotion = dossier();
  withoutMotion.payload.motion_context_snapshot = {
    contract_version: "dossier-motion-context/1",
    items: [],
    omitted_count: 0,
  };
  assert.equal(buildDossierMotionStoryReviewContext({
    dossier: withoutMotion,
    queueReason,
    targetStoryId: storyId,
    canonicalEvidenceId: evidenceId,
  }), null);
});

test("C1.4a context helper is pure and cannot re-read mutable Motion or mutate Story state", () => {
  const source = readFileSync(
    new URL("../lib/dossier-v2/story-review-context.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /getCurrentMarketMotion|market_motion_items|createSupabase|intelligenceRest|fetch\(/);
  assert.doesNotMatch(source, /story_thesis_versions|apply_intelligence_story_assessment|\.insert\(|\.update\(/);
  assert.match(source, /authority: "CONTEXT_ONLY"/);
});
