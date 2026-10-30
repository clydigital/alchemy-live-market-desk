import d02 from "./bluebelly-learn/slides/D02.json";
import d06 from "./bluebelly-learn/slides/D06.json";
import d08 from "./bluebelly-learn/slides/D08.json";
import d13 from "./bluebelly-learn/slides/D13.json";
import d15 from "./bluebelly-learn/slides/D15.json";
import d17 from "./bluebelly-learn/slides/D17.json";
import d23 from "./bluebelly-learn/slides/D23.json";
import d24 from "./bluebelly-learn/slides/D24.json";
import d26 from "./bluebelly-learn/slides/D26.json";

export type LearnSlide = {
  number: number;
  section: string;
  title: string;
  lines: string[];
};

export type LearnDeck = {
  id: string;
  title: string;
  summary: string;
  track: "Macro foundations" | "Cross-asset mechanics" | "Trading & risk";
  level: "Beginner" | "Intermediate" | "Advanced";
  course: string;
  concepts: string[];
  sources: { label: string; url: string }[];
  slideCount: number;
  version: "1.0";
  publishedAs: "original-powerpoint";
};

// Editor-reviewed original teaching material; NOT live feeds, data-driven
// market claims, trade recommendations, or public publication of private Notion.
const specs: Omit<LearnDeck, "slideCount" | "version" | "publishedAs">[] = [
  {
    id: "D13", title: "You Bought a Bond. Who Pays You, and When?",
    summary: "Coupons, principal, yield to maturity and why government or company debt can lose market value.",
    track: "Macro foundations", level: "Beginner", course: "Bonds & credit",
    concepts: ["coupon", "yield to maturity", "credit spread", "duration"],
    sources: [
      { label: "TreasuryDirect: security pricing", url: "https://www.treasurydirect.gov/marketable-securities/understanding-pricing/" },
      { label: "FINRA: Bond investing", url: "https://www.finra.org/investors/investing/investment-products/bonds" },
    ],
  },
  {
    id: "D15", title: "Reading the Economy: CPI, GDP and Jobs",
    summary: "What a data release measures, why revisions matter and how a headline becomes a market surprise.",
    track: "Macro foundations", level: "Beginner", course: "Economic statistics",
    concepts: ["cpi", "pce", "gross domestic product", "inflation"],
    sources: [
      { label: "BLS: Consumer Price Index", url: "https://www.bls.gov/cpi/questions-and-answers.htm" },
      { label: "BEA: Understanding GDP", url: "https://www.bea.gov/resources/learning-center/what-to-know-gdp" },
      { label: "BLS: Employment Situation", url: "https://www.bls.gov/news.release/empsit.faq.htm" },
    ],
  },
  {
    id: "D02", title: "Why Treasury Yields Don't Simply Follow the Fed",
    summary: "Bond prices, duration, yield curves and the forces that can overpower a policy-rate cut.",
    track: "Macro foundations", level: "Intermediate", course: "Bonds & credit",
    concepts: ["duration", "term premium", "real yield", "credit spread"],
    sources: [
      { label: "US Treasury: Daily interest rates", url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates" },
      { label: "New York Fed: Term premium estimates", url: "https://www.newyorkfed.org/research/data_indicators/term-premia-tabs" },
    ],
  },
  {
    id: "D06", title: "Crude Is Falling. Why Is Diesel Still Expensive?",
    summary: "Refinery economics, product inventories, crack spreads and the oil-to-inflation chain.",
    track: "Cross-asset mechanics", level: "Intermediate", course: "Oil & physical supply",
    concepts: ["crack spread", "distillates", "term premium"],
    sources: [
      { label: "EIA: How refining works", url: "https://www.eia.gov/energyexplained/oil-and-petroleum-products/refining-crude-oil-the-refining-process.php" },
      { label: "EIA: Refining/crack prices", url: "https://www.eia.gov/finance/markets/products/prices.php" },
    ],
  },
  {
    id: "D17", title: "USDJPY, JXY, DXY and Oil: Who Is Leading?",
    summary: "How to read currency quotes and index baskets before attributing market moves to yields or oil.",
    track: "Cross-asset mechanics", level: "Intermediate", course: "FX & cross-asset",
    concepts: ["real yield", "term premium", "crack spread"],
    sources: [
      { label: "ICE: US Dollar Index", url: "https://www.ice.com/forex/usdx" },
      { label: "TradingView: TVC methodology", url: "https://www.tradingview.com/support/solutions/43000709178-what-does-tvc-stand-for-in-the-instrument-ticker/" },
      { label: "BIS: Carry trade transmission", url: "https://www.bis.org/publications/bulletin-124-monetary-policy-transmission-exchange-rates-role-currency-carry-trades" },
    ],
  },
  {
    id: "D08", title: "Who Is Actually Making Money From AI?",
    summary: "Where AI revenue goes, who funds capex and whether growth converts into sustainable investor cash.",
    track: "Cross-asset mechanics", level: "Advanced", course: "AI & business economics",
    concepts: ["ai-roic", "discount rate", "duration-equity"],
    sources: [
      { label: "SEC: Financial statements", url: "https://www.sec.gov/files/investor/pubs/begfinstmtguide.htm" },
      { label: "Investor.gov: Reading a 10-K", url: "https://www.investor.gov/introduction-investing/getting-started/researching-investments/how-read-10-k" },
      { label: "NYU Stern: Damodaran online classes", url: "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/onlineclass.htm" },
    ],
  },
  {
    id: "D23", title: "Position Sizing: How Much Can I Actually Lose?",
    summary: "Risk budgets, tick values, ATR stops, correlated positions, slippage and portfolio heat.",
    track: "Trading & risk", level: "Beginner", course: "Risk management",
    concepts: ["invalidation", "market breadth"],
    sources: [
      { label: "CME: Proper position size", url: "https://www.cmegroup.com/education/courses/trade-and-risk-management/proper-position-size" },
    ],
  },
  {
    id: "D24", title: "The Prop Challenge Is a Drawdown Game",
    summary: "The difference between advertised account size, actual loss headroom and programme-specific rules.",
    track: "Trading & risk", level: "Intermediate", course: "Prop trading",
    concepts: ["invalidation", "credit spread"],
    sources: [
      { label: "FTMO: Trading objectives", url: "https://ftmo.com/en/trading-objectives/" },
      { label: "The5ers: High Stakes programme", url: "https://the5ers.com/faqs/what-are-the-general-rules-for-the-high-stakes-program/" },
    ],
  },
  {
    id: "D26", title: "Bollinger Bands Versus Your 1SD EMA Breakout",
    summary: "Classic Bollinger Bands versus custom EMA volatility envelopes, break-and-hold and honest tests.",
    track: "Trading & risk", level: "Advanced", course: "Technical strategy",
    concepts: ["invalidation", "market breadth"],
    sources: [
      { label: "John Bollinger: Band rules", url: "https://www.bollingerbands.com/bollinger-band-rules" },
      { label: "Fidelity: Bollinger overview", url: "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/bollinger-bands" },
    ],
  },
];

const packs: Record<string, { id: string; version: string; date: string; slides: LearnSlide[] }> = {
  D02: d02, D06: d06, D08: d08, D13: d13, D15: d15,
  D17: d17, D23: d23, D24: d24, D26: d26,
};
export const BLUEBELLY_PUBLIC_LEARN_IDS = ["d02", "d06", "d08", "d13", "d15", "d17", "d23", "d24", "d26"] as const;

export const BLUEBELLY_LEARN_DECKS: LearnDeck[] = specs.map((spec) => ({
  ...spec,
  version: "1.0",
  publishedAs: "original-powerpoint",
  slideCount: packs[spec.id].slides.length,
}));

export function getBluebellyLearnDeck(id: string): { meta: LearnDeck; slides: LearnSlide[] } | null {
  const normalized = id.trim().toUpperCase();
  const meta = BLUEBELLY_LEARN_DECKS.find((deck) => deck.id === normalized);
  const pack = packs[normalized];
  return meta && pack ? { meta, slides: pack.slides } : null;
}
