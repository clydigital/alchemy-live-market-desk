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

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
] as const;

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

function expectedReference(text: string, referencePeriod: string | null) {
  if (!referencePeriod) return true;
  return text.toLocaleLowerCase("en-US").includes(referencePeriod.toLocaleLowerCase("en-US"));
}

function archiveDate(releaseDate: string) {
  const date = new Date(releaseDate);
  if (!Number.isFinite(date.getTime())) return null;
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${month}${day}${date.getUTCFullYear()}`;
}

function referenceMonth(referencePeriod: string | null) {
  if (!referencePeriod) return null;
  const month = MONTHS.find((candidate) => referencePeriod.toLocaleLowerCase("en-US").startsWith(candidate));
  return month ?? null;
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
  const month = referenceMonth(release.reference_period);
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
    const pmi = text.match(/Manufacturing PMI[^.]{0,100}?registered ([0-9.]+) percent/i)
      || text.match(/Manufacturing PMI[^0-9]{0,40}?([0-9.]+)%/i);
    if (!pmi) return null;
    return { actual: `Manufacturing PMI ${pmi[1]}`, sourceUrl };
  }

  if (/ism services/i.test(release.release_name)) {
    const pmi = text.match(/Services PMI[^.]{0,100}?registered ([0-9.]+) percent/i)
      || text.match(/Services PMI[^0-9]{0,40}?([0-9.]+)%/i);
    if (!pmi) return null;
    return { actual: `Services PMI ${pmi[1]}`, sourceUrl };
  }

  return null;
}

export async function resolveOfficialActual(
  release: OfficialMacroRelease,
  fetcher: typeof fetch = fetch,
): Promise<OfficialActualResolution> {
  const sourceUrl = officialActualSourceUrl(release);
  if (!sourceUrl) throw new Error(`No deterministic official Actual adapter exists for ${release.release_name}.`);
  const response = await fetcher(sourceUrl, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "Alchemy Live Market Desk official macro actual collector",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Official source returned HTTP ${response.status}.`);
  const parsed = parseOfficialActual(release, await response.text());
  if (!parsed) throw new Error(`Official source did not contain a matching ${release.reference_period || "reference-period"} Actual.`);
  return parsed;
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
