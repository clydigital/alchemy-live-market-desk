import Link from "next/link";
import { headers } from "next/headers";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";

import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import EarningsWeekGrid from "@/components/blue-desk/EarningsWeekGrid";
import CatalystCalendar from "@/components/blue-desk/CatalystCalendar";
import { getBluebellyCatalystSources } from "@/lib/bluebelly-catalyst-sources";
import { projectBluebellyCatalysts } from "@/lib/bluebelly-catalyst-calendar";
import { loadMajorIpoWatch } from "@/lib/bluebelly-major-ipo-watch-server";
import { MarketIcon } from "@/components/blue-desk/MarketIcon";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { getEconomicCalendar } from "@/lib/calendar";
import { getForwardEarningsEvents, type ForwardEarningsResult } from "@/lib/forward-earnings-sources";
import { buildPresenterCalendar, type PresenterCalendarEvent } from "@/lib/presenter-calendar";
import { selectBlueDeskEarningsWeek, selectBlueDeskNext24Hours, selectBlueDeskReleasedWeek, selectBlueDeskUpcoming } from "@/lib/blue-desk-calendar";
import { formatDualDeskTime } from "@/lib/blue-desk-time";
import styles from "../blue-desk.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Market Calendar | Blue Desk",
  description: "High-impact economics, Fed speakers, peace talks, earnings, major IPO watch and technology catalysts.",
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

function Events({ records, statusLabel }: { records: PresenterCalendarEvent[]; statusLabel: WindowName }) {
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
        {event.affectedAssets.length ? <p className={styles.muted}>Assets: {event.affectedAssets.join(" · ")}</p> : null}
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
  // The default broad window keeps the next confirmed catalysts visible during
  // quiet 7-day windows; 24h/7d remain explicit, narrower reader choices.
  const windowName: WindowName = raw === "24h" || raw === "7d" || raw === "released" ? raw : "30d";
  const now = new Date();

  const [macroResult, earningsResult, catalystResult, ipoResult] = await Promise.allSettled([
    getEconomicCalendar(),
    getForwardEarningsEvents({ now }),
    getBluebellyCatalystSources({ now }),
    loadMajorIpoWatch({ now }),
  ]);
  const macro = macroResult.status === "fulfilled" ? macroResult.value : [];
  const earnings: ForwardEarningsResult = earningsResult.status === "fulfilled"
    ? earningsResult.value
    : { events: [], coverage: "unavailable", warning: "Earnings source could not be reached." };
  const calendar = buildPresenterCalendar(macro, earnings, now, macroResult.status === "rejected");
  const radar = catalystResult.status === "fulfilled" ? catalystResult.value : {events:[],signals:[],coverage:[],warnings:["Catalyst monitoring sources unavailable."]};
  const ipos = ipoResult.status === "fulfilled" ? ipoResult.value : {
    cards:[],coverage:{name:"SEC · major IPO watch",state:"unavailable",detail:"IPO source check unavailable."}
  };
  // An S-1 filing is a past milestone. IPO rows remain undated watch cards
  // until an original source actually confirms a future listing appointment.
  const catalysts = [...projectBluebellyCatalysts(calendar.events, radar.events, radar.signals), ...ipos.cards];
  const sourceCoverage = [...radar.coverage, ipos.coverage];

  const events = windowName === "24h"
    ? selectBlueDeskNext24Hours(calendar, now)
    : windowName === "released"
      ? selectBlueDeskReleasedWeek(calendar, now)
      : selectBlueDeskUpcoming(calendar, now, windowName === "30d" ? 30 : 7);

  // Empty narrow windows must never imply there are no future verified
  // schedules. These remain real source events from presenter-calendar/1,
  // not predicted releases, forecasts or synthetic event clocks.
  const nextKnown = (events.length === 0 && (windowName === "24h" || windowName === "7d"))
    ? selectBlueDeskUpcoming(calendar, now, 30).slice(0, 3)
    : [];

  // A stable earnings lane shows issuer-announced and provider-reported dates
  // together without presenting vendor estimates as confirmed announcements.
  const earningsHub = selectBlueDeskUpcoming(calendar, now, 30)
    .filter(event => event.kind === "earnings").slice(0, 24);
  const earningsWeek = selectBlueDeskEarningsWeek(calendar, now);
  const thisWeekIds = new Set(earningsWeek.map(event => event.id));
  const earningsLater = earningsHub.filter(event => !thisWeekIds.has(event.id));
  const earningsGroups = [
    { id: "this-week", title: "This US earnings week", records: earningsWeek },
    { id: "later", title: "Later in the next 30 days", records: earningsLater },
  ].filter(group => group.records.length > 0);
  const economicWindow = events.filter(event => event.kind === "economic");

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

        <CatalystCalendar items={catalysts} sourceCoverage={sourceCoverage} nowISO={now.toISOString()} />

        <details style={{ marginTop: 22, border: "1px solid #2d5267", borderRadius: 10, padding: "15px 18px", background: "#092637" }}>
          <summary style={{ cursor: "pointer", color: "#bce8f5", fontWeight: 750 }}>
            Detailed legacy economic and earnings source listings · open for full records
          </summary>
        <nav className={styles.calendarTabs} aria-label="Calendar window">
          {WINDOWS.map(view => (
            <Link
              key={view.id} href={blueDeskPublicHref("/blue-desk/calendar?window=" + view.id, host)}
              aria-current={windowName === view.id ? "page" : undefined}
              className={windowName === view.id ? styles.calendarTabActive : styles.calendarTab}
            >
              <MarketIcon name={view.id === "released" ? "check" : view.id === "24h" ? "watch" : "calendar"} size={16} />
              {view.label}
            </Link>
          ))}
        </nav>

        <div className={styles.calendarSummary}>
          <span>{events.length} record{events.length === 1 ? "" : "s"}</span>
          <span>Economic: {calendar.sourceHealth.macro} · Earnings: {calendar.sourceHealth.earnings.replaceAll("_", " ")}</span>
        </div>

        {calendar.sourceHealth.warnings.length ? (
          <p className={styles.coverage} role="status">Source coverage: {calendar.sourceHealth.warnings.join(" ")}</p>
        ) : null}

        <nav className={styles.calendarTabs} aria-label="Calendar sections">
          <a className={styles.calendarTab} href="#economic-calendar">Economic calendar</a>
          <a className={styles.calendarTab} href="#earnings-hub">Earnings Hub ({earningsHub.length})</a>
        </nav>

        <div className={styles.calendarStack} id="economic-calendar">
          <Events records={economicWindow} statusLabel={windowName} />
          {nextKnown.length ? (
            <>
              <p className={styles.coverage}>
                Next source-listed scheduled events outside this selection or without an
                exact time in the selected window. These are not released results.
                {" "}<Link href={blueDeskPublicHref("/blue-desk/calendar?window=30d", host)} className={styles.textLink}>Browse the 30-day calendar →</Link>
              </p>
              <Events records={nextKnown} statusLabel="30d" />
            </>
          ) : null}
        </div>

        <section id="earnings-hub" className={styles.secondaryPanel}
          aria-labelledby="earnings-hub-title" data-calendar-earnings-hub="source-dated">
          <p className={styles.kicker}>EARNINGS HUB / THIS WEEK + THE NEXT 30 DAYS</p>
          <h2 id="earnings-hub-title">What companies are reporting next?</h2>
          <p className={styles.muted}>Major tracked companies, grouped by the current US trading week.
            Company-announced dates are confirmed; vendor estimates are not. A conference-call
            time is not the results-release time. Times are shown in ET and Malaysia time only
            when an original source establishes an exact instant. This is not an exhaustive
            earnings calendar.</p>
          <div className={styles.calendarSummary}>
            <span>{earningsWeek.length} this week · {earningsLater.length} later</span>
            <span>Earnings coverage: {calendar.sourceHealth.earnings.replaceAll("_", " ")}</span>
          </div>
          {earningsWeek.length ? <EarningsWeekGrid records={earningsWeek} now={now} /> : null}
          {earningsGroups.length ? <h3>Detailed earnings listings and source records</h3> : null}
          {earningsGroups.length ? earningsGroups.map(group => (
            <section key={group.id} aria-label={group.title} data-earnings-window={group.id}>
              <h3>{group.title}</h3>
              <p className={styles.muted}>{group.id === "this-week"
                ? "Monday–Sunday in US Eastern Time. Confirmed company events first; exact source-date-only notices remain without an invented release hour."
                : "Later source-listed companies. Provider dates, where available, are research leads until confirmed by issuer IR."}</p>
              {group.records.map(event =>
              <article key={event.id} className={styles.eventRow} data-earnings-event={event.id}>
                <div className={styles.eventHeading}>
                  <span className={styles.kicker}>{event.verificationState === "official"
                    ? "ISSUER-ANNOUNCED" : "PROVIDER-REPORTED · DATE TO VERIFY"}</span>
                  <h3>{event.title}</h3>
                </div>
                <DualTimestamp value={event.scheduledAt} sourceDate={event.localDate}
                  className={styles.eventTime} />
                {event.affectedAssets.length ? <p className={styles.muted}>
                  Company / ticker: {event.affectedAssets.join(" · ")}</p> : null}
                {event.consensus ? <p><strong>Reported expectations:</strong>
                  {" "}{event.consensus}</p> : null}
                <p><strong>Guiding question:</strong> {event.decidingQuestion ||
                  "Do results and forward guidance change the established sector thesis?"}</p>
                <p className={styles.muted}>Check management's guidance, reported period,
                  operating costs, funding and capital spending before drawing sector or index conclusions.</p>
                {sourceUrl(event.sourceUrl) ? <a className={styles.textLink}
                  href={event.sourceUrl} target="_blank" rel="noreferrer">
                  {event.sourceName} · source calendar ↗</a> : null}
              </article>
              )}
            </section>
          )) : <p className={styles.coverage}>No upcoming issuer-confirmed or approved-provider
            earnings are available in the current 30-day window. This is incomplete
            calendar coverage, not proof that no major companies are reporting.</p>}
        </section>

        </details>
        <footer className={styles.footer}><span>Blue Desk</span></footer>
      </div>
    </main>
  );
}
