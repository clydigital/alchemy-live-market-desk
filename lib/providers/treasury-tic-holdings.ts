export const TREASURY_TIC_TABLE5_URL =
  "https://ticdata.treasury.gov/resource-center/data-chart-center/tic/Documents/slt_table5.txt";

export type TreasuryTicProviderStatus = "OK" | "PARTIAL" | "UNAVAILABLE";

export type TreasuryTicCountryHolding = {
  country: string;
  latestUsdBn: number | null;
  previousUsdBn: number | null;
  monthlyChangeUsdBn: number | null;
};

export type TreasuryTicSnapshot = {
  status: TreasuryTicProviderStatus;
  fetchedAt: string;
  latestPeriod: string | null;
  previousPeriod: string | null;
  sourceName: "U.S. Department of the Treasury · Treasury International Capital";
  sourceUrl: typeof TREASURY_TIC_TABLE5_URL;
  countries: TreasuryTicCountryHolding[];
  custodyAttributionCaveat: string;
  warnings: string[];
};

const CUSTODY_CAVEAT =
  "TIC country holdings are collected primarily from U.S.-based custodians and broker-dealers; overseas custody can prevent precise attribution to the actual beneficial owner.";

function numeric(value: string | undefined) {
  if (!value) return null;
  const cleaned = value.trim().replace(/,/g, "");
  if (!cleaned || cleaned === "*" || /^n\.?a\.?$/i.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseTreasuryTicTable5(text: string, fetchedAt = new Date().toISOString()): TreasuryTicSnapshot {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const header = lines.find((line) => /^Country\t/.test(line));
  if (!header) {
    return {
      status: "UNAVAILABLE",
      fetchedAt,
      latestPeriod: null,
      previousPeriod: null,
      sourceName: "U.S. Department of the Treasury · Treasury International Capital",
      sourceUrl: TREASURY_TIC_TABLE5_URL,
      countries: [],
      custodyAttributionCaveat: CUSTODY_CAVEAT,
      warnings: ["TIC Table 5 header was not found."],
    };
  }

  const periods = header.split("\t").slice(1).map((value) => value.trim()).filter(Boolean);
  const latestPeriod = periods[0] ?? null;
  const previousPeriod = periods[1] ?? null;
  const countries: TreasuryTicCountryHolding[] = [];

  for (const line of lines) {
    const cells = line.split("\t");
    const country = cells[0]?.trim();
    if (!country || country === "Country" || cells.length < 2) continue;
    const latest = numeric(cells[1]);
    const previous = numeric(cells[2]);
    if (latest === null && previous === null) continue;
    countries.push({
      country,
      latestUsdBn: latest,
      previousUsdBn: previous,
      monthlyChangeUsdBn: latest !== null && previous !== null
        ? Number((latest - previous).toFixed(1))
        : null,
    });
  }

  const keyRows = ["Japan", "Grand Total", "Of Which: Foreign Official"];
  const missing = keyRows.filter((name) => !countries.some((item) => item.country === name));
  return {
    status: !latestPeriod || !countries.length
      ? "UNAVAILABLE"
      : missing.length
        ? "PARTIAL"
        : "OK",
    fetchedAt,
    latestPeriod,
    previousPeriod,
    sourceName: "U.S. Department of the Treasury · Treasury International Capital",
    sourceUrl: TREASURY_TIC_TABLE5_URL,
    countries,
    custodyAttributionCaveat: CUSTODY_CAVEAT,
    warnings: missing.map((name) => `TIC Table 5 is missing expected row: ${name}.`),
  };
}

export async function fetchTreasuryTicTable5(
  fetchImpl: typeof fetch = fetch,
): Promise<TreasuryTicSnapshot> {
  const fetchedAt = new Date().toISOString();
  try {
    const response = await fetchImpl(TREASURY_TIC_TABLE5_URL, {
      headers: {
        accept: "text/plain,*/*",
        "user-agent": "Alchemy Live Desk Treasury-TIC adapter",
      },
      next: { revalidate: 60 * 60 * 12 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseTreasuryTicTable5(await response.text(), fetchedAt);
  } catch (error) {
    return {
      status: "UNAVAILABLE",
      fetchedAt,
      latestPeriod: null,
      previousPeriod: null,
      sourceName: "U.S. Department of the Treasury · Treasury International Capital",
      sourceUrl: TREASURY_TIC_TABLE5_URL,
      countries: [],
      custodyAttributionCaveat: CUSTODY_CAVEAT,
      warnings: [`Treasury TIC Table 5 acquisition failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}
