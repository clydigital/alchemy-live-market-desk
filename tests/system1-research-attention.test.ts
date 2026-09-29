import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSystem1ResearchAttention,
  MAX_SYSTEM1_EVIDENCE_PER_CLUSTER,
  MAX_SYSTEM1_RESEARCH_CLUSTERS,
} from "../lib/intelligence/system1-research-attention.ts";
import type {
  FreshNewsRecruitment,
  RecruitmentEvidenceCandidate,
} from "../lib/intelligence/fresh-news-recruitment.ts";
import type { EvidencePackItem } from "../lib/intelligence/schemas.ts";

function evidence(
  id: string,
  title: string,
  overrides: Partial<EvidencePackItem> = {},
): EvidencePackItem {
  return {
    id,
    claim: title,
    summary: title,
    evidenceClass: "news",
    sourceName: `Source ${id}`,
    sourceTier: 2,
    reliabilityScore: 80,
    ancestryGroupId: `ancestry-${id}`,
    supportDirection: "context",
    eventAt: "2026-09-30T00:00:00.000Z",
    publishedAt: "2026-09-30T00:00:00.000Z",
    availableAt: "2026-09-30T00:00:00.000Z",
    receivedAt: "2026-09-30T00:01:00.000Z",
    freshnessStatus: "current",
    affectedAssets: [],
    affectedTopics: [],
    provenanceUrls: [`https://example-${id}.com/${id}`],
    structuredPayload: {
      itemKey: id,
      title,
      relevance: 80,
      novelty: 75,
      materiality: 75,
      recommendedAction: "collect_evidence",
    },
    ...overrides,
  };
}

function candidate(
  id: string,
  title: string,
  overrides: Partial<RecruitmentEvidenceCandidate> = {},
): RecruitmentEvidenceCandidate {
  return {
    evidence: evidence(id, title),
    nature: "fresh_news",
    ageHours: 1,
    freshnessScore: 100,
    upstreamMateriality: 75,
    eligible: true,
    exclusionReason: null,
    duplicateOfEvidenceId: null,
    ...overrides,
  };
}

function recruitment(candidates: RecruitmentEvidenceCandidate[]): FreshNewsRecruitment {
  return {
    asOf: "2026-09-30T01:00:00.000Z",
    evidenceCount: candidates.length,
    eligibleCount: candidates.length,
    scheduledOnlyCount: 0,
    staleCount: 0,
    futureTimestampCount: 0,
    duplicateCount: 0,
    candidates,
    diagnostics: candidates,
  };
}

test("System 1 sends at most four research clusters to System 2", () => {
  const packet = buildSystem1ResearchAttention(recruitment([
    candidate("rates", "Treasury term premium reprices borrowing costs", {
      evidence: evidence("rates", "Treasury term premium reprices borrowing costs", {
        structuredPayload: {
          itemKey: "rates",
          title: "Treasury term premium reprices borrowing costs",
          relevance: 95,
          novelty: 82,
          materiality: 94,
          recommendedAction: "collect_evidence",
        },
      }),
    }),
    candidate("memory", "Korean memory exports accelerate on HBM demand"),
    candidate("oil", "Refining margins widen despite softer crude"),
    candidate("china", "China household credit remains weak"),
    candidate("gold", "Central bank gold purchases remain elevated"),
    candidate("shipping", "Shipping insurance premia rise on rerouting"),
  ]));

  assert.equal(packet.candidateCount, MAX_SYSTEM1_RESEARCH_CLUSTERS);
  assert.ok(packet.cues.length <= MAX_SYSTEM1_RESEARCH_CLUSTERS);
  assert.ok(packet.evidenceCount <= MAX_SYSTEM1_RESEARCH_CLUSTERS * MAX_SYSTEM1_EVIDENCE_PER_CLUSTER);
});

test("System 1 bounds evidence depth within one research cluster", () => {
  const sameCluster = Array.from({ length: 7 }, (_, index) =>
    candidate(
      `memory-${index}`,
      `Memory HBM supply tightens as AI accelerator demand rises update ${index}`,
      {
        evidence: evidence(
          `memory-${index}`,
          `Memory HBM supply tightens as AI accelerator demand rises update ${index}`,
          {
            ancestryGroupId: `memory-source-${index}`,
            structuredPayload: {
              itemKey: `memory-${index}`,
              title: `Memory HBM supply tightens as AI accelerator demand rises update ${index}`,
              relevance: 88,
              novelty: 80,
              materiality: 86,
              recommendedAction: "collect_evidence",
            },
          },
        ),
      },
    )
  );

  const packet = buildSystem1ResearchAttention(recruitment(sameCluster));

  assert.equal(packet.candidateCount, 1);
  assert.equal(packet.evidenceCount, MAX_SYSTEM1_EVIDENCE_PER_CLUSTER);
  assert.equal(packet.cues[0].evidenceIds.length, MAX_SYSTEM1_EVIDENCE_PER_CLUSTER);
});

test("System 1 questions encode investigation behaviour without asserting a conclusion", () => {
  const contradiction = candidate("credit", "Credit spreads diverge from equity optimism", {
    evidence: evidence("credit", "Credit spreads diverge from equity optimism", {
      structuredPayload: {
        itemKey: "credit",
        title: "Credit spreads diverge from equity optimism",
        relevance: 90,
        novelty: 82,
        materiality: 85,
        recommendedAction: "collect_evidence",
        divergenceKind: "contradiction",
      },
    }),
  });
  const existingStory = candidate("ai", "AI inference pricing falls again", {
    evidence: evidence("ai", "AI inference pricing falls again", {
      affectedTopics: ["us-china-ai-war"],
      structuredPayload: {
        itemKey: "ai",
        title: "AI inference pricing falls again",
        relevance: 90,
        novelty: 84,
        materiality: 82,
        recommendedAction: "recalibrate_story",
      },
    }),
  });

  const packet = buildSystem1ResearchAttention(recruitment([contradiction, existingStory]));

  const questions = packet.cues.map((cue) => cue.question).join("\n");
  assert.match(questions, /why is the expected relationship not holding/);
  assert.match(questions, /cross-asset or second-order transmission/);
  assert.doesNotMatch(questions, /therefore|proves|will rise|will fall/i);
});
