export type CalendarCountry = "United States" | "Canada" | "United Kingdom" | "Euro Area" | "Japan" | "Australia" | "New Zealand";
export type G7Country = CalendarCountry;

export type EconomicCalendarEvent = {
  id: string;
  date: string;
  timeLabel: string;
  country: CalendarCountry;
  g7Markets: string[];
  event: string;
  category: "Central bank" | "Inflation" | "Labour" | "Growth";
  impact: "High";
  referencePeriod: string | null;
  status: "Scheduled" | "Released";
  actual: string | null;
  consensus: string | null;
  alchemyExpectation?: string | null;
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
const RBA_CALENDAR = "https://www.rba.gov.au/schedules-events/board-meeting-schedules.html";
const RBNZ_CALENDAR = "https://www.rbnz.govt.nz/news-and-events/how-we-release-information/ocr-decision-dates-and-financial-stability-report-dates-to-feb-2028";

const scheduledEvents: EconomicCalendarEvent[] = [
  {
    id: "au-rba-2026-09-29",
    date: "2026-09-29",
    timeLabel: "14:30 AEST",
    country: "Australia",
    g7Markets: ["Australia"],
    event: "RBA monetary-policy decision",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    alchemyExpectation: null,
    previous: null,
    decidingQuestion: "Does the RBA validate the market-implied cash-rate path or lean harder against inflation?",
    affectedAssets: ["AUD", "AU02Y", "ASX"],
    sourceName: "Reserve Bank of Australia",
    sourceUrl: RBA_CALENDAR,
    sourceKind: "official-schedule",
  },
  {
    id: "au-rba-2026-11-03",
    date: "2026-11-03",
    timeLabel: "14:30 AEDT",
    country: "Australia",
    g7Markets: ["Australia"],
    event: "RBA monetary-policy decision and Statement on Monetary Policy",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    alchemyExpectation: null,
    previous: null,
    decidingQuestion: "Do the RBA forecasts change the balance between inflation persistence and domestic demand?",
    affectedAssets: ["AUD", "AU02Y", "ASX"],
    sourceName: "Reserve Bank of Australia",
    sourceUrl: RBA_CALENDAR,
    sourceKind: "official-schedule",
  },
  {
    id: "au-rba-2026-12-08",
    date: "2026-12-08",
    timeLabel: "14:30 AEDT",
    country: "Australia",
    g7Markets: ["Australia"],
    event: "RBA monetary-policy decision",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    alchemyExpectation: null,
    previous: null,
    decidingQuestion: "Does the year-end decision confirm a durable change in the Australian policy path?",
    affectedAssets: ["AUD", "AU02Y", "ASX"],
    sourceName: "Reserve Bank of Australia",
    sourceUrl: RBA_CALENDAR,
    sourceKind: "official-schedule",
  },
  {
    id: "nz-rbnz-2026-09-02",
    date: "2026-09-02",
    timeLabel: "14:00 NZST",
    country: "New Zealand",
    g7Markets: ["New Zealand"],
    event: "RBNZ Monetary Policy Statement and OCR decision",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    alchemyExpectation: null,
    previous: null,
    decidingQuestion: "Does the RBNZ validate the market-implied OCR path after the latest inflation and labour evidence?",
    affectedAssets: ["NZD", "NZ02Y", "NZX"],
    sourceName: "Reserve Bank of New Zealand",
    sourceUrl: RBNZ_CALENDAR,
    sourceKind: "official-schedule",
  },
  {
    id: "nz-rbnz-2026-10-28",
    date: "2026-10-28",
    timeLabel: "14:00 NZDT",
    country: "New Zealand",
    g7Markets: ["New Zealand"],
    event: "RBNZ Monetary Policy Review and OCR decision",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    alchemyExpectation: null,
    previous: null,
    decidingQuestion: "Does the RBNZ reaction function change after the latest CPI release?",
    affectedAssets: ["NZD", "NZ02Y", "NZX"],
    sourceName: "Reserve Bank of New Zealand",
    sourceUrl: RBNZ_CALENDAR,
    sourceKind: "official-schedule",
  },
  {
    id: "nz-rbnz-2026-12-09",
    date: "2026-12-09",
    timeLabel: "14:00 NZDT",
    country: "New Zealand",
    g7Markets: ["New Zealand"],
    event: "RBNZ Monetary Policy Statement and OCR decision",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: null,
    alchemyExpectation: null,
    previous: null,
    decidingQuestion: "Do the new RBNZ projections confirm the next phase of the OCR cycle?",
    affectedAssets: ["NZD", "NZ02Y", "NZX"],
    sourceName: "Reserve Bank of New Zealand",
    sourceUrl: RBNZ_CALENDAR,
    sourceKind: "official-schedule",
  },
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
      signal: AbortSignal.timeout(8_000),
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

type DeskMacroRelease = {
  id: string;
  release_name: string;
  agency: string;
  category: string;
  release_date: string;
  release_time_label: string | null;
  reference_period: string | null;
  status: string;
  actual: string | null;
  consensus: string | null;
  previous: string | null;
  revised_previous: string | null;
  watch_question: string | null;
  source_url: string;
  affected_assets: string[] | null;
};

type DeskMacroMetric = {
  release_id: string;
  label: string;
  unit: string | null;
  previous: number | null;
  revised_previous: number | null;
  consensus: number | null;
  alchemy_expectation: number | null;
  actual: number | null;
};

function calendarCountry(agency: string): CalendarCountry {
  if (/reserve bank of australia|\brba\b/i.test(agency)) return "Australia";
  if (/reserve bank of new zealand|\brbnz\b/i.test(agency)) return "New Zealand";
  if (/canada/i.test(agency)) return "Canada";
  if (/england|united kingdom|\bons\b/i.test(agency)) return "United Kingdom";
  if (/euro|ecb/i.test(agency)) return "Euro Area";
  if (/japan|\bboj\b/i.test(agency)) return "Japan";
  return "United States";
}

function calendarCategory(release: DeskMacroRelease): EconomicCalendarEvent["category"] {
  if (/reserve bank|central bank|federal reserve|bank of canada|bank of england|ecb|boj/i.test(release.agency)) return "Central bank";
  if (/labour|employment|job|wage/i.test(`${release.category} ${release.release_name}`)) return "Labour";
  if (/inflation|price|cpi|ppi|pce/i.test(`${release.category} ${release.release_name}`)) return "Inflation";
  return "Growth";
}

function metricValue(value: number | null, unit: string | null) {
  if (value === null) return null;
  return `${value}${unit ? ` ${unit}` : ""}`;
}

async function fetchDeskCalendar(): Promise<EconomicCalendarEvent[]> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!baseUrl || !apiKey) return [];
  try {
    const headers = { apikey: apiKey, Authorization: `Bearer ${apiKey}` };
    const [releaseResponse, metricResponse] = await Promise.all([
      fetch(`${baseUrl}/rest/v1/macro_releases?select=id,release_name,agency,category,release_date,release_time_label,reference_period,status,actual,consensus,previous,revised_previous,watch_question,source_url,affected_assets&order=release_date.asc&limit=160`, {
        headers,
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(5_000),
      }),
      fetch(`${baseUrl}/rest/v1/macro_release_metrics?select=release_id,label,unit,previous,revised_previous,consensus,alchemy_expectation,actual&order=updated_at.desc&limit=320`, {
        headers,
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(5_000),
      }),
    ]);
    if (!releaseResponse.ok) return [];
    const releases = await releaseResponse.json() as DeskMacroRelease[];
    const metrics = metricResponse.ok ? await metricResponse.json() as DeskMacroMetric[] : [];
    const metricByRelease = new Map<string, DeskMacroMetric>();
    for (const metric of metrics) {
      if (!metricByRelease.has(metric.release_id)) metricByRelease.set(metric.release_id, metric);
    }
    return releases.map((release) => {
      const metric = metricByRelease.get(release.id);
      const country = calendarCountry(release.agency);
      return {
        id: release.id,
        date: release.release_date.slice(0, 10),
        timeLabel: release.release_time_label || "Time TBC",
        country,
        g7Markets: [country],
        event: release.release_name,
        category: calendarCategory(release),
        impact: "High",
        referencePeriod: release.reference_period,
        status: release.actual || metric?.actual !== null && metric?.actual !== undefined || release.status === "completed" ? "Released" : "Scheduled",
        actual: release.actual || metricValue(metric?.actual ?? null, metric?.unit ?? null),
        consensus: release.consensus || metricValue(metric?.consensus ?? null, metric?.unit ?? null),
        alchemyExpectation: metricValue(metric?.alchemy_expectation ?? null, metric?.unit ?? null),
        previous: release.revised_previous || release.previous || metricValue(metric?.revised_previous ?? metric?.previous ?? null, metric?.unit ?? null),
        decidingQuestion: release.watch_question || `What would materially change the market interpretation of ${release.release_name}?`,
        affectedAssets: release.affected_assets || [],
        sourceName: release.agency,
        sourceUrl: release.source_url,
        sourceKind: "desk-record",
      };
    });
  } catch {
    return [];
  }
}

export async function getEconomicCalendar() {
  const [blsEvents, deskEvents] = await Promise.all([fetchBlsCalendar(), fetchDeskCalendar()]);
  const allEvents = [...scheduledEvents, ...blsEvents, ...deskEvents];
  return [...new Map(allEvents.map((event) => [event.id, event])).values()]
    .sort((a, b) => a.date.localeCompare(b.date));
}
