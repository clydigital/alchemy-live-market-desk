import type { EditorialRegimeId } from "./bluebelly-editorial-architecture.ts";

/**
 * Source-dated human/ChatGPT research challenge to the 30 Oct editorial meters.
 * This is NOT a new canonical Story or a revised accepted Regime version.
 */
export type RegimeManualChallenge = Readonly<{
  lens: EditorialRegimeId;
  asOf: string;
  headline: string;
  whatChanged: string;
  objection: string;
  nextTest: string;
  status: "RESEARCH_ONLY";
  sourceLinks: readonly {name:string;url:string}[];
}>;

const CHALLENGES: Partial<Record<EditorialRegimeId,RegimeManualChallenge>> = {
  breadth: {
    lens:"breadth",asOf:"2026-11-11",status:"RESEARCH_ONLY",
    headline:"The broader market may be recovering ahead of AI leaders",
    whatChanged:"A dated, matched 20-session price-return comparison through 10 November shows RSP equal-weight ETF outperforming the S&P 500 cash index by about 7.2 percentage points. This challenges the older assumption that breadth is still deteriorating, but RSP is an ETF and this comparison is not a constituent-level advance/decline count.",
    objection:"The 11 November AI-sector recovery was reported during the session, not at a completed close. Broader rotation can coincide with temporary covering in semiconductors. It does not establish that the full-market advance is durable.",
    nextTest:"Reconstruct the completed 11 November session, equal-weight versus cap-weight returns, 50D/200D participation, financials and semiconductors; verify independent earnings revisions and HY credit follow-through.",
    sourceLinks:[
      {name:"Nasdaq · RSP historical prices",url:"https://www.nasdaq.com/market-activity/etf/rsp/historical"},
      {name:"FRED · S&P 500 cash index",url:"https://fred.stlouisfed.org/series/SP500"},
      {name:"Schwab · 11 November breadth commentary (attributed)",url:"https://www.schwab.com/learn/story/stock-market-update-open"},
    ],
  },
  ai: {
    lens:"ai",asOf:"2026-11-11",status:"RESEARCH_ONLY",
    headline:"AI demand looks real. Debt-financed cash returns are still the question",
    whatChanged:"CoreWeave's 10 November quarterly issuer report describes roughly $3.66bn revenue and raises FY2026 revenue guidance while guiding to $37–39bn annual capital spending and $1.05–1.15bn Q4 interest expense. Approximately $9bn of expected customer deposits/prepayments are prospective, not already received. TSMC's October revenue rose 59.7% year on year, but that is consolidated sales, not AI-only earnings.",
    objection:"Supplier demand, customer contracts, cash PP&E, net debt costs and revenue-to-cash conversion must be evaluated separately. Strong semiconductor sales do not prove every AI infrastructure investment has positive ROIC; heavy capex alone does not prove demand collapse.",
    nextTest:"Verify realised CoreWeave cash receipts, net financing and lease commitments, unit economics and forward EBITDA/interest coverage. Compare issuer filings at aligned quarters; test Nvidia's 17 November results and revised guidance.",
    sourceLinks:[
      {name:"CoreWeave · original Q3 earnings release",url:"https://investors.coreweave.com/news/news-details/2026/CoreWeave-Reports-Strong-Third-Quarter-2026-Results/default.aspx"},
      {name:"TSMC · original October revenue SEC filing",url:"https://www.sec.gov/Archives/edgar/data/1046179/000104617926000796/tsm-revenue20261110.htm"},
      {name:"Nvidia · scheduled 17 November results",url:"https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Sets-Conference-Call-for-Third-Quarter-Financial-Results/"},
    ],
  },
  bonds: {
    lens:"bonds",asOf:"2026-11-11",status:"RESEARCH_ONLY",
    headline:"Rising Treasury yields are confirmed. A credit squeeze is not",
    whatChanged:"The 10 November US Treasury curve closed at 4.73% for two years and 4.98% for ten years after stronger-than-expected October CPI; the two-year move was about +17bp from the previous close. Risk assets sold off initially, but technology shares recovered on 11 November without a new US cash-bond trading session.",
    objection:"Nominal yield repricing can reflect the expected Fed path, real discount rates, inflation compensation or issuance. Neither high yields nor recovering equities alone establishes that borrowers face binding credit stress. The latest comparable HY/CCC observations reviewed were from 9 November.",
    nextTest:"Use 12 November reopened cash Treasury and issuer-credit observations, real yields versus breakevens, IG/HY/CCC OAS, primary issuance and refinancing terms. Match cash closes rather than pairing Tuesday yields with Wednesday stocks.",
    sourceLinks:[
      {name:"U.S. Treasury · daily yield curve",url:"https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value=2026"},
      {name:"FRED · high-yield OAS",url:"https://fred.stlouisfed.org/series/BAMLH0A0HYM2"},
      {name:"SIFMA · Veterans Day fixed-income closure",url:"https://www.sifma.org/news/press-releases/sifma-fixed-income-market-close-recommendation-in-the-u-s-the-u-k-and-japan-for-the-u-s-veterans-day-holiday-2026"},
    ],
  },
  fed: {
    lens:"fed",asOf:"2026-11-11",status:"RESEARCH_ONLY",
    headline:"October CPI challenges the easing case; the exact Fed repricing still needs proof",
    whatChanged:"October CPI published 10 November was +0.4% month-on-month headline and +0.3% core, versus 0.3% and 0.2% consensus respectively. The short end of the US curve rose sharply in the following trading session. This supports a hawkish policy-path risk, but not a specific unverified December hike probability.",
    objection:"A single monthly CPI shock does not establish the entire inflation trend or future FOMC vote. Front-end repricing also needs evidence from matched Fed-funds/OIS quotes, and contemporaneous Treasury cash yields are unavailable on 11 November's holiday.",
    nextTest:"Compare official BLS components and methodology, exact post-release December Fed-funds futures/OIS settlement and 12 November short-end yields. Keep core services, energy and revisions distinct, and use the next PPI/PCE/jobs publications to test persistence.",
    sourceLinks:[
      {name:"BLS · October CPI original release",url:"https://www.bls.gov/news.release/archives/cpi_11102026.htm"},
      {name:"U.S. Treasury · dated curve",url:"https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value=2026"},
      {name:"Reuters · 10 November inflation-market reaction",url:"https://www.reuters.com/business/view-hot-october-inflation-report-rattles-markets-2026-11-10/"},
    ],
  },
};

export function getRegimeManualChallenge(lens:EditorialRegimeId):RegimeManualChallenge|null {
  return CHALLENGES[lens] ?? null;
}
