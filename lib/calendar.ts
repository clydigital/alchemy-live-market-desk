export type G7Country = "United States" | "Canada" | "United Kingdom" | "Euro Area" | "Japan";

export type EconomicCalendarEvent = {
  id: string;
  date: string;
  timeLabel: string;
  country: G7Country;
  g7Markets: string[];
  event: string;
  category: "Central bank" | "Inflation" | "Labour" | "Growth";
  impact: "High";
  referencePeriod: string | null;
  status: "Scheduled" | "Released";
  actual: string | null;
  consensus: string | null;
  previous: string | null;
  decidingQuestion: string;
  affectedAssets: string[];
  sourceName: string;
  sourceUrl: string;
  sourceKind: "official-live" | "official-schedule" | "desk-record";
};

const FED_CALENDAR = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
const BOC_CALENDAR = "https://www.bankofcanada.ca/core-functions/monetary-policy/key-interest-rate/";
const BOE_CALENDAR = "https://www.bankofengland.co.uk/news/2025/september/monetary-policy-committee-dates-for-2026";
const ECB_CALENDAR = "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html";
const BOJ_CALENDAR = "https://www.boj.or.jp/en/mopo/mpmsche_minu/m_ref/mref250731a.pdf";

const scheduledEvents: EconomicCalendarEvent[] = [
  {
    id: "ca-lfs-2026-08-07",
    date: "2026-08-07",
    timeLabel: "08:30 ET",
    country: "Canada",
    g7Markets: ["Canada"],
    event: "Labour Force Survey",
    category: "Labour",
    impact: "High",
    referencePeriod: "July 2026",
    status: "Scheduled",
    actual: null,
    consensus: null,
    previous: null,
    decidingQuestion: "Is Canadian labour cooling fast enough to change the next Bank of Canada decision?",
    affectedAssets: ["CAD", "CA02Y", "TSX"],
    sourceName: "Statistics Canada",
    sourceUrl: "https://www150.statcan.gc.ca/n1/daily-quotidien/260710/dq260710a-eng.htm",
    sourceKind: "official-schedule",
  },
  {
    id: "uk-gdp-2026-08-13",
    date: "2026-08-13",
    timeLabel: "07:00 BST",
    country: "United Kingdom",
    g7Markets: ["United Kingdom"],
    event: "GDP first quarterly estimate",
    category: "Growth",
    impact: "High",
    referencePeriod: "Q2 2026",
    status: "Scheduled",
    actual: null,
    consensus: null,
    previous: null,
    decidingQuestion: "Can UK activity absorb restrictive rates and the renewed energy-price shock?",
    affectedAssets: ["GBP", "UK02Y", "FTSE"],
    sourceName: "Office for National Statistics",
    sourceUrl: "https://www.ons.gov.uk/releasecalendar?keywords=GDP&release-type=type-upcoming&sort=date-newest",
    sourceKind: "official-schedule",
  },
  {
    id: "ea-gdp-2026-08-14",
    date: "2026-08-14",
    timeLabel: "11:00 CEST",
    country: "Euro Area",
    g7Markets: ["France", "Germany", "Italy"],
    event: "GDP and employment flash estimate",
    category: "Growth",
    impact: "High",
    referencePeriod: "Q2 2026",
    status: "Scheduled",
    actual: null,
    consensus: null,
    previous: null,
    decidingQuestion: "Is euro-area growth broad enough to keep the ECB focused on inflation rather than demand?",
    affectedAssets: ["EUR", "BUND", "STOXX"],
    sourceName: "Eurostat",
    sourceUrl: "https://ec.europa.eu/eurostat/documents/24987/6642470/QNA_release_calendar.pdf",
    sourceKind: "official-schedule",
  },
  {
    id: "ca-boc-2026-09-02",
    date: "2026-09-02",
    timeLabel: "Time TBC",
    country: "Canada",
    g7Markets: ["Canada"],
    event: "Bank of Canada rate decision",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    previous: null,
    decidingQuestion: "Does the Bank validate easing expectations or lean against inflation and currency pressure?",
    affectedAssets: ["CAD", "CA02Y", "TSX"],
    sourceName: "Bank of Canada",
    sourceUrl: BOC_CALENDAR,
    sourceKind: "official-schedule",
  },
  {
    id: "ea-ecb-2026-09-10",
    date: "2026-09-10",
    timeLabel: "14:15 CEST",
    country: "Euro Area",
    g7Markets: ["France", "Germany", "Italy"],
    event: "ECB monetary-policy decision",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    previous: null,
    decidingQuestion: "Is the ECB more constrained by energy inflation or by the loss of growth momentum?",
    affectedAssets: ["EUR", "BUND", "STOXX"],
    sourceName: "European Central Bank",
    sourceUrl: ECB_CALENDAR,
    sourceKind: "official-schedule",
  },
  {
    id: "us-fomc-2026-09-16",
    date: "2026-09-16",
    timeLabel: "14:00 ET",
    country: "United States",
    g7Markets: ["United States"],
    event: "FOMC decision and projections",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    previous: null,
    decidingQuestion: "Do the dots validate front-end tightening risk after the energy and labour data?",
    affectedAssets: ["USD", "US02Y", "SPX", "GOLD"],
    sourceName: "Federal Reserve",
    sourceUrl: FED_CALENDAR,
    sourceKind: "official-schedule",
  },
  {
    id: "uk-boe-2026-09-17",
    date: "2026-09-17",
    timeLabel: "12:00 BST",
    country: "United Kingdom",
    g7Markets: ["United Kingdom"],
    event: "Bank of England rate decision",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    previous: null,
    decidingQuestion: "Does the vote split move toward renewed tightening or toward protecting growth?",
    affectedAssets: ["GBP", "UK02Y", "FTSE"],
    sourceName: "Bank of England",
    sourceUrl: BOE_CALENDAR,
    sourceKind: "official-schedule",
  },
  {
    id: "jp-boj-2026-09-18",
    date: "2026-09-18",
    timeLabel: "After meeting",
    country: "Japan",
    g7Markets: ["Japan"],
    event: "Bank of Japan policy decision",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    previous: null,
    decidingQuestion: "Does policy guidance reinforce the yen intervention or reopen the carry trade?",
    affectedAssets: ["JPY", "JGB", "NIKKEI"],
    sourceName: "Bank of Japan",
    sourceUrl: BOJ_CALENDAR,
    sourceKind: "official-schedule",
  },
  {
    id: "us-fomc-2026-10-28",
    date: "2026-10-28",
    timeLabel: "14:00 ET",
    country: "United States",
    g7Markets: ["United States"],
    event: "FOMC rate decision",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    previous: null,
    decidingQuestion: "Has incoming inflation or labour evidence materially changed the September policy path?",
    affectedAssets: ["USD", "US02Y", "SPX", "GOLD"],
    sourceName: "Federal Reserve",
    sourceUrl: FED_CALENDAR,
    sourceKind: "official-schedule",
  },
  {
    id: "ca-boc-2026-10-28",
    date: "2026-10-28",
    timeLabel: "Time TBC",
    country: "Canada",
    g7Markets: ["Canada"],
    event: "Bank of Canada decision and MPR",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    previous: null,
    decidingQuestion: "Do new forecasts change the balance between inflation persistence and weak domestic demand?",
    affectedAssets: ["CAD", "CA02Y", "TSX"],
    sourceName: "Bank of Canada",
    sourceUrl: BOC_CALENDAR,
    sourceKind: "official-schedule",
  },
  {
    id: "ea-ecb-2026-10-29",
    date: "2026-10-29",
    timeLabel: "14:15 CET",
    country: "Euro Area",
    g7Markets: ["France", "Germany", "Italy"],
    event: "ECB monetary-policy decision",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    previous: null,
    decidingQuestion: "Is policy transmission easing inflation without destabilising sovereign spreads?",
    affectedAssets: ["EUR", "BUND", "BTP", "STOXX"],
    sourceName: "European Central Bank",
    sourceUrl: ECB_CALENDAR,
    sourceKind: "official-schedule",
  },
  {
    id: "jp-boj-2026-10-30",
    date: "2026-10-30",
    timeLabel: "After meeting",
    country: "Japan",
    g7Markets: ["Japan"],
    event: "Bank of Japan decision and Outlook Report",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    previous: null,
    decidingQuestion: "Do inflation forecasts justify tighter policy and a smaller US-Japan carry gap?",
    affectedAssets: ["JPY", "JGB", "NIKKEI"],
    sourceName: "Bank of Japan",
    sourceUrl: BOJ_CALENDAR,
    sourceKind: "official-schedule",
  },
  {
    id: "uk-boe-2026-11-05",
    date: "2026-11-05",
    timeLabel: "12:00 GMT",
    country: "United Kingdom",
    g7Markets: ["United Kingdom"],
    event: "Bank of England decision and MPR",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    previous: null,
    decidingQuestion: "Do the new forecasts validate the market's terminal-rate and growth assumptions?",
    affectedAssets: ["GBP", "UK02Y", "FTSE"],
    sourceName: "Bank of England",
    sourceUrl: BOE_CALENDAR,
    sourceKind: "official-schedule",
  },
  {
    id: "us-fomc-2026-12-09",
    date: "2026-12-09",
    timeLabel: "14:00 ET",
    country: "United States",
    g7Markets: ["United States"],
    event: "FOMC decision and projections",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    previous: null,
    decidingQuestion: "Does the year-end projection path validate the curve's 2027 policy pricing?",
    affectedAssets: ["USD", "US02Y", "SPX", "GOLD"],
    sourceName: "Federal Reserve",
    sourceUrl: FED_CALENDAR,
    sourceKind: "official-schedule",
  },
  {
    id: "ca-boc-2026-12-09",
    date: "2026-12-09",
    timeLabel: "Time TBC",
    country: "Canada",
    g7Markets: ["Canada"],
    event: "Bank of Canada rate decision",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    previous: null,
    decidingQuestion: "Does the Bank end the year prioritising currency and inflation risk or weak activity?",
    affectedAssets: ["CAD", "CA02Y", "TSX"],
    sourceName: "Bank of Canada",
    sourceUrl: BOC_CALENDAR,
    sourceKind: "official-schedule",
  },
  {
    id: "uk-boe-2026-12-17",
    date: "2026-12-17",
    timeLabel: "12:00 GMT",
    country: "United Kingdom",
    g7Markets: ["United Kingdom"],
    event: "Bank of England rate decision",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    previous: null,
    decidingQuestion: "Does the year-end vote split confirm a durable policy shift?",
    affectedAssets: ["GBP", "UK02Y", "FTSE"],
    sourceName: "Bank of England",
    sourceUrl: BOE_CALENDAR,
    sourceKind: "official-schedule",
  },
  {
    id: "ea-ecb-2026-12-17",
    date: "2026-12-17",
    timeLabel: "14:15 CET",
    country: "Euro Area",
    g7Markets: ["France", "Germany", "Italy"],
    event: "ECB monetary-policy decision",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    previous: null,
    decidingQuestion: "Do updated projections reopen easing or keep policy constrained by inflation?",
    affectedAssets: ["EUR", "BUND", "BTP", "STOXX"],
    sourceName: "European Central Bank",
    sourceUrl: ECB_CALENDAR,
    sourceKind: "official-schedule",
  },
  {
    id: "jp-boj-2026-12-18",
    date: "2026-12-18",
    timeLabel: "After meeting",
    country: "Japan",
    g7Markets: ["Japan"],
    event: "Bank of Japan policy decision",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    previous: null,
    decidingQuestion: "Does the Bank finish the year with policy support for a durable yen recovery?",
    affectedAssets: ["JPY", "JGB", "NIKKEI"],
    sourceName: "Bank of Japan",
    sourceUrl: BOJ_CALENDAR,
    sourceKind: "official-schedule",
  },
];

const BLS_ICS = "https://www.bls.gov/schedule/news_release/bls.ics";

function field(block: string, name: string) {
  const match = block.match(new RegExp(`^${name}(?:;[^:]*)?:(.+)$`, "mi"));
  return match?.[1]?.trim() || "";
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function blsDefinition(summary: string) {
  if (/Employment Situation/i.test(summary)) return { category: "Labour" as const, question: "Are payrolls, unemployment and wages changing the Fed path?", assets: ["USD", "US02Y", "SPX"] };
  if (/Consumer Price Index/i.test(summary)) return { category: "Inflation" as const, question: "Is inflation broad and persistent enough to change rate expectations?", assets: ["USD", "US02Y", "SPX", "GOLD"] };
  if (/Producer Price Index/i.test(summary)) return { category: "Inflation" as const, question: "Is pipeline inflation reinforcing or contradicting the CPI signal?", assets: ["USD", "US02Y", "SPX"] };
  if (/Job Openings and Labor Turnover Survey/i.test(summary)) return { category: "Labour" as const, question: "Is labour demand cooling before payroll growth breaks?", assets: ["USD", "US02Y", "SPX"] };
  return null;
}

async function fetchBlsCalendar(): Promise<EconomicCalendarEvent[]> {
  try {
    const response = await fetch(BLS_ICS, {
      headers: { accept: "text/calendar", "user-agent": "Alchemy Live Desk economic calendar" },
      next: { revalidate: 60 * 60 * 6 },
    });
    if (!response.ok) return [];
    const ics = (await response.text()).replace(/\r?\n[ \t]/g, "");
    return [...ics.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)].flatMap((match) => {
      const block = match[1];
      const summary = field(block, "SUMMARY").replace(/\\,/g, ",");
      const definition = blsDefinition(summary);
      const start = field(block, "DTSTART");
      const dateMatch = start.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
      if (!definition || !dateMatch) return [];
      const date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      const hour = dateMatch[4] || "08";
      const minute = dateMatch[5] || "30";
      const url = field(block, "URL") || BLS_ICS;
      return [{
        id: `us-bls-${date}-${slug(summary)}`,
        date,
        timeLabel: `${hour}:${minute} ET`,
        country: "United States" as const,
        g7Markets: ["United States"],
        event: summary,
        category: definition.category,
        impact: "High" as const,
        referencePeriod: null,
        status: "Scheduled" as const,
        actual: null,
        consensus: null,
        previous: null,
        decidingQuestion: definition.question,
        affectedAssets: definition.assets,
        sourceName: "U.S. Bureau of Labor Statistics",
        sourceUrl: url,
        sourceKind: "official-live" as const,
      }];
    });
  } catch {
    return [];
  }
}

export async function getEconomicCalendar() {
  const blsEvents = await fetchBlsCalendar();
  const allEvents = [...blsEvents, ...scheduledEvents];
  return [...new Map(allEvents.map((event) => [`${event.date}:${event.event}`, event])).values()]
    .sort((a, b) => a.date.localeCompare(b.date));
}
