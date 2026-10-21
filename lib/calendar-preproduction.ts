import { getEconomicCalendar, type EconomicCalendarEvent } from "./calendar.ts";
import { fetchTradingEconomicsUsCalendarSnapshot, type TradingEconomicsCalendarEvent } from "./providers/trading-economics-calendar.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";

/**
 * Existing scheduled Live research slots own this pre-publication calendar QA.
 * Dates must come from an official release calendar, forecasts from a
 * point-in-time pre-release capture, and actuals from independent official
 * post-release collectors. Provider "latest" is not historical consensus.
 */
export type CalendarPreproductionResult = {
  status: "READY" | "DEGRADED";
  checkedAt: string;
  officialUpcoming: number;
  futureDueWithinSevenDays: number;
  consensusCaptured: number;
  noConsensus: number;
  provider: "trading_economics" | "unconfigured" | "unavailable";
  warnings: string[];
};

type Release = {
  id: string;
  release_name: string;
  release_date: string;
  reference_period: string | null;
  consensus: string | null;
  consensus_captured_at: string | null;
  actual: string | null;
  status: string;
};
type Metric = {
  release_id: string;
  metric_key: string;
  consensus: number | null;
  consensus_captured_at: string | null;
};

function family(name: string) {
  if (/consumer price index|\bcpi\b/i.test(name)) return "CPI";
  if (/producer price index|\bppi\b/i.test(name)) return "PPI";
  if (/employment situation|nonfarm payroll/i.test(name)) return "NFP";
  if (/jolts|job openings/i.test(name)) return "JOLTS";
  if (/ism manufacturing/i.test(name)) return "ISM_MFG";
  if (/ism services/i.test(name)) return "ISM_SERVICES";
  return null;
}
function metricForProvider(fam: string, event: string): string | null {
  if (fam === "CPI") {
    if (!/\b(?:inflation rate|consumer price index|core cpi|core inflation)\b/i.test(event)) return null;
    const core = /\bcore\b/i.test(event);
    const mom = /\b(?:mom|month.over.month|monthly)\b/i.test(event);
    const yoy = /\b(?:yoy|year.over.year|annual)\b/i.test(event);
    if (mom === yoy) return null;
    return "cpi_" + (core ? "core" : "headline") + "_" + (mom ? "mom" : "yoy");
  }
  // More metric families can be enabled only after official unit/reference
  // identity fixtures. Do not treat NFP change as total payroll levels.
  return null;
}
function monthKey(text: string | null) {
  if (!text) return null;
  const m = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  if (m) return m[1].toLowerCase() + ":" + m[2];
  const short = text.match(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[/\s-]*((?:20)?\d{2})\b/i);
  if (!short) return null;
  const ix = "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC".split(" ").indexOf(short[1].toUpperCase());
  const year = short[2].length === 2 ? "20" + short[2] : short[2];
  return "january february march april may june july august september october november december".split(" ")[ix] + ":" + year;
}
function sameSourceDate(release: Release, provider: TradingEconomicsCalendarEvent): boolean {
  const due = Date.parse(release.release_date);
  const reported = Date.parse(provider.date);
  // Calendar vendors are not authorised to move an official release time.
  // A matched provider event must be within 12h on its original ET date.
  return Number.isFinite(due) && Number.isFinite(reported)
    && Math.abs(due - reported) <= 12 * 60 * 60 * 1000
    && Boolean(monthKey(release.reference_period))
    && monthKey(release.reference_period) === monthKey(provider.reference);
}
export function preReleaseConsensusCandidates(input: {
  releases: readonly Release[];
  metrics: readonly Metric[];
  provider: readonly TradingEconomicsCalendarEvent[];
  capturedAt: string;
}) {
  const at = Date.parse(input.capturedAt);
  if (!Number.isFinite(at)) return [];
  const results: Array<{ releaseId: string; metricKey: string; value: number; source: string; capturedAt: string }> = [];
  for (const release of input.releases) {
    const due = Date.parse(release.release_date);
    if (!Number.isFinite(due) || due <= at || release.actual || release.status === "completed") continue;
    const fam = family(release.release_name);
    if (!fam) continue;
    for (const metric of input.metrics.filter(x => x.release_id === release.id && x.consensus === null && !x.consensus_captured_at)) {
      const matches = input.provider.filter(row => (
        sameSourceDate(release, row)
        && row.consensus !== null
        && row.parsedConsensus !== null
        && metricForProvider(fam, row.event) === metric.metric_key
        // Vendor must not be showing a post-release actual or revision.
        && row.actual === null
        && (!row.lastUpdate || (Number.isFinite(Date.parse(row.lastUpdate))
          && Date.parse(row.lastUpdate) <= at && Date.parse(row.lastUpdate) < due))
      ));
      // Ambiguous overlapping vendor series are NOT "resolved" by choosing
      // the first one; fail closed until a publisher mapping is reviewed.
      if (matches.length !== 1) continue;
      const item = matches[0];
      // Require an exact percentage metric and a plausible rate, not 1.2K,
      // index level, raw CPI value, or another transformation.
      if (!/^cpi_(?:headline|core)_(?:mom|yoy)$/.test(metric.metric_key)
        || !Number.isFinite(item.parsedConsensus)
        || Math.abs(item.parsedConsensus!) > 50
        || !/%/.test(item.consensus ?? "")) continue;
      results.push({
        releaseId: release.id,
        metricKey: metric.metric_key,
        value: item.parsedConsensus!,
        source: "https://tradingeconomics.com/calendar/api",
        capturedAt: input.capturedAt,
      });
    }
  }
  return results;
}

const CPI_KEYS = [
  { key:"cpi_headline_mom",label:"Headline CPI m/m",transformation:"mom" },
  { key:"cpi_headline_yoy",label:"Headline CPI y/y",transformation:"yoy" },
  { key:"cpi_core_mom",label:"Core CPI m/m",transformation:"mom" },
  { key:"cpi_core_yoy",label:"Core CPI y/y",transformation:"yoy" },
] as const;

/** Insert only empty observation schemas, never forecast values or rewritten
 * actuals. Existing CPI post-release ingestion fills these same stable keys. */
export function futureCpiMetricSeedRows(
  releases: readonly Release[], metrics: readonly Metric[], at: string,
) {
  const already = new Set(metrics.map(x=>x.release_id+":"+x.metric_key));
  return releases.filter(release =>
    family(release.release_name)==="CPI"
    && release.release_date>at && !release.actual
    && Boolean(monthKey(release.reference_period))
  ).flatMap(release=>CPI_KEYS.filter(item=>!already.has(release.id+":"+item.key)).map(item=>({
    release_id:release.id, metric_key:item.key, label:item.label,
    transformation:item.transformation, unit:"%",
    source_url:"https://www.bls.gov/schedule/news_release/cpi.htm",
    metadata:{sourceRole:"future_measurement_schema_only",forecastStatus:"NOT_CAPTURED"},
  })));
}

export async function runCalendarPreproductionCheck({
  now = new Date(),
  calendarEvents,
  providerApiKey = process.env.TRADING_ECONOMICS_API_KEY,
  providerFetch = fetchTradingEconomicsUsCalendarSnapshot,
}: {
  now?: Date;
  calendarEvents?: EconomicCalendarEvent[];
  providerApiKey?: string;
  providerFetch?: typeof fetchTradingEconomicsUsCalendarSnapshot;
} = {}): Promise<CalendarPreproductionResult> {
  const checkedAt = now.toISOString();
  const calendar = calendarEvents ?? await getEconomicCalendar();
  const official = calendar.filter(row =>
    row.sourceKind !== "desk-record" && row.sourceUrl.startsWith("https://")
    && row.date >= checkedAt.slice(0,10) && row.date <= new Date(now.getTime()+45*86_400_000).toISOString().slice(0,10));
  const withinSeven = official.filter(row =>
    row.date <= new Date(now.getTime()+7*86_400_000).toISOString().slice(0,10));
  const warnings: string[] = [];
  if (!official.length) warnings.push("NO_UPCOMING_OFFICIAL_RELEASE_DATES");
  if (!official.some(row => row.sourceKind === "official-live")) {
    warnings.push("LIVE_OFFICIAL_CALENDAR_SOURCE_UNAVAILABLE");
  }
  const client = createSupabaseAdminClient();
  const { data: releases, error: releaseError } = await client.from("macro_releases")
    .select("id,release_name,release_date,reference_period,consensus,consensus_captured_at,actual,status")
    .gt("release_date", checkedAt)
    .lt("release_date", new Date(now.getTime()+45*86_400_000).toISOString())
    .order("release_date",{ascending:true}).limit(120);
  if (releaseError) throw new Error("Calendar pre-production release lookup failed: "+releaseError.message);
  const listed = releases ?? [];
  const ids = listed.map(r => r.id);
  const { data: existingMetrics, error: existingMetricError } = ids.length
    ? await client.from("macro_release_metrics").select("release_id,metric_key,consensus,consensus_captured_at").in("release_id",ids).limit(250)
    : {data:[],error:null};
  if(existingMetricError) throw new Error("Calendar pre-production metric preflight failed: "+existingMetricError.message);
  const seed = futureCpiMetricSeedRows(listed, existingMetrics ?? [], checkedAt);
  if(seed.length) {
    const {error:seedError}=await client.from("macro_release_metrics").upsert(seed,{
      onConflict:"release_id,metric_key",ignoreDuplicates:true,
    });
    if(seedError) throw new Error("Calendar pre-production metric seed failed: "+seedError.message);
  }
  const { data: metrics, error: metricError } = ids.length
    ? await client.from("macro_release_metrics").select("release_id,metric_key,consensus,consensus_captured_at").in("release_id",ids).limit(250)
    : {data:[],error:null};
  if (metricError) throw new Error("Calendar pre-production metric lookup failed: "+metricError.message);
  const missing = (metrics ?? []).filter(x=>x.consensus === null || !x.consensus_captured_at).length;
  let consensusCaptured = 0;
  let provider: CalendarPreproductionResult["provider"] = "unconfigured";
  if (providerApiKey?.trim()) {
    const from = new Date(now.getTime()-86_400_000);
    const to = new Date(now.getTime()+45*86_400_000);
    const snapshot = await providerFetch({apiKey:providerApiKey,from,to});
    provider = snapshot.state === "ready" ? "trading_economics" : "unavailable";
    if (snapshot.state !== "ready") warnings.push("CONSENSUS_PROVIDER_"+snapshot.state.toUpperCase());
    if (snapshot.state === "ready") {
      const candidates = preReleaseConsensusCandidates({
        releases:listed, metrics:metrics ?? [], provider:snapshot.events, capturedAt:checkedAt,
      });
      for(const candidate of candidates) {
        // Compare-and-swap; one immutable FIRST pre-release receipt per
        // comparable metric. Post-release/revised vendor data cannot overwrite.
        const { data, error } = await client.from("macro_release_metrics")
          .update({
            consensus: candidate.value, consensus_source:candidate.source,
            consensus_captured_at:candidate.capturedAt,
          })
          .eq("release_id",candidate.releaseId).eq("metric_key",candidate.metricKey)
          .is("consensus",null).is("consensus_captured_at",null)
          .select("id");
        if(error) warnings.push("FORECAST_CAPTURE_WRITE_FAILED:"+candidate.metricKey);
        else consensusCaptured += data?.length ?? 0;
      }
    }
  } else {
    warnings.push("CONSENSUS_PROVIDER_UNCONFIGURED");
  }
  if(missing>consensusCaptured) warnings.push("PRE_RELEASE_CONSENSUS_GAPS:"+String(missing-consensusCaptured));
  return {
    status:warnings.length?"DEGRADED":"READY",checkedAt,
    officialUpcoming:official.length,futureDueWithinSevenDays:withinSeven.length,
    consensusCaptured,noConsensus:Math.max(0,missing-consensusCaptured),provider,warnings,
  };
}
