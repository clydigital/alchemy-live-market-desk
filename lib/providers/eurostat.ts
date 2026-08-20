export const EUROSTAT_STATISTICS_BASE_URL = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";
export const EUROSTAT_SOURCE_NAME = "Eurostat" as const;

export type EurostatObservation = {
  flatIndex: number;
  dimensions: Record<string, string>;
  labels: Record<string, string>;
  value: number | null;
  status: string | null;
};

export type EurostatDataset = {
  datasetCode: string;
  label: string | null;
  source: string | null;
  updated: string | null;
  dimensionIds: string[];
  sizes: number[];
  observations: EurostatObservation[];
  sourceUrl: string;
};

export type EurostatSnapshot = {
  state: "ready" | "unavailable";
  retrievedAt: string;
  sourceName: typeof EUROSTAT_SOURCE_NAME;
  dataset: EurostatDataset | null;
  note: string | null;
};

type JsonObject = Record<string, unknown>;
type EurostatFilters = Record<string, string | string[]>;

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeEurostatDatasetCode(value: string) {
  const code = value.trim();
  if (!/^[A-Za-z0-9_.-]+$/.test(code)) throw new Error("Eurostat dataset code is invalid.");
  return code;
}

function normaliseFilters(filters: EurostatFilters) {
  const entries = Object.entries(filters);
  if (entries.length === 0) throw new Error("Eurostat query must include at least one bounded filter.");
  if ("geo" in filters && "geoLevel" in filters) {
    throw new Error("Eurostat geo and geoLevel filters are mutually exclusive.");
  }

  let totalPositions = 0;
  const normalized: Array<[string, string[]]> = [];
  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.trim();
    if (!/^[A-Za-z0-9_.-]+$/.test(key)) throw new Error("Eurostat filter key is invalid.");
    const values = (Array.isArray(rawValue) ? rawValue : [rawValue])
      .map((item) => item.trim())
      .filter(Boolean);
    if (values.length === 0) throw new Error(`Eurostat filter ${key} has no values.`);
    totalPositions += values.length;
    normalized.push([key, values]);
  }
  if (totalPositions > 50) throw new Error("Eurostat query exceeds the 50-position safety bound.");

  const lastPeriod = normalized.find(([key]) => key === "lastTimePeriod");
  if (lastPeriod) {
    if (lastPeriod[1].length !== 1 || !/^\d+$/.test(lastPeriod[1][0])) {
      throw new Error("Eurostat lastTimePeriod must be one positive integer.");
    }
    const n = Number(lastPeriod[1][0]);
    if (n < 1 || n > 24) throw new Error("Eurostat lastTimePeriod must be between 1 and 24.");
  }

  return normalized;
}

export function buildEurostatStatisticsUrl(datasetCode: string, filters: EurostatFilters) {
  const code = normalizeEurostatDatasetCode(datasetCode);
  const normalized = normaliseFilters(filters);
  const params = new URLSearchParams();
  params.set("format", "JSON");
  params.set("lang", "EN");
  for (const [key, values] of normalized) {
    for (const value of values) params.append(key, value);
  }
  return `${EUROSTAT_STATISTICS_BASE_URL}/${encodeURIComponent(code)}?${params.toString()}`;
}

function orderedCategoryCodes(dimension: JsonObject, expectedSize: number) {
  const category = asObject(dimension.category);
  if (!category) throw new Error("Eurostat dimension has no category metadata.");
  const index = category.index;
  let codes: string[] = [];

  if (Array.isArray(index)) {
    codes = index.filter((item): item is string => typeof item === "string");
  } else {
    const indexObject = asObject(index);
    if (!indexObject) throw new Error("Eurostat dimension category index is malformed.");
    const ranked = Object.entries(indexObject).flatMap(([code, position]) => {
      const n = finiteNumber(position);
      return n !== null && Number.isInteger(n) && n >= 0 ? [{ code, position: n }] : [];
    });
    ranked.sort((a, b) => a.position - b.position || a.code.localeCompare(b.code));
    codes = ranked.map((item) => item.code);
  }

  if (codes.length !== expectedSize) {
    throw new Error(`Eurostat dimension expected ${expectedSize} categories but found ${codes.length}.`);
  }

  const rawLabels = asObject(category.label) ?? {};
  const labels: Record<string, string> = {};
  for (const code of codes) labels[code] = text(rawLabels[code]) ?? code;
  return { codes, labels };
}

function flatValue(container: unknown, index: number): unknown {
  if (Array.isArray(container)) return container[index];
  const object = asObject(container);
  if (!object) return undefined;
  return object[String(index)];
}

function decodeFlatIndex(flatIndex: number, sizes: number[]) {
  const positions = new Array<number>(sizes.length);
  let remainder = flatIndex;
  for (let i = sizes.length - 1; i >= 0; i -= 1) {
    positions[i] = remainder % sizes[i];
    remainder = Math.floor(remainder / sizes[i]);
  }
  return positions;
}

export function parseEurostatJsonStat(
  payload: unknown,
  datasetCode: string,
  sourceUrl: string,
  maxCells = 5_000,
): EurostatDataset {
  const root = asObject(payload);
  if (!root) throw new Error("Eurostat payload is not an object.");
  if (text(root.class) !== "dataset") throw new Error("Eurostat payload is not a JSON-stat dataset.");

  const ids = Array.isArray(root.id)
    ? root.id.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
  const sizes = Array.isArray(root.size)
    ? root.size.map((item) => finiteNumber(item))
    : [];
  if (ids.length === 0 || sizes.length !== ids.length || sizes.some((item) => item === null || !Number.isInteger(item) || item <= 0)) {
    throw new Error("Eurostat dimension id/size metadata is malformed.");
  }
  const cleanSizes = sizes as number[];
  const cellCount = cleanSizes.reduce((acc, item) => acc * item, 1);
  if (!Number.isSafeInteger(cellCount) || cellCount > maxCells) {
    throw new Error(`Eurostat response exceeds the ${maxCells}-cell safety bound.`);
  }

  const dimensionsRoot = asObject(root.dimension);
  if (!dimensionsRoot) throw new Error("Eurostat payload has no dimension metadata.");
  const categoryByDimension: Record<string, { codes: string[]; labels: Record<string, string> }> = {};
  ids.forEach((id, index) => {
    const dimension = asObject(dimensionsRoot[id]);
    if (!dimension) throw new Error(`Eurostat dimension ${id} is missing.`);
    categoryByDimension[id] = orderedCategoryCodes(dimension, cleanSizes[index]);
  });

  if (!Array.isArray(root.value) && !asObject(root.value)) {
    throw new Error("Eurostat payload has no value container.");
  }

  const observations: EurostatObservation[] = [];
  for (let flatIndex = 0; flatIndex < cellCount; flatIndex += 1) {
    const rawValue = flatValue(root.value, flatIndex);
    const rawStatus = flatValue(root.status, flatIndex);
    const value = finiteNumber(rawValue);
    const status = text(rawStatus);
    if (value === null && status === null) continue;

    const positions = decodeFlatIndex(flatIndex, cleanSizes);
    const dimensions: Record<string, string> = {};
    const labels: Record<string, string> = {};
    ids.forEach((id, dimIndex) => {
      const code = categoryByDimension[id].codes[positions[dimIndex]];
      dimensions[id] = code;
      labels[id] = categoryByDimension[id].labels[code] ?? code;
    });
    observations.push({ flatIndex, dimensions, labels, value, status });
  }

  return {
    datasetCode: normalizeEurostatDatasetCode(datasetCode),
    label: text(root.label),
    source: text(root.source),
    updated: text(root.updated),
    dimensionIds: ids,
    sizes: cleanSizes,
    observations,
    sourceUrl,
  };
}

function unavailable(retrievedAt: string, note: string): EurostatSnapshot {
  return {
    state: "unavailable",
    retrievedAt,
    sourceName: EUROSTAT_SOURCE_NAME,
    dataset: null,
    note,
  };
}

export async function fetchEurostatSensor(options: {
  datasetCode: string;
  filters: EurostatFilters;
  maxCells?: number;
  fetchImpl?: typeof fetch;
}): Promise<EurostatSnapshot> {
  const retrievedAt = new Date().toISOString();
  let sourceUrl: string;
  try {
    sourceUrl = buildEurostatStatisticsUrl(options.datasetCode, options.filters);
  } catch (error) {
    return unavailable(retrievedAt, error instanceof Error ? error.message : "Eurostat query is invalid.");
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(sourceUrl, {
      headers: { accept: "application/json", "user-agent": "Alchemy Live Desk Eurostat adapter" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return unavailable(retrievedAt, `Eurostat returned HTTP ${response.status}.`);
    const dataset = parseEurostatJsonStat(
      await response.json(),
      options.datasetCode,
      sourceUrl,
      options.maxCells ?? 5_000,
    );
    return {
      state: "ready",
      retrievedAt,
      sourceName: EUROSTAT_SOURCE_NAME,
      dataset,
      note: null,
    };
  } catch (error) {
    return unavailable(
      retrievedAt,
      error instanceof Error ? `Eurostat unavailable: ${error.message}` : "Eurostat unavailable.",
    );
  }
}
