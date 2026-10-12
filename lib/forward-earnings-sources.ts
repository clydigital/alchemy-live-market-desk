import { fetchFinnhubEarnings } from "./finnhub-earnings.ts";
import { normaliseMarketEvent, type MarketEventV1 } from "./market-events.ts";

export const EARNINGS_PARSE_URL = "https://api.parse.bot/scraper/2f15267d-2491-4111-ba2c-ce7eb2e52e47/get_upcoming_earnings";
export type ForwardEarningsCoverage = "official_and_provider" | "official_only" | "provider_only" | "unavailable";
export type ForwardEarningsResult = { events: MarketEventV1[]; coverage: ForwardEarningsCoverage; warning: string | null };

type OfficialEarning = {
  ticker: string; company: string; quarter: string; at: string; label: string; stage: string;
  source: string; decisive: string; transmission: string;
};
// Dated company-IR announcements, not predicted reporting dates. Automatically expire.
const OFFICIAL: OfficialEarning[] = [
  { ticker: "JPM", company: "JPMorganChase", quarter: "Q3 2026", at: "2026-10-13T08:30:00-04:00", label: "08:30 ET earnings call", stage: "Earnings call; results release time not asserted", source: "https://www.jpmorganchase.com/ir/events", decisive: "Net interest income, deposits, lending and credit provisions versus guidance", transmission: "Banks test whether higher funding rates are affecting credit and economic demand." },
  { ticker: "C", company: "Citigroup", quarter: "Q3 2026", at: "2026-10-13T08:00:00-04:00", label: "Approx. 08:00 ET results; 11:00 ET call", stage: "Results release; call later", source: "https://www.citigroup.com/global/news/press-release/2026/citi-third-quarter-2026-earnings-call", decisive: "Net interest income, trading revenues, deposit costs and credit quality", transmission: "Funding and credit quality are cross-checks for the US cost-of-capital regime." },
  { ticker: "WFC", company: "Wells Fargo", quarter: "Q3 2026", at: "2026-10-13T07:00:00-04:00", label: "Approx. 07:00 ET results; 10:00 ET call", stage: "Results release; call later", source: "https://newsroom.wf.com/news-releases/news-details/2026/Wells-Fargo-to-Announce-Third-Quarter-2026-Earnings-on-Oct--13-2026/default.aspx", decisive: "Net interest income, deposits, credit provisions and loan growth", transmission: "Credit transmission matters when long-end rates and borrowing costs rise." },
  { ticker: "BAC", company: "Bank of America", quarter: "Q3 2026", at: "2026-10-14T06:45:00-04:00", label: "Approx. 06:45 ET results; 08:30 ET call", stage: "Results release; call later", source: "https://newsroom.bankofamerica.com/content/newsroom/press-releases/2026/09/bank-of-america-to-report-third-quarter-2026-financial-results-a.html.html", decisive: "Deposit costs, net interest income, capital markets and credit loss reserves", transmission: "Bank guidance can reveal whether restrictive rates affect business and consumer financing." },
  { ticker: "TSM", company: "TSMC", quarter: "Q3 2026", at: "2026-10-15T14:00:00+08:00", label: "14:00 MYT earnings conference", stage: "Earnings conference; release time not asserted", source: "https://investor.tsmc.com/english/quarterly-results/2026/q3", decisive: "AI chip demand, gross margin, new guidance, capacity and capital expenditure", transmission: "TSMC links AI end demand to semiconductor supply and hyperscaler investment economics." },
  { ticker: "JPM", company: "JPMorganChase", quarter: "Q4 2026", at: "2027-01-14T08:30:00-05:00", label: "08:30 ET earnings call", stage: "Earnings call; results release time not asserted", source: "https://www.jpmorganchase.com/ir/events", decisive: "Credit costs, deposit rates, lending and management outlook", transmission: "Bank earnings test funding, credit and rates regime assumptions." },
  { ticker: "C", company: "Citigroup", quarter: "Q4 2026", at: "2027-01-14", label: "Time unconfirmed", stage: "Earnings call date only", source: "https://www.citigroup.com/global/investors/events-and-presentations", decisive: "Net interest income, credit quality and deposits", transmission: "Bank earnings test funding and credit conditions." },
];

const WATCHED = new Set(["JPM", "C", "WFC", "BAC", "GS", "MS", "BLK", "TSM", "NVDA", "AMD", "MU", "AVGO", "AMZN", "GOOGL", "MSFT", "META", "ORCL", "CRWV", "AAPL", "NFLX", "TSLA", "UNH", "JNJ", "XOM", "CVX", "DAL"]);
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));
const eventDay = (event: MarketEventV1) => event.startAt?.slice(0, 10) ?? "";

export function officialEarningsEvents(now = new Date()): MarketEventV1[] {
  const today = now.toISOString().slice(0, 10);
  return OFFICIAL.filter(row => row.at.slice(0, 10) >= today).flatMap(row => {
    const event = normaliseMarketEvent({
      id: "issuer-ir:" + row.ticker + ":" + row.quarter,
      occurrenceKey: "issuer-ir:" + row.ticker + ":" + row.quarter,
      eventType: "earnings", title: row.company + " " + row.quarter + " earnings",
      startAt: row.at, timeLabel: row.label,
      timePrecision: row.at.length === 10 ? "date" : "exact",
      status: "scheduled", verificationState: "official",
      affectedAssets: [row.ticker], geography: [row.ticker === "TSM" ? "Taiwan" : "United States"],
      decisiveVariable: row.decisive, expectedStage: row.stage,
      transmission: row.transmission,
      sourceName: row.company + " investor relations", sourceUrl: row.source,
      sourceRecordRefs: ["issuer-ir:" + row.ticker + ":" + row.quarter],
    });
    return event ? [event] : [];
  });
}

type EarningsHubRow = { ticker?: unknown; company_name?: unknown; quarter?: unknown; report_date?: unknown; report_time?: unknown; eps_estimate?: unknown; revenue_estimate?: unknown };
export function parseEarningsHubUpcoming(payload: unknown, now = new Date()): MarketEventV1[] {
  if (!payload || typeof payload !== "object") return [];
  const wrapper = payload as { data?: { upcoming_earnings?: unknown }; upcoming_earnings?: unknown };
  const records = wrapper.data?.upcoming_earnings ?? wrapper.upcoming_earnings;
  if (!Array.isArray(records)) return [];
  const today = now.toISOString().slice(0, 10);
  const latest = new Date(now.getTime() + 45 * 86_400_000).toISOString().slice(0, 10);
  return records.flatMap((value): MarketEventV1[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as EarningsHubRow;
    const ticker = clean(row.ticker).toUpperCase();
    const date = clean(row.report_date), company = clean(row.company_name), quarter = clean(row.quarter);
    if (!WATCHED.has(ticker) || !company || !validDate(date) || date < today || date > latest) return [];
    const estimates = [
      typeof row.eps_estimate === "number" && Number.isFinite(row.eps_estimate) ? "EPS estimate " + row.eps_estimate : null,
      typeof row.revenue_estimate === "number" && Number.isFinite(row.revenue_estimate) ? "Revenue estimate " + row.revenue_estimate : null,
    ].filter(Boolean).join("; ");
    const event = normaliseMarketEvent({
      id: "earningshub:" + ticker + ":" + date,
      occurrenceKey: "earningshub:" + ticker + ":" + date,
      eventType: "earnings", title: company + " earnings",
      startAt: date, timePrecision: "date", timeLabel: clean(row.report_time) || "Reporting time unconfirmed",
      status: "reported", verificationState: "reported", affectedAssets: [ticker],
      decisiveVariable: "Review " + ticker + " revenue, earnings quality, forward guidance and financing/capex relevance.",
      expectedStage: quarter || "Reporting period unconfirmed",
      expectation: estimates || null,
      transmission: "A provider calendar date is a research lead; verify with issuer IR before treating timing as confirmed.",
      sourceName: "EarningsHub via Parse (unconfirmed calendar)", sourceUrl: "https://earningshub.com/",
      sourceRecordRefs: ["earningshub:" + ticker + ":" + date],
    });
    return event ? [event] : [];
  });
}

function withoutIssuerDateConflicts(provider: MarketEventV1[], official: MarketEventV1[]) {
  // A company's issuer-announced event remains authoritative even if a calendar
  // vendor suggests a different date within the same reporting window.
  const priority = provider.filter(event => !official.some(issuer => {
    if (issuer.affectedAssets[0] !== event.affectedAssets[0]) return false;
    const difference = Math.abs(Date.parse((issuer.startAt || "").slice(0, 10)) - Date.parse((event.startAt || "").slice(0, 10)));
    return Number.isFinite(difference) && difference <= 14 * 86_400_000;
  }));
  return [...official, ...priority];
}

export async function getForwardEarningsEvents({
  now = new Date(), fetchImpl = fetch,
  // Old Parse ingestion remains testable only through explicit call parameters; it
  // is no longer an automatically selected production provider.
  apiKey, licensed = false,
  finnhubKey = process.env.FINNHUB_API_KEY,
  finnhubCommercialApproved = process.env.FINNHUB_COMMERCIAL_USE_APPROVED === "true",
}: {
  now?: Date; fetchImpl?: typeof fetch;
  apiKey?: string; licensed?: boolean;
  finnhubKey?: string; finnhubCommercialApproved?: boolean;
} = {}): Promise<ForwardEarningsResult> {
  const official = officialEarningsEvents(now);
  if (finnhubKey && !finnhubCommercialApproved) return {
    events: official, coverage: official.length ? "official_only" : "unavailable",
    warning: "Finnhub key is present but business use is not authorised. Issuer-confirmed earnings only.",
  };
  if (finnhubKey && finnhubCommercialApproved) {
    try {
      const provider = await fetchFinnhubEarnings({ apiKey: finnhubKey, now, fetchImpl });
      if (!provider.length) return {
        events: official, coverage: official.length ? "official_only" : "unavailable",
        warning: "Finnhub returned no recognised future priority-company earnings; check source coverage.",
      };
      return {
        events: withoutIssuerDateConflicts(provider, official),
        coverage: official.length ? "official_and_provider" : "provider_only",
        warning: null,
      };
    } catch {
      return {
        events: official, coverage: official.length ? "official_only" : "unavailable",
        warning: "Finnhub calendar unavailable or entitlement denied; issuer-confirmed earnings only.",
      };
    }
  }
  if (!apiKey || !licensed) return {
    events: official, coverage: official.length ? "official_only" : "unavailable",
    warning: "Finnhub earnings feed inactive (FINNHUB_API_KEY and business-use approval required); issuer-confirmed dates only.",
  };
  try {
    const response = await fetchImpl(EARNINGS_PARSE_URL, {
      headers: { "X-API-Key": apiKey, Accept: "application/json" },
      next: { revalidate: 24 * 60 * 60 }, signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error("provider HTTP " + response.status);
    const provider = parseEarningsHubUpcoming(await response.json(), now);
    if (!provider.length) throw new Error("no recognised priority issuers");
    const exact = new Set(official.map(event => event.affectedAssets[0] + ":" + eventDay(event)));
    return {
      events: [...official, ...provider.filter(event => !exact.has(event.affectedAssets[0] + ":" + eventDay(event)))],
      coverage: official.length ? "official_and_provider" : "provider_only", warning: null,
    };
  } catch {
    return {
      events: official, coverage: official.length ? "official_only" : "unavailable",
      warning: "EarningsHub provider request failed; retained only the published issuer-IR schedule.",
    };
  }
}
