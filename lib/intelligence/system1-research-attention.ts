import {
  buildResearchAttentionPacket,
  type AttentionReservationLane,
  type ResearchAttentionCandidate,
  type ResearchAttentionInput,
} from "../research-attention";
import {
  type FreshNewsRecruitment,
  type RecruitmentEvidenceCandidate,
} from "./fresh-news-recruitment";
import type { EvidencePackItem } from "./schemas";

export const MAX_SYSTEM1_RESEARCH_CLUSTERS = 4;
export const MAX_SYSTEM1_EVIDENCE_PER_CLUSTER = 4;

export type System1ResearchCue = {
  candidateId: string;
  priority: number;
  lane: AttentionReservationLane;
  question: string;
  reason: "contradiction" | "current_story_delta" | "emerging_theme" | "open_research";
  storySlugs: string[];
  evidenceIds: string[];
};

export type System1ResearchAttention = {
  selectedCandidates: RecruitmentEvidenceCandidate[];
  selectedEvidence: EvidencePackItem[];
  cues: System1ResearchCue[];
  candidateCount: number;
  evidenceCount: number;
};

function number(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function itemKey(candidate: RecruitmentEvidenceCandidate) {
  return text(candidate.evidence.structuredPayload?.itemKey) || `evidence:${candidate.evidence.id}`;
}

function publishedAt(item: EvidencePackItem, fallback: string) {
  return item.publishedAt || item.availableAt || item.eventAt || item.receivedAt || fallback;
}

function researchAttentionInput(
  candidate: RecruitmentEvidenceCandidate,
  generatedAt: string,
): ResearchAttentionInput {
  const item = candidate.evidence;
  return {
    itemKey: itemKey(candidate),
    publisher: item.sourceName || "Unknown source",
    title: text(item.structuredPayload?.title) || item.claim,
    url: item.provenanceUrls[0] || `urn:evidence:${item.id}`,
    publishedAt: publishedAt(item, generatedAt),
    summary: item.summary || item.claim,
    sourceQuality: Math.max(0, Math.min(100, Math.round(item.reliabilityScore || 0))),
    relevance: number(item.structuredPayload?.relevance, 50),
    novelty: number(item.structuredPayload?.novelty, 50),
    materiality: number(item.structuredPayload?.materiality, candidate.upstreamMateriality),
    recommendedAction: text(item.structuredPayload?.recommendedAction) || "collect_evidence",
    divergenceKind: text(item.structuredPayload?.divergenceKind) || undefined,
    affectedStorySlugs: item.affectedTopics,
  };
}

function reason(candidate: ResearchAttentionCandidate): System1ResearchCue["reason"] {
  if (candidate.contradiction) return "contradiction";
  if (candidate.currentDelta) return "current_story_delta";
  if (candidate.emerging) return "emerging_theme";
  return "open_research";
}

function researchQuestion(candidate: ResearchAttentionCandidate) {
  if (candidate.contradiction) {
    return `What changed around "${candidate.representativeTitle}", why is the expected relationship not holding, and what evidence would resolve it?`;
  }
  if (candidate.currentDelta) {
    return `What changed around "${candidate.representativeTitle}", why does it matter for the existing Story, and what cross-asset or second-order transmission is worth testing?`;
  }
  if (candidate.emerging) {
    return `What changed around "${candidate.representativeTitle}", what second-order or cross-market implication could matter, and what would confirm it?`;
  }
  return `Is "${candidate.representativeTitle}" decision-relevant now? What causal mechanism and market implication are worth testing?`;
}

/**
 * Deterministic System 1 research-attention gate.
 *
 * All evidence remains canonical. This only decides which fresh clusters are
 * worth spending System 2 reasoning tokens on during this run.
 */
export function buildSystem1ResearchAttention(
  recruitment: FreshNewsRecruitment,
  options: {
    maxClusters?: number;
    maxEvidencePerCluster?: number;
  } = {},
): System1ResearchAttention {
  const maxClusters = Math.max(1, Math.min(
    MAX_SYSTEM1_RESEARCH_CLUSTERS,
    Math.floor(options.maxClusters ?? MAX_SYSTEM1_RESEARCH_CLUSTERS),
  ));
  const maxEvidencePerCluster = Math.max(1, Math.min(
    MAX_SYSTEM1_EVIDENCE_PER_CLUSTER,
    Math.floor(options.maxEvidencePerCluster ?? MAX_SYSTEM1_EVIDENCE_PER_CLUSTER),
  ));

  const candidatesByKey = new Map(
    recruitment.candidates.map((candidate) => [itemKey(candidate), candidate]),
  );
  const packet = buildResearchAttentionPacket(
    recruitment.candidates.map((candidate) => researchAttentionInput(candidate, recruitment.asOf)),
    { generatedAt: recruitment.asOf, maxSlots: maxClusters },
  );

  const selectedCandidates: RecruitmentEvidenceCandidate[] = [];
  const selectedEvidenceIds = new Set<string>();
  const cues = packet.selected.map((candidate): System1ResearchCue => {
    const clusterCandidates = candidate.itemKeys
      .flatMap((key) => {
        const selected = candidatesByKey.get(key);
        return selected ? [selected] : [];
      })
      // Preserve the Fresh News Recruiter's deterministic quality/freshness order.
      .sort((left, right) =>
        recruitment.candidates.indexOf(left) - recruitment.candidates.indexOf(right))
      .slice(0, maxEvidencePerCluster);

    for (const selected of clusterCandidates) {
      if (selectedEvidenceIds.has(selected.evidence.id)) continue;
      selectedEvidenceIds.add(selected.evidence.id);
      selectedCandidates.push(selected);
    }

    return {
      candidateId: candidate.id,
      priority: candidate.priority,
      lane: candidate.reservationLane || "open",
      question: researchQuestion(candidate),
      reason: reason(candidate),
      storySlugs: candidate.storySlugs,
      evidenceIds: clusterCandidates.map((selected) => selected.evidence.id),
    };
  }).filter((cue) => cue.evidenceIds.length > 0);

  return {
    selectedCandidates,
    selectedEvidence: selectedCandidates.map((candidate) => candidate.evidence),
    cues,
    candidateCount: cues.length,
    evidenceCount: selectedCandidates.length,
  };
}
