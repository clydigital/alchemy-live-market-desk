import assert from "node:assert/strict";
import test from "node:test";

import { buildFreshNewsRecruitment } from "../lib/intelligence/fresh-news-recruitment.ts";
import type { EvidencePackItem } from "../lib/intelligence/schemas.ts";

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
    eventAt: "2026-09-03T06:00:00.000Z",
    publishedAt: "2026-09-03T06:00:00.000Z",
    availableAt: "2026-09-03T06:01:00.000Z",
    receivedAt: "2026-09-03T06:02:00.000Z",
    freshnessStatus: "current",
    affectedAssets: [],
    affectedTopics: [],
    provenanceUrls: [`https://example.com/${id}`],
    structuredPayload: { itemKey: `feed:${id}`, materiality: 50, evidenceNature: "fresh_news" },
    ...overrides,
  };
}

test("scheduled central-bank entries stay in Ahead and never enter fresh-news recruitment", () => {
  const result = buildFreshNewsRecruitment([
    evidence("rbnz-schedule", {
      claim: "Official schedule for the upcoming RBNZ OCR decision.",
      eventAt: "2026-09-04T12:00:00.000Z",
      publishedAt: "2026-09-04T12:00:00.000Z",
      structuredPayload: { itemKey: "calendar:nz-rbnz-2026-09-04", evidenceNature: "scheduled_event", materiality: 98 },
    }),
  ], "2026-09-03T08:00:00.000Z");

  assert.equal(result.eligibleCount, 0);
  assert.equal(result.scheduledOnlyCount, 1);
  assert.equal(result.diagnostics[0]?.exclusionReason, "scheduled_only");
});

test("a released event outcome is eligible while a recent re-ingestion cannot refresh old news", () => {
  const result = buildFreshNewsRecruitment([
    evidence("released-cpi", {
      evidenceClass: "official_release",
      claim: "US CPI was released above consensus.",
      structuredPayload: { itemKey: "calendar:us-cpi", evidenceNature: "event_outcome", materiality: 96 },
    }),
    evidence("old-copy", {
      publishedAt: "2026-08-20T06:00:00.000Z",
      eventAt: "2026-08-20T06:00:00.000Z",
      receivedAt: "2026-09-03T07:59:00.000Z",
    }),
  ], "2026-09-03T08:00:00.000Z");

  assert.deepEqual(result.candidates.map((item) => item.evidence.id), ["released-cpi"]);
  assert.equal(result.diagnostics.find((item) => item.evidence.id === "old-copy")?.exclusionReason, "stale");
});

test("near-identical same-ancestry copy is deduplicated before semantic clustering", () => {
  const claim = "Treasury yields rose as oil prices increased and investors repriced inflation risk.";
  const result = buildFreshNewsRecruitment([
    evidence("wire-a", { claim, ancestryGroupId: "wire-owner" }),
    evidence("wire-b", { claim: `${claim} Today.`, ancestryGroupId: "wire-owner", receivedAt: "2026-09-03T06:01:00.000Z" }),
  ], "2026-09-03T08:00:00.000Z");

  assert.equal(result.eligibleCount, 1);
  assert.equal(result.duplicateCount, 1);
});

test("a G20-equivalent cross-asset item reaches the semantic recruiter without Story tags", () => {
  const result = buildFreshNewsRecruitment([
    evidence("g20-bonds", {
      claim: "At the G20, the Treasury secretary said higher interest rates mainly reflected stronger growth while global bond yields followed oil higher.",
      affectedAssets: ["GLOBAL_BONDS", "CRUDE_OIL"],
      affectedTopics: [],
      structuredPayload: { itemKey: "axios:g20-bonds", evidenceNature: "fresh_news", materiality: 64 },
    }),
  ], "2026-09-03T08:00:00.000Z");

  assert.equal(result.candidates[0]?.evidence.id, "g20-bonds");
  assert.deepEqual(result.candidates[0]?.evidence.affectedTopics, []);
  assert.deepEqual(result.candidates[0]?.evidence.affectedAssets, ["GLOBAL_BONDS", "CRUDE_OIL"]);
});
