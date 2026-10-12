/**
 * The shared edition selector deliberately preserves a current-edition fallback
 * for legacy API consumers. The Hybrid page must NOT render that fallback when
 * a reader explicitly requests a missing or invalid immutable edition.
 *
 * Historical Hybrid pages also require the exact frozen Dossier; presenting
 * current analysis under a historical URL is not an acceptable fallback.
 */
export type HybridEditionRequestState =
  | "CURRENT"
  | "INVALID_REQUEST"
  | "HISTORICAL_READY"
  | "HISTORICAL_DOSSIER_UNAVAILABLE";

export function assessHybridEditionRequest(input: {
  requestedParam: string | string[] | undefined;
  selectedEditionId: string | null;
  currentEditionId: string | null;
  selectorFellBack: boolean;
  exactHistoricalDossierBound: boolean;
}): HybridEditionRequestState {
  if (input.requestedParam === undefined) return "CURRENT";
  if (
    typeof input.requestedParam !== "string"
    || !input.requestedParam.trim()
    || input.selectorFellBack
    || input.selectedEditionId !== input.requestedParam
  ) {
    return "INVALID_REQUEST";
  }

  if (input.selectedEditionId === input.currentEditionId) return "CURRENT";
  return input.exactHistoricalDossierBound
    ? "HISTORICAL_READY"
    : "HISTORICAL_DOSSIER_UNAVAILABLE";
}
