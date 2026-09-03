export const POWER_STACK_RATING_SNAPSHOT_V1 = "power-stack-rating-snapshot/v1";
export const POWER_STACK_RATING_IMPORT_V1 = "power-stack-rating-import/v1";

export const DEFAULT_POWER_STACK_RATING_SNAPSHOT_URL =
  "https://clydigital.github.io/power-stack/data/live-rating-snapshot.json";

export type PowerStackIndustryMacroRisk = {
  industry: string;
  score: number;
  label: string;
  asOf: string;
  pressures: string[];
  offsets: string[];
};

export type PowerStackRating = {
  ticker: string;
  name: string;
  themeGroup: string;
  researchScore: number;
  macroAdjustment: number;
  adjustedScore: number;
  industryMacroRisk: PowerStackIndustryMacroRisk | null;
  industryRiskNote?: string;
};

export type PowerStackRatingSnapshot = {
  contractVersion: typeof POWER_STACK_RATING_SNAPSHOT_V1;
  snapshotAt: string;
  sourceCommit: string;
  macroContextGeneratedAt: string;
  macroProfileUpdatedAt: string;
  methodology: Record<string, unknown>;
  ratings: PowerStackRating[];
  sourceFiles: string[];
};

export type FrozenPowerStackRatingImport = {
  contractVersion: typeof POWER_STACK_RATING_IMPORT_V1;
  importedAt: string;
  sourceSnapshotAt: string;
  sourceCommit: string;
  macroContextGeneratedAt: string;
  macroProfileUpdatedAt: string;
  methodology: Record<string, unknown>;
  ratings: PowerStackRating[];
  sourceFiles: string[];
  sourceUrl: string;
};

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function finite(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function iso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseIndustryRisk(value: unknown): PowerStackIndustryMacroRisk | null | undefined {
  if (value === null) return null;
  if (!object(value)) return undefined;
  if (
    typeof value.industry !== "string"
    || !finite(value.score, 0, 100)
    || typeof value.label !== "string"
    || !iso(value.asOf)
    || !strings(value.pressures)
    || !strings(value.offsets)
  ) return undefined;
  return {
    industry: value.industry,
    score: value.score,
    label: value.label,
    asOf: value.asOf,
    pressures: [...value.pressures],
    offsets: [...value.offsets],
  };
}

function parseRating(value: unknown): PowerStackRating | null {
  if (!object(value)) return null;
  const ticker = typeof value.ticker === "string" ? value.ticker.trim().toUpperCase() : "";
  const industryMacroRisk = parseIndustryRisk(value.industryMacroRisk);
  if (
    !/^[A-Z0-9.-]{1,12}$/.test(ticker)
    || typeof value.name !== "string"
    || typeof value.themeGroup !== "string"
    || !finite(value.researchScore, 0, 10)
    || !finite(value.macroAdjustment, -1, 1)
    || !finite(value.adjustedScore, 0, 10)
    || industryMacroRisk === undefined
    || (value.industryRiskNote !== undefined && typeof value.industryRiskNote !== "string")
  ) return null;
  return {
    ticker,
    name: value.name,
    themeGroup: value.themeGroup,
    researchScore: value.researchScore,
    macroAdjustment: value.macroAdjustment,
    adjustedScore: value.adjustedScore,
    industryMacroRisk,
    ...(typeof value.industryRiskNote === "string" ? { industryRiskNote: value.industryRiskNote } : {}),
  };
}

export function parsePowerStackRatingSnapshot(value: unknown): PowerStackRatingSnapshot | null {
  if (!object(value)) return null;
  if (
    value.contractVersion !== POWER_STACK_RATING_SNAPSHOT_V1
    || !iso(value.snapshotAt)
    || typeof value.sourceCommit !== "string"
    || !value.sourceCommit.trim()
    || !iso(value.macroContextGeneratedAt)
    || !iso(value.macroProfileUpdatedAt)
    || !object(value.methodology)
    || !Array.isArray(value.ratings)
    || !strings(value.sourceFiles)
  ) return null;
  const ratings = value.ratings.map(parseRating);
  if (ratings.some((rating) => rating === null)) return null;
  const typedRatings = ratings as PowerStackRating[];
  if (new Set(typedRatings.map((rating) => rating.ticker)).size !== typedRatings.length) return null;
  return {
    contractVersion: POWER_STACK_RATING_SNAPSHOT_V1,
    snapshotAt: value.snapshotAt,
    sourceCommit: value.sourceCommit,
    macroContextGeneratedAt: value.macroContextGeneratedAt,
    macroProfileUpdatedAt: value.macroProfileUpdatedAt,
    methodology: structuredClone(value.methodology),
    ratings: typedRatings,
    sourceFiles: [...value.sourceFiles],
  };
}

export async function fetchPowerStackRatingImport({
  sourceUrl = process.env.POWER_STACK_RATING_SNAPSHOT_URL || DEFAULT_POWER_STACK_RATING_SNAPSHOT_URL,
  importedAt = new Date().toISOString(),
}: {
  sourceUrl?: string;
  importedAt?: string;
} = {}): Promise<FrozenPowerStackRatingImport | null> {
  try {
    const response = await fetch(sourceUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const snapshot = parsePowerStackRatingSnapshot(await response.json());
    if (!snapshot) return null;
    return {
      contractVersion: POWER_STACK_RATING_IMPORT_V1,
      importedAt,
      sourceSnapshotAt: snapshot.snapshotAt,
      sourceCommit: snapshot.sourceCommit,
      macroContextGeneratedAt: snapshot.macroContextGeneratedAt,
      macroProfileUpdatedAt: snapshot.macroProfileUpdatedAt,
      methodology: snapshot.methodology,
      ratings: snapshot.ratings,
      sourceFiles: snapshot.sourceFiles,
      sourceUrl,
    };
  } catch {
    return null;
  }
}

export async function enrichDailyBriefSnapshotWrite(
  path: string,
  init: RequestInit,
  load: () => Promise<FrozenPowerStackRatingImport | null> = () => fetchPowerStackRatingImport(),
): Promise<RequestInit> {
  if (path !== "hybrid_publication_snapshots" || (init.method || "GET").toUpperCase() !== "POST" || typeof init.body !== "string") {
    return init;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(init.body);
  } catch {
    return init;
  }
  const rows = Array.isArray(payload) ? payload : [payload];
  const needsImport = rows.some((row) => object(row)
    && row.snapshot_type === "daily_brief"
    && object(row.payload)
    && !("powerStackRatings" in row.payload));
  if (!needsImport) return init;

  const imported = await load().catch(() => null);
  if (!imported) return init;
  const patched = rows.map((row) => {
    if (!object(row) || row.snapshot_type !== "daily_brief" || !object(row.payload) || "powerStackRatings" in row.payload) return row;
    return {
      ...row,
      payload: {
        ...row.payload,
        powerStackRatings: structuredClone(imported),
      },
    };
  });
  return {
    ...init,
    body: JSON.stringify(Array.isArray(payload) ? patched : patched[0]),
  };
}
