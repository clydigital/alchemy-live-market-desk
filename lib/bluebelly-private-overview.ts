/**
 * Minimum private Bluebelly reader contract for an eventual ChatGPT connector.
 *
 * This is a field-allowlisted identity/freshness projection, NOT canonical
 * evidence, a published Story, provider health, or a permission to query raw
 * Dossier payloads. A connector must use a separately audited auth scope.
 */
export const BLUEBELLY_PRIVATE_OVERVIEW_V1 = "bluebelly-private-overview/1" as const;

export type BluebellyOverviewSelection = {
  status: "current" | "fallback_previous_healthy" | "degraded_latest" | "historical_exact" | "unavailable";
  presentation: unknown | null;
  selectedDossierId: string | null;
  selectedAsOf: string | null;
  latestDossierId: string | null;
  latestAsOf: string | null;
  usingFallback: boolean;
};

export type BluebellyPrivateOverviewV1 = {
  contractVersion: typeof BLUEBELLY_PRIVATE_OVERVIEW_V1;
  availability: "AVAILABLE" | "UNAVAILABLE";
  authority: "CANONICAL_DOSSIER_V2";
  selectionStatus: BluebellyOverviewSelection["status"];
  selectedDossierId: string | null;
  selectedAsOf: string | null;
  latestDossierId: string | null;
  latestAsOf: string | null;
  usingFallback: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function dossierId(input: string | null): string | null {
  return input && UUID.test(input) ? input : null;
}

function timestamp(input: string | null): string | null {
  return input && Number.isFinite(Date.parse(input)) ? input : null;
}

export function projectBluebellyPrivateOverview(
  selection: BluebellyOverviewSelection,
): BluebellyPrivateOverviewV1 {
  const selectedDossierId = dossierId(selection.selectedDossierId);
  const selectedAsOf = timestamp(selection.selectedAsOf);
  const available = selection.status !== "unavailable"
    && selection.presentation !== null
    && selectedDossierId !== null
    && selectedAsOf !== null;

  return {
    contractVersion: BLUEBELLY_PRIVATE_OVERVIEW_V1,
    availability: available ? "AVAILABLE" : "UNAVAILABLE",
    authority: "CANONICAL_DOSSIER_V2",
    selectionStatus: selection.status,
    selectedDossierId: available ? selectedDossierId : null,
    selectedAsOf: available ? selectedAsOf : null,
    latestDossierId: dossierId(selection.latestDossierId),
    latestAsOf: timestamp(selection.latestAsOf),
    usingFallback: available && selection.usingFallback,
  };
}
