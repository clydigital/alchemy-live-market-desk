import assert from "node:assert/strict";
import test from "node:test";

import { buildRecruitmentCapShadow } from "../lib/intelligence/recruitment-cap-shadow.ts";
import type { EvidencePackItem } from "../lib/intelligence/schemas.ts";
import type { RecruitmentEvidenceCandidate } from "../lib/intelligence/fresh-news-recruitment.ts";

function evidence(id: string, sourceTier = 2): EvidencePackItem {
  return {
    id,
    claim: `Claim ${id}`,
    summary: null,
    evidenceClass: "news",
    sourceName: "Test",
    sourceTier,
    reliabilityScore: 80,
    ancestryGroupId: `group-${id}`,
    supportDirection: "supports",
    eventAt: "2026-09-10T00:00:00.000Z",
    publishedAt: "2026-09-10T00:00:00.000Z",
    availableAt: "2026-09-10T00:00:00.000Z",
    receivedAt: "2026-09-10T00:00:00.000Z",
    freshnessStatus: "fresh",
    affectedAssets: [],
    affectedTopics: [],
    provenanceUrls: [`https://example.com/${id}`],
    structuredPayload: {},
  };
}

function candidate(index: number, overrides: Partial<RecruitmentEvidenceCandidate> = {}): RecruitmentEvidenceCandidate {
  return {
    evidence: evidence(`ev-${index}`),
    nature: "fresh_news",
    ageHours: 1,
    freshnessScore: 100 - index,
    upstreamMateriality: 50,
    eligible: true,
    exclusionReason: null,
    duplicateOfEvidenceId: null,
    ...overrides,
  };
}

test("recruitment cap shadow measures a 36-of-48 packet without mutating candidates", () => {
  const candidates = Array.from({ length: 48 }, (_, index) => candidate(index));
  const before = candidates.map((item) => item.evidence.id);
  const shadow = buildRecruitmentCapShadow({ candidates });

  assert.equal(shadow.currentCandidateCount, 48);
  assert.equal(shadow.proposedCandidateCap, 36);
  assert.equal(shadow.proposedCandidateCount, 36);
  assert.equal(shadow.omittedCandidateCount, 12);
  assert.deepEqual(candidates.map((item) => item.evidence.id), before);
});

test("recruitment cap shadow surfaces high-value evidence that a smaller cap would omit", () => {
  const candidates = Array.from({ length: 40 }, (_, index) => candidate(index));
  candidates[36] = candidate(36, { upstreamMateriality: 72, freshnessScore: 95 });
  candidates[37] = candidate(37, { upstreamMateriality: 91, evidence: evidence("tier-1", 1) });
  candidates[38] = candidate(38, { nature: "event_outcome", upstreamMateriality: 88 });

  const shadow = buildRecruitmentCapShadow({ candidates });

  assert.equal(shadow.omittedCandidateCount, 4);
  assert.equal(shadow.omittedMateriality70Count, 3);
  assert.equal(shadow.omittedMateriality85Count, 2);
  assert.equal(shadow.omittedFreshness90Count, 1);
  assert.equal(shadow.omittedTier1Count, 1);
  assert.equal(shadow.omittedEventOutcomeCount, 1);
  assert.equal(shadow.omittedMaxMateriality, 91);
  assert.equal(shadow.omittedMaxFreshness, 95);
});

test("recruitment cap shadow reports no omission below the proposed cap", () => {
  const shadow = buildRecruitmentCapShadow({ candidates: Array.from({ length: 12 }, (_, index) => candidate(index)) });

  assert.equal(shadow.proposedCandidateCount, 12);
  assert.equal(shadow.omittedCandidateCount, 0);
  assert.equal(shadow.omittedMaxMateriality, null);
  assert.equal(shadow.omittedMaxFreshness, null);
});
