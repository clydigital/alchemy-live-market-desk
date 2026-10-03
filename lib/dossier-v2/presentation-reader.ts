import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "../supabase/admin.ts";
import type { MarketDossierV2 } from "./contracts.ts";
import {
  buildDossierV2Presentation,
  type DossierPresentationInvestigation,
  type DossierPresentationV1,
} from "./presentation-adapter.ts";
import { getMarketDossierV2ById } from "./persistence.ts";
import { validateMarketDossierV2Record } from "./validation.ts";

export type DossierPresentationSelectionStatus =
  | "current"
  | "fallback_previous_healthy"
  | "degraded_latest"
  | "historical_exact"
  | "unavailable";

export type DossierCalibrationHistoryCase = {
  dossierId: string;
  previousDossierId: string | null;
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
  previousInvestigationId: string | null;
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

export type DossierCalibrationLearningState =
  | "REACTION_RULE_SUPPORTED"
  | "DIVERGENCE_REVIEW"
  | "MIXED_REACTION_REVIEW"
  | "TRANSMISSION_UNRESOLVED"
  | "CLOSED_WITHOUT_MECHANISM_VERDICT";

export type DossierCalibrationReactionRead =
  | "FOLLOWED_EXPECTATION"
  | "DID_NOT_FOLLOW_EXPECTATION"
  | "MIXED_REACTION"
  | "NOT_MEASURED";

export type DossierCalibrationCaseLineage = {
  lineageId: string;
  caseVintages: number;
  evaluatedVintages: number;
  rewriteOnlyVintages: number;
  measuredVintages: number;
  firstAsOf: string;
  latestAsOf: string;
  latestQuestion: string;
  hasDivergence: boolean;
  hasMixed: boolean;
  expectationRewriteCount: number;
  latestPostMortemHypothesis: string;
  latestResearchNext: string;
  learningState: DossierCalibrationLearningState;
  reactionRead: DossierCalibrationReactionRead;
  mechanismRead: string;
  transmissionRead: string;
  learningSummary: string;
  cases: DossierCalibrationHistoryCase[];
};

export type DossierHistoryItem = {
  id: string;
  previousDossierId: string | null;
  asOf: string;
  createdAt: string;
  headline: string;
  epistemicLabel: string;
  health: "healthy" | "degraded";
  investigationCount: number;
  divergentInvestigationCount: number;
};

export type DossierHistoryIndex = {
  contractVersion: "dossier-history/1";
  items: DossierHistoryItem[];
  omittedInvalidCount: number;
};

export type DossierPresentationSelection = {
  status: DossierPresentationSelectionStatus;
  requestedDossierId?: string | null;
  presentation: DossierPresentationV1 | null;
  latestDossierId: string | null;
  selectedDossierId: string | null;
  latestAsOf: string | null;
  selectedAsOf: string | null;
  usingFallback: boolean;
  lastValidDossierId?: string | null;
  lastValidAsOf?: string | null;
  calibrationHistory: DossierCalibrationHistoryEntry[];
  calibrationLineages: DossierCalibrationCaseLineage[];
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

function structuralPredecessor(
  dossier: MarketDossierV2,
  dossiersById: Map<string, MarketDossierV2>,
) {
  return dossier.previous_dossier_id
    ? dossiersById.get(dossier.previous_dossier_id) ?? null
    : null;
}

function analyticalBaselineId(dossier: MarketDossierV2): string | null {
  const raw = dossier.payload.memory_control;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const value = (raw as { analytical_baseline_id?: unknown }).analytical_baseline_id;
    if (value === null) return null;
    if (typeof value === "string" && value.trim()) return value;
  }
  return dossier.previous_dossier_id;
}

function buildCandidate(
  dossier: MarketDossierV2,
  dossiersById: Map<string, MarketDossierV2>,
): CandidatePresentation | null {
  const structural = structuralPredecessor(dossier, dossiersById);
  const baselineId = analyticalBaselineId(dossier);
  const analyticalBaseline = baselineId
    ? dossiersById.get(baselineId) ?? null
    : null;

  try {
    return {
      dossier,
      presentation: buildDossierV2Presentation(
        dossier,
        analyticalBaseline,
        structural,
      ),
    };
  } catch {
    try {
      return {
        dossier,
        presentation: buildDossierV2Presentation(
          dossier,
          null,
          structural,
        ),
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
        previousDossierId: dossier.previous_dossier_id,
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
        previousInvestigationId: item.journey.previousId,
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

function learningFromCases(
  ordered: DossierCalibrationHistoryCase[],
) {
  const latest = ordered.at(-1)!;
  const evaluated = ordered.filter((item) => item.checkCount > 0);
  const rewriteOnlyVintages = ordered.filter(
    (item) => item.checkCount === 0 && item.expectationChanged === true,
  ).length;
  const allEvaluatedAligned =
    evaluated.length >= 2 && evaluated.every((item) => item.outcome === "ALIGNED");

  const reactionRead: DossierCalibrationReactionRead =
    latest.outcome === "DIVERGENT"
      ? "DID_NOT_FOLLOW_EXPECTATION"
      : latest.outcome === "MIXED"
        ? "MIXED_REACTION"
        : latest.outcome === "ALIGNED"
          ? "FOLLOWED_EXPECTATION"
          : "NOT_MEASURED";

  const closed = latest.status === "resolved" || latest.status === "parked";
  const learningState: DossierCalibrationLearningState =
    closed
      ? "CLOSED_WITHOUT_MECHANISM_VERDICT"
      : latest.outcome === "DIVERGENT"
        ? "DIVERGENCE_REVIEW"
        : latest.outcome === "MIXED"
          ? "MIXED_REACTION_REVIEW"
          : allEvaluatedAligned
            ? "REACTION_RULE_SUPPORTED"
            : "TRANSMISSION_UNRESOLVED";

  const mechanismRead =
    "Calibration alone cannot prove the mechanism was right or wrong; that requires canonical invalidation or discriminating evidence.";

  const transmissionRead =
    reactionRead === "DID_NOT_FOLLOW_EXPECTATION"
      ? "The expected transmission failed or was offset in this measured window; the cause remains a post-mortem hypothesis."
      : reactionRead === "MIXED_REACTION"
        ? "Transmission was mixed across exact checks; no single causal explanation is established."
        : reactionRead === "FOLLOWED_EXPECTATION"
          ? "The expected transmission appeared in the measured window, but that does not validate the full causal mechanism."
          : "No exact reaction audit exists for the latest case, so transmission remains unresolved.";

  let learningSummary: string;
  if (evaluated.length === 0) {
    learningSummary =
      `${ordered.length} case vintage(s), 0 exact reaction audits. `
      + (rewriteOnlyVintages
        ? `Expectation wording changed in ${rewriteOnlyVintages} vintage(s); treat this as hypothesis refinement, not forecast calibration.`
        : "This history is contextual, not calibrated.");
  } else if (latest.outcome === "DIVERGENT") {
    learningSummary =
      "The latest exact reaction did not follow the preserved expectation. Review the failed/offset transmission link; do not infer that the entire mechanism is invalid.";
  } else if (latest.outcome === "MIXED") {
    learningSummary =
      "Exact checks disagreed. The case remains a competing-mechanism problem rather than a clean success/failure verdict.";
  } else if (allEvaluatedAligned) {
    learningSummary =
      `The reaction expectation aligned across ${evaluated.length} exact measured vintage(s). This supports the reaction rule, not the whole causal mechanism.`;
  } else {
    learningSummary =
      "One exact reaction aligned with expectation. More independent measured vintages are needed before treating the reaction rule as repeatable.";
  }

  return {
    evaluatedVintages: evaluated.length,
    rewriteOnlyVintages,
    learningState,
    reactionRead,
    mechanismRead,
    transmissionRead,
    learningSummary,
  };
}

function calibrationLineages(
  built: CandidatePresentation[],
  history: DossierCalibrationHistoryEntry[],
): DossierCalibrationCaseLineage[] {
  const parent = new Map<string, string>();

  const nodeKey = (dossierId: string, investigationId: string) =>
    `${dossierId}:${investigationId}`;

  for (const { dossier, presentation } of built) {
    for (const item of presentation.investigationAudit) {
      const key = nodeKey(dossier.id, item.id);
      parent.set(key, key);
    }
  }

  const find = (key: string): string => {
    const current = parent.get(key);
    if (!current || current === key) return current ?? key;
    const root = find(current);
    parent.set(key, root);
    return root;
  };

  const union = (left: string, right: string) => {
    if (!parent.has(left) || !parent.has(right)) return;
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    const [root, child] = leftRoot.localeCompare(rightRoot) <= 0
      ? [leftRoot, rightRoot]
      : [rightRoot, leftRoot];
    parent.set(child, root);
  };

  for (const { dossier, presentation } of built) {
    const baselineId = presentation.memory.analyticalBaselineId;
    if (!baselineId) continue;
    for (const item of presentation.investigationAudit) {
      if (
        !item.journey.previousId
        || (item.journey.matchedBy !== "id" && item.journey.matchedBy !== "linkage")
      ) continue;

      union(
        nodeKey(dossier.id, item.id),
        nodeKey(baselineId, item.journey.previousId),
      );
    }
  }

  const measuredCases = history.flatMap((entry) => entry.cases);
  const groups = new Map<string, DossierCalibrationHistoryCase[]>();

  for (const item of measuredCases) {
    const key = nodeKey(item.dossierId, item.investigationId);
    const root = parent.has(key) ? find(key) : key;
    const group = groups.get(root) ?? [];
    group.push(item);
    groups.set(root, group);
  }

  return [...groups.values()]
    .filter((cases) => cases.length >= 2)
    .map((cases) => {
      const ordered = [...cases].sort(
        (left, right) =>
          Date.parse(left.asOf) - Date.parse(right.asOf)
          || left.dossierId.localeCompare(right.dossierId)
          || left.investigationId.localeCompare(right.investigationId),
      );
      const first = ordered[0];
      const latest = ordered.at(-1)!;
      const learning = learningFromCases(ordered);

      return {
        lineageId: nodeKey(first.dossierId, first.investigationId),
        caseVintages: ordered.length,
        evaluatedVintages: learning.evaluatedVintages,
        rewriteOnlyVintages: learning.rewriteOnlyVintages,
        measuredVintages: learning.evaluatedVintages,
        firstAsOf: first.asOf,
        latestAsOf: latest.asOf,
        latestQuestion: latest.question,
        hasDivergence: ordered.some((item) => item.outcome === "DIVERGENT"),
        hasMixed: ordered.some((item) => item.outcome === "MIXED"),
        expectationRewriteCount: ordered.filter((item) => item.expectationChanged === true).length,
        latestPostMortemHypothesis: latest.postMortemHypothesis,
        latestResearchNext: latest.researchNext,
        learningState: learning.learningState,
        reactionRead: learning.reactionRead,
        mechanismRead: learning.mechanismRead,
        transmissionRead: learning.transmissionRead,
        learningSummary: learning.learningSummary,
        cases: ordered,
      } satisfies DossierCalibrationCaseLineage;
    })
    .sort(
      (left, right) =>
        Date.parse(right.latestAsOf) - Date.parse(left.latestAsOf)
        || right.caseVintages - left.caseVintages
        || left.lineageId.localeCompare(right.lineageId),
    );
}

export function selectExactDossierV2Presentation(
  dossier: MarketDossierV2 | null,
  previousDossier: MarketDossierV2 | null = null,
  requestedDossierId: string | null = dossier?.id ?? null,
  analyticalBaselineDossier: MarketDossierV2 | null = null,
): DossierPresentationSelection {
  if (!dossier) {
    return {
      status: "unavailable",
      requestedDossierId,
      presentation: null,
      latestDossierId: null,
      selectedDossierId: null,
      latestAsOf: null,
      selectedAsOf: null,
      usingFallback: false,
      lastValidDossierId: null,
      lastValidAsOf: null,
      calibrationHistory: [],
      calibrationLineages: [],
      notice: {
        tone: "error",
        label: "Historical Dossier unavailable",
        detail: "The requested immutable Dossier V2 record does not exist or cannot be rendered safely.",
      },
    };
  }

  const dossiersById = new Map<string, MarketDossierV2>([[dossier.id, dossier]]);
  if (previousDossier) dossiersById.set(previousDossier.id, previousDossier);
  if (analyticalBaselineDossier) {
    dossiersById.set(analyticalBaselineDossier.id, analyticalBaselineDossier);
  }

  const exact = buildCandidate(dossier, dossiersById);
  if (!exact) {
    return {
      status: "unavailable",
      requestedDossierId: requestedDossierId ?? dossier.id,
      presentation: null,
      latestDossierId: null,
      selectedDossierId: null,
      latestAsOf: null,
      selectedAsOf: null,
      usingFallback: false,
      lastValidDossierId: null,
      lastValidAsOf: null,
      calibrationHistory: [],
      calibrationLineages: [],
      notice: {
        tone: "error",
        label: "Historical Dossier unavailable",
        detail: "The requested immutable Dossier exists, but its analytical payload cannot be rendered safely.",
      },
    };
  }

  const builtMap = new Map<string, CandidatePresentation>([[exact.dossier.id, exact]]);
  for (const related of [previousDossier, analyticalBaselineDossier]) {
    if (!related || builtMap.has(related.id)) continue;
    const candidate = buildCandidate(related, dossiersById);
    if (candidate) builtMap.set(candidate.dossier.id, candidate);
  }
  const built = [...builtMap.values()];
  const history = calibrationHistory(built);
  const lineages = calibrationLineages(built, history);
  const degraded = !presentationIsHealthy(exact.presentation);

  return {
    status: "historical_exact",
    requestedDossierId: requestedDossierId ?? dossier.id,
    presentation: exact.presentation,
    latestDossierId: null,
    selectedDossierId: dossier.id,
    latestAsOf: null,
    selectedAsOf: dossier.as_of,
    usingFallback: false,
    lastValidDossierId: dossier.id,
    lastValidAsOf: dossier.as_of,
    calibrationHistory: history,
    calibrationLineages: lineages,
    notice: {
      tone: degraded ? "warn" : "ready",
      label: degraded ? "Historical Dossier · degraded" : "Historical Dossier",
      detail: degraded
        ? "Showing the exact immutable historical Dossier, including the degradation recorded at that time. No newer Dossier has been substituted."
        : "Showing the exact immutable historical Dossier. No newer Dossier or current-market enrichment has been substituted.",
    },
  };
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
      lastValidDossierId: null,
      lastValidAsOf: null,
      calibrationHistory: [],
      calibrationLineages: [],
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
  const lastValid = built[0] ?? null;
  const history = calibrationHistory(built);
  const lineages = calibrationLineages(built, history);

  if (latestCandidate) {
    const healthy = presentationIsHealthy(latestCandidate.presentation);
    return {
      status: healthy ? "current" : "degraded_latest",
      presentation: latestCandidate.presentation,
      latestDossierId: latest.id,
      selectedDossierId: latest.id,
      latestAsOf: latest.as_of,
      selectedAsOf: latest.as_of,
      usingFallback: false,
      lastValidDossierId: latest.id,
      lastValidAsOf: latest.as_of,
      calibrationHistory: history,
      calibrationLineages: lineages,
      notice: {
        tone: healthy ? "ready" : "warn",
        label: healthy ? "Current Dossier" : "Current Dossier · degraded",
        detail: healthy
          ? "Showing the latest persisted Dossier V2."
          : "Showing the latest structurally valid Dossier with its degradation and research gaps visible. No older interpretation has been substituted.",
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
    lastValidDossierId: lastValid?.dossier.id ?? null,
    lastValidAsOf: lastValid?.dossier.as_of ?? null,
    calibrationHistory: history,
    calibrationLineages: lineages,
    notice: {
      tone: "error",
      label: "Current Dossier unavailable",
      detail: lastValid
        ? "The latest persisted Dossier cannot be rendered safely. The last valid Dossier remains available as historical reference and has not been substituted as current."
        : "Persisted Dossier records exist, but the latest record cannot be rendered safely and no valid historical reference is available.",
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


export async function getDossierV2PresentationSelectionById(
  id: string,
  client?: SupabaseClient,
): Promise<DossierPresentationSelection> {
  const dbClient = client ?? createSupabaseAdminClient();
  const dossier = await getMarketDossierV2ById(id, dbClient);
  if (!dossier) {
    return selectExactDossierV2Presentation(null, null, id);
  }

  let previous: MarketDossierV2 | null = null;
  if (dossier.previous_dossier_id) {
    try {
      previous = await getMarketDossierV2ById(dossier.previous_dossier_id, dbClient);
    } catch {
      previous = null;
    }
  }

  return selectExactDossierV2Presentation(dossier, previous, id);
}

export async function getDossierV2HistoryIndex(
  limit = 24,
  client?: SupabaseClient,
): Promise<DossierHistoryIndex> {
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit) || 24));
  const dbClient = client ?? createSupabaseAdminClient();

  const { data, error } = await dbClient
    .from("market_dossiers_v2")
    .select("id, contract_version, previous_dossier_id, as_of, freshness, research_gaps, payload, created_at")
    .order("as_of", { ascending: false })
    .limit(boundedLimit);

  if (error) {
    throw new Error(`Failed to load Market Dossier V2 history: ${error.message}`);
  }

  const items: DossierHistoryItem[] = [];
  let omittedInvalidCount = 0;

  for (const row of data ?? []) {
    try {
      const dossier = validateMarketDossierV2Record(row);
      const presentation = buildDossierV2Presentation(dossier);
      items.push({
        id: dossier.id,
        previousDossierId: dossier.previous_dossier_id,
        asOf: dossier.as_of,
        createdAt: dossier.created_at,
        headline: presentation.header.headline,
        epistemicLabel: presentation.header.epistemicLabel,
        health: presentationIsHealthy(presentation) ? "healthy" : "degraded",
        investigationCount: presentation.investigationAudit.length,
        divergentInvestigationCount: presentation.investigationAudit.filter(
          (item) => item.divergence === "MATERIAL" || item.divergence === "PARTIAL",
        ).length,
      });
    } catch {
      omittedInvalidCount += 1;
    }
  }

  return {
    contractVersion: "dossier-history/1",
    items,
    omittedInvalidCount,
  };
}
