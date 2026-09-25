export const POWER_STACK_FUNDAMENTALS_V1 = "power-stack-fundamentals/v1";
export const POWER_STACK_FUNDAMENTALS_IMPORT_V1 = "power-stack-fundamentals-import/v1";

export const DEFAULT_POWER_STACK_FUNDAMENTALS_URL =
  "https://clydigital.github.io/power-stack/data/live-fundamentals-snapshot.json";

export type PowerStackQualityProfile = {
  aiRisk: number | null;
  themeDependency: number | null;
  cyclicality: number | null;
  speculation: number | null;
};

export type PowerStackCompanyFundamental = {
  ticker: string;
  name: string;
  market: string | null;
  region: string | null;
  themeGroup: string | null;
  theme: string | null;
  baseConviction: number;
  status: string | null;
  thesis: string | null;
  catalysts: string | null;
  risks: string | null;
  qualityProfile: PowerStackQualityProfile;
  lastUpdated: string | null;
};

export type PowerStackFundamentalsSnapshot = {
  contractVersion: typeof POWER_STACK_FUNDAMENTALS_V1;
  snapshotAt: string;
  sourceCommit: string;
  companies: PowerStackCompanyFundamental[];
  sourceFiles: string[];
  guardrails: string[];
};

export type FrozenPowerStackFundamentalsImport = {
  contractVersion: typeof POWER_STACK_FUNDAMENTALS_IMPORT_V1;
  importedAt: string;
  sourceSnapshotAt: string;
  sourceCommit: string;
  companies: PowerStackCompanyFundamental[];
  sourceFiles: string[];
  guardrails: string[];
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

function nullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function nullableRisk(value: unknown): number | null | undefined {
  if (value === null) return null;
  return finite(value, 0, 5) ? value : undefined;
}

function parseQualityProfile(value: unknown): PowerStackQualityProfile | null {
  if (!object(value)) return null;
  const aiRisk = nullableRisk(value.aiRisk);
  const themeDependency = nullableRisk(value.themeDependency);
  const cyclicality = nullableRisk(value.cyclicality);
  const speculation = nullableRisk(value.speculation);
  if ([aiRisk, themeDependency, cyclicality, speculation].some((item) => item === undefined)) return null;
  return {
    aiRisk: aiRisk ?? null,
    themeDependency: themeDependency ?? null,
    cyclicality: cyclicality ?? null,
    speculation: speculation ?? null,
  };
}

function parseCompany(value: unknown): PowerStackCompanyFundamental | null {
  if (!object(value)) return null;
  const ticker = typeof value.ticker === "string" ? value.ticker.trim().toUpperCase() : "";
  const qualityProfile = parseQualityProfile(value.qualityProfile);
  const market = nullableString(value.market);
  const region = nullableString(value.region);
  const themeGroup = nullableString(value.themeGroup);
  const theme = nullableString(value.theme);
  const status = nullableString(value.status);
  const thesis = nullableString(value.thesis);
  const catalysts = nullableString(value.catalysts);
  const risks = nullableString(value.risks);
  const lastUpdated = nullableString(value.lastUpdated);
  if (
    !/^[A-Z0-9.-]{1,12}$/.test(ticker)
    || typeof value.name !== "string"
    || !finite(value.baseConviction, 0, 10)
    || qualityProfile === null
    || [market, region, themeGroup, theme, status, thesis, catalysts, risks, lastUpdated].some((item) => item === undefined)
  ) return null;
  return {
    ticker,
    name: value.name,
    market: market ?? null,
    region: region ?? null,
    themeGroup: themeGroup ?? null,
    theme: theme ?? null,
    baseConviction: value.baseConviction,
    status: status ?? null,
    thesis: thesis ?? null,
    catalysts: catalysts ?? null,
    risks: risks ?? null,
    qualityProfile,
    lastUpdated: lastUpdated ?? null,
  };
}

export function parsePowerStackFundamentalsSnapshot(value: unknown): PowerStackFundamentalsSnapshot | null {
  if (!object(value)) return null;
  if (
    value.contractVersion !== POWER_STACK_FUNDAMENTALS_V1
    || !iso(value.snapshotAt)
    || typeof value.sourceCommit !== "string"
    || !value.sourceCommit.trim()
    || !Array.isArray(value.companies)
    || !strings(value.sourceFiles)
    || !strings(value.guardrails)
  ) return null;
  const companies = value.companies.map(parseCompany);
  if (companies.some((company) => company === null)) return null;
  const typedCompanies = companies as PowerStackCompanyFundamental[];
  if (new Set(typedCompanies.map((company) => company.ticker)).size !== typedCompanies.length) return null;
  return {
    contractVersion: POWER_STACK_FUNDAMENTALS_V1,
    snapshotAt: value.snapshotAt,
    sourceCommit: value.sourceCommit,
    companies: typedCompanies,
    sourceFiles: [...value.sourceFiles],
    guardrails: [...value.guardrails],
  };
}

export async function fetchPowerStackFundamentalsImport({
  sourceUrl = process.env.POWER_STACK_FUNDAMENTALS_URL || DEFAULT_POWER_STACK_FUNDAMENTALS_URL,
  importedAt = new Date().toISOString(),
}: {
  sourceUrl?: string;
  importedAt?: string;
} = {}): Promise<FrozenPowerStackFundamentalsImport | null> {
  try {
    const response = await fetch(sourceUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const snapshot = parsePowerStackFundamentalsSnapshot(await response.json());
    if (!snapshot) return null;
    return {
      contractVersion: POWER_STACK_FUNDAMENTALS_IMPORT_V1,
      importedAt,
      sourceSnapshotAt: snapshot.snapshotAt,
      sourceCommit: snapshot.sourceCommit,
      companies: snapshot.companies,
      sourceFiles: snapshot.sourceFiles,
      guardrails: snapshot.guardrails,
      sourceUrl,
    };
  } catch {
    return null;
  }
}

export async function enrichDailyBriefSnapshotWrite(
  path: string,
  init: RequestInit,
  load: () => Promise<FrozenPowerStackFundamentalsImport | null> = () => fetchPowerStackFundamentalsImport(),
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
    && !("powerStackFundamentals" in row.payload));
  if (!needsImport) return init;

  const imported = await load().catch(() => null);
  if (!imported) return init;
  const patched = rows.map((row) => {
    if (!object(row) || row.snapshot_type !== "daily_brief" || !object(row.payload) || "powerStackFundamentals" in row.payload) return row;
    return {
      ...row,
      payload: {
        ...row.payload,
        powerStackFundamentals: structuredClone(imported),
      },
    };
  });
  return {
    ...init,
    body: JSON.stringify(Array.isArray(payload) ? patched : patched[0]),
  };
}
