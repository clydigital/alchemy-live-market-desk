import {recentOriginalIssuerReleases} from "./bluebelly-issuer-release-receipts.ts";
import { fetchFinnhubEarnings } from "./finnhub-earnings.ts";
import { normaliseMarketEvent, type MarketEventV1 } from "./market-events.ts";

export const EARNINGS_PARSE_URL = "https://api.parse.bot/scraper/2f15267d-2491-4111-ba2c-ce7eb2e52e47/get_upcoming_earnings";
export type ForwardEarningsCoverage = "official_and_provider" | "official_only" | "provider_only" | "unavailable";
export type ForwardEarningsResult = { events: MarketEventV1[]; coverage: ForwardEarningsCoverage; warning: string | null };

export type OfficialEarning = {
  ticker: string; company: string; quarter: string; at: string; label: string; stage: string;
  source: string; decisive: string; transmission: string;
  releaseSession?: "BMO" | "AMC" | "DATE_ONLY";
  /** Date from which this editorial source review was first admitted: not the original issuer publication time. */
  admittedFromDay?: string;
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
  // Issuer-verified November 2–6 AI, power, mobility and healthcare week.
  // These are conference-call clocks; do not infer an exact publication minute.
  { ticker: "ETN", company: "Eaton", quarter: "Q3 2026", at: "2026-11-03T11:00:00-05:00", label: "11:00 ET earnings call; results before NYSE open", stage: "Issuer confirms pre-open results and call time", source: "https://origin-edge.eaton.com/us/en-us/company/investor-relations/financial-presentations-webcasts.html", decisive: "Electrical Americas orders and backlog, cash conversion, segment margins versus prior Q3 guidance and data-centre demand", transmission: "AI power infrastructure must create profitable orders and collected cash, not just a higher backlog." },
  { ticker: "SMCI", company: "Super Micro Computer", quarter: "FY2027 Q1", at: "2026-11-03T17:00:00-05:00", label: "17:00 ET earnings call; release minute not asserted", stage: "Issuer confirms call; prior 20 October numbers are unaudited preliminary estimates", source: "https://ir.supermicro.com/news/news-details/2026/Supermicro-Provides-First-Quarter-of-Fiscal-Year-2027-Preliminary-Business-Update/default.aspx", decisive: "Final revenue and gross margin versus preliminary estimates; inventory, receivables and operating cash conversion", transmission: "AI rack demand is only a durable earnings story if high shipment volume generates cash after working capital." },
  { ticker: "NVTS", company: "Navitas Semiconductor", quarter: "Q3 2026", at: "2026-11-03T17:00:00-05:00", label: "17:00 ET earnings webcast", stage: "Issuer confirms webcast; separate results minute not asserted", source: "https://ir.navitassemi.com/events/event-details/navitas-semiconductor-q3-2026-earnings", decisive: "GaN and SiC design wins turning into high-voltage AI-power sales, gross margin and funding runway", transmission: "AI electrical efficiency gains need to translate into shipments rather than merely prototypes." },
  { ticker: "UBER", company: "Uber", quarter: "Q3 2026", at: "2026-11-04T08:00:00-05:00", label: "08:00 ET earnings conference call", stage: "Issuer-confirmed results discussion; release minute unconfirmed", source: "https://investor.uber.com/news-events/news/press-release-details/2026/Uber-Announces-Date-of-Third-Quarter-2026-Results-Conference-Call/default.aspx", decisive: "Gross bookings, free cash flow, mobility margin and real economics of autonomous fleet/platform partnerships", transmission: "Robotaxis can strengthen or disintermediate Uber depending on who owns the customer and vehicles." },
  { ticker: "QCOM", company: "Qualcomm", quarter: "FY2026 Q4", at: "2026-11-04T16:45:00-05:00", label: "16:45 ET conference call; results after close", stage: "Issuer-confirmed after-close release and call", source: "https://investor.qualcomm.com/news-events/press-releases/news-details/2026/Qualcomm-Schedules-Fourth-Quarter-and-Fiscal-2026-Earnings-Release-and-Conference-Call/default.aspx", decisive: "Handsets, licensing margins, automotive wins, and edge AI revenue versus guidance", transmission: "AI must move beyond cloud spending into paying on-device consumers and automotive platforms." },
  { ticker: "MRNA", company: "Moderna", quarter: "Q3 2026", at: "2026-11-06T08:00:00-05:00", label: "08:00 ET results conference call", stage: "Issuer confirms webcast; release minute not asserted", source: "https://investors.modernatx.com/events-presentations", decisive: "Seasonal vaccine revenue, operating cash burn, cash runway and the timing of non-COVID pipeline economics", transmission: "A promising biopharma pipeline must be financed through clinical approvals and repeat sales." },
  { ticker: "AMZN", company: "Amazon", quarter: "Q3 2026", at: "2026-10-29T17:00:00-04:00", label: "17:00 ET results conference call", stage: "Call time confirmed; results-release minute not established", source: "https://www.aboutamazon.com/news/company-news/amazon-earnings-q3-2026-report", decisive: "AWS growth, AI infrastructure spending, operating margin and free cash flow", transmission: "The investor test is whether rising AI infrastructure commitments convert into durable AWS cash profits." },
  { ticker: "ARM", company: "Arm Holdings", quarter: "FY2027 Q2", at: "2026-11-04T17:00:00-05:00", label: "17:00 ET management webcast; release minute not stated", stage: "Issuer confirms 4 Nov Q2 FY27 results webcast; source does not separately establish a results-release session", source: "https://investors.arm.com/financials/quarterly-annual-results", decisive: "Datacentre and edge CPU royalties, licence revenue, AI power efficiency and management outlook", transmission: "Arm designs may benefit from AI server builds without a matching increase in the installed-base royalty run-rate.", releaseSession: "DATE_ONLY", admittedFromDay: "2026-11-04" },
  { ticker: "APP", company: "AppLovin", quarter: "Q3 2026", at: "2026-11-04T17:00:00-05:00", label: "17:00 ET earnings webinar; results after US close", stage: "Issuer confirms 4 Nov after-close release; webinar call follows", source: "https://investors.applovin.com/news/news-details/2026/AppLovin-to-Announce-Third-Quarter-2026-Results/default.aspx", decisive: "Ad software revenue, AXON monetisation, operating margin, cash generation and marketing demand", transmission: "Is the AI advertising return generating durable cash rather than valuation-only excitement?", releaseSession: "AMC", admittedFromDay: "2026-11-04" },
  { ticker: "FIG", company: "Figma", quarter: "Q3 2026", at: "2026-11-04T17:00:00-05:00", label: "17:00 ET conference call; results after US close", stage: "Issuer confirms 4 Nov after-close financial release; call time is separate", source: "https://investor.figma.com/news-events/news/news-details/2026/Figma-to-Announce-Third-Quarter-2026-Financial-Results-on-November-4-2026/default.aspx", decisive: "Subscription retention, enterprise expansion, paid AI features, margins and cash generation", transmission: "Can AI-powered software features drive incremental recurring revenue without compressing cash margins?", releaseSession: "AMC", admittedFromDay: "2026-11-04" },
  { ticker: "NVO", company: "Novo Nordisk", quarter: "9M 2026 / Q3", at: "2026-11-04T07:00:00-05:00", label: "07:00 ET call; results from 07:30 CET", stage: "Issuer confirms results 4 Nov 07:30 CET and earnings call at 13:00 CET; do not confuse the two", source: "https://www.novonordisk.com/investors/financial-calendar.html", decisive: "Obesity therapy demand, manufacturing capacity, price mix, new guidance and cash returns", transmission: "GLP-1 volume growth may be offset by rebates, competition and supply investments.", releaseSession: "BMO", admittedFromDay: "2026-11-04" },
  { ticker: "CVS", company: "CVS Health", quarter: "Q3 2026", at: "2026-11-04T08:00:00-05:00", label: "08:00 ET results conference call", stage: "Issuer-confirmed 4 Nov discussion; exact original results-release minute not stated", source: "https://investors.cvshealth.com/news/news-details/2026/CVS-Health-to-hold-third-quarter-2026-earnings-conference-call/", decisive: "Insurance medical cost ratio, pharmacy margins, Aetna membership and cash generation", transmission: "Healthcare utilisation and pharmacy benefits affect margins even when headline revenue grows.", releaseSession: "DATE_ONLY", admittedFromDay: "2026-11-04" },
  { ticker: "NET", company: "Cloudflare", quarter: "Q3 2026", at: "2026-11-05T17:00:00-05:00", label: "17:00 ET call; release after US close", stage: "Issuer confirms 5 Nov after-close financial release", source: "https://www.cloudflare.net/news/news-details/2026/Cloudflare-Announces-Date-of-Third-Quarter-2026-Financial-Results/default.aspx", decisive: "Developer and AI inference demand, large customer growth, gross margin and operating cash", transmission: "AI edge workloads need to monetise as sustained enterprise contracts.", releaseSession: "AMC", admittedFromDay: "2026-11-04" },
  { ticker: "ABNB", company: "Airbnb", quarter: "Q3 2026", at: "2026-11-05T17:00:00-05:00", label: "17:00 ET webcast; results after US close", stage: "Company announces 5 Nov after-close release; 17:00 ET is the webcast", source: "https://www.nasdaq.com/press-release/airbnb-announce-third-quarter-2026-results-2026-10-01", decisive: "Nights booked, take rate, international demand, marketing intensity and cash flow", transmission: "A stronger bookings tally is not automatically stronger cash conversion.", releaseSession: "AMC", admittedFromDay: "2026-11-04" },
  { ticker: "IONQ", company: "IonQ", quarter: "Q3 2026", at: "2026-11-05T16:30:00-05:00", label: "16:30 ET call; results after US close", stage: "Issuer announces 5 Nov after-close quarter results and 16:30 ET call", source: "https://investors.ionq.com/news/news-details/2026/IonQ-to-Report-Third-Quarter-2026-Financial-Results-on-November-5-2026/default.aspx", decisive: "Quantum computing revenue, organic growth versus SkyWater acquisition, losses and cash runway", transmission: "Separate manufacturing-acquisition revenue from repeatable quantum workloads and funding needs.", releaseSession: "AMC", admittedFromDay: "2026-11-04" },
  { ticker: "SOUN", company: "SoundHound AI", quarter: "Q3 2026", at: "2026-11-05T17:00:00-05:00", label: "17:00 ET call; results after US close", stage: "Issuer confirms 5 Nov after-close release and 17:00 ET call", source: "https://investors.soundhound.com/news-releases/news-release-details/soundhound-ai-announce-third-quarter-2026-financial-results", decisive: "Revenue quality, voice-agent deployments, gross margin, dilution and cash burn", transmission: "AI deployment growth must generate recurring paid revenue and finance expansion.", releaseSession: "AMC", admittedFromDay: "2026-11-04" },
  { ticker: "SMR", company: "NuScale Power", quarter: "Q3 2026", at: "2026-11-05T17:00:00-05:00", label: "17:00 ET results review call", stage: "Issuer confirms Nov 5 quarterly results call; release minute not stated", source: "https://www.nuscalepower.com/press-releases/2026/nuscale-power-to-hold-third-quarter-2026-earnings-conference-call", decisive: "Project milestones, binding contracts, licensing, funding runway and customer deposits", transmission: "Nuclear pipeline milestones matter more than non-binding energy demand narratives.", releaseSession: "DATE_ONLY", admittedFromDay: "2026-11-04" },
  { ticker: "COP", company: "ConocoPhillips", quarter: "Q3 2026", at: "2026-11-05T12:00:00-05:00", label: "12:00 ET call; results before US open", stage: "Issuer confirms 5 Nov pre-open results and noon analyst call", source: "https://www.conocophillips.com/news-media/story/conocophillips-to-hold-third-quarter-earnings-conference-call-on-thursday-nov-5/", decisive: "Production, realised commodity prices, operating cash, capex and shareholder returns", transmission: "Higher oil prices only help cash if realised pricing and upstream costs cooperate.", releaseSession: "BMO", admittedFromDay: "2026-11-04" },
  { ticker: "GPN", company: "Global Payments", quarter: "Q3 2026", at: "2026-11-05T08:00:00-05:00", label: "08:00 ET call; results before US open", stage: "Issuer confirms 5 Nov pre-open release and 08:00 ET call", source: "https://investors.globalpayments.com/news-events/press-releases/detail/517/global-payments-to-report-third-quarter-results-on-november", decisive: "Merchant volumes, net revenue, cash margins, debt and integration expenses", transmission: "Payment volumes and take rate need to hold up against consumer spending softness.", releaseSession: "BMO", admittedFromDay: "2026-11-04" },
  { ticker: "OKLO", company: "Oklo", quarter: "Q3 2026", at: "2026-11-06T08:30:00-05:00", label: "08:30 ET call; results before US open", stage: "Issuer confirms 6 Nov pre-open results and 08:30 ET business-update call", source: "https://oklo.com/newsroom/oklo-announces-date-for-third-quarter-2026-financial-results-and-business-update-call", decisive: "Permitting, contracted capacity, funding runway and commercial milestones", transmission: "AI power forecasts cannot replace signed construction/utility milestones.", releaseSession: "BMO", admittedFromDay: "2026-11-04" },
  { ticker: "VST", company: "Vistra", quarter: "Q3 2026", at: "2026-11-06T10:00:00-05:00", label: "10:00 ET financial results call", stage: "Issuer confirms 6 Nov results call; exact original release minute is unspecified", source: "https://investor.vistracorp.com/2026-09-29-Vistra-to-Report-Third-Quarter-Results-on-Nov-6%2C-2026", decisive: "Power prices, hedge book, nuclear/gas capacity, capex and cash returns", transmission: "Data-centre power demand is worth monitoring only alongside contracted supply and realised margins.", releaseSession: "DATE_ONLY", admittedFromDay: "2026-11-04" },
  { ticker: "ENB", company: "Enbridge", quarter: "Q3 2026", at: "2026-11-06T09:00:00-05:00", label: "09:00 ET call; results before US open", stage: "Issuer confirms 6 Nov pre-open results and 09:00 ET review call", source: "https://enbridge.mediaroom.com/2026-10-05-Enbridge-Inc-to-Host-Webcast-to-Discuss-2026-Third-Quarter-Results-on-November-6", decisive: "Pipeline throughput, regulated earnings, LNG capital projects, debt financing and dividend coverage", transmission: "Fee-based asset cash flow differs from short-lived crude price moves.", releaseSession: "BMO", admittedFromDay: "2026-11-04" },
  { ticker: "NVDA", company: "NVIDIA", quarter: "FY2027 Q3", at: "2026-11-17T17:00:00-05:00", label: "17:00 ET results call; release around 16:20 ET", stage: "Issuer confirms 17 Nov, not 18 Nov; results expected approximately 13:20 PT before 14:00 PT call", source: "https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Sets-Conference-Call-for-Third-Quarter-Financial-Results/default.aspx", decisive: "FY27 Q3 sales versus own $108bn guidance, 74% gross-margin guide, FCF, new chip shipments and China exposure", transmission: "A large AI GPU sales beat needs to convert to cash while accounting for competition and export restrictions.", releaseSession: "AMC", admittedFromDay: "2026-11-04" },
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
 const publishedOriginals=recentOriginalIssuerReleases(now,8);
 return OFFICIAL.flatMap(row=>{
   if(publishedOriginals.some(result=>result.ticker===row.ticker&&result.sourceDay===row.at.slice(0,10)))return [];
   const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(row.at);
   const due=dateOnly?Date.parse(row.at+"T23:59:59Z"):Date.parse(row.at)+2*3600000;
   if(!Number.isFinite(due)||at<due||at-due>lookbackHours*3600000)return [];
   return [{ticker:row.ticker,company:row.company,quarter:row.quarter,
     originalScheduleUrl:row.source,scheduledCallAt:row.at,
     sourceDateOnly:dateOnly}];
 });
}

/** An original-source schedule, including recent elapsed calls for newsroom reconciliation.
 * Dates are issuer-listed. Past appointments do not themselves confirm results;
 * the separate verified financial-release index decides that status.
 */
export function getIssuerEarningsSchedule(now=new Date(),lookbackDays=3,forwardDays=30):OfficialEarning[]{
 if(!Number.isFinite(+now)||lookbackDays<0||lookbackDays>30||forwardDays<1||forwardDays>90)return [];
 const etParts=new Intl.DateTimeFormat("en-GB",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
 const date=(type:string)=>etParts.find(x=>x.type===type)?.value||"";
 const etDay=date("year")+"-"+date("month")+"-"+date("day");
 const start=new Date(Date.parse(etDay+"T00:00:00Z")-lookbackDays*86400000).toISOString().slice(0,10);
 const end=new Date(Date.parse(etDay+"T00:00:00Z")+forwardDays*86400000).toISOString().slice(0,10);
 return OFFICIAL.filter(x=>x.at.slice(0,10)>=start&&x.at.slice(0,10)<=end&&(!x.admittedFromDay||etDay>=x.admittedFromDay))
   .sort((a,b)=>a.at.localeCompare(b.at)||a.ticker.localeCompare(b.ticker));
}

const WATCHED = new Set(["JPM", "C", "WFC", "BAC", "GS", "MS", "BLK", "TSM", "NVDA", "AMD", "MU", "AVGO", "AMZN", "GOOGL", "MSFT", "META", "ORCL", "CRWV", "AAPL", "INTC", "SNDK", "PLTR", "PFE", "ETN", "SMCI", "NVTS", "UBER", "QCOM", "MRNA", "NFLX", "TSLA", "UNH", "JNJ", "XOM", "CVX", "DAL", "ARM", "APP", "FIG", "NVO", "CVS", "NET", "ABNB", "IONQ", "SOUN", "SMR", "COP", "GPN", "OKLO", "VST", "ENB", "NVDA"]);
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));
const eventDay = (event: MarketEventV1) => event.startAt?.slice(0, 10) ?? "";

export function officialEarningsEvents(now = new Date()): MarketEventV1[] {
  const today = now.toISOString().slice(0, 10);
  return OFFICIAL.filter(row => row.at.slice(0, 10) >= today && (!row.admittedFromDay || today >= row.admittedFromDay)).flatMap(row => {
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
  // An original issuer result supersedes its still-pending calendar
  // appointment, even if the scheduled conference call has not begun.
  // This is a source-exact, bounded exclusion, never an inferred beat/miss.
  const releasedOriginals=recentOriginalIssuerReleases(now,8);
  const official = officialEarningsEvents(now).filter(row=>!releasedOriginals.some(release=>
    release.ticker===row.affectedAssets[0] && release.sourceDay===row.startAt?.slice(0,10)));
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
