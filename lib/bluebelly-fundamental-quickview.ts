import type { EditorialRegimeId } from "./bluebelly-editorial-architecture.ts";

/**
 * A dated, human-reviewable editorial assessment. NOT an automatic signal,
 * canonical System 2 Regime verdict, live price reading, or trading instruction.
 * New public source observations must be shown alongside this snapshot, not used
 * to silently rewrite its bias. Data refresh and judgement refresh differ.
 */
export type FundamentalBias = "BULLISH" | "BEARISH" | "MIXED";
export type FundamentalConfidence = "HIGH" | "MEDIUM" | "LOW";
export type QuickViewSource = Readonly<{
  name: string;
  url: string;
  publicationDate: string;
  role: "PRIMARY" | "COMMENTARY";
}>;
export type FundamentalQuickView = Readonly<{
  id: string;
  asset: string;
  lens: EditorialRegimeId;
  bias: FundamentalBias;
  confidence: FundamentalConfidence;
  headline: string;
  reason: string;
  countercase: string;
  decidingTest: string;
  sourceObservationDate: string;
  sources: readonly QuickViewSource[];
}>;

export const FUNDAMENTAL_VIEW_REVIEWED_ON = "2026-10-30" as const;
export const FUNDAMENTAL_VIEW_VERSION = "editorial-fundamentals/2026-10-30/2" as const;

export const FUNDAMENTAL_QUICK_VIEW: readonly FundamentalQuickView[] = [
  {
    id: "brent",
    asset: "Brent / crude oil",
    lens: "energy",
    bias: "BULLISH",
    confidence: "MEDIUM",
    headline: "Short supply buffers, but high prices also weaken demand",
    reason: "The October IEA report documents depleted oil buffers and disrupted Gulf trade. HFI's non-OPEC plateau argument is a hypothesis for tighter replacement supply, not an independently proven production peak.",
    countercase: "The IEA expects substantial supply recovery and forecasts weaker oil consumption as energy costs destroy demand. A geopolitical premium can fade before the inventory deficit disappears.",
    decidingTest: "Compare IEA/EIA production and demand revisions, actual crude stocks, Gulf cargo flows, prompt spreads and multiple physical crude grades—not a single attack or futures quote.",
    sourceObservationDate: "2026-10-30 (maritime security); 2026-10-14 (IEA physical balance)",
    sources: [
      { name: "UKMTO latest shipping incident notices", url: "https://www.ukmto.org/recent-incidents", publicationDate: "2026-10-30", role: "PRIMARY" },
      { name: "IEA October Oil Market Report", url: "https://www.iea.org/reports/oil-market-report-october-2026", publicationDate: "2026-10-14", role: "PRIMARY" },
      { name: "HFI non-OPEC supply argument", url: "https://www.hfir.com/p/wctw-non-opec-supply-growth-isnt", publicationDate: "2026-10-29", role: "COMMENTARY" },
      { name: "EIA weekly petroleum supply", url: "https://www.eia.gov/petroleum/supply/weekly/", publicationDate: "2026-10-21", role: "PRIMARY" },
    ],
  },
  {
    id: "diesel",
    asset: "Diesel / distillates",
    lens: "energy",
    bias: "BULLISH",
    confidence: "HIGH",
    headline: "The strongest physical scarcity case is downstream",
    reason: "IEA October research finds sustained gasoil/diesel export constraints, depleted inventories, and a replenishment challenge stretching into 2027. Crude recovery does not automatically restore refined-fuel supply.",
    countercase: "A rebound in refinery runs, lower freight costs and demand destruction can bring diesel crack spreads down even if tanks remain historically low.",
    decidingTest: "Follow EIA distillate inventories, IEA product export volumes, refinery runs and comparable ULSD/diesel crack spreads across several weeks.",
    sourceObservationDate: "2026-10-14",
    sources: [
      { name: "IEA diesel market assessment", url: "https://www.iea.org/reports/oil-market-report-october-2026", publicationDate: "2026-10-14", role: "PRIMARY" },
      { name: "EIA weekly stocks", url: "https://www.eia.gov/petroleum/supply/weekly/", publicationDate: "2026-10-21", role: "PRIMARY" },
    ],
  },
  {
    id: "energy-producers",
    asset: "Selected oil producers",
    lens: "energy",
    bias: "BULLISH",
    confidence: "MEDIUM",
    headline: "Higher realised prices are producing cash, not just headlines",
    reason: "Shell and TotalEnergies reported strong 2026 third-quarter earnings and cash measures. That supports selected companies' operating economics, not a blanket buy rating for every energy share.",
    countercase: "Windfall margins may be cyclical; disrupted operations, tax, valuation and future capex can absorb today's income.",
    decidingTest: "Compare realised prices, operating cash, organic capex, net debt, payouts and next-quarter product margins for each company.",
    sourceObservationDate: "2026-10-29",
    sources: [
      { name: "Shell Q3 2026 release", url: "https://shell.gcs-web.com/news-releases/news-release-details/shell-plc-3rd-quarter-2026-and-nine-months-unaudited-results", publicationDate: "2026-10-29", role: "PRIMARY" },
      { name: "TotalEnergies Q3 2026 accounts", url: "https://totalenergies.com/system/files/documents/totalenergies_accounts-results-3q26_2026_en.pdf", publicationDate: "2026-10-29", role: "PRIMARY" },
    ],
  },
  {
    id: "ai-buyers",
    asset: "AI infrastructure buyers",
    lens: "ai",
    bias: "MIXED",
    confidence: "MEDIUM",
    headline: "Customer demand is real; cash payback is uneven",
    reason: "Amazon's Q3 AWS revenue rose about 39% year-on-year while its trailing free cash flow was negative $42.4bn. Alphabet also had negative quarterly free cash flow, but Microsoft remained cash-positive. The winners cannot be inferred from revenue alone.",
    countercase: "Large capex is not proof of waste. Stronger paid usage, margins and future cash conversion could justify front-loaded investment.",
    decidingTest: "Reconcile quarterly and trailing operating cash minus cash capex, lease principal, actual paid utilisation, borrowing terms and next guidance by company.",
    sourceObservationDate: "2026-10-29",
    sources: [
      { name: "Amazon Q3 2026 issuer release", url: "https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Third-Quarter-Results/default.aspx", publicationDate: "2026-10-29", role: "PRIMARY" },
      { name: "Alphabet Q3 SEC exhibit", url: "https://www.sec.gov/Archives/edgar/data/1652044/000165204426000080/googexhibit991q32026.htm", publicationDate: "2026-10-28", role: "PRIMARY" },
      { name: "Microsoft FY27 Q1 release", url: "https://www.microsoft.com/en-us/Investor/earnings/FY-2027-Q1/press-release-webcast", publicationDate: "2026-10-28", role: "PRIMARY" },
    ],
  },
  {
    id: "ai-suppliers",
    asset: "AI memory / chip suppliers",
    lens: "ai",
    bias: "BULLISH",
    confidence: "MEDIUM",
    headline: "Selling the infrastructure is easier than financing it",
    reason: "Sandisk reported data-centre revenue up 61% quarter-on-quarter and positive issuer free cash flow. Samsung and SK hynix supplier results also support real physical AI investment. Supplier strength does not prove every customer earns an attractive return.",
    countercase: "Memory margins can reverse when capacity arrives, while general PC demand remains weak. Intel's forward outlook illustrates a non-uniform semiconductor cycle.",
    decidingTest: "Watch order fulfilment, HBM/storage prices, customer spending revisions, supplier cash flow and 2027 capacity additions.",
    sourceObservationDate: "2026-10-29",
    sources: [
      { name: "Sandisk FY27 Q1 earnings", url: "https://investor.sandisk.com/news-releases/news-release-details/sandisk-reports-fiscal-first-quarter-2027-financial-results", publicationDate: "2026-10-29", role: "PRIMARY" },
      { name: "Intel Q3 2026 earnings", url: "https://www.intc.com/news-events/press-releases/detail/1786/intel-reports-third-quarter-2026-financial-results", publicationDate: "2026-10-29", role: "PRIMARY" },
    ],
  },
  {
    id: "nasdaq",
    asset: "Nasdaq / growth equities",
    lens: "breadth",
    bias: "MIXED",
    confidence: "LOW",
    headline: "Real technology demand, but crowded expectations and leverage raise risk",
    reason: "Some AI issuers' cash requirements are growing faster than operating cash, while paid cloud and hardware demand remain robust. Why X's 30 October transcript argues that leverage and expensive valuations can amplify forced selling; that is an attributed fragility hypothesis, not proof of an index-wide earnings collapse or a dated crash forecast.",
    countercase: "Improving cloud utilisation, stable credit and broader earnings can sustain an advance despite expensive rates. Equities can also sell off without a fundamental collapse.",
    decidingTest: "Use source-dated Nasdaq/QQQ and equal-weight breadth alongside issuer cash conversion, credible credit spreads, FINRA margin statistics scaled to market size, and refinancing access on matching dates.",
    sourceObservationDate: "2026-10-29",
    sources: [
      { name: "Alphabet issuer results", url: "https://www.sec.gov/Archives/edgar/data/1652044/000165204426000080/googexhibit991q32026.htm", publicationDate: "2026-10-28", role: "PRIMARY" },
      { name: "Amazon Q3 results", url: "https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Third-Quarter-Results/default.aspx", publicationDate: "2026-10-29", role: "PRIMARY" },
      { name: "Why X — why stock markets crash", url: "https://www.youtube.com/watch?v=YgqpOe2H17o", publicationDate: "2026-10-30", role: "COMMENTARY" },
    ],
  },
  {
    id: "us10y",
    asset: "US 10-year yield (not bond price)",
    lens: "bonds",
    bias: "MIXED",
    confidence: "MEDIUM",
    headline: "The absolute borrowing cost is high, but yields just eased",
    reason: "Treasury's 29 October indicative 10Y yield was 4.98%, down 7bp from 28 October, despite still-elevated inflation and solid quarterly growth. The one-day decline does not isolate recession, supply or Fed repricing.",
    countercase: "Continuing inflation, term premium and debt supply may lift long yields again, whereas weaker growth or flight to safety could pull them lower.",
    decidingTest: "Follow comparable 2Y–30Y nominal and real yields, Treasury auctions, dated OIS and IG/HY spreads. Never treat a falling yield as a rising bond yield.",
    sourceObservationDate: "2026-10-29",
    sources: [
      { name: "US Treasury daily yield curve", url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value_month=202610", publicationDate: "2026-10-29", role: "PRIMARY" },
      { name: "BEA September PCE", url: "https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026", publicationDate: "2026-10-29", role: "PRIMARY" },
    ],
  },
  {
    id: "usd",
    asset: "US dollar / DXY",
    lens: "fed",
    bias: "MIXED",
    confidence: "LOW",
    headline: "Rate support exists; matched dollar confirmation is missing",
    reason: "Sticky September PCE and restrictive US yields can support the dollar, but the dated cross-currency and futures reaction needed for a directional judgement has not been independently reconciled.",
    countercase: "A flight to safety can strengthen USD despite falling yields, while improving foreign growth or easier US policy can weaken it.",
    decidingTest: "Refresh DXY with the same-session US 2Y and foreign yield differentials, Fed OIS, and the 4H/1D technical overlay separately.",
    sourceObservationDate: "no independently matched DXY observation",
    sources: [
      { name: "BEA September PCE", url: "https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026", publicationDate: "2026-10-29", role: "PRIMARY" },
      { name: "US Treasury daily yields", url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value_month=202610", publicationDate: "2026-10-29", role: "PRIMARY" },
    ],
  },
  {
    id: "gold",
    asset: "Gold",
    lens: "gold",
    bias: "MIXED",
    confidence: "LOW",
    headline: "The structural argument and the current tape are different",
    reason: "Geopolitical and reserve-allocation arguments may favour gold, while still-high real yields can work against it. Without a fresh matched gold/real-yield/dollar observation there is no defensible live direction label.",
    countercase: "A growth shock can boost safe-haven demand, or forced liquidity selling can drive gold lower even when geopolitical risk rises.",
    decidingTest: "Match spot XAUUSD, dated 10Y TIPS, DXY and official reserve-demand data; do not recycle a prior technical level as current.",
    sourceObservationDate: "no independently matched gold/real-yield observation",
    sources: [
      { name: "US Treasury real yield curve", url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_real_yield_curve&field_tdr_date_value_month=202610", publicationDate: "latest matched reading unavailable", role: "PRIMARY" },
    ],
  },
  {
    id: "yen",
    asset: "JPY / yen funding",
    lens: "yen",
    bias: "MIXED",
    confidence: "LOW",
    headline: "Policy differentials are a watch, not proof of a carry unwind",
    reason: "Japan's late-October policy meeting can change yen funding costs. The market's same-window FX, JGB and international-flow evidence has not been reconciled into a confirmed direction.",
    countercase: "JPY can strengthen on risk aversion without an actual liquidation of leveraged carry positions, or weaken despite domestic tightening if global spreads dominate.",
    decidingTest: "Read the actual BoJ decision and Outlook, then match USDJPY, JGB 2Y/10Y, currency basis and Japanese foreign bond flows.",
    sourceObservationDate: "BoJ decision and matched JPY tape pending verification",
    sources: [
      { name: "Bank of Japan meeting schedule", url: "https://www.boj.or.jp/en/mopo/mpmsche_minu/", publicationDate: "calendar, not a market observation", role: "PRIMARY" },
    ],
  },
] as const;

export function quickViewsForLens(lens: EditorialRegimeId): readonly FundamentalQuickView[] {
  return FUNDAMENTAL_QUICK_VIEW.filter((asset) => asset.lens === lens);
}

export function fundamentalSnapshotAgeDays(now: Date): number | null {
  const timestamp = Date.parse(FUNDAMENTAL_VIEW_REVIEWED_ON + "T00:00:00+08:00");
  if (!Number.isFinite(+now) || !Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((+now - timestamp) / 86400000));
}
