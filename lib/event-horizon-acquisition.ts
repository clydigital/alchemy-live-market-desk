import { dedupeMarketEvents, normaliseMarketEvent, type MarketEventV1 } from "./market-events.ts";

export type EventHorizonCoverageState = "covered" | "stale" | "unavailable" | "unsupported" | "source_failed";
export type EventHorizonCoverage = {
  family: "central_bank_appearances" | "energy_policy" | "treasury_fiscal" | "geopolitical_diplomatic" | "political_regulatory_legal";
  state: EventHorizonCoverageState;
  sourceName: string | null;
  sourceUrl: string | null;
  retrievedAt: string;
  confirmedEventCount: number;
  detail: string;
};

export type EventHorizonAcquisition = { events: MarketEventV1[]; coverage: EventHorizonCoverage[]; warnings: string[] };

type FedCalendarRecord = { title?: unknown; description?: unknown; location?: unknown; time?: unknown; month?: unknown; days?: unknown; type?: unknown; link?: unknown };
type FedCalendarPayload = { events?: unknown };

const FED_CALENDAR_URL = "https://www.federalreserve.gov/json/calendar.json";
const FED_CALENDAR_PAGE = "https://www.federalreserve.gov/newsevents/calendar.htm";
const OPEC_ORIGIN = "https://www.opec.org";
const OPEC_PRESS_RELEASES_URL = `${OPEC_ORIGIN}/press-releases.html`;
const OPEC_DETAIL_LIMIT = 8;
const OPEC_REQUEST_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": "Mozilla/5.0 (compatible; AlchemyLiveDesk/1.0; +https://alchemymarkets.com)",
};
const STALE_SOURCE_AGE_MS = 14 * 24 * 60 * 60 * 1_000;

function text(value: unknown) { return typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/&(?:amp|quot|#39);/g, " ").replace(/\s+/g, " ").trim() : ""; }
function day(value: unknown) { return /^\d{4}-\d{2}$/.test(text(value)) ? text(value) : ""; }
function dateFor(month: unknown, rawDay: unknown) {
  const base = day(month); const raw = text(rawDay).split(",")[0]?.trim() || "";
  return base && /^\d{1,2}$/.test(raw) ? `${base}-${raw.padStart(2, "0")}` : "";
}
function namedDate(value: string) {
  const match = value.match(/^(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})$/i);
  if (!match) return "";
  const month = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].indexOf(match[2].toLowerCase()) + 1;
  return month ? `${match[3]}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
}
function isFutureOrToday(date: string, now: Date) { return date >= now.toISOString().slice(0, 10); }
function occurrencePart(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function coverage(family: EventHorizonCoverage["family"], state: EventHorizonCoverageState, sourceName: string | null, sourceUrl: string | null, retrievedAt: string, confirmedEventCount: number, detail: string): EventHorizonCoverage {
  return { family, state, sourceName, sourceUrl, retrievedAt, confirmedEventCount, detail };
}
function responseState(response: Response, now: Date, confirmedEventCount: number): Extract<EventHorizonCoverageState, "covered" | "stale"> {
  if (confirmedEventCount > 0) return "covered";
  const lastModified = Date.parse(response.headers.get("last-modified") || "");
  return Number.isFinite(lastModified) && now.getTime() - lastModified > STALE_SOURCE_AGE_MS ? "stale" : "covered";
}

export function parseFederalReserveCalendar(payload: FedCalendarPayload, now = new Date()): MarketEventV1[] {
  if (!Array.isArray(payload.events)) return [];
  return payload.events.flatMap((row): MarketEventV1[] => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    const record = row as FedCalendarRecord;
    const type = text(record.type); const title = text(record.title); const startAt = dateFor(record.month, record.days);
    if (!startAt || !isFutureOrToday(startAt, now) || !/^(Speeches|Testimony)$/i.test(type) || !title) return [];
    const speaker = title.replace(/^(Speech|Testimony|Discussion|Lecture|Panel Discussion)\s*-?\s*/i, "").trim();
    const event = normaliseMarketEvent({
      id: `fed-calendar:${startAt}:${occurrencePart(title)}`,
      occurrenceKey: `fed-appearance:${startAt}:${occurrencePart(title)}`,
      eventType: "central_bank_speech",
      title: `${title}${text(record.description) ? ` — ${text(record.description)}` : ""}`,
      startAt,
      timeLabel: text(record.time) || "Time TBC",
      timePrecision: "date",
      status: "scheduled",
      verificationState: "official",
      participants: speaker ? [speaker] : [],
      geography: ["United States"],
      affectedAssets: ["USD", "US02Y", "SPX"],
      decisiveVariable: "Does the communication change the expected Fed policy path?",
      transmission: "Fed communication can reprice front-end rates, the dollar and duration-sensitive assets.",
      sourceName: "Federal Reserve Board calendar",
      sourceUrl: text(record.link).startsWith("https://") ? text(record.link) : FED_CALENDAR_PAGE,
      sourceRecordRefs: [`fed-calendar:${startAt}:${title}`],
      lastVerifiedAt: now.toISOString(),
    });
    return event ? [event] : [];
  });
}

export function parseOpecPressReleaseLinks(source: string) {
  const links: string[] = [];
  for (const match of source.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    try {
      const url = new URL(match[1], OPEC_ORIGIN);
      if (url.origin !== OPEC_ORIGIN || !url.pathname.startsWith("/pr-detail/")) continue;
      url.hash = "";
      url.search = "";
      if (!links.includes(url.href)) links.push(url.href);
      if (links.length >= OPEC_DETAIL_LIMIT) break;
    } catch {
      // Ignore malformed or non-HTTP links from the publisher page.
    }
  }
  return links;
}

function opecMeetingEvent(title: string, date: string, sourceUrl: string, now: Date): MarketEventV1 | null {
  const startAt = namedDate(date);
  const normalisedTitle = title.replace(/\s+/g, " ").trim().replace(/^the\s+/i, "");
  if (!startAt || !isFutureOrToday(startAt, now) || !/\b(OPEC|JMMC|Ministerial)\b/i.test(normalisedTitle)) return null;
  return normaliseMarketEvent({
    id: `opec:${startAt}:${occurrencePart(normalisedTitle)}`,
    occurrenceKey: `opec-meeting:${startAt}:${occurrencePart(normalisedTitle)}`,
    eventType: "energy_policy_meeting", title: normalisedTitle, startAt, timePrecision: "date", timeLabel: "Time TBC",
    status: "scheduled", verificationState: "official", participants: ["OPEC"], geography: ["Global"], affectedAssets: ["WTI", "BRENT"],
    decisiveVariable: "Whether production policy changes the expected oil-balance path.",
    transmission: "OPEC policy can change crude supply expectations and energy-market risk premia.",
    sourceName: "OPEC official press release", sourceUrl, sourceRecordRefs: [`opec:${startAt}:${normalisedTitle}`], lastVerifiedAt: now.toISOString(),
  });
}

export function parseOpecForwardMeetings(source: string, sourceUrl: string, now = new Date()): MarketEventV1[] {
  const plain = text(source);
  const datePattern = "(\\d{1,2}\\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{4})";
  const candidates: Array<{ title: string; date: string }> = [];

  const announced = new RegExp(`(?:hold|next meeting(?: will)? be held)(?: the)?\\s+(.{3,140}?)\\s+on\\s+${datePattern}`, "gi");
  for (const match of plain.matchAll(announced)) candidates.push({ title: match[1], date: match[2] });

  const scheduled = new RegExp(`next meeting of the\\s+(.{2,100}?)\\s+is scheduled for\\s+${datePattern}`, "gi");
  for (const match of plain.matchAll(scheduled)) candidates.push({ title: match[1], date: match[2] });

  const generic = new RegExp(`next meeting will be held on\\s+${datePattern}`, "gi");
  for (const match of plain.matchAll(generic)) {
    const title = /\\bJMMC\\b/i.test(plain)
      ? "JMMC meeting"
      : /OPEC\\+/i.test(plain)
        ? "OPEC+ participating countries meeting"
        : /\\bOPEC\\b/i.test(plain)
          ? "OPEC meeting"
          : "";
    if (title) candidates.push({ title, date: match[1] });
  }

  return dedupeMarketEvents(
    candidates.flatMap(({ title, date }) => {
      const event = opecMeetingEvent(title, date, sourceUrl, now);
      return event ? [event] : [];
    }),
  );
}

async function acquireFed(fetchImpl: typeof fetch, now: Date): Promise<{ events: MarketEventV1[]; coverage: EventHorizonCoverage; warning?: string }> {
  try {
    const response = await fetchImpl(FED_CALENDAR_URL, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (response.status === 404) {
      return { events: [], coverage: coverage("central_bank_appearances", "unavailable", "Federal Reserve Board calendar", FED_CALENDAR_URL, now.toISOString(), 0, "Official Fed calendar endpoint is unavailable."), warning: "Federal Reserve calendar unavailable: HTTP 404" };
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const events = parseFederalReserveCalendar(await response.json() as FedCalendarPayload, now);
    const state = responseState(response, now, events.length);
    return { events, coverage: coverage("central_bank_appearances", state, "Federal Reserve Board calendar", FED_CALENDAR_URL, now.toISOString(), events.length, state === "stale" ? "Official Fed calendar response is stale." : events.length ? "Official upcoming Fed appearances acquired." : "Official calendar returned no future speeches or testimony.") };
  } catch (error) {
    return { events: [], coverage: coverage("central_bank_appearances", "source_failed", "Federal Reserve Board calendar", FED_CALENDAR_URL, now.toISOString(), 0, "Official Fed calendar acquisition failed."), warning: `Federal Reserve calendar unavailable: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function acquireOpec(fetchImpl: typeof fetch, now: Date): Promise<{ events: MarketEventV1[]; coverage: EventHorizonCoverage; warning?: string }> {
  try {
    const response = await fetchImpl(OPEC_PRESS_RELEASES_URL, {
      cache: "no-store",
      headers: OPEC_REQUEST_HEADERS,
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status === 404) {
      return { events: [], coverage: coverage("energy_policy", "unavailable", "OPEC official press releases", OPEC_PRESS_RELEASES_URL, now.toISOString(), 0, "Official OPEC press-release index is unavailable."), warning: "OPEC schedule unavailable: HTTP 404" };
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const links = parseOpecPressReleaseLinks(await response.text());
    if (!links.length) {
      return {
        events: [],
        coverage: coverage("energy_policy", "source_failed", "OPEC official press releases", OPEC_PRESS_RELEASES_URL, now.toISOString(), 0, "Official OPEC press-release index returned no recognised detail links."),
        warning: "OPEC press-release index returned no official detail links; energy-policy coverage is unknown.",
      };
    }

    const details = await Promise.all(links.map(async (url) => {
      try {
        const detail = await fetchImpl(url, {
          cache: "no-store",
          headers: OPEC_REQUEST_HEADERS,
          signal: AbortSignal.timeout(8_000),
        });
        if (!detail.ok) return { url, body: null };
        return { url, body: await detail.text() };
      } catch {
        return { url, body: null };
      }
    }));
    const usable = details.filter((detail): detail is { url: string; body: string } => detail.body !== null);
    const failedCount = details.length - usable.length;
    if (!usable.length) {
      return {
        events: [],
        coverage: coverage("energy_policy", "source_failed", "OPEC official press releases", OPEC_PRESS_RELEASES_URL, now.toISOString(), 0, "Official OPEC press-release detail pages could not be acquired."),
        warning: "OPEC schedule unavailable: official press-release detail pages could not be acquired.",
      };
    }

    const events = dedupeMarketEvents(usable.flatMap((detail) => parseOpecForwardMeetings(detail.body, detail.url, now)));
    if (!events.length && failedCount > 0) {
      return {
        events: [],
        coverage: coverage("energy_policy", "source_failed", "OPEC official press releases", OPEC_PRESS_RELEASES_URL, now.toISOString(), 0, "OPEC press-release acquisition was incomplete and no forward meeting could be confirmed."),
        warning: `OPEC schedule incomplete: ${failedCount} of ${details.length} official press-release detail page(s) were unavailable.`,
      };
    }

    const state = responseState(response, now, events.length);
    return {
      events,
      coverage: coverage("energy_policy", state, "OPEC official press releases", OPEC_PRESS_RELEASES_URL, now.toISOString(), events.length, state === "stale" ? "Official OPEC press-release index is stale." : events.length ? "Officially announced OPEC forward meetings acquired." : "Recent official OPEC releases returned no confirmed forward meeting."),
      warning: failedCount > 0 ? `OPEC press-release acquisition partial: ${failedCount} of ${details.length} detail page(s) were unavailable.` : undefined,
    };
  } catch (error) {
    return { events: [], coverage: coverage("energy_policy", "source_failed", "OPEC official press releases", OPEC_PRESS_RELEASES_URL, now.toISOString(), 0, "Official OPEC source acquisition failed."), warning: `OPEC schedule unavailable: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function acquireEventHorizonEvents({ fetchImpl = fetch, now = new Date() }: { fetchImpl?: typeof fetch; now?: Date } = {}): Promise<EventHorizonAcquisition> {
  const [fed, opec] = await Promise.all([acquireFed(fetchImpl, now), acquireOpec(fetchImpl, now)]);
  const unsupported = [
    coverage("treasury_fiscal", "unsupported", null, null, now.toISOString(), 0, "No authoritative Treasury forward-event adapter is configured."),
    coverage("geopolitical_diplomatic", "unsupported", null, null, now.toISOString(), 0, "No deterministic diplomatic-calendar adapter is configured."),
    coverage("political_regulatory_legal", "unsupported", null, null, now.toISOString(), 0, "No deterministic political, regulatory or legal calendar adapter is configured."),
  ];
  return { events: [...fed.events, ...opec.events], coverage: [fed.coverage, opec.coverage, ...unsupported], warnings: [fed.warning, opec.warning].filter((warning): warning is string => Boolean(warning)) };
}
