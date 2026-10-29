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
  // Late-October company-announced earnings. A call time is not proof of
  // the results-release time. Date-only notices remain date-only.
  { ticker: "MSFT", company: "Microsoft", quarter: "FY2027 Q1", at: "2026-10-28", label: "Results after US close; exact release time unconfirmed", stage: "Issuer-confirmed reporting date; release time not announced", source: "https://www.microsoft.com/en-us/investor/default", decisive: "Azure/cloud revenue and margins versus AI capex, cash flow and guidance", transmission: "Enterprise AI spending only translates into shareholder returns if cloud economics and incremental cash flow justify capital intensity." },
  { ticker: "GOOGL", company: "Alphabet", quarter: "Q3 2026", at: "2026-10-28T16:30:00-04:00", label: "16:30 ET earnings conference call", stage: "Call time confirmed; results published before call without an asserted release minute", source: "https://abc.xyz/investor/", decisive: "Google Cloud demand, Search/AI monetisation, margin and capex against funding needs", transmission: "AI capability and advertising demand need to become operating cash flows to support the infrastructure bill." },
  // Issuer-confirmed timing. Listed time is the webcast/call unless the
  // issuer explicitly established the separate results release minute.
  { ticker: "SNDK", company: "SanDisk", quarter: "FY2027 Q1", at: "2026-10-29T16:30:00-04:00", label: "16:30 ET earnings conference call", stage: "Issuer-confirmed call; results release minute not asserted", source: "https://investor.sandisk.com/news-releases/news-release-details/sandisk-report-first-quarter-fiscal-year-2027-results-october-29", decisive: "NAND selling prices versus volumes, free cash flow, receivables and long-term customer contracts", transmission: "Memory-sector margins can benefit from pricing that raises device and cloud-infrastructure input costs." },
  { ticker: "INTC", company: "Intel", quarter: "Q3 2026", at: "2026-10-29T17:00:00-04:00", label: "17:00 ET conference call; release after close", stage: "Issuer confirms after-close results; call is 14:00 PDT", source: "https://www.intel.com/content/www/us/en/newsroom/news/corporate/intel-reports-third-quarter-2026-financial-results.html", decisive: "Intel Foundry loss, outside customers, capital spending, adjusted-to-GAAP reconciliation and equity funding", transmission: "A chip-product rebound and a viable external foundry are different investment questions." },
  { ticker: "CRWV", company: "CoreWeave", quarter: "Q3 2026", at: "2026-11-10T17:00:00-05:00", label: "17:00 ET results conference call", stage: "Issuer-confirmed earnings call date; separate release minute not asserted", source: "https://investors.coreweave.com/news/news-details/2026/CoreWeave-Announces-Date-of-Third-Quarter-2026-Financial-Results-and-Conference-Call/default.aspx", decisive: "AI compute customer payments, GPU utilisation, asset-backed debt terms, leases, liquidity and quarterly free cash flow", transmission: "The core AI financing risk is whether contracted demand becomes cash after GPU fleet replacement and debt service." },
  { ticker: "PLTR", company: "Palantir", quarter: "Q3 2026", at: "2026-11-02T17:00:00-05:00", label: "17:00 ET webcast; results after close", stage: "Issuer-confirmed after-close results and webcast", source: "https://investors.palantir.com/news-details/2026/Palantir-Announces-Date-of-Third-Quarter-2026-Earnings-Release-and-Webcast/", decisive: "Commercial and government growth, margins, revenue guidance and cash conversion versus valuation", transmission: "Even strong growth may disappoint if the implied multiyear execution bar is too high." },
  { ticker: "AMD", company: "AMD", quarter: "Q3 2026", at: "2026-11-03T17:00:00-05:00", label: "17:00 ET earnings call; results after close", stage: "Issuer-confirmed date and call", source: "https://ir.amd.com/news-events/press-releases/detail/1300/amd-to-report-fiscal-third-quarter-2026-financial-results", decisive: "Data-centre revenue, GPU margins, free cash flow and contingent customer equity warrants", transmission: "AI hardware sales must convert to margin and diluted per-share economics." },
  { ticker: "PFE", company: "Pfizer", quarter: "Q3 2026", at: "2026-11-03T10:00:00-05:00", label: "10:00 ET analyst call; performance report earlier", stage: "Issuer-confirmed webcast; exact morning report minute not asserted", source: "https://www.pfizer.com/news/press-release/press-release-detail/pfizer-invites-public-view-and-listen-webcast-november-3", decisive: "Medicine launches versus lost exclusivity, operating cash, debt and dividend coverage", transmission: "Pfizer tests whether replacement products can sustain shareholder distributions and deleverage." },
  { ticker: "AMZN", company: "Amazon", quarter: "Q3 2026", at: "2026-10-29T17:00:00-04:00", label: "17:00 ET results conference call", stage: "Call time confirmed; results-release minute not established", source: "https://www.aboutamazon.com/news/company-news/amazon-earnings-q3-2026-report", decisive: "AWS growth, AI infrastructure spending, operating margin and free cash flow", transmission: "The investor test is whether rising AI infrastructure commitments convert into durable AWS cash profits." },
  { ticker: "JPM", company: "JPMorganChase", quarter: "Q4 2026", at: "2027-01-14T08:30:00-05:00", label: "08:30 ET earnings call", stage: "Earnings call; results release time not asserted", source: "https://www.jpmorganchase.com/ir/events", decisive: "Credit costs, deposit rates, lending and management outlook", transmission: "Bank earnings test funding, credit and rates regime assumptions." },
  { ticker: "C", company: "Citigroup", quarter: "Q4 2026", at: "2027-01-14", label: "Time unconfirmed", stage: "Earnings call date only", source: "https://www.citigroup.com/global/investors/events-and-presentations", decisive: "Net interest income, credit quality and deposits", transmission: "Bank earnings test funding and credit conditions." },
];

/**
 * An issuer-announced *call* or reporting date becoming overdue means the
 * public results board must reconcile the outcome; it does NOT prove that a
 * financial release has occurred or verify its figures. No external fetch/job.
 * Times are conservative: exact webcast start + 2h, date-only at end of
 * source-stated UTC date. The result is a bounded ATTENTION ledger.
 */
export function getDueOfficialEarningsCandidates(now=new Date(),lookbackHours=96){
 const at=now.getTime();
 if(!Number.isFinite(at)||!Number.isInteger(lookbackHours)||lookbackHours<1||lookbackHours>168)return [];
 return OFFICIAL.flatMap(row=>{
   const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(row.at);
   const due=dateOnly?Date.parse(row.at+"T23:59:59Z"):Date.parse(row.at)+2*3600000;
   if(!Number.isFinite(due)||at<due||at-due>lookbackHours*3600000)return [];
   return [{ticker:row.ticker,company:row.company,quarter:row.quarter,
     originalScheduleUrl:row.source,scheduledCallAt:row.at,
     sourceDateOnly:dateOnly}];
 });
}

const WATCHED = new Set(["JPM", "C", "WFC", "BAC", "GS", "MS", "BLK", "TSM", "NVDA", "AMD", "MU", "AVGO", "AMZN", "GOOGL", "MSFT", "META", "ORCL", "CRWV", "AAPL", "INTC", "SNDK", "PLTR", "PFE", "NFLX", "TSLA", "UNH", "JNJ", "XOM", "CVX", "DAL"]);
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
  // Production is issuer-first; Finnhub is never auto-called, even if a key
  // exists in Vercel. Explicit legacy opt-in remains for integration tests.
  finnhubKey,
  finnhubCommercialApproved = false,
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
    warning: "Automatic calendar pre-production checks use official macro release schedules; earnings dates remain issuer-confirmed until a licensed alternative passes validation.",
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
