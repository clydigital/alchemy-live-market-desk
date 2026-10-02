import type {
  DossierPresentationInvestigation,
  DossierPresentationStory,
} from "./dossier-v2/presentation-adapter.ts";
import { routeTextToRegimes, type RegimeRoute } from "./regimes.ts";

export type RoutedDossierInvestigation = DossierPresentationInvestigation & {
  regimeRoutes: RegimeRoute[];
};

function storyRoutingText(story: DossierPresentationStory) {
  return [
    story.title,
    story.whatChanged,
    story.whyItMatters,
    story.mechanism,
    story.conclusion,
  ]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .join(" ");
}

function routeThroughLinkedStories(
  item: DossierPresentationInvestigation,
  storyById: Map<string, DossierPresentationStory>,
  limit: number,
): RegimeRoute[] {
  const routesByKey = new Map<string, RegimeRoute>();

  for (const storyId of item.storyIds) {
    const story = storyById.get(storyId);
    if (!story) continue;

    for (const route of routeTextToRegimes(storyRoutingText(story), limit)) {
      const key = `${route.regime}:${route.subgroup}`;
      const existing = routesByKey.get(key);
      if (!existing || route.score > existing.score) {
        routesByKey.set(key, route);
      }
    }
  }

  return [...routesByKey.values()]
    .sort((a, b) =>
      b.score - a.score
      || a.regime.localeCompare(b.regime)
      || a.subgroup.localeCompare(b.subgroup)
    )
    .slice(0, limit);
}

/**
 * Investigations are analytical children of Dossier Stories. Route them through
 * only the Stories they explicitly link to so plausible investigation prose
 * cannot manufacture a Regime placement after the fact.
 *
 * Missing or orphaned Story identities fail closed.
 */
export function routeDossierInvestigationToRegimes(
  item: DossierPresentationInvestigation,
  stories: DossierPresentationStory[],
  limit = 4,
): RegimeRoute[] {
  return routeThroughLinkedStories(
    item,
    new Map(stories.map((story) => [story.id, story])),
    limit,
  );
}

export function routeDossierInvestigations(
  items: DossierPresentationInvestigation[],
  stories: DossierPresentationStory[],
): RoutedDossierInvestigation[] {
  const storyById = new Map(stories.map((story) => [story.id, story]));

  return items.map((item) => ({
    ...item,
    regimeRoutes: routeThroughLinkedStories(item, storyById, 4),
  }));
}
