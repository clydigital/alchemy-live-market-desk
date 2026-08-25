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
  sourceUrl?: string | null;
  linkedStoryIds?: string[];
  linkedStorySlugs?: string[];
  affectedAssets?: string[];
  decisiveVariable?: string | null;
  transmission?: string | null;
};

const EMPTY_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;

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

function safeUrl(value: unknown) {
  const text = clean(value);
  try {
    return new URL(text).protocol === "https:" ? text : "";
  } catch {
    return "";
  }
}

function stableId(input: Pick<MarketEventV1, "eventType" | "title" | "startAt" | "sourceUrl"> & { sourceRecordRefs?: string[] }) {
  const sourceRef = input.sourceRecordRefs?.[0] || input.sourceUrl;
  const key = [input.eventType, clean(input.title).toLowerCase(), input.startAt || "", sourceRef].join("|");
  return `mev_${createHash("sha256").update(key).digest("hex").slice(0, 24)}`;
}

function inferPrecision(startAt: string | null, requested: MarketEventTimePrecision | undefined) {
  if (requested) return requested;
  if (!startAt) return "tbc" as const;
  return ISO_DATE.test(startAt) ? "exact" as const : "date" as const;
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
  const startAt = validTimestamp(input.startAt) || (EMPTY_DATE.test(clean(input.startAt)) ? clean(input.startAt) : null);
  const endAt = validTimestamp(input.endAt) || (EMPTY_DATE.test(clean(input.endAt)) ? clean(input.endAt) : null);
  const event: MarketEventV1 = {
    version: MARKET_EVENT_VERSION,
    id: clean(input.id) || stableId({ eventType: input.eventType || "other_verified_market_event", title, startAt, sourceUrl, sourceRecordRefs: list(input.sourceRecordRefs) }),
    eventType: input.eventType || "other_verified_market_event",
    title,
    startAt,
    endAt,
    timeLabel: clean(input.timeLabel) || null,
    timePrecision: inferPrecision(startAt, input.timePrecision),
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
    sourceRecordRefs: list(input.sourceRecordRefs),
    firstSeenAt: validTimestamp(input.firstSeenAt) || now,
    lastVerifiedAt: validTimestamp(input.lastVerifiedAt) || now,
    updatedAt: validTimestamp(input.updatedAt) || now,
  };
  if (event.timePrecision === "exact" && !event.startAt) return null;
  return event;
}

export function marketEventFromEconomicCalendar(event: EconomicCalendarEvent): MarketEventV1 | null {
  const centralBank = event.category === "Central bank";
  const hasTime = /^\d{1,2}:\d{2}\s+[A-Z]{2,5}$/i.test(event.timeLabel.trim());
  return normaliseMarketEvent({
    id: `calendar:${event.id}`,
    eventType: centralBank ? "central_bank_decision" : "economic_release",
    title: event.event,
    startAt: event.date,
    timeLabel: event.timeLabel,
    timePrecision: hasTime ? "exact" : "tbc",
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
    eventType: "earnings",
    title: `${input.companyName} earnings`,
    startAt: input.callDate,
    timePrecision: ISO_DATE.test(input.callDate) ? "exact" : "date",
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

export function dedupeMarketEvents(events: MarketEventV1[]) {
  const byKey = new Map<string, MarketEventV1>();
  for (const event of events) {
    const key = event.id || event.sourceRecordRefs[0] || `${event.eventType}|${event.title.toLowerCase()}|${event.startAt || ""}`;
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
        sourceRecordRefs: list([...current.sourceRecordRefs, ...event.sourceRecordRefs]),
        firstSeenAt: Date.parse(current.firstSeenAt) <= Date.parse(event.firstSeenAt) ? current.firstSeenAt : event.firstSeenAt,
      } : event);
    }
  }
  return [...byKey.values()].sort((a, b) => (a.startAt || "9999").localeCompare(b.startAt || "9999"));
}
