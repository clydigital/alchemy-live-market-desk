import { fetchJinaReader } from "../acquisition/jina-reader.ts";
import { createSupabaseAdminClient } from "../supabase/admin.ts";

export type OfficialMacroRelease = {
  id: string;
  release_name: string;
  agency: string;
  release_date: string;
  reference_period: string | null;
  actual: string | null;
  status: string;
  source_url: string;
};

export type OfficialActualResolution = {
  actual: string;
  sourceUrl: string;
};

export type OfficialActualIngestionResult = {
  attempted: number;
  completed: number;
  failed: number;
  skipped: number;
  completedReleaseIds: string[];
  failedReleaseIds: string[];
  note: string;
};

type ReferenceMonth = {
  year: number;
  month: number;
  fullName: string;
  shortName: string;
};

type BlsPoint = {
  year: string;
  period: string;
  periodName?: string;
  value: string;
};

type BlsSeries = {
  seriesID: string;
  data: BlsPoint[];
};

type BlsResponse = {
  status?: string;
  message?: string[];
  Results?: { series?: BlsSeries[] };
};

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
] as const;

const BLS_API_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
const CPI_SERIES = ["CUSR0000SA0", "CUUR0000SA0", "CUSR0000SA0L1E", "CUUR0000SA0L1E"] as const;
const PPI_SERIES = ["WPSFD4", "WPUFD4"] as const;
const JOLTS_SERIES = ["JTS000000000000000JOL"] as const;

function htmlToText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&reg;|&#174;/gi, "®")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function signed(action: string, value: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (/decreas|fell|declin|down/i.test(action)) return `-${number}`;
  return `+${number}`;
}

function archiveDate(releaseDate: string) {
  const date = new Date(releaseDate);
  if (!Number.isFinite(date.getTime())) return null;
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${month}${day}${date.getUTCFullYear()}`;
}

function referenceMonthName(referencePeriod: string | null) {
  if (!referencePeriod) return null;
  const normalized = referencePeriod.trim().toLocaleLowerCase("en-US");
  return MONTHS.find((candidate) => normalized.startsWith(candidate) || normalized.startsWith(candidate.slice(0, 3))) ?? null;
}

function parseReferenceMonth(referencePeriod: string | null): ReferenceMonth | null {
  const monthName = referenceMonthName(referencePeriod);
  const yearMatch = referencePeriod?.match(/\b(20\d{2})\b/);
  if (!monthName || !yearMatch) return null;
  return {
    year: Number(yearMatch[1]),
    month: MONTHS.indexOf(monthName) + 1,
    fullName: `${monthName[0].toUpperCase()}${monthName.slice(1)}`,
    shortName: `${monthName.slice(0, 3)[0].toUpperCase()}${monthName.slice(1, 3)}`,
  };
}

function expectedReference(text: string, referencePeriod: string | null) {
  if (!referencePeriod) return true;
  const normalized = text.toLocaleLowerCase("en-US");
  const parsed = parseReferenceMonth(referencePeriod);
  if (!parsed) return normalized.includes(referencePeriod.toLocaleLowerCase("en-US"));
  return normalized.includes(`${parsed.fullName.toLocaleLowerCase("en-US")} ${parsed.year}`)
    || normalized.includes(`${parsed.shortName.toLocaleLowerCase("en-US")} ${parsed.year}`);
}

function periodCode(month: number) {
  return `M${String(month).padStart(2, "0")}`;
}

function previousMonth(reference: ReferenceMonth) {
  return reference.month === 1
    ? { year: reference.year - 1, month: 12 }
    : { year: reference.year, month: reference.month - 1 };
}

function pointValue(series: BlsSeries | undefined, year: number, month: number) {
  const point = series?.data?.find((candidate) => candidate.year === String(year) && candidate.period === periodCode(month));
  const value = Number(point?.value);
  return Number.isFinite(value) ? value : null;
}

function percentChange(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current / previous) - 1) * 100;
}

function signedPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  const rounded = Math.abs(value) < 0.05 ? 0 : Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}`;
}

function isBlsRelease(release: OfficialMacroRelease) {
  return /consumer price index|producer price index|jolts|job openings/i.test(release.release_name);
}

function blsSeriesForRelease(release: OfficialMacroRelease): readonly string[] | null {
  if (/consumer price index/i.test(release.release_name)) return CPI_SERIES;
  if (/producer price index/i.test(release.release_name)) return PPI_SERIES;
  if (/jolts|job openings/i.test(release.release_name)) return JOLTS_SERIES;
  return null;
}

async function resolveBlsApiActual(release: OfficialMacroRelease, fetcher: typeof fetch): Promise<OfficialActualResolution> {
  const reference = parseReferenceMonth(release.reference_period);
  const seriesIds = blsSeriesForRelease(release);
  const sourceUrl = officialActualSourceUrl(release);
  if (!reference || !seriesIds || !sourceUrl) throw new Error(`BLS API adapter requires a monthly reference period for ${release.release_name}.`);

  const response = await fetcher(BLS_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "Alchemy Live Market Desk official macro actual collector",
    },
    body: JSON.stringify({
      seriesid: seriesIds,
      startyear: String(reference.year - 1),
      endyear: String(reference.year),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`BLS Public Data API returned HTTP ${response.status}.`);
  const payload = await response.json() as BlsResponse;
  if (payload.status !== "REQUEST_SUCCEEDED") {
    throw new Error(`BLS Public Data API request failed${payload.message?.length ? `: ${payload.message.join(" ")}` : "."}`);
  }
  const series = new Map((payload.Results?.series ?? []).map((item) => [item.seriesID, item]));
  const priorMonth = previousMonth(reference);

  if (/consumer price index/i.test(release.release_name)) {
    const headlineCurrent = pointValue(series.get(CPI_SERIES[0]), reference.year, reference.month);
    const headlinePrevious = pointValue(series.get(CPI_SERIES[0]), priorMonth.year, priorMonth.month);
    const headlineYearAgo = pointValue(series.get(CPI_SERIES[1]), reference.year - 1, reference.month);
    const headlineNsaCurrent = pointValue(series.get(CPI_SERIES[1]), reference.year, reference.month);
    const coreCurrent = pointValue(series.get(CPI_SERIES[2]), reference.year, reference.month);
    const corePrevious = pointValue(series.get(CPI_SERIES[2]), priorMonth.year, priorMonth.month);
    const coreYearAgo = pointValue(series.get(CPI_SERIES[3]), reference.year - 1, reference.month);
    const coreNsaCurrent = pointValue(series.get(CPI_SERIES[3]), reference.year, reference.month);
    if ([headlineCurrent, headlinePrevious, headlineYearAgo, headlineNsaCurrent, coreCurrent, corePrevious, coreYearAgo, coreNsaCurrent].some((value) => value === null)) {
      throw new Error(`BLS Public Data API did not return all CPI observations required for ${release.reference_period}.`);
    }
    const mom = signedPercent(percentChange(headlineCurrent!, headlinePrevious!));
    const yoy = signedPercent(percentChange(headlineNsaCurrent!, headlineYearAgo!));
    const coreMom = signedPercent(percentChange(coreCurrent!, corePrevious!));
    const coreYoy = signedPercent(percentChange(coreNsaCurrent!, coreYearAgo!));
    if (!mom || !yoy || !coreMom || !coreYoy) throw new Error(`Could not calculate CPI Actuals for ${release.reference_period}.`);
    return { actual: `Headline CPI ${mom}% m/m; ${yoy}% y/y; Core ${coreMom}% m/m; ${coreYoy}% y/y`, sourceUrl };
  }

  if (/producer price index/i.test(release.release_name)) {
    const current = pointValue(series.get(PPI_SERIES[0]), reference.year, reference.month);
    const previous = pointValue(series.get(PPI_SERIES[0]), priorMonth.year, priorMonth.month);
    const nsaCurrent = pointValue(series.get(PPI_SERIES[1]), reference.year, reference.month);
    const yearAgo = pointValue(series.get(PPI_SERIES[1]), reference.year - 1, reference.month);
    if ([current, previous, nsaCurrent, yearAgo].some((value) => value === null)) {
      throw new Error(`BLS Public Data API did not return all PPI observations required for ${release.reference_period}.`);
    }
    const mom = signedPercent(percentChange(current!, previous!));
    const yoy = signedPercent(percentChange(nsaCurrent!, yearAgo!));
    if (!mom || !yoy) throw new Error(`Could not calculate PPI Actuals for ${release.reference_period}.`);
    return { actual: `Final demand PPI ${mom}% m/m; ${yoy}% y/y`, sourceUrl };
  }

  const openings = pointValue(series.get(JOLTS_SERIES[0]), reference.year, reference.month);
  if (openings === null) throw new Error(`BLS Public Data API did not return JOLTS job openings for ${release.reference_period}.`);
  const millions = (openings / 1_000).toFixed(1).replace(/\.0$/, "");
  return { actual: `Job openings ${millions}M`, sourceUrl };
}

export function officialActualSourceUrl(release: OfficialMacroRelease) {
  const archive = archiveDate(release.release_date);
  if (/consumer price index/i.test(release.release_name) && archive) {
    return `https://www.bls.gov/news.release/archives/cpi_${archive}.htm`;
  }
  if (/producer price index/i.test(release.release_name) && archive) {
    return `https://www.bls.gov/news.release/archives/ppi_${archive}.htm`;
  }
  if (/jolts|job openings/i.test(release.release_name) && archive) {
    return `https://www.bls.gov/news.release/archives/jolts_${archive}.htm`;
  }
  const month = referenceMonthName(release.reference_period);
  if (/ism manufacturing/i.test(release.release_name) && month) {
    return `https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/pmi/${month}/`;
  }
  if (/ism services/i.test(release.release_name) && month) {
    return `https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/services/${month}/`;
  }
  return null;
}

export function parseOfficialActual(release: OfficialMacroRelease, body: string): OfficialActualResolution | null {
  const sourceUrl = officialActualSourceUrl(release);
  if (!sourceUrl) return null;
  const text = htmlToText(body);
  if (!expectedReference(text, release.reference_period)) return null;

  if (/consumer price index/i.test(release.release_name)) {
    const headline = text.match(/Consumer Price Index for All Urban Consumers \(CPI-U\) (increased|rose|decreased|fell) ([0-9.]+) percent[^.]{0,120}? in [A-Za-z]+/i);
    const annual = text.match(/all items index (?:increased|rose) ([0-9.]+) percent (?:before seasonal adjustment|for the 12 months ending [A-Za-z]+)/i);
    const core = text.match(/index for all items less food and energy (?:rose|increased|decreased|fell) ([0-9.]+) percent[^.]{0,80}?(?:after|in) /i);
    const coreAnnual = text.match(/all items less food and energy index (?:rose|increased) ([0-9.]+) percent over the year/i);
    if (!headline) return null;
    const mom = signed(headline[1], headline[2]);
    if (!mom) return null;
    return {
      actual: [
        `Headline CPI ${mom}% m/m`,
        annual ? `+${annual[1]}% y/y` : null,
        core ? `Core ${signed("increased", core[1])}% m/m` : null,
        coreAnnual ? `+${coreAnnual[1]}% y/y` : null,
      ].filter(Boolean).join("; "),
      sourceUrl,
    };
  }

  if (/producer price index/i.test(release.release_name)) {
    const unchanged = text.match(/Producer Price Index for final demand was unchanged in [A-Za-z]+/i);
    const move = text.match(/Producer Price Index for final demand (increased|rose|decreased|fell) ([0-9.]+) percent in [A-Za-z]+/i);
    const annual = text.match(/final demand (?:increased|rose) ([0-9.]+) percent for the 12 months ended in [A-Za-z]+/i);
    if (!unchanged && !move) return null;
    const mom = unchanged ? "0.0" : signed(move![1], move![2]);
    return {
      actual: [`Final demand PPI ${mom}% m/m`, annual ? `+${annual[1]}% y/y` : null].filter(Boolean).join("; "),
      sourceUrl,
    };
  }

  if (/jolts|job openings/i.test(release.release_name)) {
    const openings = text.match(/number of job openings (?:was|were) [^.]{0,60}? at ([0-9.]+) million/i)
      || text.match(/job openings[^.]{0,60}? at ([0-9.]+) million/i);
    if (!openings) return null;
    return { actual: `Job openings ${openings[1]}M`, sourceUrl };
  }

  if (/ism manufacturing/i.test(release.release_name)) {
    const pmi = text.match(/Manufacturing PMI[^.]{0,120}?registered ([0-9.]+) percent/i)
      || text.match(/Manufacturing PMI[^0-9]{0,60}?([0-9.]+)%/i);
    if (!pmi) return null;
    return { actual: `Manufacturing PMI ${pmi[1]}`, sourceUrl };
  }

  if (/ism services/i.test(release.release_name)) {
    const pmi = text.match(/Services PMI[^.]{0,120}?registered ([0-9.]+) percent/i)
      || text.match(/Services PMI[^0-9]{0,60}?([0-9.]+)%/i);
    if (!pmi) return null;
    return { actual: `Services PMI ${pmi[1]}`, sourceUrl };
  }

  return null;
}

async function resolveIsmActual(release: OfficialMacroRelease, fetcher: typeof fetch): Promise<OfficialActualResolution> {
  const sourceUrl = officialActualSourceUrl(release);
  if (!sourceUrl) throw new Error(`No deterministic official Actual adapter exists for ${release.release_name}.`);

  let directStatus: number | null = null;
  try {
    const response = await fetcher(sourceUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Alchemy Live Market Desk official macro actual collector",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    directStatus = response.status;
    if (response.ok) {
      const parsed = parseOfficialActual(release, await response.text());
      if (parsed) return parsed;
    }
  } catch {
    // A reader transport for the same first-party source is attempted below.
  }

  const reader = await fetchJinaReader({
    sourceUrl,
    apiKey: process.env.JINA_API_KEY,
    fetchImpl: fetcher,
    timeoutMs: 12_000,
  });
  if (reader.ok) {
    const parsed = parseOfficialActual(release, reader.text);
    if (parsed) return parsed;
  }

  const directDetail = directStatus === null ? "direct transport failed" : `direct HTTP ${directStatus}`;
  const readerDetail = reader.ok ? "reader returned no matching reference-period Actual" : `reader ${reader.errorCode || "failed"}`;
  throw new Error(`Official ISM source could not be resolved for ${release.reference_period || "reference period"} (${directDetail}; ${readerDetail}).`);
}

export async function resolveOfficialActual(
  release: OfficialMacroRelease,
  fetcher: typeof fetch = fetch,
): Promise<OfficialActualResolution> {
  if (isBlsRelease(release)) return resolveBlsApiActual(release, fetcher);
  if (/ism manufacturing|ism services/i.test(release.release_name)) return resolveIsmActual(release, fetcher);
  throw new Error(`No deterministic official Actual adapter exists for ${release.release_name}.`);
}

export async function ingestOfficialMacroActuals(options: { now?: Date; fetcher?: typeof fetch } = {}): Promise<OfficialActualIngestionResult> {
  const now = options.now ?? new Date();
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("macro_releases")
    .select("id,release_name,agency,release_date,reference_period,actual,status,source_url")
    .is("actual", null)
    .lte("release_date", now.toISOString())
    .in("status", ["scheduled", "pre_release", "ingestion_pending", "released_pending_ingestion", "stale_error"])
    .order("release_date", { ascending: true })
    .limit(24)
    .returns<OfficialMacroRelease[]>();
  if (error) throw new Error(`Could not read overdue macro releases: ${error.message}`);

  let attempted = 0;
  let completed = 0;
  let failed = 0;
  let skipped = 0;
  const completedReleaseIds: string[] = [];
  const failedReleaseIds: string[] = [];

  for (const release of data ?? []) {
    const sourceUrl = officialActualSourceUrl(release);
    if (!sourceUrl) {
      skipped += 1;
      continue;
    }
    attempted += 1;
    const attemptedAt = now.toISOString();
    await client.from("macro_releases").update({
      last_ingestion_attempt_at: attemptedAt,
      ingestion_attempt_status: "running",
      lifecycle_evaluated_at: attemptedAt,
    }).eq("id", release.id).is("actual", null);

    try {
      const resolved = await resolveOfficialActual(release, options.fetcher ?? fetch);
      const { error: updateError } = await client.from("macro_releases").update({
        actual: resolved.actual,
        status: "completed",
        source_url: resolved.sourceUrl,
        actual_retrieved_at: attemptedAt,
        released_at: release.release_date,
        last_ingestion_attempt_at: attemptedAt,
        ingestion_attempt_status: "completed",
        ingestion_retry_exhausted: false,
        ingestion_gap_reason: null,
        lifecycle_evaluated_at: attemptedAt,
        updated_at: attemptedAt,
      }).eq("id", release.id).is("actual", null);
      if (updateError) throw new Error(updateError.message);
      completed += 1;
      completedReleaseIds.push(release.id);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      await client.from("macro_releases").update({
        status: "released_pending_ingestion",
        last_ingestion_attempt_at: attemptedAt,
        ingestion_attempt_status: "failed_retryable",
        ingestion_retry_exhausted: false,
        ingestion_gap_reason: reason.slice(0, 500),
        lifecycle_evaluated_at: attemptedAt,
        updated_at: attemptedAt,
      }).eq("id", release.id).is("actual", null);
      failed += 1;
      failedReleaseIds.push(release.id);
    }
  }

  return {
    attempted,
    completed,
    failed,
    skipped,
    completedReleaseIds,
    failedReleaseIds,
    note: attempted
      ? `${completed}/${attempted} supported overdue official Actuals ingested; ${failed} remain retryable.`
      : "No supported overdue official Actuals required ingestion.",
  };
}
