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
import {
  fetchNyFedReferenceRates,
  type NyFedReferenceRatesSnapshot,
} from "../providers/ny-fed-reference-rates.ts";
import {
  fetchNyFedPrimaryDealers,
  type NyFedPrimaryDealerSnapshot,
} from "../providers/ny-fed-primary-dealers.ts";
import {
  fetchTreasuryBills,
  type TreasuryBillSnapshot,
} from "../providers/treasury-bills.ts";
import {
  fetchTreasuryAuctions,
  type TreasuryAuctionSnapshot,
} from "../providers/treasury-auctions.ts";
import {
  fetchNyFedAcmTermPremium,
  type NyFedAcmTermPremiumSnapshot,
} from "../providers/ny-fed-acm-term-premium.ts";
import {
  fetchBundesbankBund10,
  type BundesbankBund10Snapshot,
} from "../providers/bundesbank-bund10.ts";
import {
  fetchBoeGilt10,
  type BoeGilt10Snapshot,
} from "../providers/boe-gilt10.ts";
import {
  fetchJapanMofJgbYields,
  type JapanMofJgbSnapshot,
} from "../providers/japan-mof-jgb-yields.ts";
import {
  fetchJapanMofWeeklyFlows,
  type JapanMofWeeklySnapshot,
} from "../providers/japan-mof-weekly-flows.ts";
import {
  fetchTreasuryTicTable5,
  type TreasuryTicSnapshot,
} from "../providers/treasury-tic-holdings.ts";
import {
  fetchTwelveDataReactionSnapshot,
  type IntradayReactionTrigger,
  type TwelveDataReactionSnapshot,
} from "../providers/twelve-data-reactions.ts";
import type {
  CandidateSnapshot,
  ObservedEvidence,
  SourceDataStatus,
} from "./input-packet.ts";
import { isSystem1IntradayReactionTriggerEvidence } from "./system1-divergence.ts";

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
  "us5y-fred",
  "us10y",
  "us10y-fred",
  "us20y-fred",
  "us30y-fred",
  "us5y-real",
  "us5y-breakeven",
  "us10y-real",
  "us10y-breakeven",
  "fed-funds-effective",
  "move",
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
  "hy-oas",
  "ig-oas",
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
  breadth?: Array<{
    id: string;
    label: string;
    sourceName: string;
    sampleSize: number;
    targetSize: number;
    current: {
      asOf: string | null;
      sampleSize: number;
      above20: number;
      above50: number;
      above200: number;
      newHighs20: number;
      newLows20: number;
    };
    weekAgo: {
      asOf: string | null;
      above50: number;
      above200: number;
    };
    monthAgo: {
      asOf: string | null;
      above50: number;
      above200: number;
    };
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

function isRetiredMacroMicroEvidence(row: CanonicalEvidenceRow): boolean {
  const source = sourceFromRow(row);
  const sourceName = String(source?.source_name ?? "").toLowerCase();
  const sourceUrl = String(source?.source_url ?? "").toLowerCase();
  const externalSourceId = String(source?.external_source_id ?? "").toLowerCase();
  return (
    sourceName.includes("macromicro") ||
    sourceUrl.includes("macromicro.me") ||
    externalSourceId.includes("macromicro")
  );
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

function observedEvidenceRank(
  row: CanonicalEvidenceRow,
  directSourceType: string,
): number {
  // Lower is stronger. This rank is consumed by the bounded Dossier packet
  // before recency so primary/official evidence is not displaced by a newer
  // secondary market-news observation in the same topic cluster.
  const source = sourceFromRow(row);
  const baseBySourceType: Record<string, number> = {
    VERIFIED_MACRO_DATA: 8,
    OFFICIAL_DATA: 10,
    STATISTICAL_AGENCY: 10,
    REGULATORY_FILING: 12,
    SEC_FILING: 12,
    COMPANY_FILING: 14,
    PRESS_RELEASE: 16,
    EXCHANGE_FEED: 18,
    PRICING_FEED: 18,
    MARKET_DATA: 20,
    NEWS_MARKET_CONTEXT: 52,
  };

  let rank = baseBySourceType[directSourceType] ?? 60;

  const tier = sourceTier(source);
  if (tier !== null) {
    // Tier 1 is strongest. Clamp so a malformed tier cannot overwhelm the
    // source-class priority.
    rank += Math.max(0, Math.min(16, (tier - 1) * 4));
  }

  const reliability = reliabilityScore(source);
  if (reliability !== null) {
    if (reliability >= 90) rank -= 4;
    else if (reliability >= 80) rank -= 2;
    else if (reliability < 70) rank += 8;
  }

  const materiality =
    structuredNumber(row.structured_payload, "candidateScore") ??
    structuredNumber(row.structured_payload, "materiality");
  if (materiality !== null) {
    if (materiality >= 90) rank -= 3;
    else if (materiality >= 75) rank -= 1;
  }

  return Math.max(1, Math.round(rank));
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
    .filter((row) => !isRetiredMacroMicroEvidence(row))
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
        canonical_record_backed: true,
        claim_or_fact: row.claim_text,
        category: categoryForRow(row),
        source_type: directSourceType,
        available_at: availableAt,
        occurrence_time: row.event_at ?? row.published_at ?? undefined,
        grouping_key: groupingKeyForRow(row),
        rank: observedEvidenceRank(row, directSourceType),
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


export function selectIntradayReactionTriggers(
  result: CanonicalSnapshotResult,
  asOf: string,
): IntradayReactionTrigger[] {
  const asOfMs = parseTimestamp(asOf);
  if (asOfMs === null) return [];

  return (result.snapshot.observed_evidence ?? [])
    .flatMap((raw) => {
      const evidenceId = typeof raw.evidence_id === "string" ? raw.evidence_id : null;
      const claim = typeof raw.claim_or_fact === "string" ? raw.claim_or_fact : null;
      const category = typeof raw.category === "string" ? raw.category : null;
      const sourceType = typeof raw.source_type === "string" ? raw.source_type : null;
      const availableAt = typeof raw.available_at === "string" ? raw.available_at : null;
      const occurredAt = typeof raw.occurrence_time === "string" ? raw.occurrence_time : null;
      if (!evidenceId || !claim || !category || !sourceType || !availableAt || !occurredAt) return [];

      const occurredMs = parseTimestamp(occurredAt);
      if (occurredMs === null || occurredMs > asOfMs) return [];

      // Midnight timestamps are commonly date-level placeholders in canonical
      // data. Do not treat them as exact event times for intraday reactions.
      if (/T00:00:00(?:\.000)?Z$/i.test(occurredAt)) return [];

      const candidate: ObservedEvidence = {
        evidence_id: evidenceId,
        epistemic_label: "OBSERVED",
        claim_or_fact: claim,
        category,
        source_type: sourceType,
        available_at: availableAt,
        occurrence_time: occurredAt,
        metrics: raw.metrics && typeof raw.metrics === "object" && !Array.isArray(raw.metrics)
          ? raw.metrics as Record<string, unknown>
          : undefined,
        provenance: Array.isArray(raw.provenance)
          ? raw.provenance as ObservedEvidence["provenance"]
          : [],
      };

      return isSystem1IntradayReactionTriggerEvidence(candidate)
        ? [{ evidenceId, occurredAt }]
        : [];
    })
    .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt))
    .slice(-4);
}

export function augmentCandidateSnapshotWithTwelveDataReactions(
  result: CanonicalSnapshotResult,
  reactions: TwelveDataReactionSnapshot,
  options: LoadCanonicalSnapshotOptions,
): CanonicalSnapshotResult {
  const observed = [...(result.snapshot.observed_evidence ?? [])];

  for (const record of reactions.records) {
    const primary =
      record.windows.find((window) => window.window === "30m")
      ?? record.windows.find((window) => window.window === "5m")
      ?? record.windows.find((window) => window.window === "4h")
      ?? record.windows.find((window) => window.window === "close")
      ?? record.windows.find((window) => window.window === "next_session");
    if (!primary) continue;

    const windowMap = Object.fromEntries(
      record.windows.map((window) => [window.window, {
        baseline_at: window.baselineAt,
        observed_at: window.observedAt,
        baseline: window.baseline,
        observed: window.observed,
        change_pct: window.changePct,
      }]),
    );

    observed.push({
      evidence_id: `twelve-data:event-reaction:${record.triggerEvidenceId}:${record.monitorId}`,
      claim_or_fact: `${record.observedInstrument}${record.isProxy ? " proxy" : ""} moved ${primary.changePct >= 0 ? "+" : ""}${primary.changePct.toFixed(2)}% over the ${primary.window} window after the timestamped catalyst.`,
      category: "MARKET",
      source_type: "MARKET_DATA",
      available_at: primary.observedAt,
      occurrence_time: primary.observedAt,
      grouping_key: `market-monitor:${record.monitorId}`,
      rank: 17,
      metrics: {
        signal_kind: "market_reaction",
        trigger_evidence_id: record.triggerEvidenceId,
        event_change_pct: primary.changePct,
        reaction_window: primary.window,
        reaction_windows: windowMap,
        expected_instrument: record.expectedInstrument,
        observed_instrument: record.observedInstrument,
        is_proxy: record.isProxy,
        frequency: "intraday",
        provider: record.sourceName,
        retrieved_at: reactions.retrievedAt,
      },
      provenance: [{
        source_type: "TWELVE_DATA",
        source_id: `twelve-data:${record.observedInstrument}`,
        url: record.sourceUrl,
        publisher: record.sourceName,
      }],
    });
  }

  const status =
    reactions.state === "ready"
      ? "OK"
      : reactions.state === "unconfigured"
        ? "OPTIONAL_UNCONFIGURED"
        : "OPTIONAL_UNAVAILABLE";

  const message = reactions.state === "ready"
    ? `${reactions.records.length} chronology-safe intraday event-reaction records admitted. ${reactions.warnings.join(" ")}`.trim()
    : reactions.warnings.join(" ");

  return {
    snapshot: {
      ...result.snapshot,
      observed_evidence: observed,
      sources_status: {
        ...(result.snapshot.sources_status ?? {}),
        twelve_data_intraday_reactions: {
          status,
          available_at: reactions.state === "ready" ? options.asOf : undefined,
          message,
        },
      },
    },
    diagnostics: {
      ...result.diagnostics,
      observed_count: observed.length,
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
    const isCreditOas = row.id === "hy-oas" || row.id === "ig-oas";
    const groupingKey = isCreditOas ? "market-monitor:credit-oas" : `market-monitor:${row.id}`;
    fredSeen ||= isFred;
    const moves = isCreditOas ? "" : [
      row.dayChange !== null ? `1D ${row.dayChange >= 0 ? "+" : ""}${row.dayChange.toFixed(2)}%` : null,
      row.change5d !== null ? `5D ${row.change5d >= 0 ? "+" : ""}${row.change5d.toFixed(2)}%` : null,
    ].filter(Boolean).join("; ");
    observed.push({
      evidence_id: `market-monitor:${row.id}:${row.asOf}`,
      claim_or_fact: isCreditOas
        ? `${row.label} was ${row.last}% as of ${row.asOf}.`
        : `${row.label} was ${row.last} as of ${row.asOf}${moves ? ` (${moves})` : ""}.`,
      category: row.type,
      source_type: "MARKET_DATA",
      available_at: options.asOf,
      occurrence_time: occurrenceTime,
      grouping_key: groupingKey,
      rank: isCreditOas ? (row.id === "hy-oas" ? 18 : 19) : undefined,
      metrics: {
        symbol: row.symbol,
        observed_instrument: row.symbol,
        is_proxy: /proxy/i.test(row.label),
        last: row.last,
        ...(isCreditOas ? {
          spread_level_pct: row.last,
          change_5d_pct: row.change5d,
        } : {
          day_change_pct: row.dayChange,
          change_5d_pct: row.change5d,
        }),
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

  let breadthAdded = 0;
  for (const [index, breadth] of (monitor.breadth ?? []).entries()) {
    if (!breadth.current.asOf || breadth.current.sampleSize <= 0) continue;
    const occurrenceMs = Date.parse(`${breadth.current.asOf}T00:00:00.000Z`);
    if (!Number.isFinite(occurrenceMs) || occurrenceMs > asOfMs) continue;

    const weekDelta50 = breadth.current.above50 - breadth.weekAgo.above50;
    const monthDelta50 = breadth.current.above50 - breadth.monthAgo.above50;
    observed.push({
      evidence_id: `market-breadth:${breadth.id}:${breadth.current.asOf}`,
      claim_or_fact: `${breadth.label} breadth was ${breadth.current.above50}% above the 50-day average and ${breadth.current.above200}% above the 200-day average as of ${breadth.current.asOf}; ${breadth.current.newHighs20} constituents were at 20-day highs versus ${breadth.current.newLows20} at 20-day lows across ${breadth.current.sampleSize}/${breadth.targetSize} eligible histories.`,
      category: "BREADTH",
      source_type: "MARKET_DATA",
      available_at: options.asOf,
      occurrence_time: `${breadth.current.asOf}T00:00:00.000Z`,
      grouping_key: `market-breadth:${breadth.id}`,
      rank: 15 + index * 2,
      metrics: {
        basket: breadth.id,
        sample_size: breadth.current.sampleSize,
        target_size: breadth.targetSize,
        above_20d_pct: breadth.current.above20,
        above_50d_pct: breadth.current.above50,
        above_200d_pct: breadth.current.above200,
        new_highs_20d: breadth.current.newHighs20,
        new_lows_20d: breadth.current.newLows20,
        week_delta_above_50d_pts: weekDelta50,
        month_delta_above_50d_pts: monthDelta50,
        provider: breadth.sourceName,
      },
      provenance: [{
        source_type: "NASDAQ",
        source_id: `market-breadth:${breadth.id}`,
        url: "https://www.nasdaq.com/market-activity",
        publisher: breadth.sourceName,
      }],
    });
    breadthAdded += 1;
  }

  if (!rows.length && breadthAdded === 0) return result;

  const sourcesStatus = {
    ...(result.snapshot.sources_status ?? {}),
    market_monitor: {
      status: "OK",
      available_at: options.asOf,
      message: `${rows.length} existing Live market-monitor observations and ${breadthAdded} derived breadth snapshots admitted into Dossier V2.`,
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


function monthEndOccurrence(period: string | null) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return undefined;
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 0));
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) + "T00:00:00.000Z" : undefined;
}

function endOfUtcDay(date: string | null | undefined) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const value = `${date}T23:59:59.999Z`;
  return Number.isFinite(Date.parse(value)) ? value : undefined;
}

function isAvailableByAsOf(availableAt: string | undefined, asOf: string) {
  if (!availableAt) return false;
  const availableMs = Date.parse(availableAt);
  const asOfMs = Date.parse(asOf);
  return Number.isFinite(availableMs) && Number.isFinite(asOfMs) && availableMs <= asOfMs;
}

function latestDailyObservationByAsOf<T extends { date: string }>(
  latest: T | null | undefined,
  prior: T | null | undefined,
  asOf: string,
) {
  return [latest, prior]
    .filter((item): item is T => Boolean(item))
    .filter((item) => isAvailableByAsOf(endOfUtcDay(item.date), asOf))
    .sort((left, right) => right.date.localeCompare(left.date))[0] ?? null;
}

function japanMofFlowEndDate(
  row: { periodLabel: string; inferredGregorianYear: number | null },
) {
  const fullDates = [...row.periodLabel.matchAll(/((?:19|20)\d{2})[\/-](\d{1,2})[\/-](\d{1,2})/g)];
  if (fullDates.length > 0) {
    const [, year, month, day] = fullDates[fullDates.length - 1];
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  if (row.inferredGregorianYear !== null) {
    const monthDays = [...row.periodLabel.matchAll(/(\d{1,2})月(\d{1,2})日/g)];
    if (monthDays.length > 0) {
      const [, month, day] = monthDays[monthDays.length - 1];
      return `${row.inferredGregorianYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }

  return null;
}

function flowEvidenceKey(value: string) {
  return value.replace(/[^0-9A-Za-z]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "latest";
}

export function augmentCandidateSnapshotWithGlobalRatesEvidence(
  result: CanonicalSnapshotResult,
  jgb: JapanMofJgbSnapshot,
  tic: TreasuryTicSnapshot,
  japanFlows: JapanMofWeeklySnapshot,
  options: LoadCanonicalSnapshotOptions,
  bund10?: BundesbankBund10Snapshot,
  gilt10?: BoeGilt10Snapshot,
): CanonicalSnapshotResult {
  const observed = [...(result.snapshot.observed_evidence ?? [])];

  const jgbObservation = latestDailyObservationByAsOf(
    jgb.latest,
    jgb.previous5,
    options.asOf,
  );
  const jgbAvailableAt = endOfUtcDay(jgbObservation?.date);
  const jgbIsLatest = Boolean(
    jgbObservation
    && jgb.latest
    && jgbObservation.date === jgb.latest.date,
  );
  if (
    jgbObservation
    && jgbAvailableAt
    && jgb.status !== "UNAVAILABLE"
  ) {
    observed.push({
      evidence_id: `global-rates:jgb:${jgbObservation.date}`,
      claim_or_fact: `Japan MOF constant-maturity JGB yields for ${jgbObservation.date}: 2Y ${jgbObservation.y2 ?? "n/a"}%, 10Y ${jgbObservation.y10 ?? "n/a"}%, 30Y ${jgbObservation.y30 ?? "n/a"}%.`,
      category: "Rates",
      source_type: "OFFICIAL_DATA",
      available_at: jgbAvailableAt,
      occurrence_time: `${jgbObservation.date}T00:00:00.000Z`,
      grouping_key: "global-rates:jgb",
      rank: 12,
      metrics: {
        signal_kind: "global_rates",
        signal_context: "jgb_curve",
        jgb_2y_pct: jgbObservation.y2,
        jgb_10y_pct: jgbObservation.y10,
        jgb_30y_pct: jgbObservation.y30,
        jgb_2y_change_5d_bp: jgbIsLatest ? jgb.changes5dBp.y2 : null,
        jgb_10y_change_5d_bp: jgbIsLatest ? jgb.changes5dBp.y10 : null,
        jgb_30y_change_5d_bp: jgbIsLatest ? jgb.changes5dBp.y30 : null,
        provider_status: jgbIsLatest ? jgb.status : "PARTIAL",
      },
      provenance: [{
        source_type: "JAPAN_MOF",
        source_id: "jgb-constant-maturity",
        url: jgb.sourceUrls[1] ?? jgb.sourceUrls[0],
        publisher: jgb.sourceName,
      }],
    });
  }

  const japanTic = tic.countries.find((item) => item.country === "Japan") ?? null;
  const totalTic = tic.countries.find((item) => item.country === "Grand Total") ?? null;
  const officialTic = tic.countries.find((item) => item.country === "Of Which: Foreign Official") ?? null;
  const ticOccurrence = monthEndOccurrence(tic.latestPeriod);
  const ticAvailableAt = ticOccurrence
    ? endOfUtcDay(ticOccurrence.slice(0, 10))
    : undefined;
  const ticEligible = Boolean(
    tic.latestPeriod
    && japanTic
    && tic.status !== "UNAVAILABLE"
    && isAvailableByAsOf(ticAvailableAt, options.asOf),
  );
  if (ticEligible && tic.latestPeriod && japanTic && ticAvailableAt) {
    observed.push({
      evidence_id: `global-rates:tic:${tic.latestPeriod}`,
      claim_or_fact: `Treasury TIC reported Japan Treasury holdings of ${japanTic.latestUsdBn ?? "n/a"}bn for ${tic.latestPeriod}; prior month ${japanTic.previousUsdBn ?? "n/a"}bn.`,
      category: "Rates",
      source_type: "OFFICIAL_DATA",
      available_at: ticAvailableAt,
      occurrence_time: ticOccurrence,
      grouping_key: "global-rates:tic",
      rank: 13,
      metrics: {
        signal_kind: "foreign_treasury_holdings",
        signal_context: "tic_foreign_treasury_holdings",
        period: tic.latestPeriod,
        previous_period: tic.previousPeriod,
        japan_holdings_usd_bn: japanTic.latestUsdBn,
        japan_previous_usd_bn: japanTic.previousUsdBn,
        japan_monthly_change_usd_bn: japanTic.monthlyChangeUsdBn,
        total_foreign_holdings_usd_bn: totalTic?.latestUsdBn ?? null,
        foreign_official_holdings_usd_bn: officialTic?.latestUsdBn ?? null,
        custody_attribution_caveat: tic.custodyAttributionCaveat,
        provider_status: tic.status,
      },
      provenance: [{
        source_type: "US_TREASURY_TIC",
        source_id: "slt-table5",
        url: tic.sourceUrl,
        publisher: tic.sourceName,
      }],
    });
  }

  const bundObservation = latestDailyObservationByAsOf(
    bund10?.latest,
    bund10?.previous5,
    options.asOf,
  );
  const bundAvailableAt = endOfUtcDay(bundObservation?.date);
  const bundIsLatest = Boolean(
    bundObservation
    && bund10?.latest
    && bundObservation.date === bund10.latest.date,
  );
  if (
    bund10
    && bundObservation
    && bundAvailableAt
    && bund10.status !== "UNAVAILABLE"
  ) {
    observed.push({
      evidence_id: `global-rates:bund:${bundObservation.date}`,
      claim_or_fact: `Deutsche Bundesbank 10Y current Federal bond yield for ${bundObservation.date}: ${bundObservation.yieldPct}%.`,
      category: "Rates",
      source_type: "OFFICIAL_DATA",
      available_at: bundAvailableAt,
      occurrence_time: `${bundObservation.date}T00:00:00.000Z`,
      grouping_key: "global-rates:bund",
      rank: 12,
      metrics: {
        signal_kind: "global_rates",
        signal_context: "bund_10y",
        observed_value: bundObservation.yieldPct,
        change_5d_bp: bundIsLatest ? bund10.change5dBp : null,
        provider_status: bundIsLatest ? bund10.status : "PARTIAL",
        source_date: bundObservation.date,
      },
      provenance: [{
        source_type: "BUNDESBANK",
        source_id: bund10.series,
        url: bund10.sourceUrl,
        publisher: bund10.sourceName,
      }],
    });
  }

  const giltObservation = latestDailyObservationByAsOf(
    gilt10?.latest,
    gilt10?.previous5,
    options.asOf,
  );
  const giltAvailableAt = endOfUtcDay(giltObservation?.date);
  const giltIsLatest = Boolean(
    giltObservation
    && gilt10?.latest
    && giltObservation.date === gilt10.latest.date,
  );
  if (
    gilt10
    && giltObservation
    && giltAvailableAt
    && gilt10.status !== "UNAVAILABLE"
  ) {
    observed.push({
      evidence_id: `global-rates:gilt:${giltObservation.date}`,
      claim_or_fact: `Bank of England 10Y nominal gilt par yield for ${giltObservation.date}: ${giltObservation.yieldPct}%.`,
      category: "Rates",
      source_type: "OFFICIAL_DATA",
      available_at: giltAvailableAt,
      occurrence_time: `${giltObservation.date}T00:00:00.000Z`,
      grouping_key: "global-rates:gilt",
      rank: 12,
      metrics: {
        signal_kind: "global_rates",
        signal_context: "gilt_10y",
        observed_value: giltObservation.yieldPct,
        change_5d_bp: giltIsLatest ? gilt10.change5dBp : null,
        provider_status: giltIsLatest ? gilt10.status : "PARTIAL",
        source_date: giltObservation.date,
      },
      provenance: [{
        source_type: "BANK_OF_ENGLAND",
        source_id: gilt10.series,
        url: gilt10.sourceUrl,
        publisher: gilt10.sourceName,
      }],
    });
  }

  const flowRows = [
    ...(japanFlows.rows ?? []),
    ...(japanFlows.latest ? [japanFlows.latest] : []),
  ];
  const flowByPeriod = new Map(flowRows.map((row) => [row.periodLabel, row]));
  const flowObservation = [...flowByPeriod.values()]
    .map((row) => ({
      row,
      endDate: japanMofFlowEndDate(row),
    }))
    .filter((item): item is { row: typeof japanFlows.latest extends infer _T ? NonNullable<typeof japanFlows.latest> : never; endDate: string } =>
      Boolean(item.endDate),
    )
    .filter((item) => isAvailableByAsOf(endOfUtcDay(item.endDate), options.asOf))
    .sort((left, right) => right.endDate.localeCompare(left.endDate))[0] ?? null;
  const flowAvailableAt = endOfUtcDay(flowObservation?.endDate);

  if (
    japanFlows.state === "ready"
    && flowObservation
    && flowAvailableAt
  ) {
    const flow = flowObservation.row;
    observed.push({
      evidence_id: `global-rates:japan-mof-flows:${flowEvidenceKey(flow.periodLabel)}`,
      claim_or_fact: `Japan MOF weekly portfolio flows for ${flow.periodLabel}: residents' outward long-term debt net purchase ${flow.outwardLongTermDebtNetPurchaseJpyBn ?? "n/a"} JPY bn.`,
      category: "Rates",
      source_type: "OFFICIAL_DATA",
      available_at: flowAvailableAt,
      occurrence_time: `${flowObservation.endDate}T00:00:00.000Z`,
      grouping_key: "global-rates:japan-mof-flows",
      rank: 14,
      metrics: {
        signal_kind: "portfolio_flow",
        signal_context: "japan_mof_outward_securities",
        period_label: flow.periodLabel,
        outward_sign_convention: flow.outwardSignConvention,
        outward_long_term_debt_net_purchase_jpy_bn: flow.outwardLongTermDebtNetPurchaseJpyBn,
        outward_total_net_purchase_jpy_bn: flow.outwardTotalNetPurchaseJpyBn,
        outward_equity_net_purchase_jpy_bn: flow.outwardEquityNetPurchaseJpyBn,
        provider_status: japanFlows.state,
        treasury_specific: false,
      },
      provenance: [{
        source_type: "JAPAN_MOF",
        source_id: "international-transactions-in-securities-weekly",
        url: japanFlows.sourceUrl,
        publisher: japanFlows.sourceName,
      }],
    });
  }

  return {
    snapshot: {
      ...result.snapshot,
      observed_evidence: observed,
      sources_status: {
        ...(result.snapshot.sources_status ?? {}),
        japan_mof_jgb_yields: {
          status: jgbObservation ? (jgbIsLatest ? jgb.status : "PARTIAL") : "OPTIONAL_UNAVAILABLE",
          available_at: jgbAvailableAt,
          message: jgbObservation
            ? (jgb.warnings.join(" ") || "Japan MOF JGB constant-maturity yields admitted.")
            : "No Japan MOF JGB observation at or before the requested asOf was available from the bounded provider snapshot.",
        },
        treasury_tic_foreign_holdings: {
          status: ticEligible ? tic.status : "OPTIONAL_UNAVAILABLE",
          available_at: ticEligible ? ticAvailableAt : undefined,
          message: ticEligible
            ? [tic.custodyAttributionCaveat, ...tic.warnings].join(" ")
            : "Latest Treasury TIC period falls after the requested asOf or is unavailable.",
        },
        japan_mof_weekly_flows: {
          status: flowObservation ? "OK" : "OPTIONAL_UNAVAILABLE",
          available_at: flowAvailableAt,
          message: flowObservation
            ? japanFlows.note ?? "Japan MOF weekly flow enrichment admitted."
            : "No Japan MOF weekly flow period ending at or before the requested asOf was available.",
        },
        bundesbank_bund10: {
          status: bundObservation ? (bundIsLatest ? bund10?.status ?? "PARTIAL" : "PARTIAL") : "OPTIONAL_UNAVAILABLE",
          available_at: bundAvailableAt,
          message: bundObservation
            ? (bund10?.warnings.join(" ") || "Bundesbank 10Y Bund enrichment admitted.")
            : "No Bundesbank 10Y Bund observation at or before the requested asOf was available from the bounded provider snapshot.",
        },
        boe_gilt10: {
          status: giltObservation ? (giltIsLatest ? gilt10?.status ?? "PARTIAL" : "PARTIAL") : "OPTIONAL_UNAVAILABLE",
          available_at: giltAvailableAt,
          message: giltObservation
            ? (gilt10?.warnings.join(" ") || "Bank of England 10Y gilt enrichment admitted.")
            : "No Bank of England 10Y gilt observation at or before the requested asOf was available from the bounded provider snapshot.",
        },
      },
    },
    diagnostics: {
      ...result.diagnostics,
      observed_count: observed.length,
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
  let latestAdmittedAvailableAt: string | undefined;

  if (eia.state === "ready") {
    for (const [rawKey, metric] of Object.entries(eia.metrics)) {
      if (!metric) continue;
      const key = rawKey as EiaWeeklyMetricKey;
      const selected = [metric.latest, metric.previous]
        .filter((item): item is NonNullable<typeof metric.previous> => Boolean(item))
        .filter((item) =>
          isAvailableByAsOf(endOfUtcDay(item.period), options.asOf))
        .sort((left, right) => right.period.localeCompare(left.period))[0] ?? null;
      if (!selected) continue;

      const selectedIsLatest = selected.period === metric.latest.period;
      const previous = selectedIsLatest ? metric.previous : null;
      const delta = previous ? selected.value - previous.value : null;
      const unit = selected.units ?? metric.canonicalUnit;
      const availableAt = endOfUtcDay(selected.period);
      if (!availableAt) continue;

      const comparison = previous
        ? `, versus ${formatObservedMetric(previous.value)} ${previous.units ?? metric.canonicalUnit} the prior week${delta === null ? "" : ` (change ${delta >= 0 ? "+" : ""}${formatObservedMetric(delta)} ${unit})`}`
        : "";

      observed.push({
        evidence_id: `eia:${metric.seriesId}:${selected.period}`,
        claim_or_fact: `${metric.label} was ${formatObservedMetric(selected.value)} ${unit} for the week ending ${selected.period}${comparison}.`,
        category: "Energy",
        source_type: "OFFICIAL_DATA",
        available_at: availableAt,
        occurrence_time: `${selected.period}T00:00:00.000Z`,
        grouping_key: EIA_GROUPING_KEY_BY_METRIC[key],
        rank: 30 + added,
        metrics: {
          series_id: metric.seriesId,
          period: selected.period,
          latest_value: selected.value,
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
      latestAdmittedAvailableAt = !latestAdmittedAvailableAt
        || availableAt > latestAdmittedAvailableAt
        ? availableAt
        : latestAdmittedAvailableAt;
      added += 1;
    }
  }

  const effectiveState = eia.state === "ready" && added === 0
    ? "unavailable"
    : eia.state;
  const sourcesStatus = {
    ...(result.snapshot.sources_status ?? {}),
    eia_weekly_petroleum: {
      status: optionalProviderState(effectiveState),
      available_at: latestAdmittedAvailableAt,
      message:
        eia.state === "ready" && added > 0
          ? `${added} official EIA weekly petroleum observations admitted as optional energy evidence.`
          : eia.state === "ready"
            ? "No EIA weekly petroleum observation at or before the requested asOf was available from the bounded provider snapshot."
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

export function augmentCandidateSnapshotWithAcmTermPremium(
  result: CanonicalSnapshotResult,
  acm: NyFedAcmTermPremiumSnapshot,
  options: LoadCanonicalSnapshotOptions,
): CanonicalSnapshotResult {
  const observed = [...(result.snapshot.observed_evidence ?? [])];

  if (acm.status !== "UNAVAILABLE" && acm.latest) {
    const latest = acm.latest;
    const prior = acm.prior5Sessions;
    const changeText = acm.change5dBp === null
      ? ""
      : `; five-session change ${acm.change5dBp >= 0 ? "+" : ""}${acm.change5dBp.toFixed(1)} bp`;

    observed.push({
      evidence_id: `ny-fed-acm:10y:${latest.date}`,
      claim_or_fact: `The New York Fed ACM model estimated the 10-year Treasury term premium at ${latest.termPremium10yPct.toFixed(3)}% on ${latest.date}${changeText}. This is a model estimate published by the New York Fed, not an official estimate of the New York Fed, the Federal Reserve System, or the FOMC.`,
      category: "RATES",
      source_type: "VERIFIED_MACRO_DATA",
      available_at: options.asOf,
      occurrence_time: `${latest.date}T00:00:00.000Z`,
      grouping_key: "rate-context:acm-term-premium",
      rank: 11,
      metrics: {
        signal_kind: "term_structure_model",
        signal_context: "acm_term_premium",
        model: "Adrian-Crump-Moench",
        series_id: "ACMTP10",
        observed_value: latest.termPremium10yPct,
        change_bps: acm.change5dBp,
        prior_5_session_date: prior?.date ?? null,
        prior_5_session_value: prior?.termPremium10yPct ?? null,
        observation_date: latest.date,
        provider_status: acm.status,
        model_estimate_not_official_fed_estimate: true,
      },
      provenance: [{
        source_type: "NY_FED_RESEARCH",
        source_id: "ny-fed-acm:ACMTP10",
        url: acm.sourceUrl,
        publisher: acm.sourceName,
      }],
    });
  }

  return {
    snapshot: {
      ...result.snapshot,
      observed_evidence: observed,
      sources_status: {
        ...(result.snapshot.sources_status ?? {}),
        ny_fed_acm_term_premium: {
          status: acm.status,
          available_at: acm.fetchedAt,
          message: acm.status === "UNAVAILABLE"
            ? acm.warnings.join(" ") || "NY Fed ACM term-premium data were unavailable."
            : `ACMTP10 ${acm.status === "STALE" ? "stale" : "current"} model estimate admitted from the New York Fed workbook${acm.change5dBp === null ? "; five-session change unavailable." : "."}`,
        },
      },
    },
    diagnostics: {
      ...result.diagnostics,
      observed_count: observed.length,
    },
  };
}

function treasuryAuctionAvailableAt(auctionDate: string) {
  // Fiscal Data exposes the auction date but not a machine-readable results
  // publication timestamp. Coupon results are intraday; use a conservative
  // 21:00Z same-day boundary and never admit the row before that timestamp.
  return `${auctionDate}T21:00:00.000Z`;
}

function treasurySupplyAvailableAt(announcementDate: string) {
  // Fiscal Data exposes the announcement date but not the publication time.
  // Use the same conservative 21:00Z boundary so a same-day Dossier cannot
  // see an offering amount before Treasury announced it.
  return `${announcementDate}T21:00:00.000Z`;
}

export function augmentCandidateSnapshotWithTreasuryAuctions(
  result: CanonicalSnapshotResult,
  auctions: TreasuryAuctionSnapshot,
  options: LoadCanonicalSnapshotOptions,
): CanonicalSnapshotResult {
  const observed = [...(result.snapshot.observed_evidence ?? [])];
  const asOfMs = parseTimestamp(options.asOf);
  let added = 0;

  if (auctions.status !== "UNAVAILABLE" && asOfMs !== null) {
    for (const auction of auctions.auctions) {
      const availableAt = treasuryAuctionAvailableAt(auction.auctionDate);
      const availableMs = parseTimestamp(availableAt);
      if (availableMs === null || availableMs > asOfMs) continue;

      const bidderMix = [
        auction.primaryDealerAcceptedPct === null ? null : `primary dealers ${auction.primaryDealerAcceptedPct.toFixed(1)}%`,
        auction.directBidderAcceptedPct === null ? null : `direct bidders ${auction.directBidderAcceptedPct.toFixed(1)}%`,
        auction.indirectBidderAcceptedPct === null ? null : `indirect bidders ${auction.indirectBidderAcceptedPct.toFixed(1)}%`,
      ].filter((value): value is string => Boolean(value));

      const resultDetail = [
        auction.highYieldPct === null ? null : `high yield ${auction.highYieldPct.toFixed(3)}%`,
        auction.bidToCover === null ? null : `bid-to-cover ${auction.bidToCover.toFixed(2)}`,
        bidderMix.length ? bidderMix.join(", ") : null,
      ].filter((value): value is string => Boolean(value)).join("; ");
      const norms = auction.recentComparableNorms;
      const normDetail = norms
        ? [
            norms.highYieldPctMedian === null ? null : `high yield ${norms.highYieldPctMedian.toFixed(3)}%`,
            norms.bidToCoverMedian === null ? null : `bid-to-cover ${norms.bidToCoverMedian.toFixed(2)}`,
            norms.primaryDealerAcceptedPctMedian === null ? null : `primary dealers ${norms.primaryDealerAcceptedPctMedian.toFixed(1)}%`,
            norms.directBidderAcceptedPctMedian === null ? null : `direct bidders ${norms.directBidderAcceptedPctMedian.toFixed(1)}%`,
            norms.indirectBidderAcceptedPctMedian === null ? null : `indirect bidders ${norms.indirectBidderAcceptedPctMedian.toFixed(1)}%`,
          ].filter((value): value is string => Boolean(value)).join(", ")
        : "";

      observed.push({
        evidence_id: `treasury-auction:${auction.cusip}:${auction.auctionDate}`,
        claim_or_fact: `${auction.securityTerm} U.S. Treasury auction on ${auction.auctionDate}${resultDetail ? `: ${resultDetail}` : ""}.${norms ? ` Recent same-term median across ${norms.sampleSize} prior auction${norms.sampleSize === 1 ? "" : "s"} (${norms.auctionDates.join(", ")})${normDetail ? `: ${normDetail}` : ""}.` : " No recent same-term comparison sample is available."} These historical comparisons are context only and do not by themselves classify demand as weak or strong. Fiscal Data does not provide a when-issued yield here, so an auction tail or stop-through is not determined by this observation.`,
        category: "RATES",
        source_type: "OFFICIAL_DATA",
        available_at: availableAt,
        occurrence_time: availableAt,
        grouping_key: `treasury-auction:${auction.securityTerm.toLowerCase()}`,
        rank: 12 + added,
        metrics: {
          signal_kind: "market_reaction",
          signal_context: "treasury_auction",
          cusip: auction.cusip,
          security_type: auction.securityType,
          security_term: auction.securityTerm,
          auction_date: auction.auctionDate,
          issue_date: auction.issueDate,
          maturity_date: auction.maturityDate,
          high_yield_pct: auction.highYieldPct,
          bid_to_cover_ratio: auction.bidToCover,
          offering_amount_usd: auction.offeringAmountUsd,
          competitive_accepted_usd: auction.competitiveAcceptedUsd,
          primary_dealer_accepted_pct: auction.primaryDealerAcceptedPct,
          direct_bidder_accepted_pct: auction.directBidderAcceptedPct,
          indirect_bidder_accepted_pct: auction.indirectBidderAcceptedPct,
          recent_comparable_auction_count: norms?.sampleSize ?? 0,
          recent_comparable_auction_dates: norms?.auctionDates ?? [],
          recent_median_high_yield_pct: norms?.highYieldPctMedian ?? null,
          recent_median_bid_to_cover_ratio: norms?.bidToCoverMedian ?? null,
          recent_median_offering_amount_usd: norms?.offeringAmountUsdMedian ?? null,
          recent_median_primary_dealer_accepted_pct: norms?.primaryDealerAcceptedPctMedian ?? null,
          recent_median_direct_bidder_accepted_pct: norms?.directBidderAcceptedPctMedian ?? null,
          recent_median_indirect_bidder_accepted_pct: norms?.indirectBidderAcceptedPctMedian ?? null,
          auction_quality_state: "UNRESOLVED_WITHOUT_WHEN_ISSUED",
          when_issued_yield_pct: null,
          tail_bps: null,
        },
        provenance: [{
          source_type: "US_TREASURY",
          source_id: `fiscaldata-auction:${auction.cusip}:${auction.auctionDate}`,
          url: auctions.sourceUrl,
          publisher: auctions.sourceName,
        }],
      });
      added += 1;
    }
  }

  const supplyComparisons = auctions.couponSupply.comparisons.filter((item) => {
    const availableMs = parseTimestamp(treasurySupplyAvailableAt(item.currentAnnouncementDate));
    return asOfMs !== null && availableMs !== null && availableMs <= asOfMs;
  });
  const supplyAsOf = supplyComparisons
    .map((item) => item.currentAnnouncementDate)
    .sort()
    .at(-1) ?? null;

  if (supplyAsOf) {
    const allCurrentUsd = supplyComparisons.reduce((sum, item) => sum + item.currentOfferingAmountUsd, 0);
    const allPreviousUsd = supplyComparisons.reduce((sum, item) => sum + item.previousOfferingAmountUsd, 0);
    const longEnd = supplyComparisons.filter((item) =>
      item.securityTerm === "10-Year" || item.securityTerm === "20-Year" || item.securityTerm === "30-Year"
    );
    const longEndCurrentUsd = longEnd.reduce((sum, item) => sum + item.currentOfferingAmountUsd, 0);
    const longEndPreviousUsd = longEnd.reduce((sum, item) => sum + item.previousOfferingAmountUsd, 0);
    const currentBn = allCurrentUsd / 1_000_000_000;
    const previousBn = allPreviousUsd / 1_000_000_000;
    const longEndCurrentBn = longEndCurrentUsd / 1_000_000_000;
    const longEndPreviousBn = longEndPreviousUsd / 1_000_000_000;
    const longEndChangeBn = longEndCurrentBn - longEndPreviousBn;
    const longEndTerms = longEnd
      .map((item) => item.securityTerm)
      .sort((left, right) => left.localeCompare(right));
    const longEndScope = longEndTerms.length
      ? longEndTerms.map((term) => term.replace("-Year", "Y")).join("/")
      : null;
    const termDetail = [...supplyComparisons]
      .sort((a, b) => a.securityTerm.localeCompare(b.securityTerm))
      .map((item) =>
        `${item.securityTerm} ${(item.currentOfferingAmountUsd / 1_000_000_000).toFixed(0)}bn vs ${(item.previousOfferingAmountUsd / 1_000_000_000).toFixed(0)}bn prior`
      )
      .join("; ");
    const availableAt = treasurySupplyAvailableAt(supplyAsOf);

    observed.push({
      evidence_id: `treasury-supply:coupon-sizes:${supplyAsOf}`,
      claim_or_fact: `Treasury's latest announced nominal coupon offering sizes across ${supplyComparisons.length} comparable maturities total ${currentBn.toFixed(1)}bn USD versus ${previousBn.toFixed(1)}bn at the previous same-term auctions. ${longEndScope ? `Long-end ${longEndScope} offering comparisons total ${longEndCurrentBn.toFixed(1)}bn versus ${longEndPreviousBn.toFixed(1)}bn previously (change ${longEndChangeBn >= 0 ? "+" : ""}${longEndChangeBn.toFixed(1)}bn).` : "No comparable 10Y/20Y/30Y offering pair is available in this snapshot."} ${termDetail}. This is announced gross coupon issuance context only; it does not by itself establish net borrowing, auction absorption, term-premium direction, or yield direction.`,
      category: "RATES",
      source_type: "OFFICIAL_DATA",
      available_at: availableAt,
      occurrence_time: availableAt,
      grouping_key: "rate-context:treasury-supply",
      rank: 10,
      metrics: {
        signal_kind: "treasury_supply",
        signal_context: "treasury_supply",
        supply_measure: "announced_nominal_coupon_offering_sizes",
        comparable_maturities: supplyComparisons.length,
        observed_value: longEndCurrentBn,
        previous_value: longEndPreviousBn,
        measurement_unit: "USD billions",
        all_coupon_current_usd_bn: currentBn,
        all_coupon_previous_usd_bn: previousBn,
        all_coupon_change_usd_bn: currentBn - previousBn,
        long_end_current_usd_bn: longEndCurrentBn,
        long_end_previous_usd_bn: longEndPreviousBn,
        long_end_change_usd_bn: longEndChangeBn,
        long_end_maturities_compared: longEnd.length,
        long_end_terms_compared: longEndTerms.join(","),
      },
      provenance: [{
        source_type: "US_TREASURY",
        source_id: `fiscaldata-coupon-supply:${supplyAsOf}`,
        url: auctions.sourceUrl,
        publisher: auctions.sourceName,
      }],
    });
    added += 1;
  }

  const sourcesStatus = {
    ...(result.snapshot.sources_status ?? {}),
    treasury_auctions: {
      status: auctions.status,
      available_at: auctions.asOf ? treasuryAuctionAvailableAt(auctions.asOf) : undefined,
      message: auctions.status === "UNAVAILABLE"
        ? auctions.warnings.join(" ") || "Official Treasury auction results were unavailable."
        : `${auctions.auctions.length} recent nominal coupon Treasury auction result(s) available for official rate context. Auction tail remains unresolved without when-issued evidence.`,
    },
    treasury_coupon_supply: {
      status: supplyAsOf ? auctions.couponSupply.status : "UNAVAILABLE",
      available_at: supplyAsOf ? treasurySupplyAvailableAt(supplyAsOf) : undefined,
      message: supplyAsOf
        ? `${supplyComparisons.length} comparable announced nominal coupon offering-size pair(s) admitted as gross supply context; no deterministic yield-pressure verdict is assigned.`
        : "Comparable announced nominal coupon offering sizes were unavailable by the Dossier as-of boundary.",
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

function tradingEconomicsSystem1Signal(event: TradingEconomicsUsCalendarSnapshot["events"][number]): string | null {
  const surprise = event.surprise;
  if (surprise === null || surprise === 0) return null;

  const text = `${event.category} ${event.event}`.toLowerCase();

  if (/\b(cpi|consumer price|ppi|producer price|pce|inflation|price index)\b/.test(text)) {
    return surprise > 0 ? "HOT_INFLATION_SURPRISE" : "SOFT_INFLATION_SURPRISE";
  }

  if (/\b(unemployment rate|jobless claims|unemployment claims|initial claims|continuing claims)\b/.test(text)) {
    return surprise > 0 ? "WEAK_LABOUR_SURPRISE" : "STRONG_LABOUR_SURPRISE";
  }

  if (/\b(nonfarm|payroll|employment|average hourly earnings|wage growth|wages)\b/.test(text)) {
    return surprise > 0 ? "STRONG_LABOUR_SURPRISE" : "WEAK_LABOUR_SURPRISE";
  }

  if (/\b(pmi|ism|gdp|retail sales)\b/.test(text)) {
    return surprise > 0 ? "STRONG_ACTIVITY_SURPRISE" : "WEAK_ACTIVITY_SURPRISE";
  }

  return null;
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

      const signalContext = tradingEconomicsSystem1Signal(event);

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
          signal_kind: signalContext ? "economic_release" : null,
          signal_context: signalContext,
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

function dollarProviderDateAllowed(value: string | null, asOf: string) {
  if (!value) return false;
  const observation = Date.parse(`${value}T00:00:00.000Z`);
  const cutoff = Date.parse(asOf);
  return Number.isFinite(observation) && Number.isFinite(cutoff) && observation <= cutoff;
}

export function augmentCandidateSnapshotWithDollarPlumbing(
  result: CanonicalSnapshotResult,
  nyFed: NyFedReferenceRatesSnapshot,
  dealers: NyFedPrimaryDealerSnapshot,
  treasuryBills: TreasuryBillSnapshot,
  options: LoadCanonicalSnapshotOptions,
): CanonicalSnapshotResult {
  const observed = [...(result.snapshot.observed_evidence ?? [])];

  const effr = nyFed.rates.find((item) => item.type === "EFFR") ?? null;
  const secured = ["SOFR", "TGCR", "BGCR"]
    .map((type) => nyFed.rates.find((item) => item.type === type))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const sameDate = effr && secured.length
    ? secured.every((item) => item.effectiveDate === effr.effectiveDate)
    : false;
  const securedSpread = effr && sameDate
    ? (secured.reduce((sum, item) => sum + item.percentRate, 0) / secured.length - effr.percentRate) * 100
    : null;

  if (nyFed.rates.length && nyFed.asOf && dollarProviderDateAllowed(nyFed.asOf, options.asOf)) {
    observed.push({
      evidence_id: `system1-dollar:nyfed-rates:${nyFed.asOf}`,
      claim_or_fact: `NY Fed reference rates: EFFR ${effr?.percentRate ?? "n/a"}%; SOFR ${nyFed.rates.find((item) => item.type === "SOFR")?.percentRate ?? "n/a"}%; TGCR ${nyFed.rates.find((item) => item.type === "TGCR")?.percentRate ?? "n/a"}%; BGCR ${nyFed.rates.find((item) => item.type === "BGCR")?.percentRate ?? "n/a"}%.`,
      category: "DOLLAR_LIQUIDITY",
      source_type: "OFFICIAL_DATA",
      available_at: options.asOf,
      occurrence_time: `${nyFed.asOf}T00:00:00.000Z`,
      grouping_key: "system1:dollar-funding",
      rank: 9,
      metrics: {
        effr_pct: effr?.percentRate ?? null,
        sofr_pct: nyFed.rates.find((item) => item.type === "SOFR")?.percentRate ?? null,
        tgcr_pct: nyFed.rates.find((item) => item.type === "TGCR")?.percentRate ?? null,
        bgcr_pct: nyFed.rates.find((item) => item.type === "BGCR")?.percentRate ?? null,
        secured_vs_effr_bps: securedSpread,
        sofr_volume_billions: nyFed.rates.find((item) => item.type === "SOFR")?.volumeInBillions ?? null,
        tgcr_volume_billions: nyFed.rates.find((item) => item.type === "TGCR")?.volumeInBillions ?? null,
        bgcr_volume_billions: nyFed.rates.find((item) => item.type === "BGCR")?.volumeInBillions ?? null,
        provider_status: nyFed.status,
      },
      provenance: [{
        source_type: "NY_FED",
        source_id: "reference-rates",
        url: nyFed.sourceUrl,
        publisher: nyFed.sourceName,
      }],
    });
  }

  if (
    dealers.series.some((item) => item.valueMillions !== null)
    && dealers.asOf
    && dollarProviderDateAllowed(dealers.asOf, options.asOf)
  ) {
    const position = dealers.series.find((item) => item.keyId === "PDPOSGST-TOT") ?? null;
    const failsDeliver = dealers.series.find((item) => item.keyId === "PDFTD-USTET") ?? null;
    const failsReceive = dealers.series.find((item) => item.keyId === "PDFTR-USTET") ?? null;
    observed.push({
      evidence_id: `system1-dollar:dealer-balance-sheet:${dealers.asOf}`,
      claim_or_fact: `NY Fed primary-dealer Treasury position and fails were updated for ${dealers.asOf}.`,
      category: "DOLLAR_LIQUIDITY",
      source_type: "OFFICIAL_DATA",
      available_at: options.asOf,
      occurrence_time: `${dealers.asOf}T00:00:00.000Z`,
      grouping_key: "system1:dealer-balance-sheet",
      rank: 11,
      metrics: {
        treasury_net_position_millions: position?.valueMillions ?? null,
        treasury_net_position_weekly_change_millions: position?.weeklyChangeMillions ?? null,
        fails_deliver_millions: failsDeliver?.valueMillions ?? null,
        fails_deliver_weekly_change_millions: failsDeliver?.weeklyChangeMillions ?? null,
        fails_receive_millions: failsReceive?.valueMillions ?? null,
        fails_receive_weekly_change_millions: failsReceive?.weeklyChangeMillions ?? null,
        provider_status: dealers.status,
      },
      provenance: [{
        source_type: "NY_FED",
        source_id: "primary-dealers",
        url: dealers.sourceUrl,
        publisher: dealers.sourceName,
      }],
    });
  }

  if (
    treasuryBills.points.length
    && treasuryBills.asOf
    && dollarProviderDateAllowed(treasuryBills.asOf, options.asOf)
  ) {
    observed.push({
      evidence_id: `system1-dollar:treasury-bills:${treasuryBills.asOf}`,
      claim_or_fact: `Treasury bills: 3M ${treasuryBills.points.find((item) => item.tenor === "3M")?.yieldPercent ?? "n/a"}%; 6M ${treasuryBills.points.find((item) => item.tenor === "6M")?.yieldPercent ?? "n/a"}%.`,
      category: "DOLLAR_LIQUIDITY",
      source_type: "OFFICIAL_DATA",
      available_at: options.asOf,
      occurrence_time: `${treasuryBills.asOf}T00:00:00.000Z`,
      grouping_key: "system1:treasury-bills",
      rank: 10,
      metrics: {
        bill_3m_pct: treasuryBills.points.find((item) => item.tenor === "3M")?.yieldPercent ?? null,
        bill_6m_pct: treasuryBills.points.find((item) => item.tenor === "6M")?.yieldPercent ?? null,
        provider_status: treasuryBills.status,
      },
      provenance: [{
        source_type: "US_TREASURY",
        source_id: "daily-treasury-yield-curve",
        url: treasuryBills.sourceUrl,
        publisher: treasuryBills.sourceName,
      }],
    });
  }

  result.snapshot.sources_status = {
    ...(result.snapshot.sources_status ?? {}),
    ny_fed_reference_rates: {
      status: nyFed.status,
      available_at: nyFed.asOf ?? undefined,
      message: nyFed.warnings.join(" ") || "NY Fed reference rates available for System 1 dollar-liquidity classification.",
    },
    ny_fed_primary_dealers: {
      status: dealers.status,
      available_at: dealers.asOf ?? undefined,
      message: dealers.warnings.join(" ") || "NY Fed primary-dealer data available for System 1 dollar-liquidity context.",
    },
    treasury_bills: {
      status: treasuryBills.status,
      available_at: treasuryBills.asOf ?? undefined,
      message: treasuryBills.warnings.join(" ") || "Treasury bill tenors available for System 1 dollar-liquidity classification.",
    },
  };

  return {
    snapshot: {
      ...result.snapshot,
      observed_evidence: observed,
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

  const [
    marketMonitorResult,
    eiaResult,
    tradingEconomicsResult,
    nyFedResult,
    dealerResult,
    treasuryBillsResult,
    treasuryAuctionsResult,
    acmTermPremiumResult,
    japanJgbResult,
    treasuryTicResult,
    japanMofFlowsResult,
    bundesbankBundResult,
    boeGiltResult,
  ] = await Promise.allSettled([
    import("../market-monitor.ts").then(({ getMarketMonitor }) => getMarketMonitor()),
    fetchEiaWeeklyPetroleumSnapshot(),
    fetchTradingEconomicsUsCalendarSnapshot({
      from: calendarFrom,
      to: calendarTo,
    }),
    fetchNyFedReferenceRates(new Date(asOfMs)),
    fetchNyFedPrimaryDealers(new Date(asOfMs)),
    fetchTreasuryBills(new Date(asOfMs)),
    fetchTreasuryAuctions(new Date(asOfMs)),
    fetchNyFedAcmTermPremium({
      asOf: new Date(asOfMs),
      now: new Date(),
    }),
    fetchJapanMofJgbYields(new Date(asOfMs)),
    fetchTreasuryTicTable5(),
    fetchJapanMofWeeklyFlows(),
    fetchBundesbankBund10(new Date(asOfMs)),
    fetchBoeGilt10(new Date(asOfMs)),
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

  if (
    japanJgbResult.status === "fulfilled"
    && treasuryTicResult.status === "fulfilled"
    && japanMofFlowsResult.status === "fulfilled"
    && bundesbankBundResult.status === "fulfilled"
    && boeGiltResult.status === "fulfilled"
  ) {
    result = augmentCandidateSnapshotWithGlobalRatesEvidence(
      result,
      japanJgbResult.value,
      treasuryTicResult.value,
      japanMofFlowsResult.value,
      options,
      bundesbankBundResult.value,
      boeGiltResult.value,
    );
  } else {
    result.snapshot.sources_status = {
      ...(result.snapshot.sources_status ?? {}),
      global_rates_foreign_demand: {
        status: "WARNING",
        message: "One or more optional global-rates/foreign-demand providers failed before enrichment; affected legs remain unresolved.",
      },
    };
  }

  if (
    nyFedResult.status === "fulfilled"
    && dealerResult.status === "fulfilled"
    && treasuryBillsResult.status === "fulfilled"
  ) {
    result = augmentCandidateSnapshotWithDollarPlumbing(
      result,
      nyFedResult.value,
      dealerResult.value,
      treasuryBillsResult.value,
      options,
    );
  } else {
    result.snapshot.sources_status = {
      ...(result.snapshot.sources_status ?? {}),
      dollar_liquidity_system1: {
        status: "WARNING",
        message: "One or more System 1 dollar-liquidity providers were unavailable; the classifier will fail closed to unresolved where necessary.",
      },
    };
  }

  if (acmTermPremiumResult.status === "fulfilled") {
    result = augmentCandidateSnapshotWithAcmTermPremium(
      result,
      acmTermPremiumResult.value,
      options,
    );
  } else {
    result.snapshot.sources_status = {
      ...(result.snapshot.sources_status ?? {}),
      ny_fed_acm_term_premium: {
        status: "UNAVAILABLE",
        message: `NY Fed ACM term-premium enrichment failed closed: ${acmTermPremiumResult.reason instanceof Error ? acmTermPremiumResult.reason.message : String(acmTermPremiumResult.reason)}`,
      },
    };
  }

  if (treasuryAuctionsResult.status === "fulfilled") {
    result = augmentCandidateSnapshotWithTreasuryAuctions(
      result,
      treasuryAuctionsResult.value,
      options,
    );
  } else {
    result.snapshot.sources_status = {
      ...(result.snapshot.sources_status ?? {}),
      treasury_auctions: {
        status: "UNAVAILABLE",
        message: `Official Treasury auction enrichment failed closed: ${treasuryAuctionsResult.reason instanceof Error ? treasuryAuctionsResult.reason.message : String(treasuryAuctionsResult.reason)}`,
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

  // Intraday reactions are deliberately second-stage enrichment: the trigger
  // set must include freshly admitted macro-calendar observations above.
  const intradayReactionTriggers = selectIntradayReactionTriggers(result, options.asOf);
  try {
    const twelveDataReactions = await fetchTwelveDataReactionSnapshot({
      asOf: options.asOf,
      triggers: intradayReactionTriggers,
    });
    result = augmentCandidateSnapshotWithTwelveDataReactions(
      result,
      twelveDataReactions,
      options,
    );
  } catch (error) {
    result.snapshot.sources_status = {
      ...(result.snapshot.sources_status ?? {}),
      twelve_data_intraday_reactions: {
        status: "OPTIONAL_UNAVAILABLE",
        message: `Optional Twelve Data intraday enrichment failed closed: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }

  return result;
}
