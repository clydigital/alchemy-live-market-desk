import { normaliseMarketEvent, type MarketEventV1 } from "./market-events.ts";

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
const OPEC_PRESS_ROOM_URL = "https://www.opec.org/opec_web/en/press_room/28.htm";
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

export function parseOpecForwardMeetings(source: string, sourceUrl: string, now = new Date()): MarketEventV1[] {
  const plain = text(source);
  const matches = [...plain.matchAll(/(?:hold|next meeting(?: will)? be held)(?: the)?\s+(.{3,140}?)\s+on\s+(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/gi)];
  return matches.flatMap((match): MarketEventV1[] => {
    const startAt = namedDate(match[2]); if (!startAt || !isFutureOrToday(startAt, now)) return [];
    const title = match[1].replace(/\s+/g, " ").trim().replace(/^the\s+/i, "");
    if (!/\b(OPEC|JMMC|Ministerial)\b/i.test(title)) return [];
    const event = normaliseMarketEvent({
      id: `opec:${startAt}:${occurrencePart(title)}`,
      occurrenceKey: `opec-meeting:${startAt}:${occurrencePart(title)}`,
      eventType: "energy_policy_meeting", title, startAt, timePrecision: "date", timeLabel: "Time TBC",
      status: "scheduled", verificationState: "official", participants: ["OPEC"], geography: ["Global"], affectedAssets: ["WTI", "BRENT"],
      decisiveVariable: "Whether production policy changes the expected oil-balance path.",
      transmission: "OPEC policy can change crude supply expectations and energy-market risk premia.",
      sourceName: "OPEC official press release", sourceUrl, sourceRecordRefs: [`opec:${startAt}:${title}`], lastVerifiedAt: now.toISOString(),
    });
    return event ? [event] : [];
  });
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
    const response = await fetchImpl(OPEC_PRESS_ROOM_URL, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (response.status === 404) {
      return { events: [], coverage: coverage("energy_policy", "unavailable", "OPEC official press room", OPEC_PRESS_ROOM_URL, now.toISOString(), 0, "Official OPEC schedule endpoint is unavailable."), warning: "OPEC schedule unavailable: HTTP 404" };
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const events = parseOpecForwardMeetings(await response.text(), OPEC_PRESS_ROOM_URL, now);
    const state = responseState(response, now, events.length);
    return { events, coverage: coverage("energy_policy", state, "OPEC official press room", OPEC_PRESS_ROOM_URL, now.toISOString(), events.length, state === "stale" ? "Official OPEC source response is stale." : events.length ? "Officially announced OPEC forward meetings acquired." : "Official OPEC source returned no confirmed forward meeting." ) };
  } catch (error) {
    return { events: [], coverage: coverage("energy_policy", "source_failed", "OPEC official press room", OPEC_PRESS_ROOM_URL, now.toISOString(), 0, "Official OPEC source acquisition failed."), warning: `OPEC schedule unavailable: ${error instanceof Error ? error.message : String(error)}` };
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
