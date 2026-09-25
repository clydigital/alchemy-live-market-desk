export type NyFedProviderStatus = "OK" | "STALE" | "PARTIAL" | "UNAVAILABLE";

export type NyFedReferenceRate = {
  type: "EFFR" | "SOFR" | "TGCR" | "BGCR";
  effectiveDate: string;
  percentRate: number;
  volumeInBillions: number | null;
  percentile1: number | null;
  percentile25: number | null;
  percentile75: number | null;
  percentile99: number | null;
};

export type NyFedReferenceRatesSnapshot = {
  status: NyFedProviderStatus;
  fetchedAt: string;
  asOf: string | null;
  sourceName: "Federal Reserve Bank of New York";
  sourceUrl: string;
  rates: NyFedReferenceRate[];
  warnings: string[];
};

export const NY_FED_REFERENCE_RATES_URL =
  "https://markets.newyorkfed.org/api/rates/all/latest.json";

const REQUIRED = ["EFFR", "SOFR", "TGCR", "BGCR"] as const;

function finite(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() && value.trim() !== "*") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dateAgeDays(value: string | null, now: Date) {
  if (!value) return Infinity;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? Math.max(0, (now.getTime() - parsed) / 86_400_000) : Infinity;
}

export function parseNyFedReferenceRates(
  payload: unknown,
  now = new Date(),
): NyFedReferenceRatesSnapshot {
  const fetchedAt = now.toISOString();
  const rows = payload && typeof payload === "object" && Array.isArray((payload as { refRates?: unknown }).refRates)
    ? (payload as { refRates: Array<Record<string, unknown>> }).refRates
    : [];

  const rates = rows.flatMap((row): NyFedReferenceRate[] => {
    const type = typeof row.type === "string" ? row.type.toUpperCase() : "";
    if (!REQUIRED.includes(type as (typeof REQUIRED)[number])) return [];
    const percentRate = finite(row.percentRate);
    const effectiveDate = typeof row.effectiveDate === "string" ? row.effectiveDate : "";
    if (percentRate === null || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) return [];
    return [{
      type: type as NyFedReferenceRate["type"],
      effectiveDate,
      percentRate,
      volumeInBillions: finite(row.volumeInBillions),
      percentile1: finite(row.percentPercentile1),
      percentile25: finite(row.percentPercentile25),
      percentile75: finite(row.percentPercentile75),
      percentile99: finite(row.percentPercentile99),
    }];
  });

  const unique = REQUIRED.flatMap((type) => {
    const candidates = rates
      .filter((row) => row.type === type)
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
    return candidates[0] ? [candidates[0]] : [];
  });
  const asOf = unique.map((row) => row.effectiveDate).sort().at(-1) ?? null;
  const warnings: string[] = [];
  for (const type of REQUIRED) {
    if (!unique.some((row) => row.type === type)) warnings.push(`${type} is missing from the NY Fed reference-rate response.`);
  }
  const ageDays = dateAgeDays(asOf, now);
  const status: NyFedProviderStatus = !unique.length
    ? "UNAVAILABLE"
    : warnings.length
      ? "PARTIAL"
      : ageDays > 5
        ? "STALE"
        : "OK";
  if (status === "STALE") warnings.push(`Latest NY Fed reference-rate date ${asOf} is more than five calendar days old.`);

  return {
    status,
    fetchedAt,
    asOf,
    sourceName: "Federal Reserve Bank of New York",
    sourceUrl: NY_FED_REFERENCE_RATES_URL,
    rates: unique,
    warnings,
  };
}

export async function fetchNyFedReferenceRates(
  now = new Date(),
): Promise<NyFedReferenceRatesSnapshot> {
  try {
    const response = await fetch(NY_FED_REFERENCE_RATES_URL, {
      headers: { Accept: "application/json", "User-Agent": "Alchemy Live Desk monetary signals" },
      next: { revalidate: 60 * 60 },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseNyFedReferenceRates(await response.json(), now);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown provider failure";
    return {
      status: "UNAVAILABLE",
      fetchedAt: now.toISOString(),
      asOf: null,
      sourceName: "Federal Reserve Bank of New York",
      sourceUrl: NY_FED_REFERENCE_RATES_URL,
      rates: [],
      warnings: [`NY Fed reference-rate acquisition failed: ${detail}`],
    };
  }
}
