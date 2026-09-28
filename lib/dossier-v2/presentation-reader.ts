import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "../supabase/admin.ts";
import type { MarketDossierV2 } from "./contracts.ts";
import {
  buildDossierV2Presentation,
  type DossierPresentationInvestigation,
  type DossierPresentationV1,
} from "./presentation-adapter.ts";
import { validateMarketDossierV2Record } from "./validation.ts";

export type DossierPresentationSelectionStatus =
  | "current"
  | "fallback_previous_healthy"
  | "degraded_latest"
  | "unavailable";

export type DossierCalibrationHistoryCase = {
  dossierId: string;
  asOf: string;
  investigationId: string;
  question: string;
  status: DossierPresentationInvestigation["status"];
  outcome: DossierPresentationInvestigation["reactionCalibration"]["outcome"];
  precision: DossierPresentationInvestigation["reactionCalibration"]["precision"];
  checkCount: number;
  alignedCount: number;
  divergentCount: number;
  reactionWindows: DossierPresentationInvestigation["reactionCalibration"]["reactionWindows"];
  expectationChanged: boolean | null;
  requiresReview: boolean;
  journeyTransition: DossierPresentationInvestigation["journey"]["transition"];
  matchedBy: DossierPresentationInvestigation["journey"]["matchedBy"];
  priorExpectedReaction: string | null;
  currentExpectedReaction: string | null;
  observedReaction: string | null;
  postMortemHypothesis: string;
  competingExplanations: string[];
  researchNext: string;
};

export type DossierCalibrationHistoryEntry = {
  dossierId: string;
  asOf: string;
  degraded: boolean;
  summary: DossierPresentationV1["reactionCalibration"];
  cases: DossierCalibrationHistoryCase[];
};

export type DossierPresentationSelection = {
  status: DossierPresentationSelectionStatus;
  presentation: DossierPresentationV1 | null;
  latestDossierId: string | null;
  selectedDossierId: string | null;
  latestAsOf: string | null;
  selectedAsOf: string | null;
  usingFallback: boolean;
  calibrationHistory: DossierCalibrationHistoryEntry[];
  notice: {
    tone: "ready" | "warn" | "error";
    label: string;
    detail: string;
  };
};

type CandidatePresentation = {
  dossier: MarketDossierV2;
  presentation: DossierPresentationV1;
};

function byNewest(left: MarketDossierV2, right: MarketDossierV2) {
  const leftTime = Date.parse(left.as_of);
  const rightTime = Date.parse(right.as_of);
  return rightTime - leftTime || right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id);
}

function priorDossier(
  dossier: MarketDossierV2,
  dossiersById: Map<string, MarketDossierV2>,
) {
  return dossier.previous_dossier_id
    ? dossiersById.get(dossier.previous_dossier_id) ?? null
    : null;
}

function buildCandidate(
  dossier: MarketDossierV2,
  dossiersById: Map<string, MarketDossierV2>,
): CandidatePresentation | null {
  try {
    const previous = priorDossier(dossier, dossiersById);
    return {
      dossier,
      presentation: buildDossierV2Presentation(dossier, previous),
    };
  } catch {
    try {
      return {
        dossier,
        presentation: buildDossierV2Presentation(dossier),
      };
    } catch {
      return null;
    }
  }
}

function presentationIsHealthy(presentation: DossierPresentationV1) {
  return (
    !presentation.health.degraded &&
    !presentation.health.researchGaps.some(
      (gap) => gap.category === "RESEARCH_BRAIN_DEGRADED",
    )
  );
}

function calibrationHistory(
  built: CandidatePresentation[],
): DossierCalibrationHistoryEntry[] {
  return built.flatMap(({ dossier, presentation }) => {
    const cases = presentation.investigationAudit
      .filter((item) =>
        item.reactionCalibration.checkCount > 0
        || item.reactionCalibration.expectationChanged === true
      )
      .map((item): DossierCalibrationHistoryCase => ({
        dossierId: dossier.id,
        asOf: dossier.as_of,
        investigationId: item.id,
        question: item.question,
        status: item.status,
        outcome: item.reactionCalibration.outcome,
        precision: item.reactionCalibration.precision,
        checkCount: item.reactionCalibration.checkCount,
        alignedCount: item.reactionCalibration.alignedCount,
        divergentCount: item.reactionCalibration.divergentCount,
        reactionWindows: [...item.reactionCalibration.reactionWindows],
        expectationChanged: item.reactionCalibration.expectationChanged,
        requiresReview: item.reactionCalibration.requiresReview,
        journeyTransition: item.journey.transition,
        matchedBy: item.journey.matchedBy,
        priorExpectedReaction: item.journey.previousExpectedReaction,
        currentExpectedReaction: item.expectedReaction,
        observedReaction: item.observedReaction,
        postMortemHypothesis: item.currentExplanation,
        competingExplanations: [...item.competingExplanations],
        researchNext: item.researchNext,
      }));

    return cases.length
      ? [{
          dossierId: dossier.id,
          asOf: dossier.as_of,
          degraded: presentation.health.degraded,
          summary: presentation.reactionCalibration,
          cases,
        }]
      : [];
  }).slice(0, 12);
}

export function selectDossierV2Presentation(
  records: MarketDossierV2[],
): DossierPresentationSelection {
  if (records.length === 0) {
    return {
      status: "unavailable",
      presentation: null,
      latestDossierId: null,
      selectedDossierId: null,
      latestAsOf: null,
      selectedAsOf: null,
      usingFallback: false,
      calibrationHistory: [],
      notice: {
        tone: "error",
        label: "Dossier unavailable",
        detail: "No persisted Market Dossier V2 record is available.",
      },
    };
  }

  const dossiers = [...records].sort(byNewest);
  const latest = dossiers[0];
  const dossiersById = new Map(dossiers.map((dossier) => [dossier.id, dossier]));
  const built = dossiers
    .map((dossier) => buildCandidate(dossier, dossiersById))
    .filter((candidate): candidate is CandidatePresentation => Boolean(candidate));

  const latestCandidate = built.find((candidate) => candidate.dossier.id === latest.id) ?? null;
  const healthy = built.find((candidate) => presentationIsHealthy(candidate.presentation)) ?? null;
  const history = calibrationHistory(built);

  if (healthy?.dossier.id === latest.id) {
    return {
      status: "current",
      presentation: healthy.presentation,
      latestDossierId: latest.id,
      selectedDossierId: healthy.dossier.id,
      latestAsOf: latest.as_of,
      selectedAsOf: healthy.dossier.as_of,
      usingFallback: false,
      calibrationHistory: history,
      notice: {
        tone: "ready",
        label: "Current Dossier",
        detail: "Showing the latest healthy persisted Dossier V2.",
      },
    };
  }

  if (healthy) {
    const latestReason = latestCandidate
      ? "The latest Dossier is degraded."
      : "The latest Dossier payload could not be rendered safely.";
    return {
      status: "fallback_previous_healthy",
      presentation: healthy.presentation,
      latestDossierId: latest.id,
      selectedDossierId: healthy.dossier.id,
      latestAsOf: latest.as_of,
      selectedAsOf: healthy.dossier.as_of,
      usingFallback: true,
      calibrationHistory: history,
      notice: {
        tone: "warn",
        label: "Using prior healthy Dossier",
        detail: `${latestReason} Showing the most recent healthy persisted Dossier instead.`,
      },
    };
  }

  if (latestCandidate) {
    return {
      status: "degraded_latest",
      presentation: latestCandidate.presentation,
      latestDossierId: latest.id,
      selectedDossierId: latest.id,
      latestAsOf: latest.as_of,
      selectedAsOf: latest.as_of,
      usingFallback: false,
      calibrationHistory: history,
      notice: {
        tone: "warn",
        label: "Degraded Dossier",
        detail: "No prior healthy Dossier is available, so the latest degraded Dossier is shown with its gaps intact.",
      },
    };
  }

  return {
    status: "unavailable",
    presentation: null,
    latestDossierId: latest.id,
    selectedDossierId: null,
    latestAsOf: latest.as_of,
    selectedAsOf: null,
    usingFallback: false,
    calibrationHistory: history,
    notice: {
      tone: "error",
      label: "Dossier unavailable",
      detail: "Persisted Dossier records exist, but none can be rendered safely.",
    },
  };
}

export async function getDossierV2PresentationSelection(
  client?: SupabaseClient,
): Promise<DossierPresentationSelection> {
  const dbClient = client ?? createSupabaseAdminClient();

  const { data, error } = await dbClient
    .from("market_dossiers_v2")
    .select("id, contract_version, previous_dossier_id, as_of, freshness, research_gaps, payload, created_at")
    .order("as_of", { ascending: false })
    .limit(12);

  if (error) {
    throw new Error(`Failed to load Market Dossier V2 presentations: ${error.message}`);
  }

  const valid: MarketDossierV2[] = [];
  for (const row of data ?? []) {
    try {
      valid.push(validateMarketDossierV2Record(row));
    } catch {
      // Fail closed per record. A malformed latest row must not prevent a prior
      // healthy immutable Dossier from remaining available to Live/Hybrid.
    }
  }

  return selectDossierV2Presentation(valid);
}
