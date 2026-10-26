import type { PresenterCalendarEvent } from "./presenter-calendar.ts";
import { formatDualDeskTime } from "./blue-desk-time.ts";

/**
 * Read-only display contract. Upstream sources own release-session and option
 * measurements; the view never guesses BMO/AMC from earnings-call timestamps.
 */
export type EarningsReleaseSession = "bmo" | "amc" | "unknown";

export type ImpliedMoveObservation = {
  absolutePct: number;
  sourceUrl: string;
  observedAt: string;
  expiry: string;
  method: "straddle" | "licensed_provider";
};

export type EarningsTileEnrichment = {
  releaseSession?: Exclude<EarningsReleaseSession, "unknown">;
  releaseSessionSourceUrl?: string;
  impliedMove?: ImpliedMoveObservation;
};

export type EarningsTile = {
  id: string;
  ticker: string;
  name: string;
  calendarDay: string;
  calendarDayBasis: "et_instant" | "source_date_only";
  session: EarningsReleaseSession;
  releaseSessionSourceUrl: string | null;
  official: boolean;
  sourceUrl: string;
  timeLabel: string;
  impliedMove: ImpliedMoveObservation | null;
};

function isHttps(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
}

function validObservation(value?: ImpliedMoveObservation): ImpliedMoveObservation | null {
  if (!value || !Number.isFinite(value.absolutePct) || value.absolutePct < 0) return null;
  if (!isHttps(value.sourceUrl) || !Number.isFinite(Date.parse(value.observedAt))) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.expiry)
    || !Number.isFinite(Date.parse(value.expiry + "T00:00:00Z"))) return null;
  return value.method === "straddle" || value.method === "licensed_provider" ? value : null;
}

/**
 * Normalised template cells. Pass enrichments keyed by event ID from an approved
 * read adapter when verified session or implied-move data becomes available.
 * No hard-coded ticker positions, logos, option prices or inferred release hours.
 */
export function projectEarningsWeekTiles(
  records: readonly PresenterCalendarEvent[],
  enrichments: Readonly<Record<string, EarningsTileEnrichment>> = {},
): EarningsTile[] {
  return records.flatMap((event): EarningsTile[] => {
    if (event.kind !== "earnings" || event.status !== "scheduled") return [];
    const exactDay = event.scheduledAt ? formatDualDeskTime(event.scheduledAt)?.etDay : null;
    const day = exactDay || event.localDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return [];
    const extra = enrichments[event.id];
    const hasReleaseProvenance = isHttps(extra?.releaseSessionSourceUrl);
    const session = hasReleaseProvenance && (extra?.releaseSession === "bmo" || extra?.releaseSession === "amc")
      ? extra.releaseSession
      : "unknown";
    const ticker = event.affectedAssets.find((asset) => /^[A-Z][A-Z0-9.-]{0,11}$/.test(asset)) || "—";
    return [{
      id: event.id,
      ticker,
      name: event.title.replace(/\s+(?:FY\d{4}\s+)?(?:Q[1-4]\s+\d{4}\s+)?earnings$/i, "").trim() || event.title,
      calendarDay: day,
      calendarDayBasis: exactDay ? "et_instant" : "source_date_only",
      session,
      releaseSessionSourceUrl: session === "unknown" ? null : extra!.releaseSessionSourceUrl!,
      official: event.verificationState === "official",
      sourceUrl: event.sourceUrl,
      timeLabel: event.timeLabel,
      impliedMove: validObservation(extra?.impliedMove),
    }];
  }).sort((a, b) => a.calendarDay.localeCompare(b.calendarDay)
    || (a.session === "bmo" ? 0 : a.session === "amc" ? 1 : 2)
      - (b.session === "bmo" ? 0 : b.session === "amc" ? 1 : 2)
    || ((b.impliedMove?.absolutePct || 0) - (a.impliedMove?.absolutePct || 0))
    || a.ticker.localeCompare(b.ticker));
}
