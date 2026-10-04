export const PRESENTER_HISTORICAL_CONTEXT_BOUNDARY_VERSION =
  "presenter-historical-context-boundary/1" as const;

export type PresenterHistoricalContextBoundary = {
  contractVersion: typeof PRESENTER_HISTORICAL_CONTEXT_BOUNDARY_VERSION;
  scope: "CURRENT_CASE" | "HISTORICAL_STORY_REASONING_ONLY" | "HISTORICAL_FULL_CASE";
  editionSelectionStatus: "current" | "historical" | "invalid_fallback_current";
  selectedEditionId: string | null;
  currentEditionId: string | null;
  historicalStoryReasoning: boolean;
  historicalDossierReplayAvailable: boolean;
  dossierSource: "CURRENT_DOSSIER" | "FROZEN_EDITION_DOSSIER";
  dossierId: string | null;
  dossierAsOf: string | null;
  reason: string;
};

/**
 * Presenter can replay the exact immutable Story reasoning from an older
 * Journey edition, but a Journey edition does not currently persist the exact
 * Market Dossier V2 ID that supplied the investigation.
 *
 * Therefore historical expectation/tape/divergence must not be inferred by
 * timestamp, nearest Dossier, latest Dossier, Story linkage, or prose matching.
 */
export function buildPresenterHistoricalContextBoundary(input: {
  editionSelectionStatus: "current" | "historical" | "invalid_fallback_current";
  selectedEditionId: string | null;
  currentEditionId: string | null;
  dossierId: string | null;
  dossierAsOf: string | null;
  exactHistoricalDossier?: { dossierId: string; dossierAsOf: string } | null;
}): PresenterHistoricalContextBoundary {
  const historicalStoryReasoning =
    input.editionSelectionStatus === "historical"
    && Boolean(input.selectedEditionId)
    && input.selectedEditionId !== input.currentEditionId;
  const historicalDossierReplayAvailable =
    historicalStoryReasoning
    && Boolean(input.exactHistoricalDossier?.dossierId)
    && Boolean(input.exactHistoricalDossier?.dossierAsOf);

  if (historicalDossierReplayAvailable && input.exactHistoricalDossier) {
    return {
      contractVersion: PRESENTER_HISTORICAL_CONTEXT_BOUNDARY_VERSION,
      scope: "HISTORICAL_FULL_CASE",
      editionSelectionStatus: input.editionSelectionStatus,
      selectedEditionId: input.selectedEditionId,
      currentEditionId: input.currentEditionId,
      historicalStoryReasoning: true,
      historicalDossierReplayAvailable: true,
      dossierSource: "FROZEN_EDITION_DOSSIER",
      dossierId: input.exactHistoricalDossier.dossierId,
      dossierAsOf: input.exactHistoricalDossier.dossierAsOf,
      reason: "Presenter is replaying both the exact Story reasoning and the exact immutable Market Dossier V2 identity frozen into the selected Journey edition.",
    };
  }

  return {
    contractVersion: PRESENTER_HISTORICAL_CONTEXT_BOUNDARY_VERSION,
    scope: historicalStoryReasoning
      ? "HISTORICAL_STORY_REASONING_ONLY"
      : "CURRENT_CASE",
    editionSelectionStatus: input.editionSelectionStatus,
    selectedEditionId: input.selectedEditionId,
    currentEditionId: input.currentEditionId,
    historicalStoryReasoning,
    historicalDossierReplayAvailable: false,
    dossierSource: "CURRENT_DOSSIER",
    dossierId: input.dossierId,
    dossierAsOf: input.dossierAsOf,
    reason: historicalStoryReasoning
      ? "The selected Journey edition has exact historical Story reasoning, but no valid publication-frozen Dossier identity could be replayed. Expectation, tape, divergence, and missing-evidence context therefore remain current-Dossier context."
      : input.editionSelectionStatus === "invalid_fallback_current"
        ? "The requested Journey edition was unavailable, so Presenter uses the current immutable Story reasoning with the current Dossier investigation."
        : "Presenter uses the current immutable Story reasoning with the current Dossier investigation.",
  };
}
