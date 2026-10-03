export const JAPAN_MOF_JGB_CURRENT_URL =
  "https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/jgbcme.csv";
export const JAPAN_MOF_JGB_HISTORY_URL =
  "https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/historical/jgbcme_all.csv";

export type JapanMofJgbProviderStatus = "OK" | "STALE" | "PARTIAL" | "UNAVAILABLE";

export type JapanMofJgbRow = {
  date: string;
  y2: number | null;
  y10: number | null;
  y30: number | null;
};

export type JapanMofJgbSnapshot = {
  status: JapanMofJgbProviderStatus;
  fetchedAt: string;
  asOf: string | null;
  sourceName: "Japan Ministry of Finance";
  sourceUrls: string[];
  latest: JapanMofJgbRow | null;
  previous5: JapanMofJgbRow | null;
  changes5dBp: {
    y2: number | null;
    y10: number | null;
    y30: number | null;
  };
  warnings: string[];
};

function parseNumber(value: string | undefined) {
  if (!value) return null;
  const cleaned = value.trim().replace(/,/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "n.a.") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value: string | undefined) {
  const raw = value?.trim() ?? "";
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!iso) return null;
  const [, year, month, day] = iso;
  const normalized = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return Number.isFinite(Date.parse(`${normalized}T00:00:00Z`)) ? normalized : null;
}

export function parseJapanMofJgbCsv(text: string): JapanMofJgbRow[] {
  const rows: JapanMofJgbRow[] = [];
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
    if (cells.length < 15) continue;
    const date = parseDate(cells[0]);
    if (!date) continue;

    rows.push({
      date,
      // MOF columns: Date,1,2,3,4,5,6,7,8,9,10,15,20,25,30,40.
      y2: parseNumber(cells[2]),
      y10: parseNumber(cells[10]),
      y30: parseNumber(cells[14]),
    });
  }

  return [...new Map(rows.map((row) => [row.date, row])).values()]
    .sort((left, right) => left.date.localeCompare(right.date));
}

function ageDays(value: string | null, now: Date) {
  if (!value) return Infinity;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? Math.max(0, (now.getTime() - parsed) / 86_400_000) : Infinity;
}

function bpChange(latest: number | null, previous: number | null) {
  return latest === null || previous === null
    ? null
    : Number(((latest - previous) * 100).toFixed(1));
}

async function fetchText(url: string, fetchImpl: typeof fetch) {
  const response = await fetchImpl(url, {
    headers: {
      accept: "text/csv,text/plain,*/*",
      "user-agent": "Alchemy Live Desk Japan-MOF JGB adapter",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

export async function fetchJapanMofJgbYields(
  now = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<JapanMofJgbSnapshot> {
  const fetchedAt = now.toISOString();
  const warnings: string[] = [];
  const results = await Promise.allSettled([
    fetchText(JAPAN_MOF_JGB_HISTORY_URL, fetchImpl),
    fetchText(JAPAN_MOF_JGB_CURRENT_URL, fetchImpl),
  ]);

  const texts = results.flatMap((result, index) => {
    if (result.status === "fulfilled") return [result.value];
    warnings.push(`${index === 0 ? "Historical" : "Current"} JGB CSV unavailable: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}.`);
    return [];
  });
  const rows = [...new Map(texts.flatMap(parseJapanMofJgbCsv).map((row) => [row.date, row])).values()]
    .sort((left, right) => left.date.localeCompare(right.date));

  const latest = rows.at(-1) ?? null;
  const previous5 = rows.length >= 6 ? rows.at(-6) ?? null : null;
  if (!latest) {
    return {
      status: "UNAVAILABLE",
      fetchedAt,
      asOf: null,
      sourceName: "Japan Ministry of Finance",
      sourceUrls: [JAPAN_MOF_JGB_HISTORY_URL, JAPAN_MOF_JGB_CURRENT_URL],
      latest: null,
      previous5: null,
      changes5dBp: { y2: null, y10: null, y30: null },
      warnings: warnings.length ? warnings : ["No valid JGB constant-maturity rows were parsed."],
    };
  }

  const missing = [
    latest.y2 === null ? "2Y" : null,
    latest.y10 === null ? "10Y" : null,
    latest.y30 === null ? "30Y" : null,
  ].filter((value): value is string => Boolean(value));
  if (missing.length) warnings.push(`Latest JGB row is missing ${missing.join(", ")}.`);
  if (!previous5) warnings.push("Fewer than six daily JGB observations are available, so 5D changes are unresolved.");
  const stale = ageDays(latest.date, now) > 7;
  if (stale) warnings.push(`Latest JGB observation ${latest.date} is more than seven calendar days old.`);

  const status: JapanMofJgbProviderStatus = stale
    ? "STALE"
    : missing.length || !previous5
      ? "PARTIAL"
      : "OK";

  return {
    status,
    fetchedAt,
    asOf: latest.date,
    sourceName: "Japan Ministry of Finance",
    sourceUrls: [JAPAN_MOF_JGB_HISTORY_URL, JAPAN_MOF_JGB_CURRENT_URL],
    latest,
    previous5,
    changes5dBp: {
      y2: bpChange(latest.y2, previous5?.y2 ?? null),
      y10: bpChange(latest.y10, previous5?.y10 ?? null),
      y30: bpChange(latest.y30, previous5?.y30 ?? null),
    },
    warnings,
  };
}
