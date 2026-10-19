import Link from "next/link";
import { headers } from "next/headers";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";

import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
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
          <p className={styles.muted}>Shown time is the originally scheduled instant, not a verified publication time.</p>
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
          <p className={styles.muted}>Exact time unavailable. Dates shown as supplied.</p>
          {datedOnly.map(card)}
        </section>
      ) : null}
      {!records.length ? (
        <section className={styles.secondaryPanel}>
          <h2>No verified events in this view</h2>
          <p className={styles.muted}>No events in this window. Source coverage may be incomplete.</p>
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
  const windowName: WindowName = raw === "24h" || raw === "30d" || raw === "released" ? raw : "7d";
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

  const nowDisplay = formatDualDeskTime(now);
  return (
    <main className={styles.page} data-blue-desk-calendar="ET-primary">
      <BlueDeskHeader activePath="/blue-desk/calendar" />
      <div className={styles.content}>

        <section className={styles.calendarHero}>
          <div>
            <h1>Market calendar</h1>
          </div>
          <div className={styles.calendarClock}>
            <span className={styles.kicker}>AS OF</span>
            {nowDisplay ? <DualTimestamp value={nowDisplay.iso} /> : <span>Time unavailable</span>}
          </div>
        </section>

        <nav className={styles.calendarTabs} aria-label="Calendar window">
          {WINDOWS.map(view => (
            <Link
              key={view.id} href={blueDeskPublicHref("/blue-desk/calendar?window=" + view.id, host)}
              aria-current={windowName === view.id ? "page" : undefined}
              className={windowName === view.id ? styles.calendarTabActive : styles.calendarTab}
            >
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

        <div className={styles.calendarStack}>
          <Events records={events} statusLabel={windowName} />
        </div>

        <footer className={styles.footer}><span>Blue Desk</span></footer>
      </div>
    </main>
  );
}
