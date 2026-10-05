import { createHash } from "node:crypto";

import type {
  D7CrossLayerDivergenceSnapshot,
  D7DivergenceCase,
} from "./dossier-v2/cross-layer-divergence.ts";
import { persistentResearchGapKey } from "./research-gap-identity.ts";
import {
  MAX_RESEARCH_GAP_WORK_CANDIDATES,
  type ResearchGapWorkCandidate,
  type ResearchGapWorkQueue,
} from "./research-gap-worker.ts";

function stableHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function shouldRoute(item: D7DivergenceCase) {
  if (!item.researchEligible) return false;
  if (item.state !== "CONTRADICTION" && item.state !== "LAG") return false;
  if (item.severity === "HIGH") return true;
  if (item.severity !== "MEDIUM") return false;
  return Boolean(
    item.persistentStoryId
    || item.regimeSlug
    || item.pair === "REGIME_HYBRID",
  );
}

function actionFor(item: D7DivergenceCase) {
  if (item.pair === "DOSSIER_STORY") {
    return "Resolve whether the exact persistent Story should incorporate the current Dossier evidence delta.";
  }
  if (item.pair === "STORY_REGIME") {
    return "Resolve whether the exact persistent Story should still contribute to current Regime state.";
  }
  if (item.pair === "REGIME_HYBRID") {
    return "Resolve whether the current Regime evidence satisfies the governed Hybrid transition.";
  }
  if (item.pair === "DOSSIER_MARKET") {
    return "Resolve why measured market reaction contradicted the prior Dossier expectation.";
  }
  if (item.pair === "STORY_MARKET") {
    return "Resolve why measured market reaction diverged from the expectation linked to this exact persistent Story.";
  }
  return "Resolve the measured expectation-versus-market divergence.";
}

function diagnosticNeed(item: D7DivergenceCase) {
  if (item.pair === "DOSSIER_STORY") {
    return "Discriminate whether the Dossier evidence delta is newer than canonical Story adjudication or genuinely conflicts with it.";
  }
  if (item.pair === "STORY_REGIME") {
    return "Check the exact Regime trigger/telemetry that governs whether this Story contributes to state.";
  }
  if (item.pair === "REGIME_HYBRID") {
    return "Check the structured Regime condition and the exact Hybrid transition guard side by side.";
  }
  if (item.pair === "DOSSIER_MARKET") {
    return "Identify discriminating evidence for the observed market reaction versus the prior Dossier expectation.";
  }
  if (item.pair === "STORY_MARKET") {
    return "Identify discriminating market evidence tied to the exact persistent Story expectation.";
  }
  return "Identify the smallest discriminating evidence set for the expected-versus-observed market mismatch.";
}

export function buildD7ResearchGapCandidates(input: {
  dossierId: string;
  dossierAsOf: string;
  snapshot: D7CrossLayerDivergenceSnapshot;
}): ResearchGapWorkCandidate[] {
  return input.snapshot.cases
    .filter(shouldRoute)
    .map((item): ResearchGapWorkCandidate => {
      const sourceRef = `d7:${item.id}`;
      const nativeId = `d7:${item.id}`;
      const action = actionFor(item);
      const evidenceNeeded = unique([
        ...item.evidenceRefs,
        diagnosticNeed(item),
      ]);
      const linkedInvestigationIds = item.investigationId
        ? [item.investigationId]
        : [];
      const linkedStoryIds = item.persistentStoryId
        ? [item.persistentStoryId]
        : [];
      const blockingRefs = unique([
        ...(item.persistentStoryId
          ? [`STORY:${item.persistentStoryId}`]
          : []),
        ...(item.regimeSlug ? ["REGIME:CURRENT"] : []),
      ]);

      return {
        workId: `gap-work:${stableHash(
          `${input.dossierId}|${sourceRef}`,
        )}`,
        gapKey: persistentResearchGapKey({
          sourceKind: "research_gap",
          sourceRef,
          nativeId,
          question: item.reason,
          action,
          reason: item.reason,
          evidenceNeeded,
          linkedInvestigationIds,
          linkedStoryIds,
          blockingRefs,
        }),
        sourceKind: "research_gap",
        sourceRef,
        dossierId: input.dossierId,
        dossierAsOf: input.dossierAsOf,
        question: item.reason,
        action,
        reason: item.reason,
        evidenceNeeded,
        linkedInvestigationIds,
        linkedStoryIds,
        blockingRefs,
        nativeSignals: {
          severity:
            item.severity === "HIGH" || item.severity === "MEDIUM"
              ? "MATERIAL"
              : "INFORMATIONAL",
          gapClass: item.severity === "HIGH" ? "BLOCKER" : "REFINEMENT",
          expectedInformationGain:
            item.state === "CONTRADICTION" ? "High" : "Medium",
          researchNowRank: null,
          investigationStatus: item.investigationId ? "open" : null,
          divergence:
            item.state === "CONTRADICTION" ? "MATERIAL" : "PARTIAL",
          motionAttentionTier: null,
          motionAttentionScore: null,
          motionWritingPotential: null,
        },
      };
    });
}

export function appendD7ResearchGapCandidates(
  queue: ResearchGapWorkQueue,
  candidates: ResearchGapWorkCandidate[],
): ResearchGapWorkQueue {
  if (candidates.length === 0) return queue;

  const byGapKey = new Map(
    queue.candidates.map((candidate) => [candidate.gapKey, candidate]),
  );
  for (const candidate of candidates) {
    if (!byGapKey.has(candidate.gapKey)) {
      byGapKey.set(candidate.gapKey, candidate);
    }
  }

  const merged = [...byGapKey.values()];
  const bounded = merged.slice(0, MAX_RESEARCH_GAP_WORK_CANDIDATES);

  return {
    ...queue,
    candidates: bounded,
    sourceCounts: {
      ...queue.sourceCounts,
      researchGaps:
        queue.sourceCounts.researchGaps
        + bounded.filter((item) =>
          item.sourceKind === "research_gap"
          && item.sourceRef.startsWith("d7:")
        ).length,
    },
    diagnostics: {
      ...queue.diagnostics,
      truncated:
        queue.diagnostics.truncated
        || merged.length > MAX_RESEARCH_GAP_WORK_CANDIDATES,
      omittedCandidates:
        queue.diagnostics.omittedCandidates
        + Math.max(0, merged.length - MAX_RESEARCH_GAP_WORK_CANDIDATES),
      notes: [
        ...queue.diagnostics.notes,
        "Material D7 cross-layer CONTRADICTION/LAG cases may enter the ordinary Research Gap queue; they do not create a second acquisition path.",
      ],
    },
  };
}
