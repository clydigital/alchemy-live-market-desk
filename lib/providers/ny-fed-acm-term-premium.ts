import * as XLSX from "@e965/xlsx";

export const NY_FED_ACM_TERM_PREMIUM_URL =
  "https://www.newyorkfed.org/medialibrary/media/research/data_indicators/ACMTermPremium.xls";
export const NY_FED_ACM_TERM_PREMIA_PAGE =
  "https://www.newyorkfed.org/research/data_indicators/term-premia-tabs";

export type NyFedAcmProviderStatus = "OK" | "STALE" | "UNAVAILABLE";

export type NyFedAcmTermPremiumObservation = {
  date: string;
  termPremium10yPct: number;
};

export type NyFedAcmTermPremiumSnapshot = {
  status: NyFedAcmProviderStatus;
  fetchedAt: string;
  asOf: string | null;
  sourceName: "Federal Reserve Bank of New York · ACM Treasury Term Premia";
  sourceUrl: string;
  observations: NyFedAcmTermPremiumObservation[];
  latest: NyFedAcmTermPremiumObservation | null;
  prior5Sessions: NyFedAcmTermPremiumObservation | null;
  change5dBp: number | null;
  warnings: string[];
};

const SHEET_NAME = "ACM Daily";
const DATE_HEADER = "DATE";
const VALUE_HEADER = "ACMTP10";
const MAX_WORKBOOK_BYTES = 20 * 1024 * 1024;
const HISTORICAL_REPLAY_TOLERANCE_MS = 3 * 24 * 60 * 60 * 1000;

function finite(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return null;
  const monthByName: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const month = monthByName[match[2].toLowerCase()];
  const day = Number(match[1]);
  const year = Number(match[3]);
  if (!month || !Number.isInteger(day) || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return date.toISOString().slice(0, 10);
}

function workbookRows(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (!bytes.byteLength || bytes.byteLength > MAX_WORKBOOK_BYTES) {
    throw new Error(`ACM workbook size ${bytes.byteLength} bytes is outside the governed bound.`);
  }

  const workbook = XLSX.read(bytes, { type: "array", cellDates: false });
  const candidateNames = [
    SHEET_NAME,
    ...workbook.SheetNames.filter((name) => name !== SHEET_NAME),
  ];

  for (const name of candidateNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    });
    const headerIndex = rows.findIndex((row) => {
      const values = row.map((cell) => String(cell ?? "").trim());
      return values.includes(DATE_HEADER) && values.includes(VALUE_HEADER);
    });
    if (headerIndex >= 0) return { rows, headerIndex };
  }

  throw new Error(`ACM workbook has no sheet containing ${DATE_HEADER} and ${VALUE_HEADER}.`);
}

export function parseNyFedAcmTermPremium(
  buffer: ArrayBuffer | Uint8Array,
  asOf = new Date(),
  fetchedAt = new Date(),
): NyFedAcmTermPremiumSnapshot {
  const { rows, headerIndex } = workbookRows(buffer);
  const headers = rows[headerIndex].map((cell) => String(cell ?? "").trim());
  const dateIndex = headers.indexOf(DATE_HEADER);
  const valueIndex = headers.indexOf(VALUE_HEADER);
  const cutoff = asOf.toISOString().slice(0, 10);

  const observations = rows.slice(headerIndex + 1).flatMap((row) => {
    const date = isoDate(row[dateIndex]);
    const termPremium10yPct = finite(row[valueIndex]);
    if (!date || termPremium10yPct === null || date > cutoff) return [];
    return [{ date, termPremium10yPct } satisfies NyFedAcmTermPremiumObservation];
  })
    .sort((a, b) => a.date.localeCompare(b.date));

  const latest = observations.at(-1) ?? null;
  const prior5Sessions = observations.length >= 6 ? observations.at(-6) ?? null : null;
  const change5dBp = latest && prior5Sessions
    ? Number(((latest.termPremium10yPct - prior5Sessions.termPremium10yPct) * 100).toFixed(1))
    : null;
  const warnings: string[] = [];

  if (!latest) {
    warnings.push("No ACMTP10 observations at or before the requested as-of date were parsed.");
  }

  const latestMs = latest ? Date.parse(`${latest.date}T00:00:00.000Z`) : NaN;
  const ageDays = Number.isFinite(latestMs)
    ? Math.max(0, (asOf.getTime() - latestMs) / 86_400_000)
    : Infinity;
  const stale = ageDays > 10;
  if (stale && latest) {
    warnings.push(`Latest ACMTP10 observation ${latest.date} is more than 10 calendar days old.`);
  }
  if (latest && !prior5Sessions) {
    warnings.push("Fewer than six usable ACM daily observations are present; five-session change is unavailable.");
  }

  return {
    status: !latest ? "UNAVAILABLE" : stale ? "STALE" : "OK",
    fetchedAt: fetchedAt.toISOString(),
    asOf: latest?.date ?? null,
    sourceName: "Federal Reserve Bank of New York · ACM Treasury Term Premia",
    sourceUrl: NY_FED_ACM_TERM_PREMIA_PAGE,
    observations: observations.slice(-12),
    latest,
    prior5Sessions,
    change5dBp,
    warnings,
  };
}

export async function fetchNyFedAcmTermPremium(options: {
  asOf?: Date;
  now?: Date;
  fetchImpl?: typeof fetch;
} = {}): Promise<NyFedAcmTermPremiumSnapshot> {
  const asOf = options.asOf ?? new Date();
  const now = options.now ?? new Date();
  const fetchImpl = options.fetchImpl ?? fetch;

  // The workbook is re-estimated over time and the NY Fed does not publish
  // machine-readable historical vintages. Refuse old replay dates rather than
  // backfill a current vintage into a historical Dossier.
  if (now.getTime() - asOf.getTime() > HISTORICAL_REPLAY_TOLERANCE_MS) {
    return {
      status: "UNAVAILABLE",
      fetchedAt: now.toISOString(),
      asOf: null,
      sourceName: "Federal Reserve Bank of New York · ACM Treasury Term Premia",
      sourceUrl: NY_FED_ACM_TERM_PREMIA_PAGE,
      observations: [],
      latest: null,
      prior5Sessions: null,
      change5dBp: null,
      warnings: [
        "Current ACM workbook is not admitted into historical replay because the NY Fed workbook is revised and historical vintages are not exposed by this adapter.",
      ],
    };
  }

  try {
    const response = await fetchImpl(NY_FED_ACM_TERM_PREMIUM_URL, {
      headers: {
        accept: "application/vnd.ms-excel,application/octet-stream;q=0.9,*/*;q=0.1",
        "user-agent": "Alchemy Live Desk ACM term-premium adapter",
      },
      next: { revalidate: 60 * 60 * 6 },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentLength = finite(response.headers.get("content-length"));
    if (contentLength !== null && contentLength > MAX_WORKBOOK_BYTES) {
      throw new Error(`ACM workbook content-length ${contentLength} exceeds the governed bound.`);
    }

    const buffer = await response.arrayBuffer();
    return parseNyFedAcmTermPremium(buffer, asOf, now);
  } catch (error) {
    return {
      status: "UNAVAILABLE",
      fetchedAt: now.toISOString(),
      asOf: null,
      sourceName: "Federal Reserve Bank of New York · ACM Treasury Term Premia",
      sourceUrl: NY_FED_ACM_TERM_PREMIA_PAGE,
      observations: [],
      latest: null,
      prior5Sessions: null,
      change5dBp: null,
      warnings: [`NY Fed ACM term-premium acquisition failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}
