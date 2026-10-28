import type { PresenterCalendar, PresenterCalendarEvent } from "./presenter-calendar.ts";
import { formatDualDeskTime } from "./blue-desk-time.ts";

/**
 * Blue Desk's ET-first *view* of the established presenter-calendar/1 contract.
 *
 * Never mutate the source calendar contract, scheduled instants, or edition data.
 * Source date-only events remain unplaced (no asserted Eastern time).
 */
export function selectBlueDeskUpcoming(
  calendar: Pick<PresenterCalendar, "events">,
  now: Date,
  days = 7,
): PresenterCalendarEvent[] {
  const etNow = formatDualDeskTime(now)?.etDay;
  if (!etNow || !Number.isInteger(days) || days < 1 || days > 90) return [];
  const end = new Date(Date.parse(etNow + "T00:00:00Z") + days * 86_400_000).toISOString().slice(0, 10);
  const asOf = now.getTime();
  // Date-only source records carry an MYT calendar day, not a US/Eastern
  // instant. Once that MYT day ends, they cannot remain UPCOMING.
  // Do not infer a release or an exact time when the day expires.
  const mytToday = new Date(asOf + 8 * 3_600_000).toISOString().slice(0, 10);
  return calendar.events
    .filter(event => {
      if (event.status !== "scheduled") return false;
      if (event.scheduledAt) {
        const moment = Date.parse(event.scheduledAt);
        const day = formatDualDeskTime(event.scheduledAt)?.etDay;
        return Number.isFinite(moment) && moment >= asOf && !!day && day >= etNow && day < end;
      }
      // Calendar.localDate is supplied as an MYT/source date for imprecise
      // events. Keep them on a separate "date only" track, never call it ET.
      return event.localDate >= mytToday && event.localDate >= etNow && event.localDate < end;
    })
    .sort((a, b) => {
      const aExact = a.scheduledAt ? Date.parse(a.scheduledAt) : Number.POSITIVE_INFINITY;
      const bExact = b.scheduledAt ? Date.parse(b.scheduledAt) : Number.POSITIVE_INFINITY;
      return aExact - bExact || a.id.localeCompare(b.id);
    });
}

/** Rolling next 24 hours: exact source instants only; never invent a time for a dated item. */
export function selectBlueDeskNext24Hours(
  calendar: Pick<PresenterCalendar, "events">,
  now: Date,
): PresenterCalendarEvent[] {
  const lower = now.getTime();
  const upper = lower + 24 * 3_600_000;
  if (!Number.isFinite(lower)) return [];
  return calendar.events
    .filter(event => {
      if (event.status !== "scheduled" || !event.scheduledAt) return false;
      const timestamp = Date.parse(event.scheduledAt);
      return Number.isFinite(timestamp) && timestamp >= lower && timestamp < upper;
    })
    .sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!) || a.id.localeCompare(b.id));
}

/**
 * Current ET calendar week, Monday to Sunday. The date-only lane is never presented
 * as an exact Eastern-time release; it remains labelled with its source calendar date.
 */
export function selectBlueDeskReleasedWeek(
  calendar: Pick<PresenterCalendar, "events">,
  now: Date,
): PresenterCalendarEvent[] {
  const today = formatDualDeskTime(now)?.etDay;
  if (!today) return [];
  const todayUtc = Date.parse(today + "T00:00:00Z");
  const weekday = (new Date(todayUtc).getUTCDay() + 6) % 7;
  const monday = new Date(todayUtc - weekday * 86_400_000).toISOString().slice(0, 10);
  const nextMonday = new Date(todayUtc + (7 - weekday) * 86_400_000).toISOString().slice(0, 10);
  return calendar.events
    .filter(event => {
      if (event.status !== "released") return false;
      if (event.scheduledAt) {
        const ms = Date.parse(event.scheduledAt);
        const day = formatDualDeskTime(event.scheduledAt)?.etDay;
        return Number.isFinite(ms) && ms <= now.getTime() && !!day && day >= monday && day < nextMonday;
      }
      // This lane uses the feed's own source day, NOT an asserted ET event day.
      return event.localDate >= monday && event.localDate < nextMonday;
    })
    .sort((a, b) => {
      const aTime = a.scheduledAt ? Date.parse(a.scheduledAt) : Number.NEGATIVE_INFINITY;
      const bTime = b.scheduledAt ? Date.parse(b.scheduledAt) : Number.NEGATIVE_INFINITY;
      return bTime - aTime || a.id.localeCompare(b.id);
    });
}

/**
 * The current US/Eastern Monday–Sunday earnings week, not a rolling 30-day
 * list disguised as a weekly calendar. Keep date-only records as source dates.
 * This is a read-only presentation projection of presenter-calendar/1.
 */
export function selectBlueDeskEarningsWeek(
  calendar: Pick<PresenterCalendar, "events">,
  now: Date,
): PresenterCalendarEvent[] {
  const today = formatDualDeskTime(now)?.etDay;
  if (!today) return [];
  const todayUtc = Date.parse(today + "T00:00:00Z");
  const weekday = (new Date(todayUtc).getUTCDay() + 6) % 7;
  const monday = new Date(todayUtc - weekday * 86_400_000).toISOString().slice(0, 10);
  const nextMonday = new Date(todayUtc + (7 - weekday) * 86_400_000).toISOString().slice(0, 10);
  return calendar.events
    .filter(event => {
      if (event.kind !== "earnings" || event.status !== "scheduled") return false;
      if (event.scheduledAt) {
        const when = Date.parse(event.scheduledAt);
        const etDay = formatDualDeskTime(event.scheduledAt)?.etDay;
        return Number.isFinite(when) && when >= now.getTime()
          && !!etDay && etDay >= monday && etDay < nextMonday;
      }
      // Date-only is an issuer/source calendar date, not an asserted ET time.
      return event.localDate >= today && event.localDate >= monday && event.localDate < nextMonday;
    })
    .sort((a, b) => {
      const aDay = a.scheduledAt ? formatDualDeskTime(a.scheduledAt)?.etDay : a.localDate;
      const bDay = b.scheduledAt ? formatDualDeskTime(b.scheduledAt)?.etDay : b.localDate;
      return (aDay || "").localeCompare(bDay || "") ||
        (a.scheduledAt ? Date.parse(a.scheduledAt) : Number.POSITIVE_INFINITY)
        - (b.scheduledAt ? Date.parse(b.scheduledAt) : Number.POSITIVE_INFINITY)
        || a.id.localeCompare(b.id);
    });
}
