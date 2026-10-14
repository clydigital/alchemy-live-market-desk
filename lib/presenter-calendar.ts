import type { EconomicCalendarEvent } from "./calendar.ts";
import type { ForwardEarningsResult } from "./forward-earnings-sources.ts";
import { macroEtUtcTimestamp } from "./market-calendar-clock.ts";
import type { MarketEventV1 } from "./market-events.ts";

export const PRESENTER_CALENDAR_CONTRACT = "presenter-calendar/1" as const;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MYT_OFFSET_MS = 8 * HOUR_MS;

export type PresenterCalendarEvent = {
  id: string;
  kind: "economic" | "earnings";
  title: string;
  status: "scheduled" | "released" | "cancelled" | "postponed" | "unknown";
  localDate: string;
  scheduledAt: string | null;
  timeLabel: string;
  timePrecision: "exact" | "date" | "tbc";
  actual: string | null;
  consensus: string | null;
  previous: string | null;
  revisedPrevious: string | null;
  releasedAt: string | null;
  sourceName: string;
  sourceUrl: string;
  sourceRecordRefs: string[];
  verificationState: "official" | "desk_record" | "reported" | "unverified";
  affectedAssets: string[];
  decidingQuestion: string;
};

export type PresenterCalendar = {
  contractVersion: typeof PRESENTER_CALENDAR_CONTRACT;
  asOf: string;
  timezone: "Asia/Kuala_Lumpur";
  tradingWeekStart: string;
  tradingWeekEndExclusive: string;
  sourceHealth: {
    macro: "unknown" | "partial" | "unavailable";
    earnings: ForwardEarningsResult["coverage"];
    warnings: string[];
  };
  events: PresenterCalendarEvent[];
  windows: {
    next24h: string[];
    next7d: string[];
    released: string[];
  };
};

function nonempty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function validSource(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function safeTimestamp(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function sourceDay(value: string | null | undefined): string | null {
  const date = value?.slice(0, 10) || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const timestamp = Date.parse(date + "T00:00:00Z");
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date
    ? date : null;
}

/** Convert a genuinely known instant to its MYT calendar day; never reinterpret a source date as an instant. */
function mytDay(timestamp: number): string {
  return new Date(timestamp + MYT_OFFSET_MS).toISOString().slice(0, 10);
}

function displayTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(timestamp)) + " MYT";
}

function economicRow(row: EconomicCalendarEvent): PresenterCalendarEvent | null {
  const day = sourceDay(row.date);
  const exact = safeTimestamp(row.date)
    ?? (day ? macroEtUtcTimestamp(day, row.timeLabel) : null);
  if (!day || !validSource(row.sourceUrl)) return null;
  const status = row.status === "Released" ? "released" : "scheduled";
  return {
    id: "macro:" + row.id,
    kind: "economic",
    title: row.event,
    status,
    localDate: exact !== null ? mytDay(exact) : day,
    scheduledAt: exact !== null ? new Date(exact).toISOString() : null,
    timeLabel: exact !== null ? displayTime(exact) + " · " + row.timeLabel : row.timeLabel || "Time unconfirmed",
    timePrecision: exact !== null ? "exact" : row.timeLabel && !/tbc|unconfirmed|pending/i.test(row.timeLabel) ? "date" : "tbc",
    actual: nonempty(row.actual),
    consensus: nonempty(row.consensus),
    previous: nonempty(row.previous),
    revisedPrevious: nonempty(row.revisedPrevious ?? null),
    // This adapter does not supply a source-verified published-at clock.
    // Source date/time is a scheduled instant, NOT a release timestamp.
    releasedAt: null,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    sourceRecordRefs: [row.id],
    verificationState: row.sourceKind === "desk-record" ? "desk_record" : "official",
    affectedAssets: row.affectedAssets || [],
    decidingQuestion: row.decidingQuestion,
  };
}

function earningsRow(row: MarketEventV1): PresenterCalendarEvent | null {
  if (row.eventType !== "earnings" || !validSource(row.sourceUrl)) return null;
  const day = sourceDay(row.startAt);
  const exact = row.timePrecision === "exact" ? safeTimestamp(row.startAt) : null;
  if (!day) return null;
  // Earnings calendar providers only supply scheduled/estimated dates.
  // A vendor status of "reported" is not proof of financial results.
  return {
    id: "earnings:" + row.id,
    kind: "earnings",
    title: row.title,
    status: row.status === "cancelled" ? "cancelled" : row.status === "postponed" ? "postponed" : "scheduled",
    localDate: exact !== null ? mytDay(exact) : day,
    scheduledAt: exact !== null ? new Date(exact).toISOString() : null,
    timeLabel: exact !== null ? displayTime(exact) + (row.timeLabel ? " · " + row.timeLabel : "") : row.timeLabel || "Time unconfirmed",
    timePrecision: exact !== null ? "exact" : row.timePrecision === "tbc" ? "tbc" : "date",
    actual: null,
    consensus: nonempty(row.expectation), // labelled expectation: may include EPS estimates; never manufacture actual
    previous: null,
    revisedPrevious: null,
    releasedAt: null,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    sourceRecordRefs: row.sourceRecordRefs || [],
    verificationState: row.verificationState === "official" ? "official" : row.verificationState === "reported" ? "reported" : "unverified",
    affectedAssets: row.affectedAssets || [],
    decidingQuestion: row.decisiveVariable,
  };
}

function stableTimeSort(a: PresenterCalendarEvent, b: PresenterCalendarEvent) {
  const aTime = a.scheduledAt ? Date.parse(a.scheduledAt) : Date.parse(a.localDate + "T23:59:59Z");
  const bTime = b.scheduledAt ? Date.parse(b.scheduledAt) : Date.parse(b.localDate + "T23:59:59Z");
  return aTime - bTime || a.id.localeCompare(b.id);
}

export function buildPresenterCalendar(
  macro: EconomicCalendarEvent[],
  earnings: ForwardEarningsResult,
  now: Date = new Date(),
  macroFailed = false,
): PresenterCalendar {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid calendar as-of date");
  const nowMs = now.getTime();
  const today = mytDay(nowMs);
  const nextSevenDay = new Date(Date.parse(today + "T00:00:00Z") + 7 * DAY_MS).toISOString().slice(0, 10);
  const localDayStart = Date.parse(today + "T00:00:00Z");
  const dowFromMonday = (new Date(localDayStart).getUTCDay() + 6) % 7;
  const monday = new Date(localDayStart - dowFromMonday * DAY_MS).toISOString().slice(0, 10);
  const mondayUtc = Date.parse(monday + "T00:00:00+08:00");
  const weekStart = new Date(mondayUtc + MYT_OFFSET_MS).toISOString().slice(0, 19) + "+08:00";
  const weekEnd = new Date(mondayUtc + 7 * DAY_MS + MYT_OFFSET_MS).toISOString().slice(0, 19) + "+08:00";

  const byId = new Map<string, PresenterCalendarEvent>();
  [...macro.map(economicRow), ...earnings.events.map(earningsRow)]
    .filter((item): item is PresenterCalendarEvent => item !== null)
    .forEach(item => byId.set(item.id, item));
  const events = [...byId.values()].sort(stableTimeSort);
  const windows = {
    next24h: [] as string[],
    next7d: [] as string[],
    released: [] as string[],
  };
  for (const item of events) {
    const scheduledMs = item.scheduledAt ? Date.parse(item.scheduledAt) : null;
    if (item.status === "scheduled"
      && scheduledMs !== null && scheduledMs >= nowMs && scheduledMs < nowMs + DAY_MS) {
      windows.next24h.push(item.id);
    }
    if (item.status === "scheduled" && item.localDate >= today && item.localDate < nextSevenDay) {
      windows.next7d.push(item.id);
    }
    if (item.status === "released" && item.localDate >= monday
      && Date.parse(item.localDate + "T00:00:00+08:00") < mondayUtc + 7 * DAY_MS
      && (scheduledMs === null || scheduledMs <= nowMs)) {
      windows.released.push(item.id);
    }
  }

  const warnings = [
    ...(macroFailed ? ["Economic calendar adapter failed; events may be incomplete."] : []),
    ...(!macro.length && !macroFailed ? ["No economic calendar rows returned; provider health is unknown."] : []),
    ...(earnings.warning ? [earnings.warning] : []),
  ];
  return {
    contractVersion: PRESENTER_CALENDAR_CONTRACT,
    asOf: now.toISOString(),
    timezone: "Asia/Kuala_Lumpur",
    tradingWeekStart: weekStart,
    tradingWeekEndExclusive: weekEnd,
    sourceHealth: {
      // getEconomicCalendar hides some provider failures behind fallbacks.
      // Do not promote non-empty rows into an unjustified "healthy" claim.
      macro: macroFailed || !macro.length ? "unavailable" : "unknown",
      earnings: earnings.coverage,
      warnings,
    },
    events,
    windows,
  };
}
