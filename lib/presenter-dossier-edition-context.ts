import { isValidUuid } from "./dossier-v2/validation.ts";

import type {
  DossierPresentationSelection,
  DossierPresentationSelectionStatus,
} from "./dossier-v2/presentation-reader.ts";

export const PRESENTER_DOSSIER_EDITION_CONTEXT_VERSION =
  "presenter-dossier-edition-context/1" as const;

export type PresenterDossierEditionContext = {
  contractVersion: typeof PRESENTER_DOSSIER_EDITION_CONTEXT_VERSION;
  status: "BOUND" | "UNAVAILABLE";
  dossierId: string | null;
  dossierAsOf: string | null;
  latestDossierId: string | null;
  latestAsOf: string | null;
  selectionStatus: DossierPresentationSelectionStatus | "unavailable";
  usingFallback: boolean;
  capturedAt: string;
};

export function buildPresenterDossierEditionContext(
  selection: DossierPresentationSelection | null,
  capturedAt: string,
): PresenterDossierEditionContext {
  const dossierId = selection?.selectedDossierId?.trim() || null;
  const dossierAsOf = selection?.selectedAsOf?.trim() || null;

  return {
    contractVersion: PRESENTER_DOSSIER_EDITION_CONTEXT_VERSION,
    status: dossierId && dossierAsOf ? "BOUND" : "UNAVAILABLE",
    dossierId,
    dossierAsOf,
    latestDossierId: selection?.latestDossierId?.trim() || null,
    latestAsOf: selection?.latestAsOf?.trim() || null,
    selectionStatus: selection?.status ?? "unavailable",
    usingFallback: selection?.usingFallback === true,
    capturedAt,
  };
}


function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function validIso(value: unknown): value is string {
  return typeof value === "string"
    && value.trim().length > 0
    && Number.isFinite(Date.parse(value));
}

/**
 * Recover an exact publication-frozen Dossier identity from a Journey edition.
 * Older editions and malformed contexts fail closed to null.
 */
export function presenterDossierEditionContextFromPayload(
  payload: Record<string, unknown> | null | undefined,
): PresenterDossierEditionContext | null {
  const raw = record(payload?.presenterDossierContext);
  if (!raw) return null;
  if (raw.contractVersion !== PRESENTER_DOSSIER_EDITION_CONTEXT_VERSION) return null;
  if (raw.status !== "BOUND") return null;
  if (!isValidUuid(raw.dossierId)) return null;
  if (!validIso(raw.dossierAsOf)) return null;
  if (!validIso(raw.capturedAt)) return null;

  const latestDossierId = raw.latestDossierId === null
    ? null
    : isValidUuid(raw.latestDossierId)
      ? raw.latestDossierId
      : null;
  if (raw.latestDossierId !== null && latestDossierId === null) return null;

  const latestAsOf = raw.latestAsOf === null
    ? null
    : validIso(raw.latestAsOf)
      ? raw.latestAsOf
      : null;
  if (raw.latestAsOf !== null && latestAsOf === null) return null;

  const validSelectionStatuses = new Set([
    "current",
    "fallback_previous_healthy",
    "degraded_latest",
    "historical_exact",
    "unavailable",
  ]);
  if (typeof raw.selectionStatus !== "string" || !validSelectionStatuses.has(raw.selectionStatus)) {
    return null;
  }
  if (typeof raw.usingFallback !== "boolean") return null;

  return {
    contractVersion: PRESENTER_DOSSIER_EDITION_CONTEXT_VERSION,
    status: "BOUND",
    dossierId: raw.dossierId,
    dossierAsOf: raw.dossierAsOf,
    latestDossierId,
    latestAsOf,
    selectionStatus: raw.selectionStatus as DossierPresentationSelectionStatus,
    usingFallback: raw.usingFallback,
    capturedAt: raw.capturedAt,
  };
}

export function presenterDossierEditionSourceRef(
  context: PresenterDossierEditionContext,
): Record<string, unknown> | null {
  if (context.status !== "BOUND" || !context.dossierId) return null;
  return {
    type: "market_dossier_v2",
    id: context.dossierId,
    asOf: context.dossierAsOf,
    selectionStatus: context.selectionStatus,
    usingFallback: context.usingFallback,
  };
}
