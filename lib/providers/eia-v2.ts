export const EIA_WEEKLY_PETROLEUM_ROUTE = "https://api.eia.gov/v2/petroleum/sum/sndw/data/";

export const EIA_WEEKLY_SERIES = {
  crudeStocksExSpr: { id: "WCESTUS1", label: "Crude stocks excluding SPR" },
  gasolineStocks: { id: "WGTSTUS1", label: "Total gasoline stocks" },
  distillateStocks: { id: "WDISTUS1", label: "Distillate fuel oil stocks" },
  refineryUtilisation: { id: "WPULEUS3", label: "Refinery operable utilisation" },
  refineryCrudeInputs: { id: "WCRRIUS2", label: "Refiner net input of crude oil" },
  crudeProduction: { id: "WCRFPUS2", label: "Field production of crude oil" },
  sprStocks: { id: "WCSSTUS1", label: "Crude oil stocks in SPR" },
  gasolineProductSupplied: { id: "WGFUPUS2", label: "Finished motor gasoline product supplied" },
} as const;

export type EiaWeeklyMetricKey = keyof typeof EIA_WEEKLY_SERIES;

export type EiaWeeklyObservation = {
  period: string;
  value: number;
  units: string | null;
};

export type EiaWeeklyMetric = {
  key: EiaWeeklyMetricKey;
  seriesId: string;
  label: string;
  latest: EiaWeeklyObservation;
  previous: EiaWeeklyObservation | null;
};

export type EiaWeeklyPetroleumSnapshot = {
  state: "ready" | "unconfigured" | "unavailable";
  asOf: string | null;
  metrics: Partial<Record<EiaWeeklyMetricKey, EiaWeeklyMetric>>;
  sourceName: "U.S. Energy Information Administration";
  sourceUrl: string;
  note: string | null;
};

type EiaRow = {
  period?: unknown;
  series?: unknown;
  value?: unknown;
  units?: unknown;
};

const ID_TO_KEY = new Map<string, EiaWeeklyMetricKey>(
  Object.entries(EIA_WEEKLY_SERIES).map(([key, value]) => [value.id, key as EiaWeeklyMetricKey]),
);

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseEiaWeeklyPetroleumPayload(payload: unknown): EiaWeeklyPetroleumSnapshot {
  const response = payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as { response?: unknown }).response
    : null;
  const data = response && typeof response === "object" && !Array.isArray(response)
    ? (response as { data?: unknown }).data
    : null;
  if (!Array.isArray(data)) {
    return {
      state: "unavailable",
      asOf: null,
      metrics: {},
      sourceName: "U.S. Energy Information Administration",
      sourceUrl: EIA_WEEKLY_PETROLEUM_ROUTE,
      note: "EIA returned a response without a valid data array.",
    };
  }

  const grouped = new Map<EiaWeeklyMetricKey, EiaWeeklyObservation[]>();
  for (const raw of data as EiaRow[]) {
    const seriesId = stringValue(raw.series);
    const key = seriesId ? ID_TO_KEY.get(seriesId) : undefined;
    const period = stringValue(raw.period);
    const value = numberValue(raw.value);
    if (!key || !period || value === null) continue;
    const observation: EiaWeeklyObservation = {
      period,
      value,
      units: stringValue(raw.units),
    };
    grouped.set(key, [...(grouped.get(key) || []), observation]);
  }

  const metrics: Partial<Record<EiaWeeklyMetricKey, EiaWeeklyMetric>> = {};
  for (const [key, observations] of grouped) {
    const ordered = [...observations].sort((a, b) => b.period.localeCompare(a.period));
    if (!ordered.length) continue;
    const definition = EIA_WEEKLY_SERIES[key];
    metrics[key] = {
      key,
      seriesId: definition.id,
      label: definition.label,
      latest: ordered[0],
      previous: ordered[1] || null,
    };
  }

  const available = Object.values(metrics);
  return {
    state: available.length ? "ready" : "unavailable",
    asOf: available.map((metric) => metric?.latest.period || "").sort().at(-1) || null,
    metrics,
    sourceName: "U.S. Energy Information Administration",
    sourceUrl: EIA_WEEKLY_PETROLEUM_ROUTE,
    note: available.length
      ? null
      : "EIA returned no valid observations for the configured weekly petroleum series.",
  };
}

export function buildEiaWeeklyPetroleumUrl(apiKey: string) {
  const url = new URL(EIA_WEEKLY_PETROLEUM_ROUTE);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("frequency", "weekly");
  url.searchParams.set("data[0]", "value");
  for (const definition of Object.values(EIA_WEEKLY_SERIES)) {
    url.searchParams.append("facets[series][]", definition.id);
  }
  url.searchParams.set("sort[0][column]", "period");
  url.searchParams.set("sort[0][direction]", "desc");
  url.searchParams.set("offset", "0");
  url.searchParams.set("length", "200");
  return url.toString();
}

export async function fetchEiaWeeklyPetroleumSnapshot(
  apiKey = process.env.EIA_API_KEY?.trim(),
): Promise<EiaWeeklyPetroleumSnapshot> {
  if (!apiKey) {
    return {
      state: "unconfigured",
      asOf: null,
      metrics: {},
      sourceName: "U.S. Energy Information Administration",
      sourceUrl: EIA_WEEKLY_PETROLEUM_ROUTE,
      note: "EIA_API_KEY is not configured.",
    };
  }

  try {
    const response = await fetch(buildEiaWeeklyPetroleumUrl(apiKey), {
      headers: {
        accept: "application/json",
        "user-agent": "Alchemy Live Desk EIA v2 adapter",
      },
      next: { revalidate: 15 * 60 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return {
        state: "unavailable",
        asOf: null,
        metrics: {},
        sourceName: "U.S. Energy Information Administration",
        sourceUrl: EIA_WEEKLY_PETROLEUM_ROUTE,
        note: `EIA Open Data API returned HTTP ${response.status}.`,
      };
    }
    return parseEiaWeeklyPetroleumPayload(await response.json());
  } catch (error) {
    return {
      state: "unavailable",
      asOf: null,
      metrics: {},
      sourceName: "U.S. Energy Information Administration",
      sourceUrl: EIA_WEEKLY_PETROLEUM_ROUTE,
      note: error instanceof Error ? `EIA Open Data API unavailable: ${error.message}` : "EIA Open Data API unavailable.",
    };
  }
}
