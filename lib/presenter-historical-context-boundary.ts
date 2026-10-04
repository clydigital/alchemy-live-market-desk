export const PRESENTER_HISTORICAL_CONTEXT_BOUNDARY_VERSION =
  "presenter-historical-context-boundary/1" as const;

export type PresenterHistoricalContextBoundary = {
  contractVersion: typeof PRESENTER_HISTORICAL_CONTEXT_BOUNDARY_VERSION;
  scope: "CURRENT_CASE" | "HISTORICAL_STORY_REASONING_ONLY";
  editionSelectionStatus: "current" | "historical" | "invalid_fallback_current";
  selectedEditionId: string | null;
  currentEditionId: string | null;
  historicalStoryReasoning: boolean;
  historicalDossierReplayAvailable: false;
  dossierSource: "CURRENT_DOSSIER";
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
}): PresenterHistoricalContextBoundary {
  const historicalStoryReasoning =
    input.editionSelectionStatus === "historical"
    && Boolean(input.selectedEditionId)
    && input.selectedEditionId !== input.currentEditionId;

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
      ? "The selected Journey edition freezes exact historical Story reasoning, but it does not freeze the exact Market Dossier V2 ID for the investigation. Expectation, tape, divergence, and missing-evidence context therefore remain current-Dossier context."
      : input.editionSelectionStatus === "invalid_fallback_current"
        ? "The requested Journey edition was unavailable, so Presenter uses the current immutable Story reasoning with the current Dossier investigation."
        : "Presenter uses the current immutable Story reasoning with the current Dossier investigation.",
  };
}
