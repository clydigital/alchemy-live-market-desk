export const BUNDESBANK_BUND10_SERIES = "BBSSY.D.REN.EUR.A630.000000WT1010.A";
export const BUNDESBANK_BUND10_URL =
  "https://api.statistiken.bundesbank.de/rest/data/BBSSY/D.REN.EUR.A630.000000WT1010.A?format=text_csv&lang=en&detail=dataonly&lastNObservations=6";

export type SovereignYieldObservation = {
  date: string;
  yieldPct: number;
};

export type BundesbankBund10Snapshot = {
  status: "OK" | "PARTIAL" | "STALE" | "UNAVAILABLE";
  fetchedAt: string;
  sourceName: "Deutsche Bundesbank";
  sourceUrl: typeof BUNDESBANK_BUND10_URL;
  series: typeof BUNDESBANK_BUND10_SERIES;
  latest: SovereignYieldObservation | null;
  previous5: SovereignYieldObservation | null;
  change5dBp: number | null;
  warnings: string[];
};

function csvCells(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseBundesbankSdmxCsv(text: string): SovereignYieldObservation[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const header = csvCells(lines[0]).map((cell) => cell.replace(/^"|"$/g, ""));
  const dateIndex = header.findIndex((cell) => cell === "TIME_PERIOD");
  const valueIndex = header.findIndex((cell) => cell === "OBS_VALUE");
  if (dateIndex < 0 || valueIndex < 0) return [];

  const observations: SovereignYieldObservation[] = [];
  for (const line of lines.slice(1)) {
    const cells = csvCells(line).map((cell) => cell.replace(/^"|"$/g, ""));
    const date = cells[dateIndex]?.trim();
    const value = Number(cells[valueIndex]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !Number.isFinite(value)) continue;
    observations.push({ date, yieldPct: value });
  }
  return [...new Map(observations.map((item) => [item.date, item])).values()]
    .sort((a, b) => a.date.localeCompare(b.date));
}

function ageDays(date: string | null, now: Date) {
  if (!date) return Infinity;
  const parsed = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(parsed) ? Math.max(0, (now.getTime() - parsed) / 86_400_000) : Infinity;
}

export async function fetchBundesbankBund10(
  now = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<BundesbankBund10Snapshot> {
  const fetchedAt = now.toISOString();
  try {
    const response = await fetchImpl(BUNDESBANK_BUND10_URL, {
      headers: {
        accept: "text/csv",
        "accept-language": "en",
        "user-agent": "Alchemy Live Desk Bundesbank Bund adapter",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = parseBundesbankSdmxCsv(await response.text());
    const latest = rows.at(-1) ?? null;
    const previous5 = rows.length >= 6 ? rows.at(-6) ?? null : null;
    const warnings: string[] = [];
    if (!latest) warnings.push("No valid Bundesbank 10Y Bund observations were parsed.");
    if (latest && !previous5) warnings.push("Fewer than six Bund observations are available, so 5D change is unresolved.");
    const stale = latest ? ageDays(latest.date, now) > 7 : false;
    if (stale) warnings.push(`Latest Bund observation ${latest?.date} is more than seven calendar days old.`);

    return {
      status: !latest ? "UNAVAILABLE" : stale ? "STALE" : previous5 ? "OK" : "PARTIAL",
      fetchedAt,
      sourceName: "Deutsche Bundesbank",
      sourceUrl: BUNDESBANK_BUND10_URL,
      series: BUNDESBANK_BUND10_SERIES,
      latest,
      previous5,
      change5dBp: latest && previous5
        ? Number(((latest.yieldPct - previous5.yieldPct) * 100).toFixed(1))
        : null,
      warnings,
    };
  } catch (error) {
    return {
      status: "UNAVAILABLE",
      fetchedAt,
      sourceName: "Deutsche Bundesbank",
      sourceUrl: BUNDESBANK_BUND10_URL,
      series: BUNDESBANK_BUND10_SERIES,
      latest: null,
      previous5: null,
      change5dBp: null,
      warnings: [`Bundesbank Bund acquisition failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}
