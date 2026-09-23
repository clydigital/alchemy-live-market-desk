import type { SupabaseClient } from "@supabase/supabase-js";

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

export type MacroContextSnapshotRow = {
  id: string;
  source_key: string;
  source_url: string;
  status: string;
  capture_completed_at: string;
  transport_error_code?: string | null;
  raw_markdown?: string | null;
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

export function augmentCandidateSnapshotWithMacroContext(
  result: CanonicalSnapshotResult,
  row: MacroContextSnapshotRow | null | undefined,
): CanonicalSnapshotResult {
  if (!row) return result;
  const sourcesStatus = { ...(result.snapshot.sources_status ?? {}) };
  const usable = row.status === "complete" && Boolean(row.raw_markdown?.trim());
  sourcesStatus.macromicro = {
    status: usable ? "OK" : "WARNING",
    available_at: row.capture_completed_at,
    message: usable
      ? "Latest persisted MacroMicro supplemental scan is usable as macro research context."
      : `Latest MacroMicro scan is not usable as dated macro context (${row.transport_error_code || row.status}).`,
  };

  if (!usable) {
    return {
      ...result,
      snapshot: { ...result.snapshot, sources_status: sourcesStatus },
    };
  }

  const excerpt = visibleText(row.raw_markdown ?? "").slice(0, 1800);
  const leads = [...(result.snapshot.research_leads ?? [])];
  leads.push({
    lead_id: `macro-context:${row.id}`,
    claim_or_question: excerpt,
    source_type: "MACRO_CONTEXT",
    available_at: row.capture_completed_at,
    urgency: "MEDIUM",
    grouping_key: "macro-context:macromicro",
    provenance: [{
      source_type: "MACROMICRO",
      source_id: row.id,
      url: row.source_url,
      publisher: "MacroMicro",
    }],
  });

  return {
    snapshot: {
      ...result.snapshot,
      research_leads: leads,
      macro_data: { status: "OK", available_at: row.capture_completed_at },
      sources_status: sourcesStatus,
    },
    diagnostics: {
      ...result.diagnostics,
      lead_count: leads.length,
      macro_data_status: "OK",
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

  try {
    const { getMarketMonitor } = await import("../market-monitor.ts");
    result = augmentCandidateSnapshotWithMarketMonitor(
      result,
      await getMarketMonitor(),
      options,
    );
  } catch (error) {
    result.snapshot.sources_status = {
      ...(result.snapshot.sources_status ?? {}),
      market_monitor: {
        status: "WARNING",
        message: `Existing Live market monitor was unavailable to Dossier V2: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }

  try {
    const { data: macroRows, error: macroError } = await client
      .from("macro_source_snapshots")
      .select("id,source_key,source_url,status,capture_completed_at,transport_error_code,raw_markdown")
      .eq("source_key", "macromicro_supplemental")
      .lte("capture_completed_at", options.asOf)
      .order("capture_completed_at", { ascending: false })
      .limit(1)
      .returns<MacroContextSnapshotRow[]>();
    if (macroError) throw macroError;
    result = augmentCandidateSnapshotWithMacroContext(result, macroRows?.[0] ?? null);
  } catch (error) {
    result.snapshot.sources_status = {
      ...(result.snapshot.sources_status ?? {}),
      macromicro: {
        status: "WARNING",
        message: `Persisted MacroMicro context was unavailable to Dossier V2: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }

  return result;
}
