import Link from "next/link";
import { headers } from "next/headers";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";

import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import { MarketIcon } from "@/components/blue-desk/MarketIcon";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import StoryIdentityBalls from "@/components/blue-desk/StoryIdentityBalls";
import { storyMatchesSubject, storyIdentityBalls } from "@/lib/blue-desk/story-identity";
import { getEconomicCalendar } from "@/lib/calendar";
import { getForwardEarningsEvents, type ForwardEarningsResult } from "@/lib/forward-earnings-sources";
import { buildPresenterCalendar, type PresenterCalendarEvent } from "@/lib/presenter-calendar";
import { selectBlueDeskNext24Hours, selectBlueDeskReleasedWeek, selectBlueDeskUpcoming } from "@/lib/blue-desk-calendar";
import { formatDualDeskTime } from "@/lib/blue-desk-time";
import styles from "../blue-desk.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Market Calendar | Blue Desk",
  description: "Economic releases and earnings.",
};

type WindowName = "24h" | "7d" | "30d" | "released";

const WINDOWS = [
  { id: "24h", label: "Next 24 hours" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "released", label: "Released" },
] as const;

function sourceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function eventGroupDate(event: PresenterCalendarEvent) {
  if (!event.scheduledAt) return null;
  return formatDualDeskTime(event.scheduledAt)?.etDay ?? null;
}

function prettyDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  const date = new Date(day + "T12:00:00Z");
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(date);
}

function Events({ records, statusLabel, storyBase, presenterBase }: { records: PresenterCalendarEvent[]; statusLabel: WindowName; storyBase:string; presenterBase:string }) {
  const exact = records.filter(event => !!eventGroupDate(event));
  const datedOnly = records.filter(event => !eventGroupDate(event));
  const groups = new Map<string, PresenterCalendarEvent[]>();
  for (const event of exact) {
    const day = eventGroupDate(event)!;
    groups.set(day, [...(groups.get(day) || []), event]);
  }

  function card(event: PresenterCalendarEvent) {
    return (
      <article className={styles.eventRow} key={event.id} data-event-id={event.id}>
        <div className={styles.eventHeading}>
          <span className={styles.kicker}>{event.kind.toUpperCase()} · {event.status.toUpperCase()} · {event.verificationState.toUpperCase()}</span>
          <h3>{event.title}</h3>
          <div className={styles.calendarStoryIdentities}>
            <StoryIdentityBalls title={event.title} deck={event.decidingQuestion} assets={event.affectedAssets} hrefBase={storyBase} limit={5} />
          </div>
        </div>
        <DualTimestamp value={event.scheduledAt} sourceDate={event.localDate} className={styles.eventTime} />
        {statusLabel === "released" ? (
          <p className={styles.muted}>Scheduled time, not verified publication time.</p>
        ) : null}
        {event.decidingQuestion ? <p><strong>Why it matters:</strong> {event.decidingQuestion}</p> : null}
        <p className={styles.eventFacts}>
          Actual: {event.actual || "not available"} · Consensus: {event.consensus || "not available"} ·
          Previous: {event.revisedPrevious || event.previous || "not available"}
        </p>
        {event.affectedAssets.length ? <p className={styles.muted}>Affected assets in source record: {event.affectedAssets.join(" · ")}</p> : null}
        <Link className={styles.calendarSubjectLink} href={storyBase+"#stories-title"}>Explore ongoing market stories →</Link>
        <Link className={styles.calendarSubjectLink}
          href={presenterBase+"?event="+encodeURIComponent(event.id)}>
          Check event in Presenter · owner →</Link>
        {sourceUrl(event.sourceUrl) ? (
          <a href={event.sourceUrl} rel="noreferrer" target="_blank" className={styles.textLink}>
            {event.sourceName} · View source ↗
          </a>
        ) : <span className={styles.coverage}>Source link unavailable</span>}
      </article>
    );
  }

  return (
    <>
      {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, events]) => (
        <section key={day} className={styles.secondaryPanel} aria-label={"Eastern Time: " + prettyDay(day)}>
          <p className={styles.kicker}>EASTERN TIME · {prettyDay(day)}</p>
          {events.map(card)}
        </section>
      ))}
      {datedOnly.length ? (
        <section className={styles.secondaryPanel} aria-label="Source-date-only events">
          <p className={styles.kicker}>DATE-ONLY RECORDS · TIME NOT CONFIRMED</p>
          <h2>Source calendar dates</h2>
          <p className={styles.muted}>Date provided; time unknown.</p>
          {datedOnly.map(card)}
        </section>
      ) : null}
      {!records.length ? (
        <section className={styles.secondaryPanel}>
          <h2>{statusLabel === "released" ? "No released items recorded this week" : "No scheduled events in this window"}</h2>
          <p className={styles.muted}>The selected time window is empty. This does not establish that the broader calendar is empty or that provider coverage is complete.</p>
        </section>
      ) : null}
    </>
  );
}

export default async function BlueDeskCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const host = (await headers()).get("host");
  const raw = params.window;
  const subject=typeof params.subject==="string" && /^[A-Z0-9]{2,12}$/.test(params.subject)?params.subject:"";
  const storyBase=blueDeskPublicHref("/blue-desk",host);
  const presenterBase=blueDeskPublicHref("/blue-desk/presenter",host);
  // The default broad window keeps the next confirmed catalysts visible during
  // quiet 7-day windows; 24h/7d remain explicit, narrower reader choices.
  const windowName: WindowName = raw === "24h" || raw === "7d" || raw === "released" ? raw : "30d";
  const now = new Date();

  const [macroResult, earningsResult] = await Promise.allSettled([
    getEconomicCalendar(),
    getForwardEarningsEvents({ now }),
  ]);
  const macro = macroResult.status === "fulfilled" ? macroResult.value : [];
  const earnings: ForwardEarningsResult = earningsResult.status === "fulfilled"
    ? earningsResult.value
    : { events: [], coverage: "unavailable", warning: "Earnings source could not be reached." };
  const calendar = buildPresenterCalendar(macro, earnings, now, macroResult.status === "rejected");

  const events = windowName === "24h"
    ? selectBlueDeskNext24Hours(calendar, now)
    : windowName === "released"
      ? selectBlueDeskReleasedWeek(calendar, now)
      : selectBlueDeskUpcoming(calendar, now, windowName === "30d" ? 30 : 7);

  const filteredEvents=subject?events.filter(event=>storyMatchesSubject(event.title,event.decidingQuestion,event.affectedAssets,subject)):events;

  // Empty narrow windows must never imply there are no future verified
  // schedules. These remain real source events from presenter-calendar/1,
  // not predicted releases, forecasts or synthetic event clocks.
  const nextKnown = (events.length === 0 && (windowName === "24h" || windowName === "7d"))
    ? selectBlueDeskUpcoming(calendar, now, 30).slice(0, 3)
    : [];

  const calendarSubjects=[...new Set([...events,...nextKnown].flatMap(event=>
    storyIdentityBalls(event.title,event.decidingQuestion,5,event.affectedAssets).map(ball=>ball.code)))].slice(0,10);
  const calendarBase=blueDeskPublicHref("/blue-desk/calendar",host);
  const filteredNextKnown=subject?nextKnown.filter(event=>storyMatchesSubject(event.title,event.decidingQuestion,event.affectedAssets,subject)):nextKnown;
  const nowDisplay = formatDualDeskTime(now);
  return (
    <main className={styles.page} data-blue-desk-calendar="ET-primary">
      <BlueDeskHeader activePath="/blue-desk/calendar" />
      <div className={styles.content}>

        <section className={styles.calendarHero}>
          <div>
            <h1><MarketIcon name="calendar" size={33} /> Market calendar</h1>
          </div>
          <div className={styles.calendarClock}>
            <span className={styles.kicker}>AS OF</span>
            {nowDisplay ? <DualTimestamp value={nowDisplay.iso} /> : <span>Time unavailable</span>}
          </div>
        </section>

        <nav className={styles.calendarTabs} aria-label="Calendar window">
          {WINDOWS.map(view => (
            <Link
              key={view.id} href={blueDeskPublicHref("/blue-desk/calendar?window=" + view.id + (subject?"&subject="+encodeURIComponent(subject):""), host)}
              aria-current={windowName === view.id ? "page" : undefined}
              className={windowName === view.id ? styles.calendarTabActive : styles.calendarTab}
            >
              <MarketIcon name={view.id === "released" ? "check" : view.id === "24h" ? "watch" : "calendar"} size={16} />
              {view.label}
            </Link>
          ))}
        </nav>

        {calendarSubjects.length?<section aria-label="Filter calendar catalysts by subject" className={styles.calendarSubjectFilters}>
          <span className={styles.kicker}>FILTER CATALYSTS BY COUNTRY, COMPANY OR ASSET</span>
          <StoryIdentityBalls title="" deck="" assets={calendarSubjects} hrefBase={calendarBase+"?window="+windowName} limit={5}/>
          <p className={styles.muted}>Filters show scheduled or released items with matching explicit subjects, not a verified market reaction.</p>
        </section>:null}
        <div className={styles.calendarSummary}>
          <span>{filteredEvents.length} record{filteredEvents.length === 1 ? "" : "s"}{subject?" matching "+subject:""}</span>
          <span>Economic: {calendar.sourceHealth.macro} · Earnings: {calendar.sourceHealth.earnings.replaceAll("_", " ")}</span>
        </div>

        {subject?<p className={styles.coverage}>Filtering calendar by {subject}. <Link className={styles.textLink} href={blueDeskPublicHref("/blue-desk/calendar?window="+windowName,host)}>Clear filter ×</Link></p>:null}
        {calendar.sourceHealth.warnings.length ? (
          <p className={styles.coverage} role="status">Source coverage: {calendar.sourceHealth.warnings.join(" ")}</p>
        ) : null}

        <div className={styles.calendarStack}>
          <Events records={filteredEvents} statusLabel={windowName} storyBase={storyBase} presenterBase={presenterBase} />
          {filteredNextKnown.length ? (
            <>
              <p className={styles.coverage}>
                Next source-listed scheduled events outside this selection or without an
                exact time in the selected window. These are not released results.
                {" "}<Link href={blueDeskPublicHref("/blue-desk/calendar?window=30d", host)} className={styles.textLink}>Browse the 30-day calendar →</Link>
              </p>
              <Events records={filteredNextKnown} statusLabel="30d" storyBase={storyBase} presenterBase={presenterBase} />
            </>
          ) : null}
        </div>

        <footer className={styles.footer}><span>Blue Desk</span></footer>
      </div>
    </main>
  );
}
