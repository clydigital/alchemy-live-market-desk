import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { DossierV2InputPacket } from "../lib/dossier-v2/input-packet.ts";
import type { ResearchBrainOutputV1 } from "../lib/dossier-v2/research-brain-contracts.ts";
import {
  DOSSIER_REEVALUATION_PROPAGATION_CONTRACT_VERSION,
  MAX_DOSSIER_REEVALUATION_PROPAGATION_TARGETS,
  buildDossierReevaluationPropagationPlan,
  enqueueDossierReevaluationPropagation,
  prepareDossierReevaluationPropagationPlan,
  type DossierReevaluationPropagationPlan,
} from "../lib/dossier-v2/reevaluation-propagation.ts";

const EVIDENCE_A = "11111111-1111-4111-8111-111111111111";
const EVIDENCE_B = "22222222-2222-4222-8222-222222222222";
const STORY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STORY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STORY_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const STORY_D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const STORY_E = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

type Decision = NonNullable<ResearchBrainOutputV1["motion_acceptance"]>["decisions"][number];

function packet(input: {
  motionId?: string;
  primaryStoryId?: string | null;
  primaryRegimeSlug?: string | null;
  originEvidenceRef?: string | null;
  evidenceIds?: string[];
} = {}): DossierV2InputPacket {
  const evidenceIds = input.evidenceIds ?? [EVIDENCE_A, EVIDENCE_B, "market-monitor:us2y:2026-10-04"];
  return {
    packet_id: "packet-a3",
    contract_version: "dossier-v2-input/1",
    as_of: "2026-10-04T07:30:00.000Z",
    previous_dossier_id: null,
    observed_evidence: evidenceIds.map((evidenceId, index) => ({
      evidence_id: evidenceId,
      epistemic_label: "OBSERVED",
      claim_or_fact: `Canonical fact ${index + 1}`,
      category: "MACRO",
      source_type: "OFFICIAL_DATA",
      available_at: "2026-10-04T07:00:00.000Z",
      provenance: [{ source_type: "OFFICIAL_DATA", source_id: `source-${index + 1}` }],
    })),
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
    motion_context: {
      contract_version: "dossier-motion-context/1",
      omitted_count: 0,
      items: [{
        motion_id: input.motionId ?? "motion-a3",
        motion_key: "event:a3",
        version_number: 1,
        occurred_at: "2026-10-04T06:30:00.000Z",
        observed_at: "2026-10-04T06:35:00.000Z",
        expires_at: "2026-10-06T06:35:00.000Z",
        category: "MACRO",
        verification_state: "VERIFIED",
        headline: "A3 test Motion",
        what_happened: "A bounded Motion item asked System 2 to inspect a persistent thesis.",
        market_reaction: "Motion prose says the market moved.",
        why_interesting: "It may deserve canonical Story reevaluation.",
        big_picture_bridge: "event → Story → Regime",
        next_test: "Check canonical evidence.",
        primary_story_id: input.primaryStoryId === undefined ? STORY_A : input.primaryStoryId,
        primary_regime_slug: input.primaryRegimeSlug === undefined
          ? "global-cost-of-capital"
          : input.primaryRegimeSlug,
        attention: { materiality: 90, relevance: 90, novelty: 80 },
        origin_evidence_ref: input.originEvidenceRef ?? null,
      }],
    },
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

function output(decisions: Decision[]): ResearchBrainOutputV1 {
  return {
    motion_acceptance: {
      contract_version: "dossier-motion-acceptance/1",
      decisions,
    },
  } as ResearchBrainOutputV1;
}

function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    motion_id: "motion-a3",
    decision: "ACCEPT",
    conclusion: "Canonical evidence supports reevaluating the persistent Story.",
    canonical_evidence_refs: [EVIDENCE_A],
    destination_refs: [`STORY:${STORY_B}`],
    rationale: "System 2 accepted the framing only after canonical evidence review.",
    next_test: null,
    ...overrides,
  };
}

const stories = [
  { id: STORY_A, slug: "story-a", status: "developing", confidence: 72 },
  { id: STORY_B, slug: "story-b", status: "confirmed", confidence: 88 },
  { id: STORY_C, slug: "story-c", status: "developing", confidence: 77 },
  { id: STORY_D, slug: "story-d", status: "archived", confidence: 65 },
  { id: STORY_E, slug: "story-e", status: "developing", confidence: 70 },
];

test("A3 ACCEPT with canonical evidence plans an explicit persistent Story", () => {
  const plan = buildDossierReevaluationPropagationPlan({
    packet: packet(),
    analyticalOutput: output([decision()]),
    stories,
    regimeLinks: [],
    queueableEvidenceIds: new Set([EVIDENCE_A]),
  });

  assert.equal(plan.contract_version, DOSSIER_REEVALUATION_PROPAGATION_CONTRACT_VERSION);
  assert.equal(plan.items.length, 1);
  assert.deepEqual(plan.items[0], {
    motion_id: "motion-a3",
    decision: "ACCEPT",
    canonical_evidence_id: EVIDENCE_A,
    target_story_id: STORY_B,
    target_story_slug: "story-b",
    target_regime_slug: null,
    route_kind: "explicit_story",
    priority: 95,
    route_reason: "explicit_story",
  });
});

test("A3 REFINE falls back to the exact Motion primary Story when no explicit Story destination exists", () => {
  const plan = buildDossierReevaluationPropagationPlan({
    packet: packet({ primaryStoryId: STORY_A }),
    analyticalOutput: output([decision({
      decision: "REFINE",
      destination_refs: ["MAIN_THREAD"],
      next_test: "Retest the narrowed mechanism against fresh canonical evidence.",
    })]),
    stories,
    regimeLinks: [],
    queueableEvidenceIds: new Set([EVIDENCE_A]),
  });

  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0]?.target_story_id, STORY_A);
  assert.equal(plan.items[0]?.route_kind, "motion_primary_story");
  assert.equal(plan.items[0]?.priority, 87);
});

test("A3 UNRESOLVED and REJECT do not propagate automatically", () => {
  const plan = buildDossierReevaluationPropagationPlan({
    packet: packet(),
    analyticalOutput: output([
      decision({ decision: "UNRESOLVED", conclusion: null, canonical_evidence_refs: [], destination_refs: ["RESEARCH_NOW"] }),
      decision({ motion_id: "motion-other", decision: "REJECT", conclusion: null, canonical_evidence_refs: [], destination_refs: [] }),
    ]),
    stories,
    regimeLinks: [],
    queueableEvidenceIds: new Set([EVIDENCE_A]),
  });

  assert.deepEqual(plan.items, []);
});

test("A3 never substitutes Motion IDs or origin evidence for validated A2 canonical evidence", () => {
  const plan = buildDossierReevaluationPropagationPlan({
    packet: packet({ originEvidenceRef: EVIDENCE_B }),
    analyticalOutput: output([decision({
      canonical_evidence_refs: [EVIDENCE_A],
      destination_refs: [`STORY:${STORY_B}`],
    })]),
    stories,
    regimeLinks: [],
    queueableEvidenceIds: new Set([EVIDENCE_A, EVIDENCE_B, "motion-a3"]),
  });

  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0]?.canonical_evidence_id, EVIDENCE_A);
  assert.notEqual(plan.items[0]?.canonical_evidence_id, "motion-a3");
  assert.notEqual(plan.items[0]?.canonical_evidence_id, EVIDENCE_B);
});

test("A3 does not convert non-UUID Dossier evidence into Story-queue evidence", () => {
  const plan = buildDossierReevaluationPropagationPlan({
    packet: packet({ evidenceIds: ["market-monitor:us2y:2026-10-04"] }),
    analyticalOutput: output([decision({
      canonical_evidence_refs: ["market-monitor:us2y:2026-10-04"],
    })]),
    stories,
    regimeLinks: [],
    queueableEvidenceIds: new Set(),
  });

  assert.equal(plan.items.length, 0);
  assert.ok(plan.warnings.some((warning) => /no queueable canonical evidence/i.test(warning)));
});

test("A3 explicit Story destination outranks Motion primary Story fallback", () => {
  const plan = buildDossierReevaluationPropagationPlan({
    packet: packet({ primaryStoryId: STORY_A }),
    analyticalOutput: output([decision({ destination_refs: [`STORY:${STORY_B}`] })]),
    stories,
    regimeLinks: [],
    queueableEvidenceIds: new Set([EVIDENCE_A]),
  });

  assert.deepEqual(plan.items.map((item) => item.target_story_id), [STORY_B]);
  assert.equal(plan.items[0]?.route_kind, "explicit_story");
});

test("A3 REGIME:CURRENT uses one core plus bridge/supporting links ranked by role then confidence", () => {
  const plan = buildDossierReevaluationPropagationPlan({
    packet: packet({ primaryStoryId: null, primaryRegimeSlug: "global-cost-of-capital" }),
    analyticalOutput: output([decision({ destination_refs: ["REGIME:CURRENT"] })]),
    stories,
    regimeLinks: [
      { regime_slug: "global-cost-of-capital", story_id: STORY_A, role: "core", confidence: 70 },
      { regime_slug: "global-cost-of-capital", story_id: STORY_B, role: "core", confidence: 95 },
      { regime_slug: "global-cost-of-capital", story_id: STORY_C, role: "bridge", confidence: 92 },
      { regime_slug: "global-cost-of-capital", story_id: STORY_D, role: "supporting", confidence: 99 },
      { regime_slug: "global-cost-of-capital", story_id: STORY_E, role: "bridge", confidence: 80 },
    ],
    queueableEvidenceIds: new Set([EVIDENCE_A]),
  });

  assert.deepEqual(plan.items.map((item) => item.target_story_id), [STORY_B, STORY_C, STORY_E]);
  assert.deepEqual(plan.items.map((item) => item.route_kind), ["regime_core", "regime_bridge", "regime_bridge"]);
  assert.ok(plan.items.every((item) => item.target_regime_slug === "global-cost-of-capital"));
});

test("A3 caps total unique Story targets at the existing four-target Story review budget", () => {
  const motions = [STORY_A, STORY_B, STORY_C, STORY_D, STORY_E].map((storyId, index) => ({
    ...packet({
      motionId: `motion-${index}`,
      primaryStoryId: storyId,
      primaryRegimeSlug: null,
    }).motion_context!.items[0],
    motion_id: `motion-${index}`,
    primary_story_id: storyId,
  }));
  const inputPacket = packet();
  inputPacket.motion_context = {
    contract_version: "dossier-motion-context/1",
    omitted_count: 0,
    items: motions,
  };

  const decisions = motions.map((motion) => decision({
    motion_id: motion.motion_id,
    destination_refs: [],
  }));

  const plan = buildDossierReevaluationPropagationPlan({
    packet: inputPacket,
    analyticalOutput: output(decisions),
    stories,
    regimeLinks: [],
    queueableEvidenceIds: new Set([EVIDENCE_A]),
  });

  assert.equal(MAX_DOSSIER_REEVALUATION_PROPAGATION_TARGETS, 4);
  assert.equal(new Set(plan.items.map((item) => item.target_story_id)).size, 4);
  assert.equal(plan.omitted_count, 1);
});

test("A3 collapses duplicate Story/evidence targets and preserves the higher-priority route", () => {
  const inputPacket = packet({ primaryStoryId: STORY_B });
  const plan = buildDossierReevaluationPropagationPlan({
    packet: inputPacket,
    analyticalOutput: output([decision({
      destination_refs: [`STORY:${STORY_B}`, "REGIME:CURRENT"],
    })]),
    stories,
    regimeLinks: [
      { regime_slug: "global-cost-of-capital", story_id: STORY_B, role: "core", confidence: 100 },
      { regime_slug: "global-cost-of-capital", story_id: STORY_C, role: "bridge", confidence: 90 },
    ],
    queueableEvidenceIds: new Set([EVIDENCE_A]),
  });

  const storyB = plan.items.filter((item) => item.target_story_id === STORY_B);
  assert.equal(storyB.length, 1);
  assert.equal(storyB[0]?.route_kind, "explicit_story");
  assert.equal(storyB[0]?.priority, 95);
});

test("A3 does not invent a substitute when the exact Motion primary Story is missing or discarded", () => {
  const plan = buildDossierReevaluationPropagationPlan({
    packet: packet({ primaryStoryId: STORY_E, primaryRegimeSlug: null }),
    analyticalOutput: output([decision({ destination_refs: [] })]),
    stories: stories.map((story) => story.id === STORY_E ? { ...story, status: "discarded" } : story),
    regimeLinks: [],
    queueableEvidenceIds: new Set([EVIDENCE_A]),
  });

  assert.deepEqual(plan.items, []);
  assert.ok(plan.warnings.some((warning) => /primary Story.*unavailable/i.test(warning)));
});


function awaitableQuery<T>(
  data: T,
  error: { message: string } | null = null,
) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "in", "is", "order", "limit", "gte", "lte"]) {
    builder[method] = () => builder;
  }
  builder.then = (
    resolve: (value: { data: T; error: { message: string } | null }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve({ data, error }).then(resolve, reject);
  return builder;
}

function preparationClient(input: {
  evidenceIds?: string[];
  stories?: typeof stories;
  regimeLinks?: Array<{
    regime_id: string;
    story_id: string;
    role: string;
    confidence: number;
    effective_to: string | null;
  }>;
}) {
  const regimeId = "99999999-9999-4999-8999-999999999999";
  const tables: Record<string, unknown[]> = {
    stories: input.stories ?? stories,
    intelligence_evidence: (input.evidenceIds ?? [EVIDENCE_A]).map((id) => ({ id })),
    market_regimes: [{ id: regimeId, slug: "global-cost-of-capital" }],
    market_regime_story_links: input.regimeLinks ?? [
      { regime_id: regimeId, story_id: STORY_C, role: "core", confidence: 91, effective_to: null },
    ],
  };

  return {
    from(table: string) {
      if (!(table in tables)) throw new Error(`Unexpected preparation table ${table}`);
      return awaitableQuery(tables[table]);
    },
  } as unknown as SupabaseClient;
}

test("A3 preparation admits only canonical UUID refs that exist in intelligence_evidence", async () => {
  const prepared = await prepareDossierReevaluationPropagationPlan({
    client: preparationClient({ evidenceIds: [EVIDENCE_B] }),
    packet: packet({ primaryStoryId: STORY_A }),
    analyticalOutput: output([decision({
      canonical_evidence_refs: [EVIDENCE_A, EVIDENCE_B, "market-monitor:us2y:2026-10-04"],
      destination_refs: [`STORY:${STORY_B}`],
    })]),
  });

  assert.equal(prepared.items.length, 1);
  assert.equal(prepared.items[0]?.canonical_evidence_id, EVIDENCE_B);
  assert.equal(prepared.items[0]?.target_story_id, STORY_B);
});

test("A3 preparation resolves active Regime links through market_regimes slug and link role/confidence", async () => {
  const regimeId = "99999999-9999-4999-8999-999999999999";
  const prepared = await prepareDossierReevaluationPropagationPlan({
    client: preparationClient({
      evidenceIds: [EVIDENCE_A],
      regimeLinks: [
        { regime_id: regimeId, story_id: STORY_A, role: "core", confidence: 75, effective_to: null },
        { regime_id: regimeId, story_id: STORY_B, role: "core", confidence: 95, effective_to: null },
        { regime_id: regimeId, story_id: STORY_C, role: "bridge", confidence: 90, effective_to: null },
        { regime_id: regimeId, story_id: STORY_D, role: "supporting", confidence: 98, effective_to: null },
      ],
    }),
    packet: packet({ primaryStoryId: null, primaryRegimeSlug: "global-cost-of-capital" }),
    analyticalOutput: output([decision({
      destination_refs: ["REGIME:CURRENT"],
    })]),
  });

  assert.deepEqual(
    prepared.items.map((item) => [item.target_story_id, item.route_kind]),
    [
      [STORY_B, "regime_core"],
      [STORY_C, "regime_bridge"],
      [STORY_D, "regime_bridge"],
    ],
  );
});

function propagationPlan(
  items: DossierReevaluationPropagationPlan["items"],
): DossierReevaluationPropagationPlan {
  return {
    contract_version: DOSSIER_REEVALUATION_PROPAGATION_CONTRACT_VERSION,
    items,
    omitted_count: 0,
    warnings: [],
  };
}

function queueItem(overrides: Partial<DossierReevaluationPropagationPlan["items"][number]> = {}) {
  return {
    motion_id: "motion-a3",
    decision: "ACCEPT" as const,
    canonical_evidence_id: EVIDENCE_A,
    target_story_id: STORY_A,
    target_story_slug: "story-a",
    target_regime_slug: null,
    route_kind: "explicit_story" as const,
    priority: 95,
    route_reason: "explicit_story",
    ...overrides,
  };
}

function queueClient(input: {
  existing?: Array<{
    target_id: string;
    requested_by_evidence_id: string | null;
    status: string;
  }>;
  insertError?: string | null;
}) {
  const inserted: Array<Record<string, unknown>> = [];

  const client = {
    from(table: string) {
      assert.equal(table, "intelligence_reevaluation_queue");
      const builder = awaitableQuery(input.existing ?? []) as Record<string, unknown>;
      builder.insert = (rows: Array<Record<string, unknown>>) => {
        inserted.push(...rows);
        return awaitableQuery(null, input.insertError ? { message: input.insertError } : null);
      };
      return builder;
    },
  } as unknown as SupabaseClient;

  return { client, inserted };
}

test("A3 queue skips the same Story/evidence pair but allows new evidence and ignores null-evidence System 1 rows", async () => {
  const { client, inserted } = queueClient({
    existing: [
      { target_id: STORY_A, requested_by_evidence_id: EVIDENCE_A, status: "pending" },
      { target_id: STORY_A, requested_by_evidence_id: null, status: "pending" },
    ],
  });
  const plan = propagationPlan([
    queueItem(),
    queueItem({
      canonical_evidence_id: EVIDENCE_B,
      motion_id: "motion-b",
      decision: "REFINE",
      priority: 90,
    }),
  ]);

  const result = await enqueueDossierReevaluationPropagation({
    client,
    dossierId: "77777777-7777-4777-8777-777777777777",
    asOf: "2026-10-04T07:30:00.000Z",
    plan,
  });

  assert.equal(result.planned, 2);
  assert.equal(result.enqueued, 1);
  assert.equal(result.skipped_existing, 1);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0]?.requested_by_evidence_id, EVIDENCE_B);
  assert.equal(inserted[0]?.available_at, "2026-10-04T07:30:00.000Z");
  assert.match(
    String(inserted[0]?.reason),
    /^dossier_motion_acceptance:77777777-7777-4777-8777-777777777777:motion-b:REFINE/,
  );
});

test("A3 queue insertion failure returns an auditable warning without false success", async () => {
  const { client } = queueClient({ insertError: "forced A3 queue failure" });
  const result = await enqueueDossierReevaluationPropagation({
    client,
    dossierId: "77777777-7777-4777-8777-777777777777",
    asOf: "2026-10-04T07:30:00.000Z",
    plan: propagationPlan([queueItem()]),
  });

  assert.equal(result.enqueued, 0);
  assert.equal(result.skipped_existing, 0);
  assert.ok(result.warnings.some((warning) => /forced A3 queue failure/i.test(warning)));
});


test("A3 cycle guard keeps Regime persistence downstream and non-evidentiary", () => {
  const propagationSource = readFileSync(
    new URL("../lib/dossier-v2/reevaluation-propagation.ts", import.meta.url),
    "utf8",
  );
  const regimeSource = readFileSync(
    new URL("../lib/regime-engine.ts", import.meta.url),
    "utf8",
  );
  const executionSource = readFileSync(
    new URL("../lib/dossier-v2/execution.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(propagationSource, /\.from\(["']market_regime_current["']\)/);
  assert.doesNotMatch(propagationSource, /\.from\(["']market_regime_versions["']\)/);
  assert.doesNotMatch(propagationSource, /persist_market_regime_projection_v1/);
  assert.match(
    regimeSource,
    /requested_by_evidence_id:\s*null/,
  );

  const persistIndex = executionSource.indexOf("persistMarketDossierV2(dossierInput");
  const propagationIndex = executionSource.indexOf("enqueueDossierReevaluationPropagation");
  const refreshIndex = executionSource.indexOf("enqueueDossierStoryRefreshAgenda({");
  const regimeIndex = executionSource.indexOf("persistRegimeShadowProjectionSafely({");

  assert.ok(persistIndex >= 0);
  assert.ok(propagationIndex > persistIndex);
  assert.ok(refreshIndex > propagationIndex);
  assert.ok(regimeIndex > refreshIndex);
});
