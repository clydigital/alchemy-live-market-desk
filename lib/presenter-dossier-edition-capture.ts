import "server-only";

import { getDossierV2PresentationSelection } from "@/lib/dossier-v2/presentation-reader";
import {
  buildPresenterDossierEditionContext,
  type PresenterDossierEditionContext,
} from "@/lib/presenter-dossier-edition-context";

/**
 * Freeze the exact Dossier presentation identity visible at the publication
 * boundary. Failure to read a Dossier does not block Story publication; the
 * edition records an explicit UNAVAILABLE context instead.
 */
export async function capturePresenterDossierEditionContext(
  capturedAt: string,
): Promise<PresenterDossierEditionContext> {
  const selection = await getDossierV2PresentationSelection().catch(() => null);
  return buildPresenterDossierEditionContext(selection, capturedAt);
}
