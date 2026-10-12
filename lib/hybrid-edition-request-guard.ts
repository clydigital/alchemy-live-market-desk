import { buildCanonicalEditionIndex, selectCanonicalEdition, type EditionSnapshot } from "./edition-replay.ts";
import { buildPresenterPrepEditionIndex } from "./presenter-prep-edition-index.ts";

type ResearchRun = NonNullable<Parameters<typeof buildCanonicalEditionIndex>[1]>[number];

/**
 * Keep legacy current/default Journey selection unchanged. For an explicitly
 * requested edition omitted by the terminal index, consult the existing
 * Presenter Prep archive index, which distinguishes cross-slot publications
 * from same-slot retries without modifying frozen snapshot rows.
 *
 * Unknown IDs remain invalid; the page independently requires a bound exact
 * frozen Dossier before rendering historical analysis.
 */
export function selectHybridEditionForRequest(
  snapshots: EditionSnapshot[],
  researchRuns: ResearchRun[],
  requestedEditionId: string | null,
) {
  const canonical = selectCanonicalEdition(
    buildCanonicalEditionIndex(snapshots, researchRuns),
    requestedEditionId,
  );
  if (!requestedEditionId || canonical.status !== "invalid_fallback_current") return canonical;

  const archived = selectCanonicalEdition(
    buildPresenterPrepEditionIndex(snapshots, researchRuns),
    requestedEditionId,
  );
  return archived.status === "historical" ? archived : canonical;
}

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
