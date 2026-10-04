import "server-only";

import {
  getDossierV2PresentationSelectionById,
  type DossierPresentationSelection,
} from "@/lib/dossier-v2/presentation-reader";
import {
  presenterDossierEditionContextFromPayload,
  type PresenterDossierEditionContext,
} from "@/lib/presenter-dossier-edition-context";

export type PresenterHistoricalDossierReplay = {
  status:
    | "BOUND"
    | "NO_FROZEN_CONTEXT"
    | "UNAVAILABLE"
    | "IDENTITY_MISMATCH";
  context: PresenterDossierEditionContext | null;
  selection: DossierPresentationSelection | null;
};

export async function loadPresenterHistoricalDossierReplay(
  payload: Record<string, unknown> | null | undefined,
): Promise<PresenterHistoricalDossierReplay> {
  const context = presenterDossierEditionContextFromPayload(payload);
  if (!context) {
    return {
      status: "NO_FROZEN_CONTEXT",
      context: null,
      selection: null,
    };
  }

  const selection = await getDossierV2PresentationSelectionById(context.dossierId!);
  if (
    selection.status !== "historical_exact"
    || !selection.presentation
    || selection.selectedDossierId !== context.dossierId
  ) {
    return {
      status: "UNAVAILABLE",
      context,
      selection: null,
    };
  }

  if (selection.selectedAsOf !== context.dossierAsOf) {
    return {
      status: "IDENTITY_MISMATCH",
      context,
      selection: null,
    };
  }

  return {
    status: "BOUND",
    context,
    selection,
  };
}
