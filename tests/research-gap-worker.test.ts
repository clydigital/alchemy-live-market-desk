import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { MarketDossierV2 } from "../lib/dossier-v2/contracts.ts";
import {
  buildResearchGapWorkQueue,
  loadLatestResearchGapWorkQueue,
} from "../lib/research-gap-worker.ts";

function dossier(overrides: Partial<MarketDossierV2> = {}): MarketDossierV2 {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    contract_version: "market-dossier-v2/1",
    previous_dossier_id: null,
    as_of: "2026-10-01T00:00:00.000Z",
    freshness: { warnings: [] },
    research_gaps: [{
      gap_id: "gap:credit-confirmation",
      category: "INVESTIGATION_EVIDENCE",
      description: "Need current HY/IG and MOVE/VIX confirmation.",
      severity: "MATERIAL",
      gap_class: "BLOCKER",
      blocking_refs: ["REGIME:CURRENT", "STORY:story:rates-duration-stress"],
    }],
    payload: {
      analytical_output: {
        research_now: [{
          rank: 1,
          action: "Decompose the full Treasury curve and global long-end confirmation.",
          reason: "Separate Fed path from term-premium and global-duration pressure.",
          expected_information_gain: "High",
          linked_investigations: ["inv:duration-transmission"],
          linked_stories: ["story:rates-duration-stress"],
          blocking_evidence: ["Bund/JGB 10Y/30Y", "Cross-currency basis"],
        }],
        investigations: [{
          investigation_id: "inv:duration-transmission",
          status: "open",
          question: "Is duration stress transmitting into credit and volatility?",
          research_next: "Pull MOVE/VIX, HY/IG, global long yields and FX basis.",
          why_it_matters: "Tests whether a rates shock is becoming broader financial tightening.",
          missing_evidence: ["MOVE/VIX", "HY/IG"],
          linked_story_ids: ["story:rates-duration-stress"],
          divergence: "UNRESOLVED",
        }, {
          investigation_id: "inv:old",
          status: "resolved",
          question: "Old resolved question?",
          research_next: "Nothing.",
          why_it_matters: "Historical only.",
          missing_evidence: [],
          linked_story_ids: [],
          divergence: "NONE",
        }],
      },
    },
    created_at: "2026-10-01T00:01:00.000Z",
    ...overrides,
  };
}

test("worker reads research gaps, Research Now and unresolved investigations without ranking them", () => {
  const queue = buildResearchGapWorkQueue(
    dossier(),
    new Date("2026-10-01T00:05:00.000Z"),
  );

  assert.equal(queue.contractVersion, "research-gap-work-queue/1");
  assert.equal(queue.generatedAt, "2026-10-01T00:05:00.000Z");
  assert.deepEqual(queue.sourceCounts, {
    researchGaps: 1,
    researchNow: 1,
    investigations: 1,
  });
  assert.equal(queue.candidates.length, 3);
  assert.deepEqual(queue.candidates.map((item) => item.sourceKind), [
    "research_gap",
    "research_now",
    "investigation",
  ]);
  assert.equal(queue.diagnostics.needsPrioritisation, true);
  assert.equal(queue.diagnostics.excludedResolvedInvestigations, 1);
});

test("native urgency and linkage signals survive normalisation", () => {
  const queue = buildResearchGapWorkQueue(dossier());
  const gap = queue.candidates[0]!;
  const now = queue.candidates[1]!;
  const investigation = queue.candidates[2]!;

  assert.equal(gap.nativeSignals.severity, "MATERIAL");
  assert.equal(gap.nativeSignals.gapClass, "BLOCKER");
  assert.deepEqual(gap.blockingRefs, ["REGIME:CURRENT", "STORY:story:rates-duration-stress"]);
  assert.deepEqual(gap.linkedStoryIds, ["story:rates-duration-stress"]);

  assert.equal(now.nativeSignals.researchNowRank, 1);
  assert.equal(now.nativeSignals.expectedInformationGain, "High");
  assert.deepEqual(now.linkedInvestigationIds, ["inv:duration-transmission"]);
  assert.deepEqual(now.evidenceNeeded, ["Bund/JGB 10Y/30Y", "Cross-currency basis"]);

  assert.equal(investigation.question, "Is duration stress transmitting into credit and volatility?");
  assert.equal(investigation.nativeSignals.investigationStatus, "open");
  assert.equal(investigation.nativeSignals.divergence, "UNRESOLVED");
  assert.deepEqual(investigation.evidenceNeeded, ["MOVE/VIX", "HY/IG"]);
});

test("work IDs are deterministic for the same Dossier and source identity", () => {
  const first = buildResearchGapWorkQueue(dossier(), new Date("2026-10-01T00:05:00Z"));
  const second = buildResearchGapWorkQueue(dossier(), new Date("2026-10-01T00:06:00Z"));
  assert.deepEqual(
    first.candidates.map((item) => item.workId),
    second.candidates.map((item) => item.workId),
  );
});

test("latest-Dossier loader orders by as-of then creation time and returns a normalised queue", async () => {
  const row = dossier();
  const calls: Array<[string, unknown]> = [];
  const query = {
    select(value: string) {
      calls.push(["select", value]);
      return this;
    },
    order(column: string, options: unknown) {
      calls.push([`order:${column}`, options]);
      return this;
    },
    limit(value: number) {
      calls.push(["limit", value]);
      return this;
    },
    async maybeSingle() {
      calls.push(["maybeSingle", true]);
      return { data: row, error: null };
    },
  };
  const fakeClient = {
    from(table: string) {
      assert.equal(table, "market_dossiers_v2");
      return query;
    },
  };

  const queue = await loadLatestResearchGapWorkQueue(
    fakeClient as never,
    new Date("2026-10-01T00:10:00Z"),
  );
  assert.equal(queue?.dossierId, row.id);
  assert.deepEqual(calls.filter(([name]) => String(name).startsWith("order:")), [
    ["order:as_of", { ascending: false }],
    ["order:created_at", { ascending: false }],
  ]);
  assert.ok(calls.some(([name, value]) => name === "limit" && value === 1));
});

test("machine-authenticated queue endpoint is whitelisted before dashboard session auth", () => {
  const config = readFileSync(new URL("../lib/supabase/config.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/research-gap/queue/route.ts", import.meta.url), "utf8");
  assert.match(config, /MACHINE_AUTH_PATHS[\s\S]*"\/api\/research-gap\/queue"/);
  assert.match(route, /acceptsResearchAuthorization/);
  assert.match(route, /loadLatestResearchGapWorkQueue/);
});
