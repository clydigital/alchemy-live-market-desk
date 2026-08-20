export const IMF_SDMX_BASE_URL = "https://api.imf.org/external/sdmx/3.0/data/dataflow";
export const IMF_SOURCE_NAME = "International Monetary Fund" as const;

export type ImfSdmxObservation = {
  timePeriod: string;
  value: number | null;
  status: string | null;
  fields: Record<string, string>;
};

export type ImfSdmxDataset = {
  agencyId: string;
  dataflowId: string;
  version: string;
  key: string;
  sourceUrl: string;
  observations: ImfSdmxObservation[];
};

export type ImfSdmxSnapshot = {
  state: "ready" | "unavailable";
  retrievedAt: string;
  sourceName: typeof IMF_SOURCE_NAME;
  dataset: ImfSdmxDataset | null;
  note: string | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function finiteNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateIdentifier(value: string, label: string) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9_.-]+$/.test(normalized)) throw new Error(`IMF ${label} is invalid.`);
  return normalized;
}

export function normalizeImfKey(value: string) {
  const key = value.trim();
  if (!key || !/^[A-Za-z0-9_+.*~-]+$/.test(key)) throw new Error("IMF SDMX key is invalid.");
  if (key === "*") throw new Error("IMF SDMX full-data wildcard is not allowed.");
  const segments = key.split(".");
  if (segments.some((segment) => !segment)) throw new Error("IMF SDMX key contains an empty dimension segment.");
  const wildcardCount = segments.filter((segment) => segment === "*").length;
  if (wildcardCount > 1) throw new Error("IMF SDMX key may contain at most one wildcard segment.");
  return key;
}

function validatePeriod(value: string, label: string) {
  const period = value.trim();
  if (!/^\d{4}(?:-(?:Q[1-4]|M(?:0[1-9]|1[0-2])|\d{2}))?$/.test(period)) {
    throw new Error(`IMF ${label} period is invalid.`);
  }
  return period;
}

export function buildImfSdmxUrl(options: {
  agencyId: string;
  dataflowId: string;
  key: string;
  startPeriod: string;
  endPeriod: string;
  version?: string;
}) {
  const agencyId = validateIdentifier(options.agencyId, "agency id");
  const dataflowId = validateIdentifier(options.dataflowId, "dataflow id");
  const version = options.version ? validateIdentifier(options.version, "version") : "~";
  const key = normalizeImfKey(options.key);
  const startPeriod = validatePeriod(options.startPeriod, "start");
  const endPeriod = validatePeriod(options.endPeriod, "end");
  if (startPeriod > endPeriod) throw new Error("IMF start period must not be after end period.");

  const params = new URLSearchParams({ startPeriod, endPeriod });
  return `${IMF_SDMX_BASE_URL}/${encodeURIComponent(agencyId)}/${encodeURIComponent(dataflowId)}/${encodeURIComponent(version)}/${key}?${params.toString()}`;
}

export function parseCsvRows(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (quoted) throw new Error("IMF CSV contains an unterminated quoted field.");
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

export function parseImfSdmxCsv(csvText: string): ImfSdmxObservation[] {
  const rows = parseCsvRows(csvText.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("IMF SDMX CSV has no data rows.");
  const headers = rows[0].map((item) => item.trim());
  const timeIndex = headers.indexOf("TIME_PERIOD");
  const valueIndex = headers.indexOf("OBS_VALUE");
  const statusIndex = headers.indexOf("OBS_STATUS");
  if (timeIndex < 0 || valueIndex < 0) throw new Error("IMF SDMX CSV is missing TIME_PERIOD or OBS_VALUE.");

  const observations: ImfSdmxObservation[] = [];
  for (const cells of rows.slice(1)) {
    if (cells.every((item) => !item.trim())) continue;
    if (cells.length !== headers.length) throw new Error("IMF SDMX CSV row width does not match header width.");
    const fields: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) fields[header] = cells[index]?.trim() ?? "";
    });
    const timePeriod = text(cells[timeIndex]);
    if (!timePeriod) continue;
    const value = finiteNumber(cells[valueIndex] ?? "");
    const status = statusIndex >= 0 ? text(cells[statusIndex]) || null : null;
    if (value === null && status === null) continue;
    observations.push({ timePeriod, value, status, fields });
  }
  return observations;
}

function unavailable(retrievedAt: string, note: string): ImfSdmxSnapshot {
  return {
    state: "unavailable",
    retrievedAt,
    sourceName: IMF_SOURCE_NAME,
    dataset: null,
    note,
  };
}

export async function fetchImfSdmxSensor(options: {
  agencyId: string;
  dataflowId: string;
  key: string;
  startPeriod: string;
  endPeriod: string;
  version?: string;
  maxRows?: number;
  fetchImpl?: typeof fetch;
}): Promise<ImfSdmxSnapshot> {
  const retrievedAt = new Date().toISOString();
  let sourceUrl: string;
  try {
    sourceUrl = buildImfSdmxUrl(options);
  } catch (error) {
    return unavailable(retrievedAt, error instanceof Error ? error.message : "IMF SDMX query is invalid.");
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(sourceUrl, {
      headers: {
        accept: "text/csv",
        "user-agent": "Alchemy Live Desk IMF SDMX adapter",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return unavailable(retrievedAt, `IMF SDMX returned HTTP ${response.status}.`);
    const observations = parseImfSdmxCsv(await response.text());
    const maxRows = options.maxRows ?? 5_000;
    if (observations.length > maxRows) {
      return unavailable(retrievedAt, `IMF SDMX response exceeds the ${maxRows}-row safety bound.`);
    }
    return {
      state: "ready",
      retrievedAt,
      sourceName: IMF_SOURCE_NAME,
      dataset: {
        agencyId: validateIdentifier(options.agencyId, "agency id"),
        dataflowId: validateIdentifier(options.dataflowId, "dataflow id"),
        version: options.version ? validateIdentifier(options.version, "version") : "~",
        key: normalizeImfKey(options.key),
        sourceUrl,
        observations,
      },
      note: null,
    };
  } catch (error) {
    return unavailable(
      retrievedAt,
      error instanceof Error ? `IMF SDMX unavailable: ${error.message}` : "IMF SDMX unavailable.",
    );
  }
}
