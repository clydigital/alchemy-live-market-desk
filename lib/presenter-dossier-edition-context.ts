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
