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
      return event.localDate >= etNow && event.localDate < end;
    })
    .sort((a, b) => {
      const aExact = a.scheduledAt ? Date.parse(a.scheduledAt) : Number.POSITIVE_INFINITY;
      const bExact = b.scheduledAt ? Date.parse(b.scheduledAt) : Number.POSITIVE_INFINITY;
      return aExact - bExact || a.id.localeCompare(b.id);
    });
}
