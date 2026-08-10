import { unstable_cache } from "next/cache";

export const CHALLENGER_REPOSITORY = "clydigital/alchemy-challenger";
export const CHALLENGER_CONTRACT_VERSION = 1;
export const CHALLENGER_LEDGER_VERSION = 1;

export type ChallengerStatus = "ready" | "degraded" | "configuration_required";
export type ChallengerBias = "bullish" | "bearish" | "neutral" | "unscored";
export type ChallengerFactorGroup = "Inflation" | "Labour" | "Growth" | "Rates";

export type ChallengerFactor = {
  id: string;
  label: string;
  group: ChallengerFactorGroup;
  seriesId: string;
  enabled: boolean;
  evidenceStatus: "DOCUMENTED" | "OBSERVED" | "INFERRED" | "UNKNOWN";
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  ruleType: string;
  value: number | null;
  previousValue: number | null;
  delta: number | null;
  observationDate: string | null;
  realtimeStart: string | null;
  dataStatus: "available" | "unavailable";
  sourceUrl: string;
};

export type ChallengerNextEvent = {
  id: string;
  name: string;
  releaseName: string;
  factorIds: string[];
  publishAt: string;
  publishDate: string;
  timeEt: string;
  timeMyt: string;
  daysUntil: number;
  sourceName: string;
  sourceUrl: string;
  caveat: string;
};

export type ChallengerForwardTally = {
  horizon: "T0" | "1D" | "2D" | "3D" | "4D" | "5D" | "10D";
  sampleSize: number;
  directionalHitRate: number | null;
  meanSignedReturn: number | null;
  medianSignedReturn: number | null;
  meanMfe: number | null;
  meanMae: number | null;
  status: "awaiting_validated_signals";
};

export type ChallengerAsset = {
  symbol: "SPX";
  score: number | null;
  bias: ChallengerBias;
  conviction: number | null;
  scoreDelta1d: number | null;
  scoreDelta5d: number | null;
  factors: ChallengerFactor[];
  forwardTally: ChallengerForwardTally[];
};

export type ChallengerSnapshot = {
  contractVersion: number;
  source: "alchemy-live-market-desk";
  engine: {
    repository: string;
    version: "0.1.0";
    ledgerVersion: number;
    methodology: "forensic_ledger";
  };
  status: ChallengerStatus;
  updatedAt: string;
  asOf: string;
  assets: { SPX: ChallengerAsset };
  nextEvent: ChallengerNextEvent | null;
  methodology: {
    enabledFactorCount: number;
    totalFactorCount: number;
    failClosed: true;
    scoringAvailable: boolean;
    notes: string[];
  };
  warnings: string[];
};

type FactorSpec = Omit<ChallengerFactor, "value" | "previousValue" | "delta" | "observationDate" | "realtimeStart" | "dataStatus" | "sourceUrl">;

const FACTOR_SPECS: FactorSpec[] = [
  { id: "headline_cpi", label: "Headline CPI", group: "Inflation", seriesId: "CPIAUCSL", enabled: false, evidenceStatus: "UNKNOWN", confidence: "NONE", ruleType: "unknown" },
  { id: "core_cpi", label: "Core CPI", group: "Inflation", seriesId: "CPILFESL", enabled: false, evidenceStatus: "UNKNOWN", confidence: "NONE", ruleType: "unknown" },
  { id: "nonfarm_payrolls", label: "Nonfarm Payrolls", group: "Labour", seriesId: "PAYEMS", enabled: false, evidenceStatus: "UNKNOWN", confidence: "NONE", ruleType: "unknown" },
  { id: "unemployment_rate", label: "Unemployment Rate", group: "Labour", seriesId: "UNRATE", enabled: false, evidenceStatus: "UNKNOWN", confidence: "NONE", ruleType: "unknown" },
  { id: "manufacturing_pmi", label: "Manufacturing PMI", group: "Growth", seriesId: "NAPM", enabled: false, evidenceStatus: "INFERRED", confidence: "LOW", ruleType: "current_vs_previous" },
  { id: "services_pmi", label: "Services PMI", group: "Growth", seriesId: "NMFCI", enabled: false, evidenceStatus: "UNKNOWN", confidence: "NONE", ruleType: "unknown" },
  { id: "retail_sales", label: "Retail Sales", group: "Growth", seriesId: "RSAFS", enabled: false, evidenceStatus: "UNKNOWN", confidence: "NONE", ruleType: "unknown" },
  { id: "real_gdp", label: "Real GDP", group: "Growth", seriesId: "GDPC1", enabled: false, evidenceStatus: "INFERRED", confidence: "LOW", ruleType: "actual_vs_forecast" },
  { id: "us_2y_yield", label: "US 2Y Yield", group: "Rates", seriesId: "DGS2", enabled: false, evidenceStatus: "INFERRED", confidence: "LOW", ruleType: "price_vs_short_moving_average" },
];

const FORWARD_HORIZONS: ChallengerForwardTally["horizon"][] = ["T0", "1D", "2D", "3D", "4D", "5D", "10D"];

const RELEASE_MATCHERS = [
  { id: "cpi", name: "CPI", includes: ["consumer price index"], factorIds: ["headline_cpi", "core_cpi"], hour: 8, minute: 30 },
  { id: "employment", name: "US Employment Situation", includes: ["employment situation"], factorIds: ["nonfarm_payrolls", "unemployment_rate"], hour: 8, minute: 30 },
  { id: "manufacturing-pmi", name: "ISM Manufacturing PMI", includes: ["manufacturing ism", "ism manufacturing"], factorIds: ["manufacturing_pmi"], hour: 10, minute: 0 },
  { id: "services-pmi", name: "ISM Services PMI", includes: ["services ism", "ism services", "non-manufacturing ism"], factorIds: ["services_pmi"], hour: 10, minute: 0 },
  { id: "retail-sales", name: "US Retail Sales", includes: ["retail sales", "sales for retail and food services"], factorIds: ["retail_sales"], hour: 8, minute: 30 },
  { id: "gdp", name: "US GDP", includes: ["gross domestic product"], factorIds: ["real_gdp"], hour: 8, minute: 30 },
] as const;

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function easternOffsetMinutes(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day, 12));
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "longOffset",
  }).formatToParts(probe).find((item) => item.type === "timeZoneName")?.value || "GMT-05:00";
  const match = part.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return -300;
  const sign = match[1] === "+" ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

export function easternPublishAt(date: string, hour: number, minute: number) {
  const [year, month, day] = date.split("-").map(Number);
  const offset = easternOffsetMinutes(date);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - offset * 60_000).toISOString();
}

function timeLabel(publishAt: string, timeZone: string, suffix: string) {
  return `${new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(publishAt))} ${suffix}`;
}

function unavailableFactor(spec: FactorSpec): ChallengerFactor {
  return {
    ...spec,
    value: null,
    previousValue: null,
    delta: null,
    observationDate: null,
    realtimeStart: null,
    dataStatus: "unavailable",
    sourceUrl: `https://fred.stlouisfed.org/series/${spec.seriesId}`,
  };
}

function forwardTally(): ChallengerForwardTally[] {
  return FORWARD_HORIZONS.map((horizon) => ({
    horizon,
    sampleSize: 0,
    directionalHitRate: null,
    meanSignedReturn: null,
    medianSignedReturn: null,
    meanMfe: null,
    meanMae: null,
    status: "awaiting_validated_signals",
  }));
}

export function buildUnscoredSnapshot({
  now = new Date(),
  status = "configuration_required",
  factors = FACTOR_SPECS.map(unavailableFactor),
  nextEvent = null,
  warnings = [],
}: {
  now?: Date;
  status?: ChallengerStatus;
  factors?: ChallengerFactor[];
  nextEvent?: ChallengerNextEvent | null;
  warnings?: string[];
} = {}): ChallengerSnapshot {
  const enabledFactorCount = factors.filter((factor) => factor.enabled).length;
  return {
    contractVersion: CHALLENGER_CONTRACT_VERSION,
    source: "alchemy-live-market-desk",
    engine: {
      repository: CHALLENGER_REPOSITORY,
      version: "0.1.0",
      ledgerVersion: CHALLENGER_LEDGER_VERSION,
      methodology: "forensic_ledger",
    },
    status,
    updatedAt: now.toISOString(),
    asOf: isoDate(now),
    assets: {
      SPX: {
        symbol: "SPX",
        score: null,
        bias: "unscored",
        conviction: null,
        scoreDelta1d: null,
        scoreDelta5d: null,
        factors,
        forwardTally: forwardTally(),
      },
    },
    nextEvent,
    methodology: {
      enabledFactorCount,
      totalFactorCount: factors.length,
      failClosed: true,
      scoringAvailable: enabledFactorCount > 0,
      notes: [
        "The Challenger v0.1 formula ledger is the authority for factor activation.",
        "All nine SPX rules are currently disabled, so score, bias and conviction remain unscored.",
        "Consensus-dependent rules remain blocked until a defensible historical consensus source is selected.",
      ],
    },
    warnings,
  };
}

async function fredJson(path: string, params: Record<string, string>, apiKey: string) {
  const query = new URLSearchParams({ api_key: apiKey, file_type: "json", ...params });
  const response = await fetch(`https://api.stlouisfed.org/fred/${path}?${query}`, {
    headers: { accept: "application/json", "user-agent": "Alchemy Live Challenger/1.0" },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`FRED ${path} returned ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

async function loadFactor(spec: FactorSpec, asOf: string, apiKey: string): Promise<ChallengerFactor> {
  const payload = await fredJson("series/observations", {
    series_id: spec.seriesId,
    realtime_start: asOf,
    realtime_end: asOf,
    observation_start: `${Number(asOf.slice(0, 4)) - 5}${asOf.slice(4)}`,
    limit: "2",
    sort_order: "desc",
  }, apiKey);
  const rows = Array.isArray(payload.observations) ? payload.observations as Array<Record<string, string>> : [];
  const values = rows.flatMap((row) => {
    const value = Number(row.value);
    return Number.isFinite(value) ? [{ row, value }] : [];
  });
  const latest = values[0];
  const previous = values[1];
  if (!latest) return unavailableFactor(spec);
  return {
    ...spec,
    value: latest.value,
    previousValue: previous?.value ?? null,
    delta: previous ? Number((latest.value - previous.value).toFixed(4)) : null,
    observationDate: latest.row.date || null,
    realtimeStart: latest.row.realtime_start || null,
    dataStatus: "available",
    sourceUrl: `https://fred.stlouisfed.org/series/${spec.seriesId}`,
  };
}

type FredReleaseDate = {
  release_id?: number;
  release_name?: string;
  date?: string;
};

export function mapNextRelease(rows: FredReleaseDate[], now = new Date()): ChallengerNextEvent | null {
  const today = isoDate(now);
  const candidates = rows.flatMap((row) => {
    const releaseName = row.release_name || "";
    const normalized = releaseName.toLowerCase();
    const matcher = RELEASE_MATCHERS.find((item) => item.includes.some((needle) => normalized.includes(needle)));
    if (!matcher || !row.date || row.date < today) return [];
    const publishAt = easternPublishAt(row.date, matcher.hour, matcher.minute);
    return [{ row, matcher, publishAt }];
  }).sort((a, b) => a.publishAt.localeCompare(b.publishAt));
  const next = candidates[0];
  if (!next) return null;
  const publishDate = next.row.date!;
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = Date.parse(`${publishDate}T00:00:00Z`);
  return {
    id: `${next.matcher.id}-${publishDate}`,
    name: next.matcher.name,
    releaseName: next.row.release_name || next.matcher.name,
    factorIds: [...next.matcher.factorIds],
    publishAt: next.publishAt,
    publishDate,
    timeEt: timeLabel(next.publishAt, "America/New_York", "ET"),
    timeMyt: timeLabel(next.publishAt, "Asia/Kuala_Lumpur", "MYT"),
    daysUntil: Math.max(0, Math.ceil((end - start) / 86_400_000)),
    sourceName: "Federal Reserve Economic Data release calendar",
    sourceUrl: `https://fred.stlouisfed.org/releases?rid=${next.row.release_id || ""}`,
    caveat: "FRED republishes source-agency release dates; the source agency remains authoritative for late schedule changes.",
  };
}

async function loadNextEvent(now: Date, apiKey: string) {
  const start = isoDate(now);
  const end = isoDate(addDays(now, 90));
  const payload = await fredJson("releases/dates", {
    realtime_start: start,
    realtime_end: end,
    include_release_dates_with_no_data: "true",
    order_by: "release_date",
    sort_order: "asc",
    limit: "1000",
  }, apiKey);
  const rows = Array.isArray(payload.release_dates) ? payload.release_dates as FredReleaseDate[] : [];
  return mapNextRelease(rows, now);
}

async function loadChallengerSnapshot(): Promise<ChallengerSnapshot> {
  const now = new Date();
  const apiKey = process.env.FRED_API_KEY?.trim();
  if (!apiKey) {
    return buildUnscoredSnapshot({
      now,
      status: "configuration_required",
      warnings: ["FRED_API_KEY is not configured in the Live server environment."],
    });
  }

  const settled = await Promise.allSettled([
    ...FACTOR_SPECS.map((spec) => loadFactor(spec, isoDate(now), apiKey)),
    loadNextEvent(now, apiKey),
  ]);
  const factors = settled.slice(0, FACTOR_SPECS.length).map((result, index) => result.status === "fulfilled" ? result.value as ChallengerFactor : unavailableFactor(FACTOR_SPECS[index]));
  const eventResult = settled.at(-1);
  const nextEvent = eventResult?.status === "fulfilled" ? eventResult.value as ChallengerNextEvent | null : null;
  const unavailable = factors.filter((factor) => factor.dataStatus === "unavailable");
  const warnings = [
    ...(unavailable.length ? [`${unavailable.length} factor series could not be refreshed from FRED.`] : []),
    ...(!nextEvent ? ["No mapped Challenger release was found in the next 90 days."] : []),
  ];
  return buildUnscoredSnapshot({
    now,
    status: warnings.length ? "degraded" : "ready",
    factors,
    nextEvent,
    warnings,
  });
}

export const getChallengerSnapshot = unstable_cache(
  loadChallengerSnapshot,
  ["alchemy-challenger-live-snapshot-v1"],
  { revalidate: 300 },
);
