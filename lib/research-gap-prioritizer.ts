import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ResearchGapWorkCandidate,
  ResearchGapWorkQueue,
} from "./research-gap-worker.ts";
import { loadLatestResearchGapWorkQueue } from "./research-gap-worker.ts";

export const RESEARCH_GAP_PRIORITY_QUEUE_VERSION = "research-gap-priority-queue/1" as const;
export const MAX_SELECTED_RESEARCH_GAPS = 3;

export type ResearchGapPriorityBreakdown = {
  blocker: number;
  informationGain: number;
  nativeRank: number;
  investigationState: number;
  linkage: number;
  evidenceNeed: number;
  motionAttention: number;
};

export type PrioritisedResearchGap = ResearchGapWorkCandidate & {
  priorityRank: number;
  priorityScore: number;
  scoreBreakdown: ResearchGapPriorityBreakdown;
  selectionReason: string[];
};

export type SuppressedResearchGap = {
  workId: string;
  sourceKind: ResearchGapWorkCandidate["sourceKind"];
  sourceRef: string;
  priorityScore: number;
  reason: "duplicate_investigation_coverage" | "below_selection_cutoff";
  coveredByWorkId?: string;
};

export type ResearchGapPriorityQueue = {
  contractVersion: typeof RESEARCH_GAP_PRIORITY_QUEUE_VERSION;
  generatedAt: string;
  dossierId: string;
  dossierAsOf: string;
  selected: PrioritisedResearchGap[];
  suppressed: SuppressedResearchGap[];
  diagnostics: {
    maxSelected: number;
    sourceCandidateCount: number;
    selectedCount: number;
    duplicateCoverageSuppressed: number;
    cutoffSuppressed: number;
    policy: string[];
  };
};

function normal(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function blockerScore(candidate: ResearchGapWorkCandidate) {
  if (
    candidate.nativeSignals.severity === "MATERIAL"
    && candidate.nativeSignals.gapClass === "BLOCKER"
  ) return 45;
  if (candidate.nativeSignals.severity === "MATERIAL") return 32;
  if (candidate.nativeSignals.gapClass === "REFINEMENT") return 8;
  if (candidate.nativeSignals.severity === "INFORMATIONAL") return 6;
  return 0;
}

function informationGainScore(candidate: ResearchGapWorkCandidate) {
  const gain = normal(candidate.nativeSignals.expectedInformationGain);
  if (gain === "HIGH") return 28;
  if (gain === "MEDIUM") return 18;
  if (gain === "LOW") return 8;
  return 0;
}

function nativeRankScore(candidate: ResearchGapWorkCandidate) {
  const rank = candidate.nativeSignals.researchNowRank;
  if (rank === 1) return 15;
  if (rank === 2) return 10;
  if (rank === 3) return 6;
  if (typeof rank === "number" && rank > 3) return 2;
  return 0;
}

function investigationStateScore(candidate: ResearchGapWorkCandidate) {
  const divergence = normal(candidate.nativeSignals.divergence);
  const status = normal(candidate.nativeSignals.investigationStatus);

  let score = 0;
  if (divergence === "MATERIAL") score += 18;
  else if (divergence === "PARTIAL") score += 13;
  else if (divergence === "UNRESOLVED") score += 11;

  if (status === "STRENGTHENED") score += 7;
  else if (status === "OPEN") score += 5;
  else if (status === "WEAKENED") score += 3;

  return score;
}

function linkageScore(candidate: ResearchGapWorkCandidate) {
  let score = 0;
  if (candidate.linkedStoryIds.length > 0) score += 4;
  if (candidate.linkedInvestigationIds.length > 0) score += 4;
  if (candidate.blockingRefs.includes("MAIN_THREAD")) score += 5;
  if (candidate.blockingRefs.includes("REGIME:CURRENT")) score += 5;
  return Math.min(score, 12);
}

function evidenceNeedScore(candidate: ResearchGapWorkCandidate) {
  if (candidate.evidenceNeeded.length === 0) return 0;
  return Math.min(8, candidate.evidenceNeeded.length * 2);
}

function motionAttentionScore(candidate: ResearchGapWorkCandidate) {
  if (candidate.sourceKind !== "market_motion") return 0;
  const score = candidate.nativeSignals.motionAttentionScore ?? 0;
  const tier = candidate.nativeSignals.motionAttentionTier;
  const writing = candidate.nativeSignals.motionWritingPotential;

  let result = tier === "PRIMARY" ? 16 : score >= 80 ? 10 : score >= 70 ? 6 : 3;
  if (score >= 90) result += 4;
  else if (score >= 85) result += 2;
  if (writing === "HIGH") result += 4;
  else if (writing === "MEDIUM") result += 2;
  return Math.min(24, result);
}

function sourceTieBreak(candidate: ResearchGapWorkCandidate) {
  if (candidate.sourceKind === "research_gap") return 4;
  if (candidate.sourceKind === "research_now") return 3;
  if (candidate.sourceKind === "market_motion") return 2;
  return 1;
}

export function scoreResearchGapCandidate(candidate: ResearchGapWorkCandidate) {
  const scoreBreakdown: ResearchGapPriorityBreakdown = {
    blocker: blockerScore(candidate),
    informationGain: informationGainScore(candidate),
    nativeRank: nativeRankScore(candidate),
    investigationState: investigationStateScore(candidate),
    linkage: linkageScore(candidate),
    evidenceNeed: evidenceNeedScore(candidate),
    motionAttention: motionAttentionScore(candidate),
  };
  const priorityScore = Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0);

  const selectionReason: string[] = [];
  if (scoreBreakdown.blocker >= 32) selectionReason.push("material blocker");
  if (scoreBreakdown.informationGain >= 28) selectionReason.push("high expected information gain");
  else if (scoreBreakdown.informationGain >= 18) selectionReason.push("medium expected information gain");
  if (scoreBreakdown.nativeRank >= 15) selectionReason.push("Research Now rank 1");
  else if (scoreBreakdown.nativeRank >= 10) selectionReason.push("Research Now rank 2");
  if (scoreBreakdown.investigationState >= 11) selectionReason.push("unresolved/divergent investigation");
  if (candidate.blockingRefs.includes("MAIN_THREAD")) selectionReason.push("blocks main thread");
  if (candidate.blockingRefs.includes("REGIME:CURRENT")) selectionReason.push("blocks current regime");
  if (candidate.linkedStoryIds.length > 0) selectionReason.push("linked to persistent Story");
  if (candidate.evidenceNeeded.length > 0) selectionReason.push("specific missing evidence identified");
  if (scoreBreakdown.motionAttention >= 16) selectionReason.push("Primary Market Motion with unresolved next test");
  else if (scoreBreakdown.motionAttention > 0) selectionReason.push("Market Motion with research-worthy attention");
  if (selectionReason.length === 0) selectionReason.push("eligible unresolved research work");

  return {
    candidate,
    priorityScore,
    scoreBreakdown,
    selectionReason,
  };
}

function overlapsInvestigation(
  candidate: ResearchGapWorkCandidate,
  selected: PrioritisedResearchGap[],
) {
  // Only suppress the lower-level Investigation card when higher-level selected
  // Research Now work already operationalises that investigation. Distinct
  // Research Now actions may share one investigation and still represent
  // different evidence branches worth funding separately.
  if (candidate.sourceKind !== "investigation") return null;

  const ids = new Set(candidate.linkedInvestigationIds);
  if (ids.size === 0) return null;

  for (const item of selected) {
    if (
      item.sourceKind === "research_now"
      && item.linkedInvestigationIds.some((id) => ids.has(id))
    ) return item;
  }
  return null;
}

export function prioritiseResearchGapWork(
  queue: ResearchGapWorkQueue,
  maxSelected = MAX_SELECTED_RESEARCH_GAPS,
): ResearchGapPriorityQueue {
  const limit = Math.max(1, Math.min(MAX_SELECTED_RESEARCH_GAPS, Math.floor(maxSelected)));
  const scored = queue.candidates
    .map(scoreResearchGapCandidate)
    .sort((left, right) => (
      right.priorityScore - left.priorityScore
      || sourceTieBreak(right.candidate) - sourceTieBreak(left.candidate)
      || left.candidate.workId.localeCompare(right.candidate.workId)
    ));

  const selected: PrioritisedResearchGap[] = [];
  const suppressed: SuppressedResearchGap[] = [];

  for (const item of scored) {
    const duplicate = overlapsInvestigation(item.candidate, selected);
    if (duplicate) {
      suppressed.push({
        workId: item.candidate.workId,
        sourceKind: item.candidate.sourceKind,
        sourceRef: item.candidate.sourceRef,
        priorityScore: item.priorityScore,
        reason: "duplicate_investigation_coverage",
        coveredByWorkId: duplicate.workId,
      });
      continue;
    }

    if (selected.length >= limit) {
      suppressed.push({
        workId: item.candidate.workId,
        sourceKind: item.candidate.sourceKind,
        sourceRef: item.candidate.sourceRef,
        priorityScore: item.priorityScore,
        reason: "below_selection_cutoff",
      });
      continue;
    }

    selected.push({
      ...item.candidate,
      priorityRank: selected.length + 1,
      priorityScore: item.priorityScore,
      scoreBreakdown: item.scoreBreakdown,
      selectionReason: item.selectionReason,
    });
  }

  return {
    contractVersion: RESEARCH_GAP_PRIORITY_QUEUE_VERSION,
    generatedAt: queue.generatedAt,
    dossierId: queue.dossierId,
    dossierAsOf: queue.dossierAsOf,
    selected,
    suppressed,
    diagnostics: {
      maxSelected: limit,
      sourceCandidateCount: queue.candidates.length,
      selectedCount: selected.length,
      duplicateCoverageSuppressed: suppressed.filter((item) => item.reason === "duplicate_investigation_coverage").length,
      cutoffSuppressed: suppressed.filter((item) => item.reason === "below_selection_cutoff").length,
      policy: [
        "MATERIAL/BLOCKER work outranks nonblocking refinement.",
        "Expected information gain and native Research Now rank are preserved as strong priority signals.",
        "Unresolved/divergent investigations gain priority but do not outrank a true material blocker.",
        "A lower-ranked candidate linked to an investigation already covered by a selected item is suppressed for this Dossier.",
        "Fresh promoted Market Motion and Dossier-assessed UNRESOLVED Motion may compete for funding when they carry a concrete next test; Motion attention adds urgency but cannot outrank a true material blocker by itself.",
        "At most three candidates are selected per Dossier.",
      ],
    },
  };
}

export async function loadPrioritisedResearchGapWork(
  client?: SupabaseClient,
  now = new Date(),
) {
  const queue = await loadLatestResearchGapWorkQueue(client, now);
  return queue ? prioritiseResearchGapWork(queue) : null;
}
