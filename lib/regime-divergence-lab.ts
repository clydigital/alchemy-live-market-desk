import {
  buildDivergenceLabPresentation,
  type DivergenceLabPresentation,
} from "./divergence-lab-presentation.ts";
import type { RoutedDossierInvestigation } from "./regime-investigations.ts";

export const REGIME_DIVERGENCE_LAB_ROUTE_VERSION =
  "regime-divergence-lab-route/1" as const;

export type RegimeDivergenceLabRouteBasis =
  | "PERSISTENT_STORY_ID"
  | "ANALYTICAL_STORY_ROUTE";

export type RegimeDivergenceLabCase = {
  contractVersion: typeof REGIME_DIVERGENCE_LAB_ROUTE_VERSION;
  regime: string;
  subgroup: string;
  investigation: RoutedDossierInvestigation;
  lab: DivergenceLabPresentation;
  routeBasis: RegimeDivergenceLabRouteBasis;
  routeStoryIds: string[];
  presentationAuthority: "CONTEXT_ONLY";
};

export function buildRegimeDivergenceLabCases(input: {
  regime: string;
  subgroup: string;
  persistentStoryIds: Iterable<string>;
  investigations: RoutedDossierInvestigation[];
}): RegimeDivergenceLabCase[] {
  const persistentStoryIds = new Set(input.persistentStoryIds);

  return input.investigations.flatMap((investigation) => {
    const persistentMatches = investigation.storyIds
      .filter((storyId) => persistentStoryIds.has(storyId))
      .sort();

    if (persistentMatches.length) {
      return [{
        contractVersion: REGIME_DIVERGENCE_LAB_ROUTE_VERSION,
        regime: input.regime,
        subgroup: input.subgroup,
        investigation,
        lab: buildDivergenceLabPresentation(investigation),
        routeBasis: "PERSISTENT_STORY_ID" as const,
        routeStoryIds: persistentMatches,
        presentationAuthority: "CONTEXT_ONLY" as const,
      }];
    }

    const routed = investigation.regimeRoutes.some((route) =>
      route.regime === input.regime && route.subgroup === input.subgroup
    );
    if (!routed || investigation.regimeRoutingStoryIds.length === 0) return [];

    return [{
      contractVersion: REGIME_DIVERGENCE_LAB_ROUTE_VERSION,
      regime: input.regime,
      subgroup: input.subgroup,
      investigation,
      lab: buildDivergenceLabPresentation(investigation),
      routeBasis: "ANALYTICAL_STORY_ROUTE" as const,
      routeStoryIds: [...investigation.regimeRoutingStoryIds],
      presentationAuthority: "CONTEXT_ONLY" as const,
    }];
  });
}
