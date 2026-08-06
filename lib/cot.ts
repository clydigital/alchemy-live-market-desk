export type CotMarketGroup = "Indices & Bonds" | "Currencies" | "Commodities";

export type CotSnapshot = {
  code: string;
  label: string;
  group: CotMarketGroup;
  marketName: string;
  reportDate: string;
  retrievedAt: string;
  stale: boolean;
  openInterest: number;
  commercialNet: number;
  largeSpecNet: number;
  smallSpecNet: number;
  commercialNetPctOi: number;
  largeSpecNetPctOi: number;
  smallSpecNetPctOi: number;
  commercialRawScore: number;
  commercialDisplayScore: number;
  largeSpecScore: number;
  smallSpecScore: number;
  weeklyChange: number;
  sourceUrl: string;
};

type CotRow = {
  market_and_exchange_names?: string;
  report_date_as_yyyy_mm_dd?: string;
  open_interest_all?: string;
  noncomm_positions_long_all?: string;
  noncomm_positions_short_all?: string;
  comm_positions_long_all?: string;
  comm_positions_short_all?: string;
  nonrept_positions_long_all?: string;
  nonrept_positions_short_all?: string;
};

type MarketSpec = {
  code: string;
  label: string;
  group: CotMarketGroup;
};

const DATASET_ID = "6dca-aqww";
const DATASET_URL = `https://publicreporting.cftc.gov/Commitments-of-Traders/Legacy-Futures-Only/${DATASET_ID}`;
const API_URL = `https://publicreporting.cftc.gov/resource/${DATASET_ID}.json`;

const MARKETS: MarketSpec[] = [
  { code: "13874A", label: "S&P 500", group: "Indices & Bonds" },
  { code: "209742", label: "Nasdaq 100", group: "Indices & Bonds" },
  { code: "043602", label: "US 10Y", group: "Indices & Bonds" },
  { code: "097741", label: "Japanese Yen", group: "Currencies" },
  { code: "067651", label: "WTI Crude", group: "Commodities" },
  { code: "088691", label: "Gold", group: "Commodities" },
];

function numberValue(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function net(longValue: string | undefined, shortValue: string | undefined) {
  return numberValue(longValue) - numberValue(shortValue);
}

function percentile(values: number[], current: number) {
  if (values.length < 2) return 50;
  const belowOrEqual = values.filter((value) => value <= current).length;
  return Math.max(0, Math.min(100, Math.round(((belowOrEqual - 1) / (values.length - 1)) * 100)));
}

function pctOfOpenInterest(value: number, openInterest: number) {
  if (!openInterest) return 0;
  return Number(((value / openInterest) * 100).toFixed(1));
}

function daysSince(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86400000));
}

async function fetchMarket(spec: MarketSpec): Promise<CotSnapshot | null> {
  const params = new URLSearchParams({
    cftc_contract_market_code: spec.code,
    "$select": [
      "market_and_exchange_names",
      "report_date_as_yyyy_mm_dd",
      "open_interest_all",
      "noncomm_positions_long_all",
      "noncomm_positions_short_all",
      "comm_positions_long_all",
      "comm_positions_short_all",
      "nonrept_positions_long_all",
      "nonrept_positions_short_all",
    ].join(","),
    "$order": "report_date_as_yyyy_mm_dd DESC",
    "$limit": "60",
  });

  try {
    const response = await fetch(`${API_URL}?${params.toString()}`, {
      headers: {
        accept: "application/json",
        "user-agent": "Alchemy Markets Live Desk/1.0",
      },
      next: { revalidate: 60 * 60 * 6 },
    });

    if (!response.ok) return null;
    const rows = (await response.json()) as CotRow[];
    if (!rows.length) return null;

    const history = rows.slice(0, 53);
    const latest = history[0];
    const prior = history[1] || latest;
    const openInterest = numberValue(latest.open_interest_all);

    const commercialHistory = history.map((row) => net(row.comm_positions_long_all, row.comm_positions_short_all));
    const largeSpecHistory = history.map((row) => net(row.noncomm_positions_long_all, row.noncomm_positions_short_all));
    const smallSpecHistory = history.map((row) => net(row.nonrept_positions_long_all, row.nonrept_positions_short_all));

    const commercialNet = commercialHistory[0];
    const largeSpecNet = largeSpecHistory[0];
    const smallSpecNet = smallSpecHistory[0];
    const commercialRawScore = percentile(commercialHistory, commercialNet);
    const largeSpecScore = percentile(largeSpecHistory, largeSpecNet);
    const smallSpecScore = percentile(smallSpecHistory, smallSpecNet);
    const priorLargeSpecScore = percentile(largeSpecHistory, net(prior.noncomm_positions_long_all, prior.noncomm_positions_short_all));
    const reportDate = latest.report_date_as_yyyy_mm_dd || "";

    return {
      code: spec.code,
      label: spec.label,
      group: spec.group,
      marketName: latest.market_and_exchange_names || spec.label,
      reportDate,
      retrievedAt: new Date().toISOString(),
      stale: daysSince(reportDate) > 10,
      openInterest,
      commercialNet,
      largeSpecNet,
      smallSpecNet,
      commercialNetPctOi: pctOfOpenInterest(commercialNet, openInterest),
      largeSpecNetPctOi: pctOfOpenInterest(largeSpecNet, openInterest),
      smallSpecNetPctOi: pctOfOpenInterest(smallSpecNet, openInterest),
      commercialRawScore,
      commercialDisplayScore: 100 - commercialRawScore,
      largeSpecScore,
      smallSpecScore,
      weeklyChange: largeSpecScore - priorLargeSpecScore,
      sourceUrl: DATASET_URL,
    };
  } catch {
    return null;
  }
}

export async function getCotSnapshots() {
  const rows = await Promise.all(MARKETS.map(fetchMarket));
  return rows.filter((row): row is CotSnapshot => Boolean(row));
}
