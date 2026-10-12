/**
 * Read-only presentation projection of the latest immutable canonical edition.
 * Never fills a historical Journey from current data or promotes calendar events
 * into Dossier evidence. Source metadata was frozen during edition publication.
 */
type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
}

export type PublishedHorizonItem = {
  id: string;
  eventId: string;
  lane: "economic_calendar" | "earnings" | "geopolitical_clock";
  title: string;
  timing: { value: string; label: string | null; precision: "exact" | "date" | "window" };
  evidenceRefs: string[];
  sourceName: string | null;
  sourceUrl: string | null;
  sourceVerificationState: "official" | "corroborated" | "reported" | "unverified" | null;
  sourceCheckedAt: string | null;
};
export type PublishedHorizon = {
  contractVersion: "presenter-published-horizon/1";
  status: "AVAILABLE" | "UNAVAILABLE";
  editionId: string | null;
  publishedAt: string | null;
  dossierId: string | null;
  dossierAsOf: string | null;
  horizon: { today: PublishedHorizonItem[]; tonight: PublishedHorizonItem[]; later: PublishedHorizonItem[] };
  detail: string;
};

type EditionRow = { id: string; published_at: string; payload: unknown };

function validFutureTime(value: string, precision: string, now: string): boolean {
  if (precision === "date" || precision === "window") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const klDate = new Date(Date.parse(now) + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return value >= klDate;
  }
  return precision === "exact" && Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.parse(now);
}

function safeSourceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function items(value: unknown, now: string): PublishedHorizonItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate): PublishedHorizonItem[] => {
    const item = record(candidate);
    const timing = record(item?.timing);
    if (!item || !timing) return [];
    const lane = item.lane;
    const refs = item.evidenceRefs;
    const title = item.title;
    const eventId = item.eventId;
    const time = timing.value;
    const precision = timing.precision;
    if (!["economic_calendar", "earnings", "geopolitical_clock"].includes(String(lane))
      || typeof item.id !== "string" || !item.id
      || typeof eventId !== "string" || !eventId
      || typeof title !== "string" || !title.trim()
      || typeof time !== "string" || !validFutureTime(time, String(precision), now)
      || !Array.isArray(refs) || !refs.length || !refs.every(x => typeof x === "string" && x.length > 0)) return [];
    const status = item.sourceVerificationState;
    return [{
      id: item.id,
      eventId,
      lane: lane as PublishedHorizonItem["lane"],
      title,
      timing: { value: time, label: typeof timing.label === "string" ? timing.label : null, precision: precision as PublishedHorizonItem["timing"]["precision"] },
      evidenceRefs: refs,
      sourceName: typeof item.sourceName === "string" ? item.sourceName : null,
      sourceUrl: safeSourceUrl(item.sourceUrl),
      sourceVerificationState: ["official", "corroborated", "reported", "unverified"].includes(String(status)) ? status as PublishedHorizonItem["sourceVerificationState"] : null,
      sourceCheckedAt: typeof item.sourceCheckedAt === "string" && Number.isFinite(Date.parse(item.sourceCheckedAt)) ? item.sourceCheckedAt : null,
    }];
  }).slice(0, 24);
}

export function projectPublishedHorizon(row: EditionRow | null, now: string): PublishedHorizon {
  const empty: PublishedHorizon = {
    contractVersion: "presenter-published-horizon/1",
    status: "UNAVAILABLE",
    editionId: null, publishedAt: null, dossierId: null, dossierAsOf: null,
    horizon: { today: [], tonight: [], later: [] },
    detail: "No valid publication-frozen event horizon is available.",
  };
  if (!row?.id || !Number.isFinite(Date.parse(row.published_at)) || !Number.isFinite(Date.parse(now))) return empty;
  const payload = record(row.payload);
  const context = record(payload?.presenterDossierContext);
  const journey = record(payload?.journey);
  const horizon = record(journey?.horizon);
  if (context?.contractVersion !== "presenter-dossier-edition-context/1"
    || context.status !== "BOUND"
    || typeof context.dossierId !== "string" || !context.dossierId
    || typeof context.dossierAsOf !== "string" || !Number.isFinite(Date.parse(context.dossierAsOf))
    || journey?.contractVersion !== "journey-briefing/v1"
    || !horizon) return empty;
  const projected = {
    today: items(horizon.today, now),
    tonight: items(horizon.tonight, now),
    later: items(horizon.later, now),
  };
  return {
    ...empty,
    status: "AVAILABLE",
    editionId: row.id,
    publishedAt: row.published_at,
    dossierId: context.dossierId,
    dossierAsOf: context.dossierAsOf,
    horizon: projected,
    detail: "Only dated future events from this exact immutable edition are displayed. Missing entries are not inferred.",
  };
}
