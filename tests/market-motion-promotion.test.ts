import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MARKET_MOTION_PROMOTION_LIMIT,
  MARKET_MOTION_PROMOTION_MIN_MATERIALITY,
  MARKET_MOTION_PROMOTION_MIN_RELEVANCE,
  marketMotionPromotionInput,
  selectPromotableMarketMotion,
  selectPromotedMarketMotionForDossier,
} from "../lib/market-motion-promotion.ts";
import {
  deriveMarketMotionRoutingClass,
  isConcreteMarketMotionNextTest,
  type MarketMotionRecord,
} from "../lib/market-motion.ts";
import type { EvidencePackItem } from "../lib/intelligence/schemas.ts";
import * as promotionModule from "../lib/market-motion-promotion.ts";

const NOW = new Date("2026-10-01T02:00:00Z");

function record(overrides: Partial<MarketMotionRecord> = {}): MarketMotionRecord {
  return {
    id: "motion-1",
    motion_key: "event:hbm:micron",
    version_number: 1,
    previous_version_id: null,
    contract_version: "market-motion/v1",
    research_run_id: "run-creator",
    source_id: null,
    evidence_id: null,
    primary_story_id: "story-1",
    primary_regime_slug: "us-china-ai",
    lifecycle_state: "MOTION",
    effective_state: "MOTION",
    category: "COMPANY",
    verification_state: "LEAD",
    headline: "Micron HBM pricing stays tight",
    what_happened: "A creator surfaced a claim about HBM supply.",
    market_reaction: null,
    why_interesting: "The event tests the AI memory scarcity branch of the existing Story.",
    big_picture_bridge: "Memory supply → AI infrastructure cost → US–China AI regime",
    next_test: "Confirm with company or primary supply evidence.",
    promotion_reason: null,
    tickers: ["MU"],
    source_name: "StockedUp",
    source_url: "https://www.youtube.com/watch?v=example",
    source_kind: "creator",
    materiality: 88,
    relevance: 90,
    novelty: 84,
    occurred_at: "2026-10-01T00:30:00.000Z",
    observed_at: "2026-10-01T00:45:00.000Z",
    expires_at: "2026-10-04T00:45:00.000Z",
    metadata: {
      itemKey: "youtube:stockedup:mu-hbm",
      originItemKeys: ["youtube:stockedup:mu-hbm", "reuters:mu-hbm"],
    },
    created_at: "2026-10-01T00:45:00.000Z",
    ...overrides,
  };
}

function evidence(overrides: Partial<EvidencePackItem> = {}): EvidencePackItem {
  return {
    id: "evidence-reporting",
    externalEvidenceId: "research-intake:reporting-1",
    claim: "Independent reporting corroborates the event.",
    summary: null,
    evidenceClass: "news",
    sourceName: "Reuters",
    sourceTier: 2,
    reliabilityScore: 92,
    ancestryGroupId: "ancestry-reuters",
    supportDirection: "context",
    eventAt: "2026-10-01T00:40:00.000Z",
    publishedAt: "2026-10-01T00:40:00.000Z",
    availableAt: "2026-10-01T00:40:00.000Z",
    receivedAt: "2026-10-01T00:41:00.000Z",
    freshnessStatus: "current",
    affectedAssets: ["MU"],
    affectedTopics: ["china-us-ai-war"],
    provenanceUrls: ["https://www.reuters.com/technology/example"],
    providerKey: "research_intake",
    sourceVerificationRole: "canonical",
    structuredPayload: { itemKey: "reuters:mu-hbm" },
    ...overrides,
  };
}


test("B2 routing class prefers STORY over REGIME", () => {
  assert.equal(deriveMarketMotionRoutingClass({
    primaryStoryId: "story-1",
    primaryRegimeSlug: "us-china-ai",
    nextTest: "Test the durable thesis.",
  }), "STORY");
});

test("B2 routing class admits REGIME without a Story", () => {
  assert.equal(deriveMarketMotionRoutingClass({
    primaryStoryId: null,
    primaryRegimeSlug: "us-china-ai",
    nextTest: null,
  }), "REGIME");
});

test("B2 routing class admits concrete Investigation candidates", () => {
  assert.equal(isConcreteMarketMotionNextTest("Compare independent capacity data with pricing and guidance."), true);
  assert.equal(deriveMarketMotionRoutingClass({
    primaryStoryId: null,
    primaryRegimeSlug: null,
    nextTest: "Compare independent capacity data with pricing and guidance.",
  }), "INVESTIGATION_CANDIDATE");
});

test("B2 routing class rejects blank and generic fallback next tests", () => {
  assert.equal(isConcreteMarketMotionNextTest(null), false);
  assert.equal(isConcreteMarketMotionNextTest("   "), false);
  assert.equal(
    isConcreteMarketMotionNextTest("Check whether the linked assets and broader Story / Regime reaction confirm the information."),
    false,
  );
  assert.equal(
    isConcreteMarketMotionNextTest("Seek independent or primary-source confirmation, then test whether the market reaction persists."),
    false,
  );
  assert.equal(deriveMarketMotionRoutingClass({
    primaryStoryId: null,
    primaryRegimeSlug: null,
    nextTest: "Seek independent or primary-source confirmation, then test whether the market reaction persists.",
  }), null);
});

test("B2 promotes canonically corroborated Regime-only Motion", () => {
  const [selected] = selectPromotableMarketMotion([
    record({
      id: "regime-only",
      primary_story_id: null,
      primary_regime_slug: "us-china-ai",
    }),
  ], [evidence()], NOW);

  assert.equal(selected.motion.id, "regime-only");
  assert.equal(selected.routingClass, "REGIME");
  assert.equal(selected.selectedEvidence.id, "evidence-reporting");
});

test("B2 promotes canonically corroborated Investigation-candidate Motion", () => {
  const [selected] = selectPromotableMarketMotion([
    record({
      id: "investigation-only",
      primary_story_id: null,
      primary_regime_slug: null,
      next_test: "Compare company guidance with independent HBM capacity data.",
    }),
  ], [evidence()], NOW);

  assert.equal(selected.motion.id, "investigation-only");
  assert.equal(selected.routingClass, "INVESTIGATION_CANDIDATE");
  assert.equal(selected.selectedEvidence.id, "evidence-reporting");
});

test("B2 keeps exact Evidence firewall for orphan Motion", () => {
  const orphan = record({
    id: "regime-no-exact-evidence",
    primary_story_id: null,
    primary_regime_slug: "us-china-ai",
  });
  const unrelated = evidence({
    id: "same-regime-wrong-origin",
    structuredPayload: { itemKey: "reuters:other-event" },
    affectedTopics: ["china-us-ai-war"],
  });

  assert.deepEqual(selectPromotableMarketMotion([orphan], [unrelated], NOW), []);
});

test("B2 v2 promotion persists explicit routing class", () => {
  const motion = record({
    primary_story_id: null,
    primary_regime_slug: "us-china-ai",
  });
  const [candidate] = selectPromotableMarketMotion([motion], [evidence()], NOW);
  const input = marketMotionPromotionInput(candidate, {
    researchRunId: "run-b2",
    engineRunId: "engine-b2",
  });

  assert.equal(input.lifecycleState, "PROMOTED");
  assert.equal(input.primaryStoryId, null);
  assert.equal(input.primaryRegimeSlug, "us-china-ai");
  assert.equal(input.evidenceId, null);
  assert.equal(input.metadata?.promotionPolicy, "canonical-evidence-corroborated/v2");
  assert.equal(input.metadata?.promotionRoutingClass, "REGIME");
});

test("B1 promotion requires exact eligible canonical Evidence, not Story publication", () => {
  assert.equal(MARKET_MOTION_PROMOTION_MIN_MATERIALITY, 80);
  assert.equal(MARKET_MOTION_PROMOTION_MIN_RELEVANCE, 75);

  const selected = selectPromotableMarketMotion([record()], [evidence()], NOW);

  assert.equal(selected.length, 1);
  assert.equal(selected[0].motion.id, "motion-1");
  assert.equal(selected[0].selectedEvidence.id, "evidence-reporting");
  assert.deepEqual(selected[0].matchingOriginItemKeys, ["reuters:mu-hbm"]);
});

test("B1 allows LEAD Motion after later independent canonical corroboration", () => {
  const selected = selectPromotableMarketMotion([
    record({ verification_state: "LEAD" }),
  ], [
    evidence({ id: "independent-report" }),
  ], NOW);

  assert.equal(selected.length, 1);
  assert.equal(selected[0].motion.verification_state, "LEAD");
  assert.equal(selected[0].selectedEvidence.id, "independent-report");
});

test("B2 blocks contradicted unresolved partial expired weak and unroutable Motion", () => {
  const rows = [
    record({ id: "contradicted", verification_state: "CONTRADICTED" }),
    record({ id: "unresolved", verification_state: "UNRESOLVED" }),
    record({ id: "partial", verification_state: "PARTIAL" }),
    record({ id: "expired", expires_at: "2026-10-01T01:00:00Z" }),
    record({ id: "weak-materiality", materiality: 79 }),
    record({ id: "weak-relevance", relevance: 74 }),
    record({
      id: "unroutable",
      primary_story_id: null,
      primary_regime_slug: null,
      next_test: "Seek independent or primary-source confirmation, then test whether the market reaction persists.",
    }),
    record({ id: "already", lifecycle_state: "PROMOTED", effective_state: "PROMOTED" }),
  ];

  assert.deepEqual(selectPromotableMarketMotion(rows, [evidence()], NOW), []);
});

test("B1 rejects transcript scheduled research-analysis and discovery-only Evidence", () => {
  const rows = [record()];
  const blocked = [
    evidence({ id: "transcript", evidenceClass: "transcript" }),
    evidence({ id: "scheduled", structuredPayload: { itemKey: "reuters:mu-hbm", evidenceNature: "scheduled_event" } }),
    evidence({ id: "analysis", evidenceClass: "research_analysis" }),
    evidence({ id: "discovery", sourceVerificationRole: "discovery_only" }),
  ];

  assert.deepEqual(selectPromotableMarketMotion(rows, blocked, NOW), []);
});

test("B1 rejects same Story Regime ticker or headline without exact origin item overlap", () => {
  const unrelated = evidence({
    id: "same-context-wrong-origin",
    structuredPayload: { itemKey: "reuters:different-event" },
    affectedAssets: ["MU"],
    affectedTopics: ["china-us-ai-war"],
    claim: "Micron HBM pricing stays tight",
  });

  assert.deepEqual(selectPromotableMarketMotion([record()], [unrelated], NOW), []);
});

test("B1 chooses strongest canonical corroborator deterministically", () => {
  const reporting = evidence({
    id: "z-reporting",
    structuredPayload: { itemKey: "reuters:mu-hbm" },
    sourceTier: 2,
    reliabilityScore: 92,
  });
  const official = evidence({
    id: "a-official",
    sourceName: "SEC",
    provenanceUrls: ["https://www.sec.gov/example"],
    structuredPayload: { itemKey: "sec:mu-hbm" },
    sourceTier: 1,
    reliabilityScore: 98,
    availableAt: "2026-10-01T00:35:00.000Z",
  });
  const motion = record({
    metadata: {
      originItemKeys: ["youtube:stockedup:mu-hbm", "reuters:mu-hbm", "sec:mu-hbm"],
    },
  });

  const [selected] = selectPromotableMarketMotion([motion], [reporting, official], NOW);

  assert.equal(selected.selectedEvidence.id, "a-official");
  assert.deepEqual(selected.matchingEvidenceIds, ["a-official", "z-reporting"]);
  assert.deepEqual(selected.matchingOriginItemKeys, ["sec:mu-hbm", "reuters:mu-hbm"]);
});

test("B1 promotion remains capped at six Motion items", () => {
  const rows = Array.from({ length: MARKET_MOTION_PROMOTION_LIMIT + 3 }, (_, index) => record({
    id: `motion-${index}`,
    motion_key: `event:test:${index}`,
    materiality: 80 + index,
    relevance: 80 + index,
    metadata: { originItemKeys: [`reporting:item-${index}`] },
  }));
  const evidenceRows = rows.map((row, index) => evidence({
    id: `evidence-${index}`,
    structuredPayload: { itemKey: `reporting:item-${index}` },
  }));

  const selected = selectPromotableMarketMotion(rows, evidenceRows, NOW);

  assert.equal(selected.length, MARKET_MOTION_PROMOTION_LIMIT);
  assert.equal(selected[0].motion.id, `motion-${MARKET_MOTION_PROMOTION_LIMIT + 2}`);
});

test("promotion persists canonical Evidence identity while preserving Motion verification and expiry", () => {
  const candidate = {
    motion: record(),
    selectedEvidence: evidence(),
    matchingEvidenceIds: ["evidence-reporting"],
    matchingOriginItemKeys: ["reuters:mu-hbm"],
    evidenceWeight: 0.782,
    routingClass: "STORY" as const,
  };

  const input = marketMotionPromotionInput(candidate, {
    researchRunId: "run-reporting",
    engineRunId: "engine-1",
  });

  assert.equal(input.lifecycleState, "PROMOTED");
  assert.equal(input.verificationState, "LEAD");
  assert.equal(input.evidenceId, null);
  assert.equal(input.primaryStoryId, "story-1");
  assert.equal(input.primaryRegimeSlug, "us-china-ai");
  assert.equal(input.expiresAt, "2026-10-04T00:45:00.000Z");
  assert.match(input.promotionReason || "", /Canonical Evidence evidence-reporting corroborated/);
  assert.match(input.promotionReason || "", /Motion is promoted as short-horizon Dossier context, not as canonical evidence/);
  assert.equal(input.metadata?.promotionPolicy, "canonical-evidence-corroborated/v2");
  assert.equal(input.metadata?.promotionRoutingClass, "STORY");
  assert.equal(input.metadata?.promotionEvidenceId, "evidence-reporting");
  assert.equal(input.metadata?.promotionEvidencePacketRef, "research-intake:reporting-1");
  assert.equal(input.metadata?.promotionEvidenceItemKey, "reuters:mu-hbm");
  assert.deepEqual(input.metadata?.promotionEvidenceIds, ["evidence-reporting"]);
  assert.deepEqual(input.metadata?.promotionEvidenceItemKeys, ["reuters:mu-hbm"]);
});

test("promotion preserves a valid legacy evidence FK while keeping canonical Evidence in metadata", () => {
  const [candidate] = selectPromotableMarketMotion([
    record({ evidence_id: "legacy-evidence-row" }),
  ], [evidence()], NOW);
  const input = marketMotionPromotionInput(candidate, {
    researchRunId: "run-reporting",
    engineRunId: "engine-legacy-fk",
  });

  assert.equal(input.evidenceId, "legacy-evidence-row");
  assert.equal(input.metadata?.promotionEvidenceId, "evidence-reporting");
});

test("promotion falls back to deterministic ev: UUID packet ref when external identity is absent", () => {
  const [candidate] = selectPromotableMarketMotion([record()], [
    evidence({ externalEvidenceId: null }),
  ], NOW);
  const input = marketMotionPromotionInput(candidate, {
    researchRunId: "run-fallback",
    engineRunId: "engine-fallback",
  });

  assert.equal(input.metadata?.promotionEvidencePacketRef, "ev:evidence-reporting");
});

test("B2 Dossier selector admits fresh PROMOTED Motion with any valid routing class", () => {
  const rows = [
    record({ id: "promoted", lifecycle_state: "PROMOTED", effective_state: "PROMOTED", materiality: 92 }),
    record({ id: "plain-motion", lifecycle_state: "MOTION", effective_state: "MOTION", materiality: 99 }),
    record({ id: "other-story", lifecycle_state: "PROMOTED", effective_state: "PROMOTED", primary_story_id: "story-2", materiality: 89 }),
    record({
      id: "regime-only",
      lifecycle_state: "PROMOTED",
      effective_state: "PROMOTED",
      primary_story_id: null,
      primary_regime_slug: "us-china-ai",
      materiality: 99,
    }),
    record({
      id: "unroutable",
      lifecycle_state: "PROMOTED",
      effective_state: "PROMOTED",
      primary_story_id: null,
      primary_regime_slug: null,
      next_test: "Seek independent or primary-source confirmation, then test whether the market reaction persists.",
      materiality: 100,
    }),
    record({ id: "expired", lifecycle_state: "PROMOTED", effective_state: "PROMOTED", expires_at: "2026-10-01T01:00:00Z" }),
  ];

  assert.deepEqual(
    selectPromotedMarketMotionForDossier(rows, NOW).map((item) => item.id),
    ["regime-only", "promoted", "other-story"],
  );
});


function promotionAdapter() {
  const fn = (promotionModule as Record<string, unknown>).promoteMarketMotionFromCanonicalEvidence;
  assert.equal(typeof fn, "function", "B1 canonical-evidence promotion adapter must exist");
  return fn as (input: {
    researchRunId: string | null;
    engineRunId: string;
    evidence: EvidencePackItem[];
    now?: Date;
    client?: unknown;
  }) => Promise<{
    considered: number;
    eligible: number;
    promoted: number;
    skippedAlreadyPromoted: number;
    motionIds: string[];
    warnings: string[];
  }>;
}

function mockPromotionClient(rows: MarketMotionRecord[], failMotionKeys: string[] = []) {
  const inserted: Array<Record<string, unknown>> = [];
  const calls: string[] = [];
  const fail = new Set(failMotionKeys);
  const client = {
    from(table: string) {
      calls.push("from:" + table);
      if (table === "current_market_motion_items") {
        return {
          select(columns: string) {
            calls.push("select:" + columns);
            return Promise.resolve({ data: rows, error: null });
          },
        };
      }
      if (table === "market_motion_items") {
        return {
          insert(payload: Record<string, unknown>) {
            inserted.push(payload);
            calls.push("insert:" + String(payload.motion_key || ""));
            return {
              select(columns: string) {
                calls.push("insert-select:" + columns);
                return {
                  single() {
                    const motionKey = String(payload.motion_key || "");
                    if (fail.has(motionKey)) {
                      return Promise.resolve({
                        data: null,
                        error: { message: "forced persistence failure for " + motionKey },
                      });
                    }
                    return Promise.resolve({
                      data: {
                        ...record({
                          id: "promoted-" + inserted.length,
                          motion_key: motionKey,
                          lifecycle_state: "PROMOTED",
                          evidence_id: String(payload.evidence_id || ""),
                        }),
                      },
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      }
      throw new Error("Unexpected table " + table);
    },
  };

  return { client, inserted, calls };
}

test("B1 adapter promotes fresh Motion across research runs from canonical Evidence", async () => {
  const motion = record({
    research_run_id: "run-creator",
    metadata: { originItemKeys: ["reuters:mu-hbm"] },
  });
  const db = mockPromotionClient([motion]);
  const promote = promotionAdapter();

  const result = await promote({
    researchRunId: "run-reporting",
    engineRunId: "engine-b1",
    evidence: [evidence()],
    now: NOW,
    client: db.client,
  });

  assert.equal(result.considered, 1);
  assert.equal(result.eligible, 1);
  assert.equal(result.promoted, 1);
  assert.equal(result.skippedAlreadyPromoted, 0);
  assert.equal(db.inserted.length, 1);
  assert.equal(db.inserted[0].evidence_id, null);
  assert.equal(db.inserted[0].research_run_id, "run-reporting");
  assert.ok(!db.calls.some((call) => call.includes("research_run_id")));
});

test("B1 replay repairs a missing packet ref only against the exact original canonical Evidence UUID", async () => {
  const promoted = record({
    id: "already-promoted-missing-packet-ref",
    lifecycle_state: "PROMOTED",
    effective_state: "PROMOTED",
    metadata: {
      originItemKeys: ["reuters:mu-hbm"],
      promotionEvidenceId: "evidence-reporting",
      promotionEvidenceItemKey: "reuters:mu-hbm",
    },
  });
  const db = mockPromotionClient([promoted]);
  const promote = promotionAdapter();

  const result = await promote({
    researchRunId: "run-repair",
    engineRunId: "engine-repair",
    evidence: [evidence()],
    now: NOW,
    client: db.client,
  });

  assert.equal(result.eligible, 0);
  assert.equal(result.promoted, 0);
  assert.equal(result.skippedAlreadyPromoted, 0);
  assert.equal(db.inserted.length, 1);
  const metadata = db.inserted[0].metadata as Record<string, unknown>;
  assert.equal(metadata.promotionEvidenceId, "evidence-reporting");
  assert.equal(metadata.promotionEvidencePacketRef, "research-intake:reporting-1");
  assert.ok(result.warnings.some((warning) => /Repaired canonical Dossier Evidence packet reference/.test(warning)));
});

test("B1 replay refuses packet-ref repair when the original canonical Evidence UUID is absent", async () => {
  const promoted = record({
    id: "already-promoted-no-anchor",
    lifecycle_state: "PROMOTED",
    effective_state: "PROMOTED",
    metadata: {
      originItemKeys: ["reuters:mu-hbm"],
      promotionEvidenceId: "different-canonical-evidence",
      promotionEvidenceItemKey: "reuters:mu-hbm",
    },
  });
  const db = mockPromotionClient([promoted]);
  const promote = promotionAdapter();

  const result = await promote({
    researchRunId: "run-no-repair",
    engineRunId: "engine-no-repair",
    evidence: [evidence()],
    now: NOW,
    client: db.client,
  });

  assert.equal(result.eligible, 0);
  assert.equal(result.promoted, 0);
  assert.equal(result.skippedAlreadyPromoted, 1);
  assert.equal(db.inserted.length, 0);
});

test("B1 adapter skips already-promoted current Motion on replay", async () => {
  const db = mockPromotionClient([
    record({
      id: "already-promoted",
      lifecycle_state: "PROMOTED",
      effective_state: "PROMOTED",
      evidence_id: "evidence-reporting",
      metadata: { originItemKeys: ["reuters:mu-hbm"] },
    }),
  ]);
  const promote = promotionAdapter();

  const result = await promote({
    researchRunId: "run-replay",
    engineRunId: "engine-replay",
    evidence: [evidence()],
    now: NOW,
    client: db.client,
  });

  assert.equal(result.eligible, 0);
  assert.equal(result.promoted, 0);
  assert.equal(result.skippedAlreadyPromoted, 1);
  assert.equal(db.inserted.length, 0);
});

test("B1 adapter caps writes at six and isolates one persistence failure", async () => {
  const rows = Array.from({ length: MARKET_MOTION_PROMOTION_LIMIT + 2 }, (_, index) => record({
    id: "adapter-motion-" + index,
    motion_key: "event:adapter:" + index,
    materiality: 90 + index,
    relevance: 90 + index,
    metadata: { originItemKeys: ["reporting:adapter-" + index] },
  }));
  const evidenceRows = rows.map((row, index) => evidence({
    id: "adapter-evidence-" + index,
    structuredPayload: { itemKey: "reporting:adapter-" + index },
  }));
  const failKey = "event:adapter:" + (MARKET_MOTION_PROMOTION_LIMIT + 1);
  const db = mockPromotionClient(rows, [failKey]);
  const promote = promotionAdapter();

  const result = await promote({
    researchRunId: "run-adapter",
    engineRunId: "engine-adapter",
    evidence: evidenceRows,
    now: NOW,
    client: db.client,
  });

  assert.equal(result.eligible, MARKET_MOTION_PROMOTION_LIMIT);
  assert.equal(db.inserted.length, MARKET_MOTION_PROMOTION_LIMIT);
  assert.equal(result.promoted, MARKET_MOTION_PROMOTION_LIMIT - 1);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /forced persistence failure/);
});


test("runtime runs B1 promotion after canonical Evidence load and before System 1 without Story publication gate", () => {
  const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");
  const loadIndex = runtime.indexOf("const evidence = await loadEvidence(requiredEvidenceIds)");
  const callIndex = runtime.indexOf("await promoteMarketMotionFromCanonicalEvidence", loadIndex);
  const recruitmentIndex = runtime.indexOf("const recruitment = buildFreshNewsRecruitment", loadIndex);

  assert.ok(loadIndex >= 0, "canonical Evidence load must remain present");
  assert.ok(callIndex > loadIndex, "B1 promotion must run after canonical Evidence loads");
  assert.ok(recruitmentIndex > callIndex, "B1 promotion must run before fresh-news/System 1 recruitment");
  assert.equal(runtime.includes("promoteMarketMotionForPublishedStories"), false);

  const promotionWindow = runtime.slice(loadIndex, recruitmentIndex);
  assert.match(promotionWindow, /if \(!dryRun\)/);
  assert.doesNotMatch(promotionWindow, /publishedStories\.length/);
});
