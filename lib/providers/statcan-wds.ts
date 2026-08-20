export const STATCAN_WDS_BASE = "https://www150.statcan.gc.ca/t1/wds/rest";
export const STATCAN_SOURCE_NAME = "Statistics Canada Web Data Service" as const;
export const STATCAN_VECTOR_BATCH_LIMIT = 50;

export type StatCanChangedSeries = {
  vectorId: number;
  productId: number;
  coordinate: string;
  releaseTime: string | null;
};

export type StatCanSeriesInfo = {
  vectorId: number;
  productId: number;
  coordinate: string;
  frequencyCode: number | null;
  scalarFactorCode: number | null;
  decimals: number | null;
  terminated: boolean | null;
  titleEn: string | null;
  titleFr: string | null;
  memberUomCode: number | null;
};

export type StatCanDataPoint = {
  refPer: string | null;
  refPer2: string | null;
  refPerRaw: string | null;
  refPerRaw2: string | null;
  value: number | null;
  decimals: number | null;
  scalarFactorCode: number | null;
  symbolCode: number | null;
  statusCode: number | null;
  securityLevelCode: number | null;
  releaseTime: string | null;
};

export type StatCanVectorDetails = {
  vectorId: number;
  productId: number | null;
  coordinate: string | null;
  seriesInfo: StatCanSeriesInfo | null;
  changedDataPoints: StatCanDataPoint[];
};

export type StatCanChangedSeriesSnapshot = {
  state: "ready" | "unavailable";
  retrievedAt: string;
  sourceName: typeof STATCAN_SOURCE_NAME;
  sourceUrl: string;
  changedSeries: StatCanChangedSeries[];
  note: string | null;
};

export type StatCanVectorDetailsSnapshot = {
  state: "ready" | "partial" | "unavailable";
  retrievedAt: string;
  sourceName: typeof STATCAN_SOURCE_NAME;
  requestedVectorIds: number[];
  vectors: StatCanVectorDetails[];
  note: string | null;
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function integer(value: unknown): number | null {
  const parsed = numeric(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function responseObject(value: unknown): JsonRecord | null {
  if (!isRecord(value)) return null;
  if (isRecord(value.object)) return value.object;
  return value;
}

function findArrayPayload(value: unknown, depth = 0): unknown[] {
  if (depth > 4) return [];
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  if (Array.isArray(value.object)) return value.object;
  if (value.object !== undefined) return findArrayPayload(value.object, depth + 1);
  return [];
}

export function parseStatCanChangedSeriesList(payload: unknown): StatCanChangedSeries[] {
  const rows = findArrayPayload(payload);
  const out: StatCanChangedSeries[] = [];
  for (const item of rows) {
    const row = responseObject(item);
    if (!row) continue;
    const responseStatusCode = integer(row.responseStatusCode);
    if (responseStatusCode !== null && responseStatusCode !== 0) continue;
    const vectorId = integer(row.vectorId);
    const productId = integer(row.productId);
    const coordinate = text(row.coordinate);
    if (vectorId === null || vectorId <= 0 || productId === null || productId <= 0 || !coordinate) continue;
    out.push({
      vectorId,
      productId,
      coordinate,
      releaseTime: text(row.releaseTime),
    });
  }
  out.sort((a, b) => a.vectorId - b.vectorId);
  return out;
}

export function parseStatCanSeriesInfo(payload: unknown): StatCanSeriesInfo[] {
  const rows = findArrayPayload(payload);
  const out: StatCanSeriesInfo[] = [];
  for (const item of rows) {
    const row = responseObject(item);
    if (!row) continue;
    const responseStatusCode = integer(row.responseStatusCode);
    if (responseStatusCode !== null && responseStatusCode !== 0) continue;
    const vectorId = integer(row.vectorId);
    const productId = integer(row.productId);
    const coordinate = text(row.coordinate);
    if (vectorId === null || vectorId <= 0 || productId === null || productId <= 0 || !coordinate) continue;
    const terminated = integer(row.terminated);
    out.push({
      vectorId,
      productId,
      coordinate,
      frequencyCode: integer(row.frequencyCode),
      scalarFactorCode: integer(row.scalarFactorCode ?? row.scalorFactorCode),
      decimals: integer(row.decimals),
      terminated: terminated === null ? null : terminated === 1,
      titleEn: text(row.SeriesTitleEn ?? row.seriesTitleEn),
      titleFr: text(row.SeriesTitleFr ?? row.seriesTitleFr),
      memberUomCode: integer(row.memberUomCode),
    });
  }
  out.sort((a, b) => a.vectorId - b.vectorId);
  return out;
}

export function parseStatCanChangedSeriesData(payload: unknown): Map<number, StatCanDataPoint[]> {
  const rows = findArrayPayload(payload);
  const out = new Map<number, StatCanDataPoint[]>();
  for (const item of rows) {
    const row = responseObject(item);
    if (!row) continue;
    const responseStatusCode = integer(row.responseStatusCode);
    if (responseStatusCode !== null && responseStatusCode !== 0) continue;
    const vectorId = integer(row.vectorId);
    if (vectorId === null || vectorId <= 0 || !Array.isArray(row.vectorDataPoint)) continue;
    const points: StatCanDataPoint[] = [];
    for (const pointValue of row.vectorDataPoint) {
      if (!isRecord(pointValue)) continue;
      points.push({
        refPer: text(pointValue.refPer),
        refPer2: text(pointValue.refPer2),
        refPerRaw: text(pointValue.refPerRaw),
        refPerRaw2: text(pointValue.refPerRaw2),
        value: numeric(pointValue.value),
        decimals: integer(pointValue.decimals),
        scalarFactorCode: integer(pointValue.scalarFactorCode),
        symbolCode: integer(pointValue.symbolCode),
        statusCode: integer(pointValue.statusCode),
        securityLevelCode: integer(pointValue.securityLevelCode),
        releaseTime: text(pointValue.releaseTime),
      });
    }
    points.sort((a, b) => (a.refPer || "").localeCompare(b.refPer || ""));
    out.set(vectorId, points);
  }
  return out;
}

function normalizeVectorIds(vectorIds: number[]) {
  const normalized = [...new Set(vectorIds.filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b);
  if (normalized.length > STATCAN_VECTOR_BATCH_LIMIT) {
    throw new Error(`Statistics Canada vector batch exceeds ${STATCAN_VECTOR_BATCH_LIMIT}; batch explicitly rather than silently truncating.`);
  }
  return normalized;
}

async function parseJsonResponse(response: Response) {
  const body = await response.text();
  if (!body.trim()) throw new Error("Statistics Canada returned an empty response body.");
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error("Statistics Canada returned malformed JSON.");
  }
}

function httpNote(status: number) {
  if (status === 409) return "Statistics Canada WDS is temporarily unavailable/locked while tables are updating (HTTP 409).";
  return `Statistics Canada WDS returned HTTP ${status}.`;
}

export async function fetchStatCanChangedSeriesList(options?: {
  fetchImpl?: typeof fetch;
}): Promise<StatCanChangedSeriesSnapshot> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const sourceUrl = `${STATCAN_WDS_BASE}/getChangedSeriesList`;
  const retrievedAt = new Date().toISOString();
  try {
    const response = await fetchImpl(sourceUrl, {
      headers: { accept: "application/json", "user-agent": "Alchemy Live Desk StatCan WDS adapter" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return { state: "unavailable", retrievedAt, sourceName: STATCAN_SOURCE_NAME, sourceUrl, changedSeries: [], note: httpNote(response.status) };
    }
    const payload = await parseJsonResponse(response);
    const changedSeries = parseStatCanChangedSeriesList(payload);
    return {
      state: "ready",
      retrievedAt,
      sourceName: STATCAN_SOURCE_NAME,
      sourceUrl,
      changedSeries,
      note: changedSeries.length === 0 ? "Statistics Canada returned no changed series for the current release window." : null,
    };
  } catch (error) {
    return {
      state: "unavailable",
      retrievedAt,
      sourceName: STATCAN_SOURCE_NAME,
      sourceUrl,
      changedSeries: [],
      note: error instanceof Error ? `Statistics Canada WDS unavailable: ${error.message}` : "Statistics Canada WDS unavailable.",
    };
  }
}

async function postVectors(endpoint: string, vectorIds: number[], fetchImpl: typeof fetch) {
  const response = await fetchImpl(`${STATCAN_WDS_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "Alchemy Live Desk StatCan WDS adapter",
    },
    body: JSON.stringify(vectorIds.map((vectorId) => ({ vectorId }))),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(httpNote(response.status));
  return parseJsonResponse(response);
}

export async function fetchStatCanVectorDetails(
  vectorIdsInput: number[],
  options?: { fetchImpl?: typeof fetch },
): Promise<StatCanVectorDetailsSnapshot> {
  const retrievedAt = new Date().toISOString();
  let requestedVectorIds: number[];
  try {
    requestedVectorIds = normalizeVectorIds(vectorIdsInput);
  } catch (error) {
    return {
      state: "unavailable",
      retrievedAt,
      sourceName: STATCAN_SOURCE_NAME,
      requestedVectorIds: [],
      vectors: [],
      note: error instanceof Error ? error.message : "Statistics Canada vector request is invalid.",
    };
  }
  if (requestedVectorIds.length === 0) {
    return { state: "ready", retrievedAt, sourceName: STATCAN_SOURCE_NAME, requestedVectorIds, vectors: [], note: "No vectors requested." };
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const [infoResult, dataResult] = await Promise.allSettled([
    postVectors("getSeriesInfoFromVector", requestedVectorIds, fetchImpl),
    postVectors("getChangedSeriesDataFromVector", requestedVectorIds, fetchImpl),
  ]);

  const info = infoResult.status === "fulfilled" ? parseStatCanSeriesInfo(infoResult.value) : [];
  const data = dataResult.status === "fulfilled" ? parseStatCanChangedSeriesData(dataResult.value) : new Map<number, StatCanDataPoint[]>();
  const infoByVector = new Map(info.map((item) => [item.vectorId, item]));
  const vectors: StatCanVectorDetails[] = requestedVectorIds.map((vectorId) => {
    const seriesInfo = infoByVector.get(vectorId) || null;
    return {
      vectorId,
      productId: seriesInfo?.productId ?? null,
      coordinate: seriesInfo?.coordinate ?? null,
      seriesInfo,
      changedDataPoints: data.get(vectorId) || [],
    };
  });

  if (infoResult.status === "rejected" && dataResult.status === "rejected") {
    return {
      state: "unavailable",
      retrievedAt,
      sourceName: STATCAN_SOURCE_NAME,
      requestedVectorIds,
      vectors: [],
      note: `Statistics Canada metadata and changed-data calls failed: ${String(infoResult.reason)}; ${String(dataResult.reason)}`,
    };
  }
  if (infoResult.status === "rejected" || dataResult.status === "rejected") {
    const failed = infoResult.status === "rejected" ? "series metadata" : "changed data";
    return {
      state: "partial",
      retrievedAt,
      sourceName: STATCAN_SOURCE_NAME,
      requestedVectorIds,
      vectors,
      note: `Statistics Canada returned partial vector detail because ${failed} was unavailable.`,
    };
  }
  return { state: "ready", retrievedAt, sourceName: STATCAN_SOURCE_NAME, requestedVectorIds, vectors, note: null };
}
