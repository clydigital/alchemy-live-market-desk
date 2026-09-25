import type { NyFedProviderStatus } from "./ny-fed-reference-rates.ts";

export type NyFedDealerSeries = {
  keyId: "PDPOSGST-TOT" | "PDFTD-USTET" | "PDFTR-USTET";
  label: string;
  asOf: string | null;
  valueMillions: number | null;
  previousAsOf: string | null;
  previousValueMillions: number | null;
  weeklyChangeMillions: number | null;
};

export type NyFedPrimaryDealerSnapshot = {
  status: NyFedProviderStatus;
  fetchedAt: string;
  asOf: string | null;
  sourceName: "Federal Reserve Bank of New York";
  sourceUrl: string;
  series: NyFedDealerSeries[];
  warnings: string[];
};

export const NY_FED_PRIMARY_DEALER_URL =
  "https://markets.newyorkfed.org/api/pd/get/PDPOSGST-TOT_PDFTD-USTET_PDFTR-USTET.json";

const SERIES = [
  ["PDPOSGST-TOT", "Treasury dealer net position ex-TIPS"],
  ["PDFTD-USTET", "Treasury fails to deliver ex-TIPS"],
  ["PDFTR-USTET", "Treasury fails to receive ex-TIPS"],
] as const;

function finite(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() && value.trim() !== "*") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function rowDate(row: Record<string, unknown>) {
  const value = row.asofdate ?? row.asOfDate;
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function ageDays(value: string | null, now: Date) {
  if (!value) return Infinity;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? Math.max(0, (now.getTime() - parsed) / 86_400_000) : Infinity;
}

export function parseNyFedPrimaryDealers(
  payload: unknown,
  now = new Date(),
): NyFedPrimaryDealerSnapshot {
  const raw = payload && typeof payload === "object"
    ? (payload as { pd?: { timeseries?: unknown } }).pd?.timeseries
    : null;
  const rows = Array.isArray(raw) ? raw.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
  const warnings: string[] = [];

  const series = SERIES.map(([keyId, label]): NyFedDealerSeries => {
    const candidates = rows
      .filter((row) => row.keyid === keyId)
      .map((row) => ({ row, date: rowDate(row), value: finite(row.value) }))
      .filter((item) => item.date)
      .sort((a, b) => b.date!.localeCompare(a.date!));
    const latest = candidates[0] ?? null;
    const previous = candidates.slice(1).find((item) => item.value !== null) ?? null;
    if (!latest) warnings.push(`${label} is missing from the NY Fed primary-dealer response.`);
    const weeklyChangeMillions =
      latest?.value !== null && latest?.value !== undefined && previous?.value !== null && previous?.value !== undefined
        ? latest.value - previous.value
        : null;
    return {
      keyId,
      label,
      asOf: latest?.date ?? null,
      valueMillions: latest?.value ?? null,
      previousAsOf: previous?.date ?? null,
      previousValueMillions: previous?.value ?? null,
      weeklyChangeMillions,
    };
  });

  const asOf = series.map((item) => item.asOf).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  const numericSeries = series.filter((item) => item.valueMillions !== null);
  const stale = ageDays(asOf, now) > 14;
  const status: NyFedProviderStatus = !numericSeries.length
    ? "UNAVAILABLE"
    : warnings.length || numericSeries.length < series.length
      ? "PARTIAL"
      : stale
        ? "STALE"
        : "OK";
  if (stale && asOf) warnings.push(`Latest primary-dealer report date ${asOf} is more than fourteen calendar days old.`);

  return {
    status,
    fetchedAt: now.toISOString(),
    asOf,
    sourceName: "Federal Reserve Bank of New York",
    sourceUrl: NY_FED_PRIMARY_DEALER_URL,
    series,
    warnings,
  };
}

export async function fetchNyFedPrimaryDealers(
  now = new Date(),
): Promise<NyFedPrimaryDealerSnapshot> {
  try {
    const response = await fetch(NY_FED_PRIMARY_DEALER_URL, {
      headers: { Accept: "application/json", "User-Agent": "Alchemy Live Desk monetary signals" },
      next: { revalidate: 60 * 60 * 6 },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseNyFedPrimaryDealers(await response.json(), now);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown provider failure";
    return {
      status: "UNAVAILABLE",
      fetchedAt: now.toISOString(),
      asOf: null,
      sourceName: "Federal Reserve Bank of New York",
      sourceUrl: NY_FED_PRIMARY_DEALER_URL,
      series: SERIES.map(([keyId, label]) => ({
        keyId,
        label,
        asOf: null,
        valueMillions: null,
        previousAsOf: null,
        previousValueMillions: null,
        weeklyChangeMillions: null,
      })),
      warnings: [`NY Fed primary-dealer acquisition failed: ${detail}`],
    };
  }
}
