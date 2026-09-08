import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalStoryEvidenceTimestamp,
  latestStoryEvidenceTimestamp,
} from "../lib/intelligence/fresh-news-recruitment.ts";
import type { EvidencePackItem } from "../lib/intelligence/schemas.ts";

const SEPTEMBER_2 = "2026-09-02T08:00:00.000Z";
const SEPTEMBER_8 = "2026-09-08T08:00:00.000Z";
const SEPTEMBER_9 = "2026-09-09T08:00:00.000Z";

function evidence(id: string, overrides: Partial<EvidencePackItem> = {}): EvidencePackItem {
  return {
    id,
    claim: `Evidence claim ${id}`,
    summary: null,
    evidenceClass: "news_report",
    sourceName: "Named source",
    sourceTier: 3,
    reliabilityScore: 75,
    ancestryGroupId: `ancestry-${id}`,
    supportDirection: "context",
    eventAt: SEPTEMBER_2,
    publishedAt: SEPTEMBER_2,
    availableAt: "2026-09-02T08:01:00.000Z",
    receivedAt: SEPTEMBER_9,
    freshnessStatus: "current",
    affectedAssets: [],
    affectedTopics: [],
    provenanceUrls: [`https://example.com/${id}`],
    structuredPayload: { itemKey: `feed:${id}`, evidenceNature: "fresh_news" },
    ...overrides,
  };
}

test("old Evidence replay keeps its publication time instead of receipt or evaluation time", () => {
  const oldEvidence = evidence("old-replay", { receivedAt: SEPTEMBER_9 });

  assert.equal(canonicalStoryEvidenceTimestamp(oldEvidence), SEPTEMBER_2);
  assert.equal(latestStoryEvidenceTimestamp([oldEvidence]), SEPTEMBER_2);
});

test("genuinely new Evidence advances Story freshness and mixed packs select the newest relevant time", () => {
  const oldEvidence = evidence("old");
  const newEvidence = evidence("new", {
    eventAt: "2026-09-08T07:00:00.000Z",
    publishedAt: SEPTEMBER_8,
    availableAt: "2026-09-08T08:01:00.000Z",
    receivedAt: SEPTEMBER_9,
  });

  assert.equal(latestStoryEvidenceTimestamp([oldEvidence, newEvidence]), SEPTEMBER_8);
  assert.equal(latestStoryEvidenceTimestamp([newEvidence, oldEvidence]), SEPTEMBER_8);
});

test("class-specific precedence distinguishes event time from publication and availability", () => {
  const eventOutcome = evidence("event-outcome", {
    evidenceClass: "official_release",
    eventAt: SEPTEMBER_8,
    publishedAt: SEPTEMBER_9,
    availableAt: "2026-09-09T08:01:00.000Z",
    structuredPayload: { itemKey: "calendar:us-cpi", evidenceNature: "event_outcome" },
  });
  const ordinaryNews = evidence("ordinary-news", {
    eventAt: "2026-09-01T08:00:00.000Z",
    publishedAt: SEPTEMBER_2,
    availableAt: SEPTEMBER_8,
  });

  assert.equal(canonicalStoryEvidenceTimestamp(eventOutcome), SEPTEMBER_8);
  assert.equal(canonicalStoryEvidenceTimestamp(ordinaryNews), SEPTEMBER_2);
});

test("scheduled entries cannot advance freshness until actual outcome Evidence exists", () => {
  const scheduled = evidence("scheduled", {
    eventAt: "2026-09-10T08:00:00.000Z",
    publishedAt: SEPTEMBER_9,
    structuredPayload: { itemKey: "calendar:ecb-rate", evidenceNature: "scheduled_event" },
  });
  const outcome = evidence("outcome", {
    evidenceClass: "official_release",
    eventAt: "2026-09-10T08:00:00.000Z",
    publishedAt: "2026-09-10T08:02:00.000Z",
    structuredPayload: { itemKey: "calendar:ecb-rate", evidenceNature: "event_outcome" },
  });

  assert.equal(latestStoryEvidenceTimestamp([scheduled]), null);
  assert.equal(latestStoryEvidenceTimestamp([scheduled, outcome]), "2026-09-10T08:00:00.000Z");
});

test("replay is idempotent and cannot regress a Story that already has newer Evidence", () => {
  const oldEvidence = evidence("old-replay");
  const firstReplay = latestStoryEvidenceTimestamp([oldEvidence], SEPTEMBER_8);
  const secondReplay = latestStoryEvidenceTimestamp([oldEvidence], firstReplay);

  assert.equal(firstReplay, SEPTEMBER_8);
  assert.equal(secondReplay, SEPTEMBER_8);
});

test("manual and scheduled triggers use the same trigger-agnostic temporal result", () => {
  const frozenEvidence = [evidence("old"), evidence("new", { publishedAt: SEPTEMBER_8 })];
  const results = (["manual", "scheduled"] as const).map(() => latestStoryEvidenceTimestamp(frozenEvidence));

  assert.deepEqual(results, [SEPTEMBER_8, SEPTEMBER_8]);
});

test("runtime writes canonical Evidence time while preserving evaluation and material-mutation clocks", () => {
  const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");

  assert.equal((runtime.match(/latestStoryEvidenceTimestamp\(/g) ?? []).length, 2);
  assert.doesNotMatch(runtime, /last_evidence_at:\s*new Date\(\)\.toISOString\(\)/);
  assert.match(runtime, /last_evidence_at: lastEvidenceAt,[\s\S]*last_evaluated_at: mutationAt,[\s\S]*last_material_update_at: mutationAt,[\s\S]*momentum: momentumForTransition/);
});
