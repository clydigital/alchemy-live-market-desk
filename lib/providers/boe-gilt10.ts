export const BOE_GILT10_SERIES = "IUDMNPY";
export const BOE_DATABASE_CSV_BASE =
  "https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp";

export type BoeGiltObservation = {
  date: string;
  yieldPct: number;
};

export type BoeGilt10Snapshot = {
  status: "OK" | "PARTIAL" | "STALE" | "UNAVAILABLE";
  fetchedAt: string;
  sourceName: "Bank of England";
  sourceUrl: string;
  series: typeof BOE_GILT10_SERIES;
  latest: BoeGiltObservation | null;
  previous5: BoeGiltObservation | null;
  change5dBp: number | null;
  warnings: string[];
};

function monthName(month: number) {
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][month] ?? "Jan";
}

function boeDate(date: Date) {
  return `${String(date.getUTCDate()).padStart(2, "0")}/${monthName(date.getUTCMonth())}/${date.getUTCFullYear()}`;
}

export function buildBoeGilt10Url(now = new Date()) {
  const from = new Date(now.getTime() - 45 * 86_400_000);
  const params = new URLSearchParams({
    "csv.x": "yes",
    Datefrom: boeDate(from),
    Dateto: "now",
    SeriesCodes: BOE_GILT10_SERIES,
    CSVF: "TN",
    UsingCodes: "Y",
    VPD: "Y",
    VFD: "N",
  });
  return `${BOE_DATABASE_CSV_BASE}?${params.toString()}`;
}

function parseDate(value: string) {
  const clean = value.trim().replace(/^"|"$/g, "");
  const iso = clean.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const uk = clean.match(/^(\d{1,2})[\s/-]([A-Za-z]{3})[\s/-](\d{2,4})$/);
  if (!uk) return null;
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const month = months.indexOf(uk[2].toLowerCase());
  if (month < 0) return null;
  const year = uk[3].length === 2 ? 2000 + Number(uk[3]) : Number(uk[3]);
  const normalized = `${year}-${String(month + 1).padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
  return Number.isFinite(Date.parse(`${normalized}T00:00:00Z`)) ? normalized : null;
}

export function parseBoeGiltCsv(text: string): BoeGiltObservation[] {
  const observations: BoeGiltObservation[] = [];
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
    if (cells.length < 2) continue;
    const date = parseDate(cells[0]);
    const value = Number(cells[1]);
    if (!date || !Number.isFinite(value)) continue;
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

export async function fetchBoeGilt10(
  now = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<BoeGilt10Snapshot> {
  const fetchedAt = now.toISOString();
  const sourceUrl = buildBoeGilt10Url(now);
  try {
    const response = await fetchImpl(sourceUrl, {
      headers: {
        accept: "text/csv,text/plain,*/*",
        "user-agent": "Alchemy Live Desk Bank-of-England gilt adapter",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = parseBoeGiltCsv(await response.text());
    const latest = rows.at(-1) ?? null;
    const previous5 = rows.length >= 6 ? rows.at(-6) ?? null : null;
    const warnings: string[] = [];
    if (!latest) warnings.push("No valid BoE 10Y gilt observations were parsed.");
    if (latest && !previous5) warnings.push("Fewer than six gilt observations are available, so 5D change is unresolved.");
    const stale = latest ? ageDays(latest.date, now) > 7 : false;
    if (stale) warnings.push(`Latest gilt observation ${latest?.date} is more than seven calendar days old.`);

    return {
      status: !latest ? "UNAVAILABLE" : stale ? "STALE" : previous5 ? "OK" : "PARTIAL",
      fetchedAt,
      sourceName: "Bank of England",
      sourceUrl,
      series: BOE_GILT10_SERIES,
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
      sourceName: "Bank of England",
      sourceUrl,
      series: BOE_GILT10_SERIES,
      latest: null,
      previous5: null,
      change5dBp: null,
      warnings: [`BoE gilt acquisition failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}
