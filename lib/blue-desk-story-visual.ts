/**
 * Blue Desk V7 decorative Story art descriptor.
 *
 * Not a chart, forecast, live market view, source, or canonical evidence.
 * All inputs are exact immutable Story/edition identities, and the output
 * is a fixed allowlisted visual vocabulary. No untrusted SVG markup.
 */
export const STORY_VISUAL_VERSION = "abyssal-story/1" as const;

export type StoryVisualKind = "rates" | "energy" | "equities" | "cross-asset";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fingerprint(value: string) {
  // FNV-1a, unsigned 32-bit: deterministic across server builds and clients.
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function storyVisualKind(category: string): StoryVisualKind {
  const label = category.trim().toLocaleLowerCase("en-GB");
  if (label === "rates & policy" || label === "rates" || label === "bonds") return "rates";
  if (label === "energy & commodities" || label === "energy" || label === "oil") return "energy";
  if (label === "equities & earnings" || label === "equities" || label === "stocks") return "equities";
  return "cross-asset";
}

const LABELS: Record<StoryVisualKind, string> = {
  rates: "Rates & policy",
  energy: "Energy & commodities",
  equities: "Equities & earnings",
  "cross-asset": "Cross-asset markets",
};

export function storyVisualDescriptor(input: {
  editionId: string;
  storyId: string;
  category: string;
  visualVersion?: string;
}) {
  if (!UUID.test(input.editionId) || !UUID.test(input.storyId)) return null;
  const visualVersion = input.visualVersion ?? STORY_VISUAL_VERSION;
  // Version must be a bounded identifier, not model-produced SVG, CSS or HTML.
  if (!/^abyssal-story\/[1-9][0-9]?$/.test(visualVersion)) return null;
  const kind = storyVisualKind(input.category);
  const fingerprintInput = [
    input.storyId.toLowerCase(),
    input.editionId.toLowerCase(),
    visualVersion,
    kind,
  ].join(":");
  const seed = fingerprint(fingerprintInput);
  return {
    visualVersion,
    kind,
    label: LABELS[kind],
    id: "story-art-" + seed.toString(36),
    // Bounded aesthetic offsets only; never claim these represent observations.
    orbX: 725 + (seed % 9) * 7,
    orbY: 145 + ((seed >>> 8) % 7) * 5,
    orbitTilt: -21 + ((seed >>> 16) % 11) * 3,
    accents: Array.from({ length: 7 }, (_, index) => ({
      x: 410 + ((seed >>> (index % 4) * 6) % 470),
      y: 30 + ((seed >>> ((index + 1) % 4) * 7) % 235),
      r: index % 3 === 0 ? 2.3 : 1.2,
    })),
  } as const;
}
