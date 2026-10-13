/**
 * Read-only geographic presentation labels for News/Motion/Story events.
 * These labels never participate in canonical research, Story or Regime routing.
 * Prefer explicit source annotations; infer only from a clear geographic
 * reference in the *event headline*, not from an inherited Story thesis,
 * source publisher, company domicile or a model-written market explanation.
 */
export const MARKET_REGIONS = ["Asia", "Europe", "US", "Other"] as const;
export type MarketRegion = (typeof MARKET_REGIONS)[number];
export type MarketRegionFilter = "All" | MarketRegion;

/** Normalise user-facing URL filters; never allow unknown URLs to hide data. */
export function marketRegionFromQuery(value: string | null): MarketRegionFilter {
  if (!value) return "All";
  return MARKET_REGIONS.find((region) => region.toLowerCase() === value.trim().toLowerCase()) ?? "All";
}

export type MarketRegionAssignment = {
  primaryRegion: MarketRegion;
  affectedRegions: MarketRegion[];
};

const REGIONAL_HEADLINE_PATTERNS: Array<[MarketRegion, RegExp]> = [
  ["Asia", /\b(?:asia|asian|china|chinese|beijing|hong kong|japan|japanese|tokyo|korea|korean|seoul|taiwan|taiwanese|india|indian|singapore|shanghai|nikkei|kospi|jgb|boj|pboc)\b/i],
  ["Europe", /\b(?:europe|european|eurozone|euro-area|brussels|germany|german|france|french|italy|italian|spain|spanish|britain|british|united kingdom|london|ecb|boe|bundesbank|stoxx)\b/i],
  ["US", /\b(?:united states|american|america|washington|federal reserve|the fed|fed policy|fomc|treasury yields?|u\.s\.|nasdaq|wall street|s&p 500|us10y|us02y|us30y)\b/i],
];

function asRegion(value: unknown): MarketRegion | null {
  if (typeof value !== "string") return null;
  return MARKET_REGIONS.find((region) => region.toLowerCase() === value.trim().toLowerCase()) ?? null;
}

function sourceAffected(value: unknown): MarketRegion[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(asRegion).filter((region): region is MarketRegion => region !== null))];
}

export function resolveMarketRegions(input: {
  headline: string;
  primaryRegion?: unknown;
  affectedRegions?: unknown;
}): MarketRegionAssignment {
  const explicitPrimary = asRegion(input.primaryRegion);
  const explicitAffected = sourceAffected(input.affectedRegions);

  if (explicitPrimary || explicitAffected.length) {
    const primaryRegion = explicitPrimary ?? (explicitAffected.length === 1 ? explicitAffected[0] : "Other");
    return {
      primaryRegion,
      affectedRegions: [...new Set([primaryRegion, ...explicitAffected])],
    };
  }

  // Avoid inferring regional authority from long interpretations or worldwide
  // Story narratives. Multiple regions are deliberately marked cross-regional.
  const mentioned = REGIONAL_HEADLINE_PATTERNS
    .filter(([region, pattern]) => pattern.test(input.headline)
      || (region === "US" && (/\bUS\b/.test(input.headline) || /\bFed\b/.test(input.headline) || /\bU\.S\.(?=\W|$)/i.test(input.headline)))
      || (region === "Europe" && /\b(?:EU|UK)\b/.test(input.headline)))
    .map(([region]) => region);
  return {
    primaryRegion: mentioned.length === 1 ? mentioned[0] : "Other",
    affectedRegions: mentioned.length ? mentioned : ["Other"],
  };
}

export function combineMarketRegions(assignments: MarketRegionAssignment[]): MarketRegionAssignment {
  if (!assignments.length) return { primaryRegion: "Other", affectedRegions: ["Other"] };
  const primaries = [...new Set(assignments.map((item) => item.primaryRegion))];
  const affectedRegions = [...new Set(assignments.flatMap((item) => item.affectedRegions))];
  return {
    primaryRegion: primaries.length === 1 ? primaries[0] : "Other",
    affectedRegions: affectedRegions.length ? affectedRegions : ["Other"],
  };
}

export function matchesMarketRegion(
  assignment: MarketRegionAssignment,
  filter: MarketRegionFilter,
): boolean {
  return filter === "All"
    || assignment.primaryRegion === filter
    || assignment.affectedRegions.includes(filter);
}
