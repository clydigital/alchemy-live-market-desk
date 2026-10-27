import type { PresenterCalendarEvent } from "./presenter-calendar.ts";
import type { MarketEventV1 } from "./market-events.ts";

export const CATALYST_LANES = ["macro", "fed", "diplomacy", "earnings", "technology", "energy", "other"] as const;
export type CatalystLane = typeof CATALYST_LANES[number];
export type CatalystCertainty = "official" | "reported" | "desk_record" | "unverified";
export type CatalystCard = {
  id: string; lane: CatalystLane; title: string; date: string | null;
  startAt: string | null; timePrecision: "exact" | "date" | "tbc";
  timeLabel: string; sourceUrl: string; sourceName: string;
  certainty: CatalystCertainty; status: string; ticker: string | null;
  country: string | null; affectedAssets: string[]; why: string;
  priority: "must_watch" | "watch"; signalOnly: boolean;
};

/** The user's Economic Calendar Guide: high-impact only, 8 territories,
 * Monday-Sunday/UTC; EU on screen, DAX for Germany. Do not downgrade off-calendar
 * Fed talks, peace talks and strategic Mag7 events to standard calendar exclusions.
 */
export const CALENDAR_GUIDE = {
  timezone: "UTC", weekdays: 7, impact: "High",
  countries: ["Japan","United States","United Kingdom","Euro Area","Germany","Australia","New Zealand","Canada"],
  categories: ["Central bank","Inflation","Employment","PMI","GDP","Retail & housing","10Y & 30Y auctions"],
} as const;

const MACRO_MAJOR = /\b(cpi|ppi|pce|inflation|payroll|non.farm|unemployment|adp|jobless|jolts|employment|pmi|ism|gdp|retail|durable goods|home sales|existing home|rate|fomc|monetary|press conference|minutes|auction|yield|bond|treasury)\b/i;
const MEGACAP = new Set(["MSFT","AAPL","NVDA","GOOGL","GOOG","AMZN","META","TSLA"]);
function validUrl(value: string) {
  try { const v = new URL(value); return v.protocol === "https:" && !v.username && !v.password; } catch { return false; }
}
function dateKey(value: string | null | undefined) {
  const day = value?.slice(0, 10) || "";
  const parsed = Date.parse(day+"T00:00:00Z");
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0,10) === day ? day : null;
}
function idKey(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,120); }
function timeOf(event: PresenterCalendarEvent) {
  if (event.timePrecision !== "exact" || !event.scheduledAt) return null;
  return Number.isFinite(Date.parse(event.scheduledAt)) ? event.scheduledAt : null;
}
function fromPresenter(row: PresenterCalendarEvent): CatalystCard | null {
  const exact = timeOf(row);
  const day = dateKey(exact) || dateKey(row.localDate);
  if (!day || !validUrl(row.sourceUrl)) return null;
  if (row.kind === "economic" && !MACRO_MAJOR.test(row.title)) return null;
  if (row.status === "cancelled" || row.status === "postponed") return null;
  const ticker = row.kind === "earnings" ? row.affectedAssets.find(s => /^[A-Z][A-Z0-9.-]{0,11}$/.test(s)) || null : null;
  const priority = row.kind === "economic" || (ticker && MEGACAP.has(ticker)) ? "must_watch" : "watch";
  return {
    id: row.id, lane: row.kind === "earnings" ? "earnings" : "macro",
    title: row.title, date: day, startAt: exact,
    timePrecision: exact ? "exact" : row.timePrecision === "tbc" ? "tbc" : "date",
    timeLabel: row.timeLabel || "Time not confirmed", sourceUrl: row.sourceUrl, sourceName: row.sourceName,
    certainty: row.verificationState, status: row.status, ticker, country: row.kind === "economic" ? inferCountry(row) : null,
    affectedAssets: row.affectedAssets,
    why: row.decidingQuestion || (row.kind === "earnings" ? "Check earnings quality, margins and guidance." : "Watch the impact on rates, currencies and risk assets."),
    priority: priority === "must_watch" ? "must_watch" : "watch", signalOnly: false,
  };
}
function inferCountry(row: PresenterCalendarEvent) {
  const t = row.title + " " + row.sourceName;
  if (/\b(germany|german|bundesbank|destatis|dax)\b/i.test(t)) return "DE";
  if (/\b(ecb|euro|eurostat)\b/i.test(t)) return "EU";
  if (/\b(boj|japan)\b/i.test(t)) return "JP";
  if (/\b(boe|united kingdom|britain|uk)\b/i.test(t)) return "GB";
  if (/\b(rba|australia)\b/i.test(t)) return "AU";
  if (/\b(rbnz|new zealand)\b/i.test(t)) return "NZ";
  if (/\b(boc|canada)\b/i.test(t)) return "CA";
  return "US";
}
function laneOf(row: MarketEventV1): CatalystLane {
  if (row.eventType === "central_bank_speech") return "fed";
  if (row.eventType === "geopolitical_meeting" || row.eventType === "sanctions_or_policy_deadline") return "diplomacy";
  if (row.eventType === "energy_policy_meeting") return "energy";
  if (row.eventType === "earnings") return "earnings";
  if (row.eventType === "central_bank_decision" || row.eventType === "economic_release" || row.eventType === "treasury_or_fiscal_event") return "macro";
  if (row.eventType === "conference_or_symposium" || /\b(unveil|keynote|launch|ai day|robotaxi|investor day|gtc|re:invent|product reveal|roadshow)\b/i.test(row.title)) return "technology";
  return "other";
}
function fromMarketEvent(row: MarketEventV1): CatalystCard | null {
  if (!validUrl(row.sourceUrl) || row.status === "cancelled" || row.status === "postponed" || row.status === "completed") return null;
  const lane = laneOf(row), startAt = row.timePrecision === "exact" && row.startAt ? row.startAt : null;
  const day = dateKey(row.startAt);
  if (lane === "other") return null;
  const ticker = row.affectedAssets.find(a => MEGACAP.has(a)) || null;
  const country = row.geography.includes("Germany") ? "DE" : row.geography.includes("Euro Area") ? "EU"
    : row.geography.includes("Japan") ? "JP" : row.geography.includes("United Kingdom") ? "GB"
    : row.geography.includes("Australia") ? "AU" : row.geography.includes("New Zealand") ? "NZ"
    : row.geography.includes("Canada") ? "CA" : row.geography.includes("United States") ? "US" : null;
  return {
    id: row.id, lane, title: row.title, date: day,
    startAt, timePrecision: startAt ? "exact" : day ? "date" : "tbc", timeLabel: row.timeLabel || "Time not confirmed",
    sourceUrl: row.sourceUrl, sourceName: row.sourceName,
    certainty: row.verificationState === "corroborated" ? "reported" : row.verificationState,
    status: row.status, ticker, country, affectedAssets: row.affectedAssets,
    why: row.decisiveVariable || row.transmission || "Await the primary-source announcement and reassess market implications.",
    priority: lane === "fed" || lane === "diplomacy" || (ticker && MEGACAP.has(ticker)) ? "must_watch" : "watch",
    signalOnly: !day,
  };
}
export type OfficialSignal = {
  id: string; title: string; lane: CatalystLane; sourceUrl: string;
  sourceName: string; publishedAt: string; ticker?: string;
};
/** RSS publication is NOT an event's scheduled date or an announcement of a meeting time. */
function fromSignal(item: OfficialSignal): CatalystCard | null {
  if (!validUrl(item.sourceUrl) || !Number.isFinite(Date.parse(item.publishedAt))) return null;
  return {id:"radar:"+idKey(item.id), title:item.title, lane:item.lane,
    date:null,startAt:null,timePrecision:"tbc",timeLabel:"Timing not established",sourceUrl:item.sourceUrl,sourceName:item.sourceName,
    certainty:"official",status:"monitoring",ticker:item.ticker || null,country:item.lane==="diplomacy"?null:item.lane==="fed"?"US":null,
    affectedAssets:[],why:"Official publication detected. Monitor for an event date, participants or follow-up; this is not a timed calendar appointment.",
    priority:item.lane==="diplomacy" || item.lane==="fed"?"must_watch":"watch",signalOnly:true};
}
export function projectBluebellyCatalysts(
  presenter: readonly PresenterCalendarEvent[],
  horizon: readonly MarketEventV1[],
  signals: readonly OfficialSignal[] = [],
): CatalystCard[] {
  const all = [
    ...presenter.map(fromPresenter), ...horizon.map(fromMarketEvent), ...signals.map(fromSignal),
  ].filter((e): e is CatalystCard => !!e);
  const byKey = new Map<string,CatalystCard>();
  for(const event of all) {
    const identity = event.lane+":"+event.title.trim().toLowerCase()+":"+(event.date || "undated");
    const previous=byKey.get(identity);
    const rank=(e:CatalystCard)=> (e.certainty==="official"?4:e.certainty==="desk_record"?3:e.certainty==="reported"?2:1)+(e.startAt?1:0);
    if(!previous || rank(event)>rank(previous)) byKey.set(identity,event);
  }
  return [...byKey.values()].sort((a,b) => (a.date||"9999").localeCompare(b.date||"9999")
    || (a.startAt||"9999").localeCompare(b.startAt||"9999") || a.id.localeCompare(b.id));
}
