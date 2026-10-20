/**
 * Presentation-only navigation over sections backed by the exact frozen
 * publication. Never offer a tab whose underlying content is unavailable.
 * This helper has no DB calls, no market inferences, and no Story mutations.
 */
export type BlueDeskStorySection = {
  id: "story-overview" | "story-observations" | "story-mechanisms" | "story-analysis"
    | "story-reaction-gap" | "story-watch" | "story-evidence";
  label: string;
};

export type BlueDeskStorySectionAvailability = {
  originalObservations: number;
  causalLinks: number;
  narrativeBlocks: number;
  missingVerifiedReaction: boolean;
  watchAvailable: boolean;
};

export function blueDeskStorySections(
  available: BlueDeskStorySectionAvailability,
): BlueDeskStorySection[] {
  const sections: BlueDeskStorySection[] = [{ id: "story-overview", label: "Overview" }];
  if (available.originalObservations > 0) {
    sections.push({ id: "story-observations", label: "Original reports" });
  }
  if (available.causalLinks > 0) {
    sections.push({ id: "story-mechanisms", label: "Mechanisms" });
  }
  if (available.narrativeBlocks > 0) {
    sections.push({ id: "story-analysis", label: "Analysis" });
  }
  if (available.missingVerifiedReaction) {
    sections.push({ id: "story-reaction-gap", label: "Market reaction" });
  }
  if (available.watchAvailable) {
    sections.push({ id: "story-watch", label: "What to watch" });
  }
  // Evidence panel is always present: even empty editions explain their limits.
  sections.push({ id: "story-evidence", label: "Evidence" });
  return sections;
}
