import type { EconomicCalendarEvent } from "./calendar.ts";

export const ISM_SCHEDULE_URL = "https://www.ismworld.org/supply-management-news-and-reports/reports/rob-report-calendar/";

type IsmKind = "Manufacturing" | "Services";
type IsmScheduleRow = { date: string; kind: IsmKind };
export type IsmScheduleResult = { events: EconomicCalendarEvent[]; state: "live" | "verified_backstop" | "unavailable"; warning: string | null };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Dates checked against the ISM's published 2026 calendar on 12 October.
// This backstop automatically expires; we never extrapolate a 2027 date.
const VERIFIED_2026: IsmScheduleRow[] = [
  { date: "2026-11-02", kind: "Manufacturing" },
  { date: "2026-11-04", kind: "Services" },
  { date: "2026-12-01", kind: "Manufacturing" },
  { date: "2026-12-03", kind: "Services" },
];

function plain(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
}

export function parseIsmScheduleHtml(html: string): IsmScheduleRow[] {
  const titleYear = /(?:20\d{2})\s+ISM[^<]{0,140}Release Dates/i.exec(plain(html))?.[0]?.match(/20\d{2}/)?.[0];
  const year = Number(titleYear);
  if (!Number.isInteger(year) || year < 2026 || year > 2040) return [];
  const rows: IsmScheduleRow[] = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(item => plain(item[1]));
    if (cells.length < 3) continue;
    const month = MONTHS.findIndex(name => new RegExp(`^\${name}(?:\\s+\${year})?$`, "i").test(cells[0]));
    if (month < 0) continue;
    for (const [index, kind] of [[1, "Manufacturing"], [2, "Services"]] as const) {
      const match = cells[index].match(/^\s*(\d{1,2})(?:\s|$)/);
      if (!match) continue;
      const day = Number(match[1]);
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date) rows.push({ date, kind });
    }
  }
  return rows;
}

function asEvent(row: IsmScheduleRow): EconomicCalendarEvent {
  const manufacturing = row.kind === "Manufacturing";
  return {
    id: `us-ism-${row.kind.toLowerCase()}-${row.date}`,
    date: row.date, timeLabel: "10:00 ET",
    country: "United States", g7Markets: ["United States"],
    event: `ISM ${row.kind} PMI`, category: "Growth", impact: "High",
    referencePeriod: "Prior calendar month", status: "Scheduled",
    actual: null, consensus: null, previous: null,
    decidingQuestion: manufacturing
      ? "Do new orders, employment and prices paid signal stronger activity or inflation pressure, and do yields confirm?"
      : "Do services new orders, employment and prices paid shift growth and Fed expectations?",
    affectedAssets: ["USD", "US02Y", "US10Y", "SPX", "GOLD"],
    sourceName: "Institute for Supply Management", sourceUrl: ISM_SCHEDULE_URL,
    sourceKind: "official-schedule",
  };
}

export async function getIsmSchedule({
  now = new Date(),
  fetchImpl = fetch,
}: { now?: Date; fetchImpl?: typeof fetch } = {}): Promise<IsmScheduleResult> {
  const today = now.toISOString().slice(0, 10);
  try {
    const response = await fetchImpl(ISM_SCHEDULE_URL, {
      next: { revalidate: 24 * 60 * 60 }, signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = parseIsmScheduleHtml(await response.text());
    if (parsed.length < 4) throw new Error("official schedule table not recognised");
    return { events: parsed.filter(row => row.date >= today).map(asEvent), state: "live", warning: null };
  } catch {
    const events = VERIFIED_2026.filter(row => row.date >= today).map(asEvent);
    return {
      events, state: events.length ? "verified_backstop" : "unavailable",
      warning: events.length
        ? "ISM official calendar could not be refreshed; only dated 2026 official schedule backstops are shown."
        : "ISM official calendar unavailable; do not infer monthly release dates.",
    };
  }
}
