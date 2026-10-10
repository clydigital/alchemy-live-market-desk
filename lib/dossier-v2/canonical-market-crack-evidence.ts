import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "../supabase/admin.ts";
import { persistSensorMemory } from "../providers/sensor-memory-supabase.ts";
import { deriveMarketCrackObservations, type MarketCrackSeries } from "./market-crack-observations.ts";

const PROVIDER = "market_monitor_measured";
const METHODOLOGY = "market-crack-measured-v1";
const MAX_LIVE_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Allow only the expected exact Live provider instruments. A provider supplied
 * URL or friendly label is not sufficient to create canonical evidence.
 */
const ALLOWED_SOURCES: Record<string, { symbol: string; name: string; url: string }> = {
  "hy-oas": { symbol: "BAMLH0A0HYM2", name: "Federal Reserve Economic Data", url: "https://fred.stlouisfed.org/series/BAMLH0A0HYM2" },
  "ig-oas": { symbol: "BAMLC0A0CM", name: "Federal Reserve Economic Data", url: "https://fred.stlouisfed.org/series/BAMLC0A0CM" },
  smh: { symbol: "SMH", name: "Nasdaq official etf history", url: "https://www.nasdaq.com/market-activity/etf/smh/historical" },
  ndx: { symbol: "QQQ", name: "Nasdaq official etf history", url: "https://www.nasdaq.com/market-activity/etf/qqq/historical" },
  xlf: { symbol: "XLF", name: "Nasdaq official etf history", url: "https://www.nasdaq.com/market-activity/etf/xlf/historical" },
  rsp: { symbol: "RSP", name: "Nasdaq official etf history", url: "https://www.nasdaq.com/market-activity/etf/rsp/historical" },
  spx: { symbol: "SP500", name: "S&P Dow Jones Indices via FRED", url: "https://fred.stlouisfed.org/series/SP500" },
};

export type CanonicalMarketMeasurement = {
  id: string;
  claim: string;
  asOf: string;
  baselineDate: string;
  observedValue: number;
  unit: "basis_points" | "percentage_points";
  sources: Array<{ id: string; symbol: string; name: string; url: string; baseline: number; latest: number }>;
  affectedAssets: string[];
  contentHash: string;
};

/** No evidence writer should run on an immutable historical replay or a future date. */
export function buildCanonicalMarketMeasurements(
  rows: MarketCrackSeries[],
  asOf: string,
  now: string,
): { items: CanonicalMarketMeasurement[]; gaps: string[] } {
  const asOfMs = Date.parse(asOf), nowMs = Date.parse(now);
  if (!Number.isFinite(asOfMs) || !Number.isFinite(nowMs)
    || asOfMs > nowMs + 300_000 || nowMs - asOfMs > MAX_LIVE_AGE_MS) {
    return { items: [], gaps: ["HISTORICAL_OR_FUTURE_REPLAY"] };
  }
  const items: CanonicalMarketMeasurement[] = [], gaps: string[] = [];
  for (const observation of deriveMarketCrackObservations(rows, asOf)) {
    if (observation.status !== "OK" || observation.observedValue === null
      || !observation.lastDate || !observation.baselineDate) {
      gaps.push(observation.key + ":" + (observation.reason || "UNRESOLVED"));
      continue;
    }
    const verified = observation.sources.map((source) => {
      const expected = ALLOWED_SOURCES[source.id];
      if (!expected || source.symbol !== expected.symbol || source.sourceName !== expected.name
        || source.sourceUrl !== expected.url || source.frequency !== "daily") return null;
      const at = (day: string) => (source.points || []).filter((p) =>
        Number.isFinite(p.time) && new Date(p.time * 1000).toISOString().slice(0, 10) === day
        && Number.isFinite(p.close) && p.close > 0,
      );
      const baseline = at(observation.baselineDate!), latest = at(observation.lastDate!);
      if (baseline.length !== 1 || latest.length !== 1) return null;
      return {
        id: source.id, symbol: source.symbol, name: source.sourceName,
        url: source.sourceUrl, baseline: baseline[0].close, latest: latest[0].close,
      };
    });
    if (verified.some((item) => item === null)) {
      gaps.push(observation.key + ":SOURCE_IDENTITY_OR_INPUT_INTEGRITY_UNVERIFIED");
      continue;
    }
    const sources = verified as CanonicalMarketMeasurement["sources"];
    const id = observation.key + ":" + observation.baselineDate + ":" + observation.lastDate;
    const claim = observation.label + ": " + observation.observedValue
      + (observation.unit === "basis_points" ? " bp OAS-level change" : " percentage points price-return difference")
      + " over 20 matched trading sessions (" + observation.baselineDate + " to " + observation.lastDate + ")."
      + " Diagnostic cross-asset measurement only; no causal or Story-thesis conclusion.";
    const stable = JSON.stringify({ id, value: observation.observedValue, unit: observation.unit, sources });
    const contentHash = createHash("sha256").update(stable).digest("hex");
    items.push({
      id, claim, asOf: observation.lastDate + "T23:59:59.999Z",
      baselineDate: observation.baselineDate, observedValue: observation.observedValue,
      unit: observation.unit, sources, affectedAssets: sources.map((s) => s.symbol),
      contentHash,
    });
  }
  return { items, gaps };
}

/**
 * Uses existing append-only sensor memory and existing intelligence evidence
 * rather than creating another reasoning / pricing table.
 *
 * Changing input numbers for an already-persisted time window is NOT silently
 * merged: the candidate is held for revision adjudication.
 */
export async function persistCanonicalMarketMeasurements(
  rows: MarketCrackSeries[],
  asOf: string,
  now = new Date().toISOString(),
) {
  const candidates = buildCanonicalMarketMeasurements(rows, asOf, now);
  const client = createSupabaseAdminClient();
  const persisted: Array<{ id: string; evidenceId: string; observationId: string }> = [];
  const gaps = [...candidates.gaps];
  for (const item of candidates.items) {
    const externalEvidenceId = "market-crack:" + item.id;
    const { data: existing, error: existingError } = await client.from("intelligence_evidence")
      .select("id,content_hash")
      .eq("external_evidence_id", externalEvidenceId).limit(5);
    if (existingError) throw new Error("Could not check prior market evidence: " + existingError.message);
    if ((existing || []).some((row) => row.content_hash !== item.contentHash)) {
      gaps.push(item.id + ":CONFLICTING_SOURCE_REVISION_REQUIRES_ADJUDICATION");
      continue;
    }
    if ((existing || []).length) {
      persisted.push({ id: item.id, evidenceId: existing![0].id, observationId: "already_persisted" });
      continue;
    }

    const sourceUrl = item.sources[0].url;
    const sourceId = "market-crack:" + item.id.split(":")[0];
    const { data: source, error: sourceError } = await client
      .from("intelligence_evidence_sources")
      .upsert({
        provider_key: PROVIDER,
        external_source_id: sourceId,
        source_name: "Alchemy measured cross-market series (FRED/Nasdaq)",
        source_type: "data_provider",
        source_url: sourceUrl,
        source_tier: 2,
        reliability_score: 85,
        methodology_notes: "Aligned 20-session secondary calculation on exact FRED/Nasdaq primary price series. Price return is not total return. Independent causal corroboration still required.",
        metadata: { verificationRole: "canonical", ingestionKind: "derived_market_measurement", methodology: METHODOLOGY },
        last_seen_at: now,
        updated_at: now,
      }, { onConflict: "provider_key,external_source_id" })
      .select("id").single<{ id: string }>();
    if (sourceError || !source) throw new Error("Unable to persist measured market source: " + (sourceError?.message || "missing source"));

    const memory = await persistSensorMemory({
      provider: PROVIDER,
      sourceUrl,
      sourceType: "market_data",
      contentType: "application/json",
      rawPayload: { id: item.id, value: item.observedValue, unit: item.unit, baselineDate: item.baselineDate, sources: item.sources },
      contentText: item.claim,
      publishedAt: item.asOf,
      observedAt: now,
      sourceId: null,
      ingestionKey: externalEvidenceId,
      observations: [{
        observationType: "derived_market_measurement",
        subjectType: "cross_asset_measurement",
        subjectKey: item.id.split(":")[0],
        observedAt: item.asOf,
        effectiveAt: item.asOf,
        value: { number: item.observedValue, baseline: item.baselineDate, sources: item.sources },
        unit: item.unit,
        confidence: 85,
        methodologyVersion: METHODOLOGY,
      }],
    });
    const { data: obs, error: obsError } = await client
      .from("normalised_observations").select("id")
      .eq("raw_record_id", memory.rawRecordId)
      .eq("observation_type", "derived_market_measurement")
      .eq("subject_type", "cross_asset_measurement")
      .eq("subject_key", item.id.split(":")[0])
      .eq("observed_at", item.asOf)
      .eq("methodology_version", METHODOLOGY)
      .limit(1).single<{ id: string }>();
    if (obsError || !obs) throw new Error("Unable to resolve measured market observation: " + (obsError?.message || "missing ID"));

    const { data: evidence, error: evidenceError } = await client.from("intelligence_evidence")
      .upsert({
        source_id: source.id,
        external_evidence_id: externalEvidenceId,
        evidence_class: "market_observation",
        support_direction: "neutral",
        claim_text: item.claim,
        summary: null,
        event_at: item.asOf,
        published_at: item.asOf,
        available_at: now,
        affected_assets: item.affectedAssets,
        affected_topics: ["us-china-ai", "global-cost-of-capital", "equity-rally-quality"],
        measurement_unit: item.unit,
        observed_value: item.observedValue,
        expected_value: null,
        previous_value: null,
        confidence: 85,
        freshness_status: "current",
        content_hash: item.contentHash,
        provenance_urls: item.sources.map((s) => s.url),
        structured_payload: {
          title: item.claim.slice(0, 180),
          evidenceNature: "derived_market_measurement",
          methodologyVersion: METHODOLOGY,
          windowSessions: 20,
          baselineDate: item.baselineDate,
          observedDate: item.asOf,
          observedInputs: item.sources,
          interpretationAuthority: "diagnostic_only",
          marketDerived: true,
        },
        raw_payload: {},
        normalizer_version: METHODOLOGY,
        normalised_observation_id: obs.id,
        updated_at: now,
      }, { onConflict: "source_id,content_hash" })
      .select("id").single<{ id: string }>();
    if (evidenceError || !evidence) throw new Error("Unable to persist measured market Evidence: " + (evidenceError?.message || "missing ID"));
    persisted.push({ id: item.id, evidenceId: evidence.id, observationId: obs.id });
  }
  return { persisted, gaps };
}
