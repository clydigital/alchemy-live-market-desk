import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fetchEiaWeeklyPetroleumSnapshot,
  type EiaWeeklyMetricKey,
  type EiaWeeklyPetroleumSnapshot,
} from "../providers/eia-v2.ts";
import {
  fetchTradingEconomicsUsCalendarSnapshot,
  type TradingEconomicsUsCalendarSnapshot,
} from "../providers/trading-economics-calendar.ts";
import type {
  CandidateSnapshot,
  SourceDataStatus,
} from "./input-packet.ts";

export interface CanonicalEvidenceSourceRow {
  id: string;
  ancestry_group_id?: string | null;
  external_source_id?: string | null;
  source_name?: string | null;
  source_type?: string | null;
  source_url?: string | null;
  source_tier?: number | string | null;
  reliability_score?: number | string | null;
  provider_key?: string | null;
}

export interface CanonicalEvidenceRow {
  id: string;
  external_evidence_id?: string | null;
  claim_text: string;
  summary?: string | null;
  evidence_class: string;
  support_direction?: string | null;
  event_at?: string | null;
  published_at?: string | null;
  available_at?: string | null;
  received_at?: string | null;
  freshness_status?: string | null;
  affected_assets?: string[] | null;
  affected_topics?: string[] | null;
  provenance_urls?: string[] | null;
  structured_payload?: Record<string, unknown> | null;
  measurement_unit?: string | null;
  observed_value?: number | null;
  expected_value?: number | null;
  previous_value?: number | null;
  source?:
    | CanonicalEvidenceSourceRow
    | CanonicalEvidenceSourceRow[]
    | null;
}

export interface CanonicalSnapshotDiagnostics {
  rows_considered: number;
  observed_count: number;
  lead_count: number;
  catalyst_count: number;
  skipped_future_count: number;
  skipped_expired_scheduled_count: number;
  latest_available_at: string | null;
  price_data_status: string;
  macro_data_status: string;
}

export interface CanonicalSnapshotResult {
  snapshot: CandidateSnapshot;
  diagnostics: CanonicalSnapshotDiagnostics;
}

export interface LoadCanonicalSnapshotOptions {
  asOf: string;
  lookbackHours?: number;
  limit?: number;
}

const DIRECT_EVIDENCE_SOURCE_BY_CLASS: Record<string, string> = {
  market_observation: "MARKET_DATA",
  official_release: "OFFICIAL_DATA",
  company_primary: "PRESS_RELEASE",
  regulatory_filing: "REGULATORY_FILING",
};

const CREATOR_SOURCE_TYPES = new Set([
  "video",
  "youtube",
  "podcast",
  "creator",
  "creator_transcript",
  "social",
  "social_media",
]);

const PRICE_SOURCE_TYPES = new Set([
  "MARKET_DATA",
  "PRICING_FEED",
  "EXCHANGE_FEED",
]);

const MACRO_SOURCE_TYPES = new Set([
  "VERIFIED_MACRO_DATA",
  "OFFICIAL_DATA",
  "STATISTICAL_AGENCY",
  "REGULATORY_FILING",
]);

const ARTICLE_SOURCE_TYPES = new Set([
  "news",
  "article",
  "wire",
  "news_report",
]);


const DOSSIER_MARKET_MONITOR_CORE_IDS = [
  "us2y",
  "us10y",
  "us10y-fred",
  "us10y-real",
  "us10y-breakeven",
  "fed-funds-effective",
  "spx",
  "smh",
  "dxy",
  "usdjpy",
  "nikkei",
  "kospi",
  "hang-seng",
  "gold",
  "wti",
  "distillate",
  "crack-distillate",
  "hyg",
] as const;

function selectMarketMonitorRows(rows: MarketMonitorLike["rows"]) {
  const eligible = rows
    .filter((row) => row.last !== null && row.asOf);

  const byId = new Map(eligible.map((row) => [row.id, row]));
  const selected: MarketMonitorLike["rows"] = [];
  const selectedIds = new Set<string>();

  for (const id of DOSSIER_MARKET_MONITOR_CORE_IDS) {
    const row = byId.get(id);
    if (!row) continue;
    selected.push(row);
    selectedIds.add(row.id);
  }

  const typePriority = (row: MarketMonitorLike["rows"][number]) =>
    row.sourceName === "Federal Reserve Economic Data" ? 0 :
    row.type === "Rates" ? 1 :
    row.type === "Major Index" ? 2 :
    row.type === "AI / Semis" ? 3 :
    row.type === "Energy" ? 4 :
    row.type === "FX" ? 5 :
    row.type === "Metal" ? 6 :
    row.type === "Credit / Risk" ? 7 : 8;

  const remainder = eligible
    .filter((row) => !selectedIds.has(row.id))
    .sort((left, right) => {
      const attentionDelta = (right.attentionScore ?? 0) - (left.attentionScore ?? 0);
      if (attentionDelta !== 0) return attentionDelta;
      return typePriority(left) - typePriority(right) || left.id.localeCompare(right.id);
    });

  for (const row of remainder) {
    if (selected.length >= 28) break;
    selected.push(row);
    selectedIds.add(row.id);
  }

  return selected.slice(0, 28);
}

type MarketMonitorLike = {
  updatedAt: string;
  rows: Array<{
    id: string;
    symbol: string;
    label: string;
    type: string;
    last: number | null;
    dayChange: number | null;
    change5d: number | null;
    asOf: string | null;
    frequency: "daily" | "monthly";
    sourceName: string;
    sourceUrl: string;
    attentionScore?: number;
    hot?: boolean;
  }>;
  limitations?: string[];
};

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sourceFromRow(row: CanonicalEvidenceRow): CanonicalEvidenceSourceRow | null {
  if (Array.isArray(row.source)) return row.source[0] ?? null;
  return row.source ?? null;
}

function effectiveAvailableAt(row: CanonicalEvidenceRow): string | null {
  return row.available_at ?? row.published_at ?? row.received_at ?? null;
}

function structuredString(
  payload: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function structuredNumber(
  payload: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  const value = payload?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function provenanceForRow(
  row: CanonicalEvidenceRow,
  mappedSourceType: string,
): Array<Record<string, unknown>> {
  const source = sourceFromRow(row);
  const sourceId =
    source?.ancestry_group_id ??
    source?.external_source_id ??
    source?.id ??
    row.id;

  const url =
    row.provenance_urls?.find((item) => typeof item === "string" && item.trim()) ??
    source?.source_url ??
    undefined;

  const ref: Record<string, unknown> = {
    source_type: mappedSourceType,
    source_id: String(sourceId),
  };

  if (source?.source_name) ref.publisher = source.source_name;
  if (url) ref.url = url;
  if (row.published_at) ref.published_at = row.published_at;

  const title = structuredString(row.structured_payload, "title");
  if (title) ref.title = title;

  return [ref];
}

function categoryForRow(row: CanonicalEvidenceRow): string {
  return (
    row.affected_topics?.find(Boolean) ??
    row.affected_assets?.find(Boolean) ??
    row.evidence_class.toUpperCase()
  );
}

function groupingKeyForRow(row: CanonicalEvidenceRow): string {
  return (
    row.affected_topics?.find(Boolean) ??
    row.affected_assets?.find(Boolean) ??
    row.external_evidence_id ??
    row.id
  );
}

function sourceTier(source: CanonicalEvidenceSourceRow | null): number | null {
  const value = Number(source?.source_tier);
  return Number.isFinite(value) ? value : null;
}

function reliabilityScore(source: CanonicalEvidenceSourceRow | null): number | null {
  const value = Number(source?.reliability_score);
  return Number.isFinite(value) ? value : null;
}

function isCreatorLead(row: CanonicalEvidenceRow): boolean {
  const source = sourceFromRow(row);
  const sourceType = String(source?.source_type ?? "").trim().toLowerCase();
  const evidenceNature = structuredString(row.structured_payload, "evidenceNature");
  return (
    row.evidence_class === "transcript" ||
    evidenceNature === "creator_lead" ||
    CREATOR_SOURCE_TYPES.has(sourceType)
  );
}

function isScheduledEvent(row: CanonicalEvidenceRow): boolean {
  return structuredString(row.structured_payload, "evidenceNature") === "scheduled_event";
}

function visibleText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function isArticleMarketObservation(row: CanonicalEvidenceRow): boolean {
  if (row.evidence_class !== "news_report" || isCreatorLead(row)) return false;
  const source = sourceFromRow(row);
  const sourceType = String(source?.source_type ?? "").trim().toLowerCase();
  const reliability = reliabilityScore(source);
  if (!ARTICLE_SOURCE_TYPES.has(sourceType) || (reliability !== null && reliability < 70)) {
    return false;
  }

  const statsSignal = structuredString(row.structured_payload, "statsSignal");
  const text = visibleText([row.claim_text, row.summary, statsSignal].filter(Boolean).join(" "));
  const hasMarketSubject = /\b(?:yield|treasur|bond|stocks?|shares?|futures?|index|s&p|nasdaq|dow|nikkei|stoxx|crude|oil|brent|wti|gold|silver|dollar|yen|euro|bitcoin|diesel|gasoline|spread|etf)\b/i.test(text);
  const hasMetric = /(?:[$€£¥]\s?\d|\b\d+(?:,\d{3})*(?:\.\d+)?\s?(?:%|percent|bp|bps|basis points?|points?|dollars?|barrel|gallon)\b|\b(?:yield|price|index)\b.{0,48}\b\d+(?:\.\d+)?)/i.test(text);
  const hasMoveOrLevel = /\b(?:rose|fell|rall(?:y|ied|ying)|surged|jumped|gained|climbed|slid|dropped|declined|lost|up|down|steady|hit|reached|traded|closed|opened|topped|support|resistance|high|low)\b/i.test(text);
  return Boolean(statsSignal) || (hasMarketSubject && hasMetric && hasMoveOrLevel);
}

function mappedDirectSourceType(row: CanonicalEvidenceRow): string | null {
  const mapped = DIRECT_EVIDENCE_SOURCE_BY_CLASS[row.evidence_class];
  if (!mapped) return null;
  return mapped;
}

function urgencyForLead(row: CanonicalEvidenceRow): "HIGH" | "MEDIUM" | "LOW" {
  const score =
    structuredNumber(row.structured_payload, "candidateScore") ??
    structuredNumber(row.structured_payload, "materiality") ??
    0;

  if (score >= 85) return "HIGH";
  if (score >= 65) return "MEDIUM";
  return "LOW";
}

function impactForCatalyst(row: CanonicalEvidenceRow): "HIGH" | "MEDIUM" | "LOW" {
  const score =
    structuredNumber(row.structured_payload, "materiality") ??
    structuredNumber(row.structured_payload, "candidateScore") ??
    0;

  if (score >= 85) return "HIGH";
  if (score >= 60) return "MEDIUM";
  return "LOW";
}

function sourceStatus(
  availableAt: string | null,
  asOfMs: number,
  staleAfterHours: number,
): SourceDataStatus {
  if (!availableAt) return { status: "MISSING" };
  const availableMs = parseTimestamp(availableAt);
  if (availableMs === null) return { status: "MISSING" };

  const ageHours = (asOfMs - availableMs) / 3_600_000;
  return {
    status: ageHours > staleAfterHours ? "STALE" : "OK",
    available_at: availableAt,
  };
}

export function buildCandidateSnapshotFromCanonicalEvidence(
  rows: CanonicalEvidenceRow[],
  options: LoadCanonicalSnapshotOptions,
): CanonicalSnapshotResult {
  const asOfMs = parseTimestamp(options.asOf);
  if (asOfMs === null) {
    throw new Error(`Invalid Task 9 asOf timestamp: "${options.asOf}".`);
  }

  const lookbackHours = Math.max(1, Math.min(options.lookbackHours ?? 168, 24 * 30));
  const lookbackStartMs = asOfMs - lookbackHours * 3_600_000;

  const observedEvidence: Array<Record<string, unknown>> = [];
  const researchLeads: Array<Record<string, unknown>> = [];
  const catalysts: Array<Record<string, unknown>> = [];

  let skippedFutureCount = 0;
  let skippedExpiredScheduledCount = 0;
  let latestAvailableAt: string | null = null;
  let latestObservedAvailableAt: string | null = null;
  let latestPriceAvailableAt: string | null = null;
  let latestMacroAvailableAt: string | null = null;

  const eligibleRows = rows
    .filter((row) => {
      const availableAt = effectiveAvailableAt(row);
      const availableMs = parseTimestamp(availableAt);
      if (availableMs === null) return false;
      if (availableMs > asOfMs) {
        skippedFutureCount += 1;
        return false;
      }
      return availableMs >= lookbackStartMs;
    })
    .sort((a, b) => {
      const aMs = parseTimestamp(effectiveAvailableAt(a)) ?? 0;
      const bMs = parseTimestamp(effectiveAvailableAt(b)) ?? 0;
      return bMs - aMs || a.id.localeCompare(b.id);
    });

  for (const row of eligibleRows) {
    const availableAt = effectiveAvailableAt(row);
    if (!availableAt) continue;

    if (!latestAvailableAt) latestAvailableAt = availableAt;

    if (isScheduledEvent(row)) {
      const eventMs = parseTimestamp(row.event_at);
      if (eventMs === null || eventMs < asOfMs) {
        skippedExpiredScheduledCount += 1;
        continue;
      }

      catalysts.push({
        catalyst_id: row.external_evidence_id ?? `catalyst:${row.id}`,
        title:
          structuredString(row.structured_payload, "title") ??
          row.summary ??
          row.claim_text,
        event_time: row.event_at,
        available_at: availableAt,
        impact_level: impactForCatalyst(row),
        provenance: provenanceForRow(row, "SCHEDULED_EVENT"),
      });
      continue;
    }

    const articleMarketObservation = isArticleMarketObservation(row);
    const verifiedMacroObservation =
      structuredString(row.structured_payload, "evidenceNature") === "verified_macro_data";
    const directSourceType =
      mappedDirectSourceType(row) ??
      (verifiedMacroObservation ? "VERIFIED_MACRO_DATA" : null) ??
      (articleMarketObservation ? "NEWS_MARKET_CONTEXT" : null);

    if (directSourceType && !isCreatorLead(row)) {
      const source = sourceFromRow(row);
      observedEvidence.push({
        evidence_id: row.external_evidence_id ?? `ev:${row.id}`,
        claim_or_fact: row.claim_text,
        category: categoryForRow(row),
        source_type: directSourceType,
        available_at: availableAt,
        occurrence_time: row.event_at ?? row.published_at ?? undefined,
        grouping_key: groupingKeyForRow(row),
        ...(articleMarketObservation ? { is_admitted_fact: true } : {}),
        metrics: {
          support_direction: row.support_direction ?? "neutral",
          affected_assets: row.affected_assets ?? [],
          affected_topics: row.affected_topics ?? [],
          source_tier: sourceTier(source),
          reliability_score: reliabilityScore(source),
          ...(verifiedMacroObservation ? {
            signal_kind: structuredString(row.structured_payload, "signalKind"),
            signal_context: structuredString(row.structured_payload, "signalContext"),
            observed_value: row.observed_value ?? null,
            expected_value: row.expected_value ?? null,
            previous_value: row.previous_value ?? null,
            measurement_unit: row.measurement_unit ?? null,
          } : {}),
        },
        provenance: provenanceForRow(row, directSourceType),
      });

      if (!latestObservedAvailableAt) latestObservedAvailableAt = availableAt;
      if ((PRICE_SOURCE_TYPES.has(directSourceType) || articleMarketObservation) && !latestPriceAvailableAt) {
        latestPriceAvailableAt = availableAt;
      }
      if (MACRO_SOURCE_TYPES.has(directSourceType) && !latestMacroAvailableAt) {
        latestMacroAvailableAt = availableAt;
      }
      continue;
    }

    const source = sourceFromRow(row);
    researchLeads.push({
      lead_id: row.external_evidence_id ?? `lead:${row.id}`,
      claim_or_question: row.claim_text,
      source_type: isCreatorLead(row) ? "CREATOR_LEAD" : "RESEARCH_LEAD",
      available_at: availableAt,
      urgency: urgencyForLead(row),
      grouping_key: groupingKeyForRow(row),
      provenance: provenanceForRow(
        row,
        isCreatorLead(row) ? "CREATOR_LEAD" : "RESEARCH_LEAD",
      ),
      source_tier: sourceTier(source),
    });
  }

  const priceData = sourceStatus(latestPriceAvailableAt, asOfMs, 24);
  const macroData = sourceStatus(latestMacroAvailableAt, asOfMs, 96);
  const canonicalEvidenceStatus = sourceStatus(latestAvailableAt, asOfMs, 48);

  const snapshot: CandidateSnapshot = {
    observed_evidence: observedEvidence,
    research_leads: researchLeads,
    catalysts,
    price_data: priceData,
    macro_data: macroData,
    sources_status: {
      canonical_evidence: {
        status: canonicalEvidenceStatus.status,
        available_at: canonicalEvidenceStatus.available_at,
        message:
          observedEvidence.length > 0
            ? `${observedEvidence.length} direct observed evidence items admitted for this packet.`
            : "No direct current evidence admitted; available material remains research leads/context.",
      },
    },
  };

  return {
    snapshot,
    diagnostics: {
      rows_considered: eligibleRows.length,
      observed_count: observedEvidence.length,
      lead_count: researchLeads.length,
      catalyst_count: catalysts.length,
      skipped_future_count: skippedFutureCount,
      skipped_expired_scheduled_count: skippedExpiredScheduledCount,
      latest_available_at: latestAvailableAt,
      price_data_status: String(priceData.status ?? "MISSING"),
      macro_data_status: String(macroData.status ?? "MISSING"),
    },
  };
}


export function augmentCandidateSnapshotWithMarketMonitor(
  result: CanonicalSnapshotResult,
  monitor: MarketMonitorLike | null | undefined,
  options: LoadCanonicalSnapshotOptions,
): CanonicalSnapshotResult {
  if (!monitor?.rows?.length) return result;
  const asOfMs = parseTimestamp(options.asOf);
  if (asOfMs === null) return result;

  const observed = [...(result.snapshot.observed_evidence ?? [])];
  let fredSeen = false;

  const rows = selectMarketMonitorRows(
    monitor.rows.filter((row) => {
      if (row.last === null || !row.asOf) return false;
      const occurrenceMs = Date.parse(`${row.asOf}T00:00:00.000Z`);
      return Number.isFinite(occurrenceMs) && occurrenceMs <= asOfMs;
    }),
  );

  for (const row of rows) {
    const occurrenceTime = `${row.asOf}T00:00:00.000Z`;
    const isFred = row.sourceName === "Federal Reserve Economic Data";
    fredSeen ||= isFred;
    const moves = [
      row.dayChange !== null ? `1D ${row.dayChange >= 0 ? "+" : ""}${row.dayChange.toFixed(2)}%` : null,
      row.change5d !== null ? `5D ${row.change5d >= 0 ? "+" : ""}${row.change5d.toFixed(2)}%` : null,
    ].filter(Boolean).join("; ");
    observed.push({
      evidence_id: `market-monitor:${row.id}:${row.asOf}`,
      claim_or_fact: `${row.label} was ${row.last} as of ${row.asOf}${moves ? ` (${moves})` : ""}.`,
      category: row.type,
      source_type: "MARKET_DATA",
      available_at: options.asOf,
      occurrence_time: occurrenceTime,
      grouping_key: `market-monitor:${row.id}`,
      metrics: {
        symbol: row.symbol,
        last: row.last,
        day_change_pct: row.dayChange,
        change_5d_pct: row.change5d,
        frequency: row.frequency,
        provider: row.sourceName,
      },
      provenance: [{
        source_type: isFred ? "FRED" : "MARKET_DATA",
        source_id: `market-monitor:${row.id}`,
        url: row.sourceUrl,
        publisher: row.sourceName,
      }],
    });
  }

  if (!rows.length) return result;

  const sourcesStatus = {
    ...(result.snapshot.sources_status ?? {}),
    market_monitor: {
      status: "OK",
      available_at: options.asOf,
      message: `${rows.length} existing Live market-monitor observations admitted into Dossier V2.`,
    },
  };

  const macroData = fredSeen
    ? { status: "OK", available_at: options.asOf }
    : result.snapshot.macro_data;
  const priceData = { status: "OK", available_at: options.asOf };

  return {
    snapshot: {
      ...result.snapshot,
      observed_evidence: observed,
      price_data: priceData,
      macro_data: macroData,
      sources_status: sourcesStatus,
    },
    diagnostics: {
      ...result.diagnostics,
      observed_count: observed.length,
      latest_available_at: options.asOf,
      price_data_status: "OK",
      macro_data_status: fredSeen
        ? "OK"
        : String(result.snapshot.macro_data?.status ?? result.diagnostics.macro_data_status),
    },
  };
}

const EIA_GROUPING_KEY_BY_METRIC: Record<EiaWeeklyMetricKey, string> = {
  crudeStocksExSpr: "eia:inventories",
  gasolineStocks: "eia:inventories",
  distillateStocks: "eia:inventories",
  sprStocks: "eia:inventories",
  refineryUtilisation: "eia:refining",
  refineryCrudeInputs: "eia:refining",
  crudeProduction: "eia:supply-demand",
  gasolineProductSupplied: "eia:supply-demand",
};

function formatObservedMetric(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function optionalProviderState(
  state: "ready" | "unconfigured" | "unavailable",
): "OK" | "OPTIONAL_UNCONFIGURED" | "OPTIONAL_UNAVAILABLE" {
  if (state === "ready") return "OK";
  return state === "unconfigured" ? "OPTIONAL_UNCONFIGURED" : "OPTIONAL_UNAVAILABLE";
}

export function augmentCandidateSnapshotWithEia(
  result: CanonicalSnapshotResult,
  eia: EiaWeeklyPetroleumSnapshot,
  options: LoadCanonicalSnapshotOptions,
): CanonicalSnapshotResult {
  const observed = [...(result.snapshot.observed_evidence ?? [])];
  let added = 0;

  if (eia.state === "ready") {
    for (const [rawKey, metric] of Object.entries(eia.metrics)) {
      if (!metric) continue;
      const key = rawKey as EiaWeeklyMetricKey;
      const latest = metric.latest;
      const previous = metric.previous;
      const delta = previous ? latest.value - previous.value : null;
      const unit = latest.units ?? metric.canonicalUnit;

      const comparison = previous
        ? `, versus ${formatObservedMetric(previous.value)} ${previous.units ?? metric.canonicalUnit} the prior week${delta === null ? "" : ` (change ${delta >= 0 ? "+" : ""}${formatObservedMetric(delta)} ${unit})`}`
        : "";

      observed.push({
        evidence_id: `eia:${metric.seriesId}:${latest.period}`,
        claim_or_fact: `${metric.label} was ${formatObservedMetric(latest.value)} ${unit} for the week ending ${latest.period}${comparison}.`,
        category: "Energy",
        source_type: "OFFICIAL_DATA",
        available_at: options.asOf,
        occurrence_time: `${latest.period}T00:00:00.000Z`,
        grouping_key: EIA_GROUPING_KEY_BY_METRIC[key],
        rank: 30 + added,
        metrics: {
          series_id: metric.seriesId,
          period: latest.period,
          latest_value: latest.value,
          previous_value: previous?.value ?? null,
          delta,
          unit,
          provider: eia.sourceName,
        },
        provenance: [{
          source_type: "EIA",
          source_id: metric.seriesId,
          url: eia.sourceUrl,
          publisher: eia.sourceName,
        }],
      });
      added += 1;
    }
  }

  const sourcesStatus = {
    ...(result.snapshot.sources_status ?? {}),
    eia_weekly_petroleum: {
      status: optionalProviderState(eia.state),
      available_at: eia.retrievedAt ?? undefined,
      message:
        eia.state === "ready"
          ? `${added} official EIA weekly petroleum observations admitted as optional energy evidence.`
          : eia.note ?? "Optional EIA weekly petroleum enrichment was skipped.",
    },
  };

  return {
    snapshot: {
      ...result.snapshot,
      observed_evidence: observed,
      sources_status: sourcesStatus,
    },
    diagnostics: {
      ...result.diagnostics,
      observed_count: observed.length,
    },
  };
}

export function augmentCandidateSnapshotWithTradingEconomics(
  result: CanonicalSnapshotResult,
  calendar: TradingEconomicsUsCalendarSnapshot,
  options: LoadCanonicalSnapshotOptions,
): CanonicalSnapshotResult {
  const observed = [...(result.snapshot.observed_evidence ?? [])];
  const asOfMs = parseTimestamp(options.asOf);
  let added = 0;

  if (calendar.state === "ready" && asOfMs !== null) {
    for (const event of calendar.events) {
      const eventMs = parseTimestamp(event.date);
      if (eventMs === null || eventMs > asOfMs || !event.actual) continue;

      const consensusText = event.consensus ? ` vs consensus ${event.consensus}` : "";
      const previousText = event.previous ? `; previous ${event.previous}` : "";

      const provenance: Array<Record<string, unknown>> = [{
        source_type: "ECONOMIC_CALENDAR",
        source_id: `trading-economics:${event.calendarId}`,
        url: calendar.sourceUrl,
        publisher: calendar.sourceName,
      }];
      if (event.sourceUrl) {
        provenance.push({
          source_type: "OFFICIAL_SOURCE",
          source_id: `trading-economics-source:${event.calendarId}`,
          url: event.sourceUrl,
          publisher: event.source ?? undefined,
        });
      }

      observed.push({
        evidence_id: `trading-economics:${event.calendarId}:${event.date.slice(0, 10)}`,
        claim_or_fact: `${event.event}: actual ${event.actual}${consensusText}${previousText}.`,
        category: event.category,
        source_type: "ECONOMIC_CALENDAR",
        is_admitted_fact: true,
        available_at: options.asOf,
        occurrence_time: event.date,
        grouping_key: "macro-surprise:us",
        rank: 20 + added,
        metrics: {
          calendar_id: event.calendarId,
          reference: event.reference,
          actual: event.actual,
          consensus: event.consensus,
          previous: event.previous,
          te_forecast: event.teForecast,
          parsed_actual: event.parsedActual,
          parsed_consensus: event.parsedConsensus,
          parsed_previous: event.parsedPrevious,
          surprise: event.surprise,
          importance: event.importance,
          reported_source: event.source,
        },
        provenance,
      });
      added += 1;
      if (added >= 6) break;
    }
  }

  const sourcesStatus = {
    ...(result.snapshot.sources_status ?? {}),
    trading_economics_us_calendar: {
      status: optionalProviderState(calendar.state),
      available_at: calendar.retrievedAt ?? undefined,
      message:
        calendar.state === "ready"
          ? `${added} realized high-importance U.S. calendar events admitted as optional actual/consensus/previous evidence.`
          : calendar.note ?? "Optional Trading Economics event-surprise enrichment was skipped.",
    },
  };

  return {
    snapshot: {
      ...result.snapshot,
      observed_evidence: observed,
      sources_status: sourcesStatus,
    },
    diagnostics: {
      ...result.diagnostics,
      observed_count: observed.length,
    },
  };
}

export async function loadCanonicalCandidateSnapshot(
  client: SupabaseClient,
  options: LoadCanonicalSnapshotOptions,
): Promise<CanonicalSnapshotResult> {
  const lookbackHours = Math.max(1, Math.min(options.lookbackHours ?? 168, 24 * 30));
  const asOfMs = parseTimestamp(options.asOf);
  if (asOfMs === null) {
    throw new Error(`Invalid Task 9 asOf timestamp: "${options.asOf}".`);
  }

  const since = new Date(asOfMs - lookbackHours * 3_600_000).toISOString();
  const limit = Math.max(1, Math.min(options.limit ?? 180, 500));

  const { data, error } = await client
    .from("intelligence_evidence")
    .select(
      [
        "id",
        "external_evidence_id",
        "claim_text",
        "summary",
        "evidence_class",
        "support_direction",
        "event_at",
        "published_at",
        "available_at",
        "received_at",
        "freshness_status",
        "affected_assets",
        "affected_topics",
        "provenance_urls",
        "structured_payload",
        "measurement_unit",
        "observed_value",
        "expected_value",
        "previous_value",
        "source:intelligence_evidence_sources!inner(id,ancestry_group_id,external_source_id,source_name,source_type,source_url,source_tier,reliability_score,provider_key)",
      ].join(","),
    )
    .gte("received_at", since)
    .lte("received_at", options.asOf)
    .in("freshness_status", ["current", "aging"])
    .order("received_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load canonical evidence for Dossier V2: ${error.message}`);
  }

  let result = buildCandidateSnapshotFromCanonicalEvidence(
    (data ?? []) as unknown as CanonicalEvidenceRow[],
    options,
  );

  const calendarFrom = new Date(asOfMs - Math.min(72, lookbackHours) * 3_600_000);
  const calendarTo = new Date(asOfMs);

  const [marketMonitorResult, eiaResult, tradingEconomicsResult] =
    await Promise.allSettled([
      import("../market-monitor.ts").then(({ getMarketMonitor }) => getMarketMonitor()),
      fetchEiaWeeklyPetroleumSnapshot(),
      fetchTradingEconomicsUsCalendarSnapshot({
        from: calendarFrom,
        to: calendarTo,
      }),
    ]);

  if (marketMonitorResult.status === "fulfilled") {
    result = augmentCandidateSnapshotWithMarketMonitor(
      result,
      marketMonitorResult.value,
      options,
    );
  } else {
    result.snapshot.sources_status = {
      ...(result.snapshot.sources_status ?? {}),
      market_monitor: {
        status: "WARNING",
        message: `Existing Live market monitor was unavailable to Dossier V2: ${marketMonitorResult.reason instanceof Error ? marketMonitorResult.reason.message : String(marketMonitorResult.reason)}`,
      },
    };
  }

  if (eiaResult.status === "fulfilled") {
    result = augmentCandidateSnapshotWithEia(result, eiaResult.value, options);
  } else {
    result.snapshot.sources_status = {
      ...(result.snapshot.sources_status ?? {}),
      eia_weekly_petroleum: {
        status: "OPTIONAL_UNAVAILABLE",
        message: `Optional EIA enrichment failed closed: ${eiaResult.reason instanceof Error ? eiaResult.reason.message : String(eiaResult.reason)}`,
      },
    };
  }

  if (tradingEconomicsResult.status === "fulfilled") {
    result = augmentCandidateSnapshotWithTradingEconomics(
      result,
      tradingEconomicsResult.value,
      options,
    );
  } else {
    result.snapshot.sources_status = {
      ...(result.snapshot.sources_status ?? {}),
      trading_economics_us_calendar: {
        status: "OPTIONAL_UNAVAILABLE",
        message: `Optional Trading Economics enrichment failed closed: ${tradingEconomicsResult.reason instanceof Error ? tradingEconomicsResult.reason.message : String(tradingEconomicsResult.reason)}`,
      },
    };
  }

  return result;
}
