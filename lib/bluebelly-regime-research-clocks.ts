import type { PublicSourceObservation } from "./blue-desk-source-observations-projector.ts";

/**
 * Public read-only freshness projection. Three *different* authority clocks:
 * observed source event, reviewed editorial lens, and last persistent shadow
 * projection. Never turns a source receipt into a new interpreted thesis.
 */
export type RegimeResearchClockInput = {
  sources: readonly PublicSourceObservation[] | null;
  editorialReviewedOn: string;
  shadow: {
    available: boolean;
    latestRunStatus: string | null;
    latestCompletedAt: string | null;
    currentProjectionCount: number;
    expectedProjectionCount: number;
  } | null;
  now?: Date;
};

export type RegimeResearchClockView = {
  sourceState: "DATED" | "EMPTY" | "UNAVAILABLE";
  sourceEventAt: string | null;
  sourceRecordedAt: string | null;
  editorialReviewedOn: string;
  unreviewedNewSource: boolean;
  shadowState: "COMPLETED" | "NOT_COMPLETED" | "UNAVAILABLE";
  shadowCompletedAt: string | null;
  shadowCoverage: string | null;
};

function pastTime(raw: string | null | undefined, now: number): number | null {
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) && ms <= now ? ms : null;
}

function reviewedDayEndMyt(day: string): number | null {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(day)) return null;
  const ms = Date.parse(day + "T23:59:59.999+08:00");
  if (!Number.isFinite(ms)) return null;
  const back = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(ms));
  // en-CA is commonly ISO but can vary by runtime locale; compare normalized parts instead.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(ms));
  const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
  void back;
  return `${fields.year}-${fields.month}-${fields.day}` === day ? ms : null;
}

export function projectRegimeResearchClocks(input: RegimeResearchClockInput): RegimeResearchClockView {
  const now = (input.now ?? new Date()).getTime();
  const safeNow = Number.isFinite(now) ? now : -Infinity;
  const valid = (input.sources ?? [])
    .filter(row => {
      const event = pastTime(row.eventAt, safeNow);
      const recorded = pastTime(row.recordedAt, safeNow);
      return event !== null && recorded !== null && recorded >= event;
    })
    .sort((a, b) => Date.parse(b.eventAt) - Date.parse(a.eventAt));
  const latest = valid[0] ?? null;
  const reviewEnd = reviewedDayEndMyt(input.editorialReviewedOn);
  const projected = input.shadow?.available && input.shadow.latestRunStatus === "completed"
    && pastTime(input.shadow.latestCompletedAt, safeNow) !== null;
  const completedAt = projected ? input.shadow?.latestCompletedAt ?? null : null;

  return {
    sourceState: input.sources === null ? "UNAVAILABLE" : latest ? "DATED" : "EMPTY",
    sourceEventAt: latest?.eventAt ?? null,
    sourceRecordedAt: latest?.recordedAt ?? null,
    editorialReviewedOn: input.editorialReviewedOn,
    unreviewedNewSource: Boolean(latest && reviewEnd !== null && Date.parse(latest.recordedAt) > reviewEnd),
    shadowState: input.shadow === null || !input.shadow.available
      ? "UNAVAILABLE" : projected ? "COMPLETED" : "NOT_COMPLETED",
    shadowCompletedAt: completedAt,
    shadowCoverage: input.shadow?.available
      ? `${input.shadow.currentProjectionCount}/${input.shadow.expectedProjectionCount}` : null,
  };
}
