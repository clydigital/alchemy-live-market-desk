"use client";

import { useMemo, useState } from "react";
import type { EconomicCalendarEvent, G7Country } from "@/lib/calendar";
import type { MacroRelease } from "@/lib/data";

type CalendarCountry = "All economies" | G7Country;
type CalendarWindow = 7 | 30 | 90 | 180;

function inferCountry(item: MacroRelease): G7Country {
  const text = `${item.agency} ${item.source_url}`.toLowerCase();
  if (/reserve bank of australia|\brba\b/.test(text)) return "Australia";
  if (/reserve bank of new zealand|\brbnz\b/.test(text)) return "New Zealand";
  if (/bank of canada|statcan|canada/.test(text)) return "Canada";
  if (/bank of england|ons\.gov|united kingdom| uk /.test(` ${text} `)) return "United Kingdom";
  if (/boj|bank of japan|japan/.test(text)) return "Japan";
  if (/ecb|eurostat|ec\.europa|euro area/.test(text)) return "Euro Area";
  return "United States";
}

function category(item: MacroRelease): EconomicCalendarEvent["category"] {
  if (/central|rate|fomc|policy/i.test(`${item.category} ${item.release_name}`)) return "Central bank";
  if (/inflation|cpi|ppi|price/i.test(`${item.category} ${item.release_name}`)) return "Inflation";
  if (/labour|labor|employment|jolts|payroll/i.test(`${item.category} ${item.release_name}`)) return "Labour";
  return "Growth";
}

function deskEvents(items: MacroRelease[]): EconomicCalendarEvent[] {
  return items.map((item) => {
    const country = inferCountry(item);
    return {
      id: `desk-${item.id}`,
      date: item.release_date.slice(0, 10),
      timeLabel: item.release_time_label,
      country,
      g7Markets: country === "Euro Area" ? ["France", "Germany", "Italy"] : [country],
      event: item.release_name,
      category: category(item),
      impact: "High",
      referencePeriod: item.reference_period,
      status: /released|complete|published/i.test(item.status) ? "Released" : "Scheduled",
      actual: item.actual,
      consensus: item.consensus,
      alchemyExpectation: null,
      previous: item.previous,
      revisedPrevious: item.revised_previous,
      decidingQuestion: item.watch_question,
      affectedAssets: item.affected_assets,
      sourceName: item.agency,
      sourceUrl: item.source_url,
      sourceKind: "desk-record",
    };
  });
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00Z`));
}

function daysFromToday(value: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${value}T00:00:00`).getTime() - today.getTime()) / 86400000);
}

function countryCode(country: G7Country) {
  return ({ "United States": "US", Canada: "CA", "United Kingdom": "UK", "Euro Area": "EA", Japan: "JP", Australia: "AU", "New Zealand": "NZ" })[country];
}

export default function EconomicCalendar({ officialEvents, macroReleases }: { officialEvents: EconomicCalendarEvent[]; macroReleases: MacroRelease[] }) {
  const [country, setCountry] = useState<CalendarCountry>("All economies");
  const [windowDays, setWindowDays] = useState<CalendarWindow>(30);
  const events = useMemo(() => {
    const combined = [...deskEvents(macroReleases), ...officialEvents];
    const deduped = [...new Map(combined.map((event) => [`${event.date}:${event.event.toLowerCase()}`, event])).values()];
    return deduped.sort((a, b) => a.date.localeCompare(b.date));
  }, [macroReleases, officialEvents]);
  const visible = events.filter((event) => {
    const days = daysFromToday(event.date);
    return days >= -1 && days <= windowDays && (country === "All economies" || event.country === country);
  });
  const next = visible.find((event) => daysFromToday(event.date) >= 0);
  const centralBanks = visible.filter((event) => event.category === "Central bank").length;
  const sourceCount = new Set(visible.map((event) => event.sourceName)).size;

  return <div className="calendar-page tab-page">
    <header className="calendar-hero">
      <div>
        <span>HIGH-IMPACT GLOBAL CALENDAR</span>
        <h2>Know the next test before it hits.</h2>
        <p>Only verified desk records and official schedules enter this view. Consensus remains blank until a reviewed source supplies it.</p>
      </div>
      <div className="calendar-next">
        <small>NEXT HIGH-IMPACT EVENT</small>
        <b>{next ? next.event : "No event loaded"}</b>
        <span>{next ? `${dateLabel(next.date)} · ${next.timeLabel}` : "Expand the date window"}</span>
      </div>
    </header>

    <div className="calendar-controls">
      <div className="calendar-country-tabs" role="tablist" aria-label="Calendar market">
        {(["All economies", "United States", "Canada", "United Kingdom", "Euro Area", "Japan", "Australia", "New Zealand"] as CalendarCountry[]).map((item) => <button key={item} className={country === item ? "active" : ""} onClick={() => setCountry(item)}>{item === "All economies" ? item : countryCode(item)}</button>)}
      </div>
      <div className="calendar-window-tabs" aria-label="Calendar horizon">
        {([7, 30, 90, 180] as CalendarWindow[]).map((days) => <button key={days} className={windowDays === days ? "active" : ""} onClick={() => setWindowDays(days)}>{days}D</button>)}
      </div>
    </div>

    <section className="calendar-kpis" aria-label="Calendar coverage">
      <span><small>EVENTS</small><b>{visible.length}</b></span>
      <span><small>CENTRAL BANKS</small><b>{centralBanks}</b></span>
      <span><small>OFFICIAL SOURCES</small><b>{sourceCount}</b></span>
      <span><small>MARKETS</small><b>{new Set(visible.flatMap((event) => event.g7Markets)).size}</b></span>
    </section>

    <div className="calendar-list-head" aria-hidden="true"><span>Date / market</span><span>Event</span><span>Release state</span><span>Desk question</span><span>Source</span></div>
    <section className="calendar-list">
      {visible.map((event) => {
        const days = daysFromToday(event.date);
        return <article className={`calendar-event country-${countryCode(event.country).toLowerCase()}`} key={event.id}>
          <div className="calendar-date"><b>{dateLabel(event.date)}</b><span>{event.timeLabel}</span><small>{days < 0 ? "RECENT" : days === 0 ? "TODAY" : days === 1 ? "TOMORROW" : `${days} DAYS`}</small></div>
          <div className="calendar-event-name"><span><i>{countryCode(event.country)}</i>{event.category}</span><h3>{event.event}</h3><small>{event.referencePeriod || event.g7Markets.join(" · ")}</small></div>
          <div className="calendar-release-state"><b>{event.status}</b><dl><dt>ACTUAL</dt><dd>{event.actual || "Awaiting"}</dd><dt>CONSENSUS</dt><dd>{event.consensus || "Not loaded"}</dd><dt>ALCHEMY EXPECTATION</dt><dd>{event.alchemyExpectation || "Not recorded"}</dd><dt>PREVIOUS</dt><dd>{event.previous || "Not loaded"}</dd><dt>REVISED PREVIOUS</dt><dd>{event.revisedPrevious || "Not revised"}</dd></dl></div>
          <div className="calendar-question"><p>{event.decidingQuestion}</p><div>{event.affectedAssets.map((asset) => <span key={asset}>{asset}</span>)}</div></div>
          <div className="calendar-source"><span>{event.sourceKind === "official-live" ? "LIVE SCHEDULE" : event.sourceKind === "desk-record" ? "DESK RECORD" : "OFFICIAL"}</span><a href={event.sourceUrl} target="_blank" rel="noreferrer">{event.sourceName} ↗</a></div>
        </article>;
      })}
      {!visible.length && <div className="calendar-empty"><b>No verified high-impact events in this window.</b><p>Expand the horizon or switch market. Unverified events are not backfilled.</p></div>}
    </section>
  </div>;
}
