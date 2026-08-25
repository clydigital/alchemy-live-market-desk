import "server-only";

import { getEconomicCalendar } from "@/lib/calendar";
import {
  dedupeMarketEvents,
  marketEventFromEconomicCalendar,
  marketEventFromEarnings,
  type MarketEventV1,
} from "@/lib/market-events";
import { marketEventFromRow, marketEventToRow, type MarketEventRow } from "@/lib/market-event-persistence";
import type { EarningsItem, EditionUpcoming, EconomicCalendarItem, GeopoliticalClockItem } from "@/lib/intelligence/edition";
import { intelligenceRest } from "@/lib/intelligence/supabase";

type EarningsCallRow = {
  id: string;
  ticker: string;
  company_name: string;
  fiscal_period: string;
  call_date: string | null;
  relevance_reason: string | null;
  guidance: string | null;
  demand: string | null;
};

type EventHorizonResult = {
  upcoming: EditionUpcoming;
  events: MarketEventV1[];
  warnings: string[];
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

function earningsItem(call: EarningsCallRow, linkedStory?: { title?: string; assets?: string[] }) : EarningsItem {
  return {
    company: call.company_name,
    time: call.call_date || "TBC",
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
      "earnings_calls?select=id,ticker,company_name,fiscal_period,call_date,relevance_reason,guidance,demand&call_date=not.is.null&order=call_date.asc&limit=80",
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
  const [calendar, storedRows, earningsCalls] = await Promise.all([
    getEconomicCalendar().catch((error) => {
      warnings.push(`Economic calendar unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return [] as Awaited<ReturnType<typeof getEconomicCalendar>>;
    }),
    loadStoredEvents(),
    loadEarningsCalls(),
  ]);
  const calendarEvents = calendar.map(marketEventFromEconomicCalendar).filter((event): event is MarketEventV1 => Boolean(event));
  const earningsEvents = earningsCalls.map((call) => {
    const story = stories.find((candidate) => candidate.assets.includes(call.ticker));
    return marketEventFromEarnings({
      id: call.id,
      companyName: call.company_name,
      callDate: call.call_date || "",
      linkedStoryIds: story ? [story.id] : [],
      affectedAssets: story?.assets || [call.ticker],
      decisiveVariable: call.relevance_reason,
      transmission: call.guidance || call.demand,
    });
  }).filter((event): event is MarketEventV1 => Boolean(event));
  const storedEvents = storedRows.map(marketEventFromRow).filter((event): event is MarketEventV1 => Boolean(event));
  const currentEvents = dedupeMarketEvents([...calendarEvents, ...earningsEvents]);
  if (currentEvents.length && !(await persistEvents(currentEvents))) warnings.push("Market event persistence unavailable; using the current verified horizon for this edition only.");
  const allEvents = dedupeMarketEvents([...storedEvents, ...currentEvents]);
  const linkedStoryByTicker = new Map(stories.flatMap((story) => story.assets.map((asset) => [asset, story] as const)));
  const earnings = earningsCalls.map((call) => earningsItem(call, linkedStoryByTicker.get(call.ticker))).filter((item) => Boolean(safeDate(item.time)));
  const geopolitical = allEvents
    .filter((event) => !["economic_release", "central_bank_decision", "earnings"].includes(event.eventType))
    .filter((event) => event.status !== "cancelled")
    .map(geopoliticalClockItem);
  return {
    upcoming: {
      economicCalendar: calendar.map(calendarItem),
      earnings,
      geopoliticalClock: geopolitical,
    },
    events: allEvents,
    warnings,
  };
}

