import { createHash } from "node:crypto";

import type { EconomicCalendarEvent } from "@/lib/calendar";

export const MARKET_EVENT_VERSION = "market-event-v1" as const;

export type MarketEventType =
  | "economic_release"
  | "central_bank_decision"
  | "central_bank_speech"
  | "conference_or_symposium"
  | "geopolitical_meeting"
  | "sanctions_or_policy_deadline"
  | "energy_policy_meeting"
  | "treasury_or_fiscal_event"
  | "earnings"
  | "regulatory_or_legal_event"
  | "other_verified_market_event";

export type MarketEventTimePrecision = "exact" | "date" | "window" | "tbc";
export type MarketEventStatus = "scheduled" | "reported" | "confirmed" | "completed" | "cancelled" | "postponed";
export type MarketEventVerificationState = "official" | "corroborated" | "reported" | "unverified";

export type MarketEventV1 = {
  version: typeof MARKET_EVENT_VERSION;
  id: string;
  /** Stable identity for the real-world occurrence; timing is mutable schedule data. */
  occurrenceKey: string;
  eventType: MarketEventType;
  title: string;
  startAt: string | null;
  endAt: string | null;
  timeLabel: string | null;
  timePrecision: MarketEventTimePrecision;
  status: MarketEventStatus;
  verificationState: MarketEventVerificationState;
  participants: string[];
  geography: string[];
  affectedAssets: string[];
  linkedStoryIds: string[];
  linkedStorySlugs: string[];
  decisiveVariable: string;
  transmission: string;
  expectedStage: string | null;
  expectation: string | null;
  sourceName: string;
  sourceUrl: string;
  sourceUrls: string[];
  sourceRecordRefs: string[];
  firstSeenAt: string;
  lastVerifiedAt: string;
  updatedAt: string;
};

export type MarketEventInput = Omit<Partial<MarketEventV1>, "version" | "id" | "firstSeenAt" | "lastVerifiedAt" | "updatedAt"> & {
  id?: string;
  firstSeenAt?: string;
  lastVerifiedAt?: string;
  updatedAt?: string;
};

export type EarningsMarketEventInput = {
  id: string;
  companyName: string;
  callDate: string;
  occurrenceKey?: string;
  sourceUrl?: string | null;
  timeLabel?: string | null;
  linkedStoryIds?: string[];
  linkedStorySlugs?: string[];
  affectedAssets?: string[];
  decisiveVariable?: string | null;
  transmission?: string | null;
};

export type EarningsCallMarketEventRow = {
  id: string;
  ticker: string;
  company_name: string;
  fiscal_period: string;
  call_date: string | null;
  event_time_label?: string | null;
  source_url?: string | null;
  relevance_reason: string | null;
  guidance: string | null;
  demand: string | null;
};

const EMPTY_DATE = /^\d{4}-\d{2}-\d{2}$/;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function list(value: unknown) {
  return [...new Set((Array.isArray(value) ? value : []).map(clean).filter(Boolean))];
}

function validTimestamp(value: unknown) {
  const text = clean(value);
  return text && Number.isFinite(Date.parse(text)) ? text : null;
}

function offsetAwareTimestamp(value: unknown) {
  const text = clean(value);
  if (!text || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) return null;
  return Number.isFinite(Date.parse(text)) ? text : null;
}

function dateOnly(value: unknown) {
  const text = clean(value);
  return EMPTY_DATE.test(text) ? text : null;
}

function safeUrl(value: unknown) {
  const text = clean(value);
  try {
    return new URL(text).protocol === "https:" ? text : "";
  } catch {
    return "";
  }
}

function canonicalTitle(value: unknown) {
  return clean(value).toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function canonicalOccurrenceKey(value: unknown) {
  return clean(value).toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function marketEventSignature(input: Pick<MarketEventV1, "eventType" | "title" | "occurrenceKey">) {
  return [input.eventType, canonicalTitle(input.title), canonicalOccurrenceKey(input.occurrenceKey)].join("|");
}

function stableId(input: Pick<MarketEventV1, "eventType" | "title" | "occurrenceKey">) {
  const key = marketEventSignature(input);
  return `mev_${createHash("sha256").update(key).digest("hex").slice(0, 24)}`;
}

function inferPrecision(startAt: string | null, requested: MarketEventTimePrecision | undefined) {
  if (requested) return requested;
  if (!startAt) return "tbc" as const;
  return offsetAwareTimestamp(startAt) ? "exact" as const : "date" as const;
}

function inferStatus(value: unknown): MarketEventStatus {
  const normalized = clean(value).toLowerCase();
  return ["scheduled", "reported", "confirmed", "completed", "cancelled", "postponed"].includes(normalized)
    ? normalized as MarketEventStatus
    : "scheduled";
}

function inferVerification(value: unknown): MarketEventVerificationState {
  const normalized = clean(value).toLowerCase();
  return ["official", "corroborated", "reported", "unverified"].includes(normalized)
    ? normalized as MarketEventVerificationState
    : "unverified";
}

export function normaliseMarketEvent(input: MarketEventInput): MarketEventV1 | null {
  const title = clean(input.title);
  const sourceUrl = safeUrl(input.sourceUrl);
  const sourceName = clean(input.sourceName);
  if (!title || !sourceUrl || !sourceName) return null;

  const now = new Date().toISOString();
  const startAt = offsetAwareTimestamp(input.startAt) || dateOnly(input.startAt);
  const endAt = offsetAwareTimestamp(input.endAt) || dateOnly(input.endAt);
  const sourceRecordRefs = list([...(input.sourceRecordRefs || []), input.id]);
  const sourceUrls = list([...(input.sourceUrls || []), sourceUrl]);
  const timePrecision = inferPrecision(startAt, input.timePrecision);
  if (timePrecision === "exact" && !offsetAwareTimestamp(input.startAt)) return null;
  const eventType = input.eventType || "other_verified_market_event";
  const occurrenceKey = canonicalOccurrenceKey(input.occurrenceKey) || canonicalTitle(title);
  const event: MarketEventV1 = {
    version: MARKET_EVENT_VERSION,
    id: stableId({ eventType, title, occurrenceKey }),
    occurrenceKey,
    eventType,
    title,
    startAt,
    endAt,
    timeLabel: clean(input.timeLabel) || null,
    timePrecision,
    status: inferStatus(input.status),
    verificationState: inferVerification(input.verificationState),
    participants: list(input.participants),
    geography: list(input.geography),
    affectedAssets: list(input.affectedAssets),
    linkedStoryIds: list(input.linkedStoryIds),
    linkedStorySlugs: list(input.linkedStorySlugs),
    decisiveVariable: clean(input.decisiveVariable),
    transmission: clean(input.transmission),
    expectedStage: clean(input.expectedStage) || null,
    expectation: clean(input.expectation) || null,
    sourceName,
    sourceUrl,
    sourceUrls,
    sourceRecordRefs,
    firstSeenAt: validTimestamp(input.firstSeenAt) || now,
    lastVerifiedAt: validTimestamp(input.lastVerifiedAt) || now,
    updatedAt: validTimestamp(input.updatedAt) || now,
  };
  return event;
}

export function marketEventFromEconomicCalendar(event: EconomicCalendarEvent): MarketEventV1 | null {
  const centralBank = event.category === "Central bank";
  const occurrenceKey = event.referencePeriod
    ? `calendar:${event.event}:${event.referencePeriod}`
    : `calendar:${event.id}`;
  return normaliseMarketEvent({
    id: `calendar:${event.id}`,
    eventType: centralBank ? "central_bank_decision" : "economic_release",
    title: event.event,
    occurrenceKey,
    startAt: event.date,
    timeLabel: event.timeLabel,
    timePrecision: offsetAwareTimestamp(event.date) ? "exact" : dateOnly(event.date) ? "date" : "tbc",
    status: event.status === "Released" ? "completed" : "scheduled",
    verificationState: event.sourceKind === "desk-record" ? "corroborated" : "official",
    geography: [event.country],
    affectedAssets: event.affectedAssets,
    decisiveVariable: event.decidingQuestion,
    transmission: event.decidingQuestion,
    sourceName: event.sourceName,
    sourceUrl: event.sourceUrl,
    sourceRecordRefs: [event.id],
  });
}

export function marketEventFromEarnings(input: EarningsMarketEventInput): MarketEventV1 | null {
  return normaliseMarketEvent({
    id: `earnings:${input.id}`,
    occurrenceKey: input.occurrenceKey || `earnings:${input.companyName}:${input.id}`,
    eventType: "earnings",
    title: `${input.companyName} earnings`,
    startAt: input.callDate,
    timeLabel: input.timeLabel,
    timePrecision: offsetAwareTimestamp(input.callDate) ? "exact" : dateOnly(input.callDate) ? "date" : "tbc",
    status: "scheduled",
    verificationState: "corroborated",
    affectedAssets: input.affectedAssets,
    linkedStoryIds: input.linkedStoryIds,
    linkedStorySlugs: input.linkedStorySlugs,
    decisiveVariable: input.decisiveVariable || "What changes in demand, guidance or cash conversion?",
    transmission: input.transmission || "Earnings and guidance can update the linked company and theme view.",
    sourceName: input.companyName,
    sourceUrl: input.sourceUrl || "",
    sourceRecordRefs: [input.id],
  });
}

export function marketEventFromEarningsCallRow(row: EarningsCallMarketEventRow): MarketEventV1 | null {
  return marketEventFromEarnings({
    id: row.id,
    companyName: row.company_name,
    callDate: row.call_date || "",
    occurrenceKey: `earnings:${row.ticker}:${row.fiscal_period}`,
    timeLabel: row.event_time_label,
    sourceUrl: row.source_url,
    affectedAssets: [row.ticker],
    decisiveVariable: row.relevance_reason,
    transmission: row.guidance || row.demand,
  });
}

export function dedupeMarketEvents(events: MarketEventV1[]) {
  const byKey = new Map<string, MarketEventV1>();
  for (const event of events) {
    const key = marketEventSignature(event);
    const current = byKey.get(key);
    if (!current || Date.parse(event.updatedAt) >= Date.parse(current.updatedAt)) {
      byKey.set(key, current ? {
        ...current,
        ...event,
        participants: list([...current.participants, ...event.participants]),
        geography: list([...current.geography, ...event.geography]),
        affectedAssets: list([...current.affectedAssets, ...event.affectedAssets]),
        linkedStoryIds: list([...current.linkedStoryIds, ...event.linkedStoryIds]),
        linkedStorySlugs: list([...current.linkedStorySlugs, ...event.linkedStorySlugs]),
        sourceUrls: list([...current.sourceUrls, ...event.sourceUrls, current.sourceUrl, event.sourceUrl]),
        sourceRecordRefs: list([...current.sourceRecordRefs, ...event.sourceRecordRefs]),
        firstSeenAt: Date.parse(current.firstSeenAt) <= Date.parse(event.firstSeenAt) ? current.firstSeenAt : event.firstSeenAt,
      } : event);
    }
  }
  return [...byKey.values()].sort((a, b) => (a.startAt || "9999").localeCompare(b.startAt || "9999"));
}
