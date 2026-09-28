import type {
  DossierPresentationInvestigation,
  DossierPresentationStory,
} from "./dossier-v2/presentation-adapter.ts";
import { routeTextToRegimes } from "./regimes.ts";

export type DossierInvestigationRouteMap = Record<string, string[]>;

type InvestigationRoutingInput = {
  stories: DossierPresentationStory[];
  investigations: DossierPresentationInvestigation[];
};

function routeKey(regime: string, subgroup: string) {
  return `${regime}:${subgroup}`;
}

function storyRoutingText(story: DossierPresentationStory) {
  return [
    story.title,
    story.whatChanged,
    story.whyItMatters,
    story.mechanism,
    story.conclusion,
  ].filter(Boolean).join(" ");
}

/**
 * Dossier Story IDs are analytical identities and are not guaranteed to be
 * persistent Story UUIDs. Resolve an Investigation's Regime placement through
 * the Dossier Story it explicitly links to, then reuse the same deterministic
 * Regime text router used elsewhere in Live.
 *
 * No investigation-text fallback is allowed: an unlinked or missing Dossier
 * Story fails closed instead of being routed by a plausible-sounding question.
 */
export function buildDossierInvestigationRouteMap(
  input: InvestigationRoutingInput,
): DossierInvestigationRouteMap {
  const storyById = new Map(input.stories.map((story) => [story.id, story]));

  return Object.fromEntries(input.investigations.map((investigation) => {
    const keys = new Set<string>();

    for (const storyId of investigation.storyIds) {
      const story = storyById.get(storyId);
      if (!story) continue;
      for (const route of routeTextToRegimes(storyRoutingText(story), 3)) {
        keys.add(routeKey(route.regime, route.subgroup));
      }
    }

    return [investigation.id, [...keys].sort()];
  }));
}
