import type { DossierPresentationInvestigation } from "./dossier-v2/presentation-adapter.ts";
import { routeTextToRegimes, type RegimeRoute } from "./regimes.ts";

export type RoutedDossierInvestigation = DossierPresentationInvestigation & {
  regimeRoutes: RegimeRoute[];
};

function investigationText(item: DossierPresentationInvestigation) {
  return [
    item.question,
    item.whyItMatters,
    item.currentExplanation,
    item.expectedReaction,
    item.observedReaction,
    item.researchNext,
    item.confirmationCondition,
    item.invalidationCondition,
    ...item.competingExplanations,
    ...item.missingEvidence,
    ...item.storyIds,
    ...item.thesisIds,
  ]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .join(" ");
}

export function routeDossierInvestigationToRegimes(
  item: DossierPresentationInvestigation,
  limit = 4,
): RegimeRoute[] {
  return routeTextToRegimes(investigationText(item), limit);
}

export function routeDossierInvestigations(
  items: DossierPresentationInvestigation[],
): RoutedDossierInvestigation[] {
  return items.map((item) => ({
    ...item,
    regimeRoutes: routeDossierInvestigationToRegimes(item),
  }));
}
