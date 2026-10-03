import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MARKET_MOTION_DOSSIER_PROMOTION_POLICY,
  marketMotionDossierPromotionInput,
  promoteMarketMotionFromDossierAssessments,
  selectDossierAcceptedPromotableMarketMotion,
  selectPromotedMarketMotionForDossier,
} from "../lib/market-motion-promotion.ts";
import type { MarketMotionRecord } from "../lib/market-motion.ts";
import type { ResearchBrainMotionAssessment } from "../lib/dossier-v2/research-brain-contracts.ts";

const NOW = new Date("2026-10-01T02:00:00Z");

function record(overrides: Partial<MarketMotionRecord> = {}): MarketMotionRecord {
  return {
    id: "motion-1",
    motion_key: "intake:motion-1",
    version_number: 1,
    previous_version_id: null,
    contract_version: "market-motion/v1",
    research_run_id: "run-1",
    source_id: null,
    evidence_id: null,
    primary_story_id: "story-1",
    primary_regime_slug: "us-china-ai",
    lifecycle_state: "MOTION",
    effective_state: "MOTION",
    category: "COMPANY",
    verification_state: "REPORTED",
    headline: "Micron HBM pricing stays tight",
    what_happened: "Fresh reporting says HBM demand remains strong while supply stays constrained.",
    market_reaction: null,
    why_interesting: "The event tests the AI memory scarcity branch of the existing Story.",
    big_picture_bridge: "Memory supply → AI infrastructure cost → US–China AI regime",
    next_test: "Confirm with company or primary supply evidence.",
    promotion_reason: null,
    tickers: ["MU"],
    source_name: "Reuters",
    source_url: "https://www.reuters.com/technology/example",
    source_kind: "reporting",
    materiality: 88,
    relevance: 90,
    novelty: 84,
    occurred_at: "2026-10-01T00:30:00.000Z",
    observed_at: "2026-10-01T00:45:00.000Z",
    expires_at: "2026-10-04T00:45:00.000Z",
    metadata: { itemKey: "motion-1" },
    created_at: "2026-10-01T00:45:00.000Z",
    ...overrides,
  };
}

test("Dossier selector admits only fresh PROMOTED Motion with an exact canonical Story link", () => {
  const rows = [
    record({ id: "promoted", lifecycle_state: "PROMOTED", effective_state: "PROMOTED", materiality: 92 }),
    record({ id: "plain-motion", lifecycle_state: "MOTION", effective_state: "MOTION", materiality: 99 }),
    record({ id: "other-story", lifecycle_state: "PROMOTED", effective_state: "PROMOTED", primary_story_id: "story-2", materiality: 89 }),
    record({ id: "no-story", lifecycle_state: "PROMOTED", effective_state: "PROMOTED", primary_story_id: null, materiality: 99 }),
    record({ id: "expired", lifecycle_state: "PROMOTED", effective_state: "PROMOTED", expires_at: "2026-10-01T01:00:00Z" }),
  ];

  assert.deepEqual(
    selectPromotedMarketMotionForDossier(rows, NOW).map((item) => item.id),
    ["promoted", "other-story"],
  );
});


function assessment(
  decision: ResearchBrainMotionAssessment["decision"] = "ACCEPT",
  overrides: Partial<ResearchBrainMotionAssessment> = {},
): ResearchBrainMotionAssessment {
  return {
    motion_id: "motion-1",
    decision,
    reason: "Canonical Dossier evidence supports the Motion as current analytical context.",
    evidence_references: ["research-intake:evidence-1"],
    story_implication: "The linked Story should carry this accepted short-horizon development.",
    regime_implication: "The development reinforces the current regime interpretation.",
    investigation_next: null,
    ...overrides,
  };
}

test("B1 promotion authority requires a Dossier ACCEPT assessment rather than Story publication", () => {
  const rows = [
    record({ id: "accepted" }),
    record({ id: "refined", motion_key: "intake:refined" }),
    record({ id: "unresolved", motion_key: "intake:unresolved" }),
    record({ id: "rejected", motion_key: "intake:rejected" }),
    record({ id: "no-story", motion_key: "intake:no-story", primary_story_id: null }),
    record({ id: "expired", motion_key: "intake:expired", expires_at: "2026-10-01T01:00:00Z" }),
    record({ id: "weak", motion_key: "intake:weak", materiality: 79 }),
  ];
  const assessments = [
    assessment("ACCEPT", { motion_id: "accepted" }),
    assessment("REFINE", { motion_id: "refined" }),
    assessment("UNRESOLVED", { motion_id: "unresolved", story_implication: null, regime_implication: null, investigation_next: "Test the unresolved branch." }),
    assessment("REJECT", { motion_id: "rejected", story_implication: null, regime_implication: null }),
    assessment("ACCEPT", { motion_id: "no-story" }),
    assessment("ACCEPT", { motion_id: "expired" }),
    assessment("ACCEPT", { motion_id: "weak" }),
  ];

  const selected = selectDossierAcceptedPromotableMarketMotion(rows, assessments, NOW);

  assert.deepEqual(selected.map((item) => item.id), ["accepted"]);
});

test("B1 promoted version records Dossier acceptance as the authority", () => {
  const input = marketMotionDossierPromotionInput(
    record(),
    assessment(),
    { dossierId: "dossier-123" },
  );

  assert.equal(input.lifecycleState, "PROMOTED");
  assert.equal(input.primaryStoryId, "story-1");
  assert.equal(input.primaryRegimeSlug, "us-china-ai");
  assert.equal(input.metadata?.promotionPolicy, MARKET_MOTION_DOSSIER_PROMOTION_POLICY);
  assert.equal(input.metadata?.promotionDossierId, "dossier-123");
  assert.equal(input.metadata?.promotionDecision, "ACCEPT");
  assert.deepEqual(input.metadata?.promotionEvidenceRefs, ["research-intake:evidence-1"]);
  assert.match(input.promotionReason || "", /Validated Dossier dossier-123 accepted this Motion/i);
  assert.equal(
    input.whyInteresting,
    "The linked Story should carry this accepted short-horizon development.",
  );
});

test("B1 refuses to promote REFINE until a corrected append-only Motion version exists", () => {
  assert.throws(
    () => marketMotionDossierPromotionInput(
      record(),
      assessment("REFINE"),
      { dossierId: "dossier-123" },
    ),
    /requires an ACCEPT assessment/i,
  );
});

test("B1 removes Story-change promotion from the canonical intelligence runtime", () => {
  const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");

  assert.doesNotMatch(runtime, /promoteMarketMotionForPublishedStories/);
  assert.doesNotMatch(runtime, /linked canonical Story changed in this intelligence run/);
});


test("B1 Dossier execution owns promotion after persistence", () => {
  const execution = readFileSync(new URL("../lib/dossier-v2/execution.ts", import.meta.url), "utf8");
  const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");

  assert.match(execution, /promoteMarketMotionFromDossierAssessments/);
  assert.match(execution, /motion_attention_assessments/);
  assert.doesNotMatch(runtime, /promoteMarketMotionFromDossierAssessments/);
  assert.doesNotMatch(runtime, /canonical-story-changed\/v1/);
});

test("B1 promoter is exported for the post-Dossier append-only path", () => {
  assert.equal(typeof promoteMarketMotionFromDossierAssessments, "function");
});
