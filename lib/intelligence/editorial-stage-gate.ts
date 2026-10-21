/**
 * Model-allocation contract for the existing single-composed-edition publisher.
 * A research run may persist one base and at most one composed snapshot.
 * Until a separately proven continuation artifact exists, don't consume two
 * model stages while creating the one composed edition.
 */
export type EditorialStageDecision = {
  permitted: boolean;
  reason: "AVAILABLE" | "DOSSIER_MODEL_ALREADY_USED" | "INVOCATION_MODEL_ALREADY_USED";
};

export function decideEditorialStage(input: {
  dossierModelWasUsed: boolean;
  oneModelStage: boolean;
  invokedModelStage: string | null;
}): EditorialStageDecision {
  if (input.dossierModelWasUsed) return { permitted: false, reason: "DOSSIER_MODEL_ALREADY_USED" };
  if (input.oneModelStage && input.invokedModelStage && input.invokedModelStage !== "market_editorial_composer") {
    return { permitted: false, reason: "INVOCATION_MODEL_ALREADY_USED" };
  }
  return { permitted: true, reason: "AVAILABLE" };
}
