import "server-only";

import { getEconomicCalendar } from "@/lib/calendar";
import { acquireEventHorizonEvents, type EventHorizonCoverage } from "@/lib/event-horizon-acquisition";
import { eventHorizonUpcomingLane } from "@/lib/event-horizon-lanes";
import {
  dedupeMarketEvents,
  marketEventFromEconomicCalendar,
  marketEventFromEarningsCallRow,
  type EarningsCallMarketEventRow,
  type MarketEventV1,
} from "@/lib/market-events";
import { marketEventFromRow, marketEventToRow, type MarketEventRow } from "@/lib/market-event-persistence";
import type { EarningsItem, EditionUpcoming, EconomicCalendarItem, GeopoliticalClockItem } from "@/lib/intelligence/edition";
import { intelligenceRest } from "@/lib/intelligence/supabase";

type EarningsCallRow = EarningsCallMarketEventRow;

type EventHorizonResult = {
  upcoming: EditionUpcoming;
  events: MarketEventV1[];
  warnings: string[];
  coverage: EventHorizonCoverage[];
};

function safeDate(value: string | null | undefined) {
  return value && Number.isFinite(Date.parse(value)) ? value : null;
}

function calendarItem(event: Awaited<ReturnType<typeof getEconomicCalendar>>[number]): EconomicCalendarItem {
  return {
    time: event.timeLabel ? `${event.date} · ${event.timeLabel}` : event.date,
    event: event.event,
    consensus: event.consensus,
    prior: event.revisedPrevious || event.previous,
    exposedAssets: event.affectedAssets,
    whyItMatters: event.decidingQuestion,
  };
}

function marketEventCalendarItem(event: MarketEventV1): EconomicCalendarItem {
  const time = event.startAt
    ? `${event.startAt}${event.timeLabel ? ` · ${event.timeLabel}` : ""}`
    : event.timeLabel || "Time TBC";
  return {
    time,
    event: event.title,
    consensus: null,
    prior: null,
    exposedAssets: event.affectedAssets,
    whyItMatters: event.decisiveVariable || event.transmission,
  };
}

function earningsItem(call: EarningsCallRow, linkedStory?: { title?: string; assets?: string[] }) : EarningsItem {
  return {
    company: call.company_name,
    time: call.call_date ? `${call.call_date}${call.event_time_label ? ` · ${call.event_time_label}` : ""}` : "TBC",
    decisiveVariable: call.relevance_reason || "What changes in demand, guidance or cash conversion?",
    linkedTheme: linkedStory?.title || call.ticker,
    confirmationCase: call.guidance || "Guidance and demand remain consistent with the current view.",
    disappointmentCase: call.demand || "Demand or guidance weakens against the current view.",
  };
}

function geopoliticalClockItem(event: MarketEventV1): GeopoliticalClockItem {
  return {
    time: event.startAt,
    event: event.title,
    participants: event.participants,
    transmission: event.transmission || event.decisiveVariable,
    decisiveOutcome: event.decisiveVariable,
    scheduled: ["scheduled", "confirmed", "reported"].includes(event.status),
    eventType: event.eventType,
    timePrecision: event.timePrecision,
    verificationState: event.verificationState,
    affectedAssets: event.affectedAssets,
    sourceName: event.sourceName,
    sourceUrl: event.sourceUrl,
  };
}

async function loadStoredEvents() {
  try {
    return await intelligenceRest<MarketEventRow[]>(
      "market_events?select=*&status=in.(scheduled,reported,confirmed)&order=start_at.asc.nullslast&limit=240",
    );
  } catch {
    return [];
  }
}

async function loadEarningsCalls() {
  try {
    return await intelligenceRest<EarningsCallRow[]>(
      "earnings_calls?select=id,ticker,company_name,fiscal_period,call_date,event_time_label,source_url,relevance_reason,guidance,demand&call_date=not.is.null&order=call_date.asc&limit=80",
    );
  } catch {
    return [];
  }
}

async function persistEvents(events: MarketEventV1[]) {
  if (!events.length) return null;
  try {
    return await intelligenceRest<MarketEventRow[]>("market_events?on_conflict=event_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(events.map(marketEventToRow)),
    });
  } catch {
    return null;
  }
}

export async function buildEditionEventHorizon(stories: Array<{ id: string; title: string; assets: string[] }>): Promise<EventHorizonResult> {
  const warnings: string[] = [];
  const [calendar, storedRows, earningsCalls, acquisition] = await Promise.all([
    getEconomicCalendar().catch((error) => {
      warnings.push(`Economic calendar unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return [] as Awaited<ReturnType<typeof getEconomicCalendar>>;
    }),
    loadStoredEvents(),
    loadEarningsCalls(),
    acquireEventHorizonEvents(),
  ]);
  const calendarEvents = calendar.map(marketEventFromEconomicCalendar).filter((event): event is MarketEventV1 => Boolean(event));
  const earningsEvents = earningsCalls.map((call) => {
    const story = stories.find((candidate) => candidate.assets.includes(call.ticker));
    const event = marketEventFromEarningsCallRow(call);
    return event
      ? { ...event, linkedStoryIds: story ? [story.id] : [], affectedAssets: story?.assets || event.affectedAssets }
      : null;
  }).filter((event): event is MarketEventV1 => Boolean(event));
  const storedEvents = storedRows.map(marketEventFromRow).filter((event): event is MarketEventV1 => Boolean(event));
  const currentEvents = dedupeMarketEvents([...calendarEvents, ...earningsEvents, ...acquisition.events]);
  if (currentEvents.length && !(await persistEvents(currentEvents))) warnings.push("Market event persistence unavailable; using the current verified horizon for this edition only.");
  const allEvents = dedupeMarketEvents([...storedEvents, ...currentEvents]);
  const linkedStoryByTicker = new Map(stories.flatMap((story) => story.assets.map((asset) => [asset, story] as const)));
  const earnings = earningsCalls
    .map((call) => ({ item: earningsItem(call, linkedStoryByTicker.get(call.ticker)), callDate: call.call_date }))
    .filter(({ callDate }) => Boolean(safeDate(callDate)))
    .map(({ item }) => item);
  const policyCalendar = allEvents
    .filter((event) => eventHorizonUpcomingLane(event.eventType) === "economicCalendar")
    .filter((event) => event.status !== "cancelled")
    .map(marketEventCalendarItem);
  const geopolitical = allEvents
    .filter((event) => eventHorizonUpcomingLane(event.eventType) === "geopoliticalClock")
    .filter((event) => event.status !== "cancelled")
    .map(geopoliticalClockItem);
  return {
    upcoming: {
      economicCalendar: [...calendar.map(calendarItem), ...policyCalendar],
      earnings,
      geopoliticalClock: geopolitical,
    },
    events: allEvents,
    warnings: [...warnings, ...acquisition.warnings],
    coverage: acquisition.coverage,
  };
}
