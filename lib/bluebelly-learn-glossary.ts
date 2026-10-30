import type { CanonicalConcept } from "./concepts.ts";

// Editorially curated public educational definitions, separate from the 28
// research-governed Regime concepts. No publication or Dossier authority.
export type LearnTopic = "foundations" | "rates" | "companies" | "energy" | "fx" | "trading";
export type LearnConcept = Pick<CanonicalConcept,"key"|"label"|"definition"|"whyItMatters"|"watch"|"aliases"|"regimes"> & {
  topic: LearnTopic | "regime";
  example?: string;
};

type LessonRow = readonly [string,string,LearnTopic,string,string,string,string[]];
const LESSONS: LessonRow[] = [
  [
    "bond",
    "Bond",
    "foundations",
    "A loan made by investors to a government or company in exchange for promised payments.",
    "A bond has a market price that can rise or fall even when its coupon is fixed.",
    "A £1,000 bond might pay £40 per year while its resale price moves.",
    [
      "issuer",
      "coupon",
      "maturity"
    ]
  ],
  [
    "coupon",
    "Coupon",
    "foundations",
    "The interest payment a bond promises, usually stated as a percentage of face value.",
    "A fixed coupon does not change when the bond's market price changes.",
    "A 4% coupon on £1,000 face value pays £40 a year.",
    [
      "coupon rate",
      "payment schedule",
      "face value"
    ]
  ],
  [
    "yield-to-maturity",
    "Yield to maturity",
    "foundations",
    "The annualised return implied by a bond's price and promised payments if held to maturity under its assumptions.",
    "It combines coupons, price paid and repayment at maturity; it is not a guaranteed realised return.",
    "Buying a fixed-coupon bond below face value generally raises its yield to maturity.",
    [
      "price",
      "maturity",
      "credit risk"
    ]
  ],
  [
    "basis-point",
    "Basis point (bp)",
    "foundations",
    "One-hundredth of a percentage point, used to describe changes in interest rates and yields.",
    "It stops readers confusing a percentage change with a percentage-point change.",
    "A move from 4.00% to 4.25% is 25 basis points.",
    [
      "yield change",
      "policy-rate moves"
    ]
  ],
  [
    "consumer-price-index",
    "Consumer Price Index (CPI)",
    "foundations",
    "An index tracking the prices households pay for a representative basket of goods and services.",
    "Markets compare inflation with expectations because this can change the likely policy path.",
    "A 0.3% monthly rise is not the same measurement as 3.0% annual inflation.",
    [
      "headline CPI",
      "core CPI",
      "revisions"
    ]
  ],
  [
    "core-inflation",
    "Core inflation",
    "foundations",
    "An inflation measure excluding some volatile categories, commonly food and energy.",
    "It can help reveal persistent price pressure even when fuel costs swing sharply.",
    "Falling petrol prices can pull headline CPI lower while core services remain firm.",
    [
      "core CPI",
      "services inflation",
      "wages"
    ]
  ],
  [
    "pce-inflation",
    "PCE inflation",
    "foundations",
    "Inflation measured using the US Personal Consumption Expenditures price index.",
    "The Federal Reserve follows this index closely, while CPI can tell a different near-term story.",
    "CPI and PCE use different baskets, weights and methods.",
    [
      "headline PCE",
      "core PCE",
      "Fed guidance"
    ]
  ],
  [
    "economic-consensus",
    "Consensus forecast",
    "foundations",
    "A published summary of economists' or analysts' expectations before a data release.",
    "A strong result can still disappoint if the market expected an even stronger number.",
    "If forecasts call for 2.4% and the release is 2.6%, it beats that consensus.",
    [
      "forecast source",
      "forecast timestamp",
      "actual"
    ]
  ],
  [
    "priced-in",
    "Priced in",
    "foundations",
    "A condition where a widely expected event is already reflected substantially in current asset prices.",
    "Prices often react to the surprise versus expectations, not simply the headline outcome.",
    "A forecast rate hike may trigger little movement if it was overwhelmingly expected.",
    [
      "rate futures",
      "pre-event price",
      "actual reaction"
    ]
  ],
  [
    "gross-domestic-product",
    "Gross domestic product (GDP)",
    "foundations",
    "The value of goods and services produced within an economy over a period.",
    "Growth can alter earnings expectations, bond yields and future central-bank policy.",
    "A GDP revision can change the interpretation of an earlier quarter.",
    [
      "real GDP",
      "nominal GDP",
      "revisions"
    ]
  ],
  [
    "duration",
    "Bond duration",
    "rates",
    "A measure of a bond's sensitivity to changes in yields, expressed approximately in years.",
    "Longer-duration bonds generally experience larger price changes when yields move.",
    "A duration of 8 suggests roughly an 8% price move for a one-point yield shift, before convexity.",
    [
      "modified duration",
      "yield move",
      "maturity"
    ]
  ],
  [
    "yield-curve",
    "Yield curve",
    "rates",
    "A comparison of borrowing yields across different maturities, such as 2-year and 10-year Treasuries.",
    "Its shape can reveal expectations for policy, growth, inflation and term premium.",
    "If the 10-year yield moves above the 2-year, the 2s10s spread is positive.",
    [
      "2Y–10Y",
      "2Y–30Y",
      "curve slope"
    ]
  ],
  [
    "inverted-yield-curve",
    "Inverted yield curve",
    "rates",
    "A yield curve where shorter-dated borrowing yields exceed longer-dated yields.",
    "It can reflect expected future policy easing, though the interpretation depends on the cycle.",
    "A 2-year yield of 4.5% and a 10-year yield of 4.0% produces a −50 bp 2s10s spread.",
    [
      "2Y–10Y spread",
      "forward rates",
      "growth data"
    ]
  ],
  [
    "credit-spread",
    "Credit spread",
    "rates",
    "The extra yield a borrower pays above a comparable lower-risk benchmark.",
    "Wider spreads indicate investors want more compensation for credit risk or illiquidity.",
    "If a bond yields 6% and a matched Treasury yields 4%, the spread is 200 bp.",
    [
      "investment grade",
      "high yield",
      "default risk"
    ]
  ],
  [
    "quantitative-tightening",
    "Quantitative tightening (QT)",
    "rates",
    "A central bank reducing its asset holdings, often by allowing bonds to mature without full reinvestment.",
    "It can affect reserves, market liquidity and the supply of bonds private investors must hold.",
    "QT is not the same as a policy-rate increase; both can operate at once.",
    [
      "balance sheet",
      "reserves",
      "reinvestment caps"
    ]
  ],
  [
    "breakeven-inflation",
    "Breakeven inflation",
    "rates",
    "The difference between a nominal government-bond yield and a comparable inflation-linked real yield.",
    "It is a market-implied inflation compensation measure, not a clean forecast of CPI.",
    "If nominal 10Y is 4.3% and real 10Y is 2.0%, the simple breakeven is 2.3%.",
    [
      "10Y breakeven",
      "TIPS",
      "liquidity premium"
    ]
  ],
  [
    "hawkish-dovish",
    "Hawkish versus dovish",
    "rates",
    "Hawkish communication leans toward tighter policy; dovish communication leans toward easier policy.",
    "The market response depends on whether the statement was more or less hawkish than expected.",
    "A rate hold can be hawkish if officials warn further hikes remain possible.",
    [
      "statement changes",
      "votes",
      "priced rate path"
    ]
  ],
  [
    "treasury-auction",
    "Treasury auction",
    "rates",
    "A process through which a government sells new debt to investors.",
    "Demand and the final yield help show how easily the market is absorbing issuance.",
    "A weaker-than-expected auction can require a higher yield to attract buyers.",
    [
      "auction tail",
      "bid-to-cover",
      "dealer allocation"
    ]
  ],
  [
    "capital-expenditure",
    "Capital expenditure (capex)",
    "companies",
    "Money spent acquiring or building long-lived assets such as factories, servers and data centres.",
    "Large investment can support future growth while reducing near-term cash available to shareholders.",
    "A cloud company could report rising revenue and still spend more cash on servers.",
    [
      "cash capex",
      "depreciation",
      "utilisation"
    ]
  ],
  [
    "operating-cash-flow",
    "Operating cash flow",
    "companies",
    "Cash generated or used by a company's regular operations during a reporting period.",
    "Profits on paper and actual cash receipts do not always arrive at the same time.",
    "A company can record net profit while working-capital changes reduce operating cash.",
    [
      "cash from operations",
      "receivables",
      "working capital"
    ]
  ],
  [
    "free-cash-flow",
    "Free cash flow (FCF)",
    "companies",
    "Broadly, operating cash flow minus cash spent on capital expenditure; company definitions may differ.",
    "It helps reveal whether growth produces cash after essential or strategic investment.",
    "£12bn operating cash flow less £9bn cash capex leaves £3bn FCF on this simple basis.",
    [
      "operating cash flow",
      "cash capex",
      "leases"
    ]
  ],
  [
    "earnings-per-share",
    "Earnings per share (EPS)",
    "companies",
    "Profit attributable to each ordinary share, calculated from earnings and a share-count measure.",
    "Buybacks, dilution and one-off accounting gains can move EPS independently of core operations.",
    "More shares can lower EPS even when total profit stays unchanged.",
    [
      "GAAP EPS",
      "adjusted EPS",
      "diluted shares"
    ]
  ],
  [
    "profit-margin",
    "Operating margin",
    "companies",
    "Operating profit divided by revenue, expressed as a percentage.",
    "Fast sales growth does not necessarily mean the business is becoming more profitable.",
    "£20 operating profit on £100 revenue gives a 20% operating margin.",
    [
      "operating income",
      "revenue",
      "margin trend"
    ]
  ],
  [
    "share-dilution",
    "Share dilution",
    "companies",
    "A reduction in an existing owner's percentage ownership when additional shares are issued.",
    "New shares can fund growth, but each old share represents a smaller fraction of the company.",
    "Owning 10 of 100 shares is 10%; after 25 new shares, it becomes 8%.",
    [
      "shares outstanding",
      "equity issuance",
      "stock compensation"
    ]
  ],
  [
    "forward-pe",
    "Forward price-to-earnings (P/E)",
    "companies",
    "The current share price divided by expected earnings per share over a stated future period.",
    "A premium valuation needs earnings growth or confidence strong enough to justify the price.",
    "A £100 share against £5 expected EPS trades at 20× forward earnings.",
    [
      "estimate date",
      "earnings basis",
      "sector peers"
    ]
  ],
  [
    "earnings-guidance",
    "Earnings guidance",
    "companies",
    "A company's own expectations or targets for future performance.",
    "An upbeat past quarter can be overshadowed by weak forecasts for what comes next.",
    "A company can beat the last-quarter revenue estimate but guide next quarter below consensus.",
    [
      "revenue outlook",
      "margin outlook",
      "capex plan"
    ]
  ],
  [
    "brent-crude",
    "Brent crude",
    "energy",
    "A major international crude-oil benchmark used to price many global oil trades.",
    "Shipping and international supply shocks can influence Brent differently from US WTI.",
    "A refinery buying internationally priced crude may face a different input cost from a US inland buyer.",
    [
      "Brent futures",
      "time spreads",
      "freight"
    ]
  ],
  [
    "wti-crude",
    "West Texas Intermediate (WTI)",
    "energy",
    "A widely traded US crude-oil benchmark with delivery associated with Cushing, Oklahoma.",
    "Local US inventories, pipeline constraints and exports can change its spread to Brent.",
    "Brent and WTI can both rise while the difference between them widens.",
    [
      "WTI futures",
      "Cushing stocks",
      "Brent–WTI spread"
    ]
  ],
  [
    "contango",
    "Contango",
    "energy",
    "A futures market in which later-dated contracts trade above nearer-dated contracts.",
    "It can make storing a physical commodity more attractive, depending on financing and storage costs.",
    "Oil for December priced above November is one example of contango.",
    [
      "nearby/deferred futures",
      "storage costs",
      "inventories"
    ]
  ],
  [
    "backwardation",
    "Backwardation",
    "energy",
    "A futures market in which nearer-dated contracts trade above later-dated contracts.",
    "It can signal strong demand for immediate supply, though other factors also matter.",
    "A prompt oil contract trading above next month's contract shows backwardation.",
    [
      "prompt spread",
      "physical premiums",
      "inventories"
    ]
  ],
  [
    "inventory-draw",
    "Inventory draw",
    "energy",
    "A fall in stored quantities over a stated period.",
    "Draws can signal tighter physical supply, but seasonal demand and data coverage matter.",
    "A 2-million-barrel weekly draw means reported stocks fell by that amount.",
    [
      "EIA stock change",
      "refinery runs",
      "imports"
    ]
  ],
  [
    "forex-pair",
    "Currency pair",
    "fx",
    "A quote showing the price of one currency in units of another.",
    "The first currency is the base; direction depends on which side of the pair you are measuring.",
    "USD/JPY at 150 means one US dollar buys 150 yen.",
    [
      "base currency",
      "quote currency",
      "relative yields"
    ]
  ],
  [
    "dxy-dollar-index",
    "US Dollar Index (DXY)",
    "fx",
    "A weighted measure of the dollar against a basket of major currencies.",
    "It can rise even when the dollar falls against one currency if other basket components dominate.",
    "EUR has a large index weight, so EUR/USD can strongly affect DXY.",
    [
      "ICE basket",
      "EUR/USD",
      "Treasury yields"
    ]
  ],
  [
    "carry-trade",
    "Currency carry trade",
    "fx",
    "Borrowing in a lower-interest currency to invest in a higher-yielding currency or asset.",
    "Rate differentials can help returns, but exchange-rate moves can erase the carry quickly.",
    "Earning 4% extra yield does not help if the funded currency jumps 8%.",
    [
      "interest differential",
      "funding currency",
      "FX volatility"
    ]
  ],
  [
    "interest-differential",
    "Interest-rate differential",
    "fx",
    "The difference between the interest rates or comparable bond yields of two currencies.",
    "Relative yields can influence FX flows but do not determine exchange rates alone.",
    "Higher US rates than Japanese rates may support USD/JPY, unless risk demand changes.",
    [
      "US 2Y",
      "Japan 2Y",
      "policy expectations"
    ]
  ],
  [
    "exponential-moving-average",
    "Exponential moving average (EMA)",
    "trading",
    "A moving average that gives greater weight to more recent prices.",
    "Traders use it as a trend reference; a cross is information, not proof of a reversal.",
    "A sustained move below a 20-period EMA may be an early warning, not a guarantee.",
    [
      "20 EMA",
      "50 EMA",
      "timeframe"
    ]
  ],
  [
    "standard-deviation",
    "Standard deviation (SD)",
    "trading",
    "A measure of how widely observations vary around their average.",
    "Volatility bands use it to put price distance in context.",
    "A move two SD from a chosen mean is unusual relative to that sample, not impossible.",
    [
      "lookback",
      "volatility regime",
      "band width"
    ]
  ],
  [
    "bollinger-bands",
    "Bollinger Bands",
    "trading",
    "A conventional indicator using a moving average and upper/lower volatility bands.",
    "Band touches do not automatically mean a market must reverse.",
    "A band expansion can reflect increasing volatility rather than a directional signal.",
    [
      "band width",
      "middle average",
      "break-and-hold"
    ]
  ],
  [
    "average-true-range",
    "Average true range (ATR)",
    "trading",
    "An indicator estimating recent price-range volatility, including gaps.",
    "An ATR-based stop adjusts distance for market movement but cannot prevent slippage.",
    "If ATR is 2 points, a 1.5× ATR stop spans 3 points before position sizing.",
    [
      "ATR period",
      "stop distance",
      "position size"
    ]
  ],
  [
    "support-resistance",
    "Support and resistance",
    "trading",
    "Areas where past buying or selling activity may influence future price behaviour.",
    "A level becomes more useful when price shows acceptance, rejection or a retest.",
    "A breakout above resistance can fail if price quickly moves back below it.",
    [
      "retests",
      "volume",
      "higher timeframe"
    ]
  ],
  [
    "break-and-hold",
    "Break and hold",
    "trading",
    "A move beyond a reference level followed by sustained trading on the new side.",
    "It distinguishes brief price spikes from a stronger potential behaviour change.",
    "Closing above a resistance band is stronger evidence than a momentary wick above it.",
    [
      "close",
      "retest",
      "timeframe"
    ]
  ],
  [
    "position-sizing",
    "Position sizing",
    "trading",
    "Choosing how many units to trade based on risk budget and stop distance.",
    "Two equally attractive trades may require different sizes because their stops differ.",
    "With £100 risk and a £2-per-share stop, the simple size is 50 shares.",
    [
      "risk per trade",
      "stop distance",
      "contract value"
    ]
  ],
  [
    "risk-reward",
    "Risk-to-reward ratio",
    "trading",
    "The amount risked relative to the potential gain for a defined trade plan.",
    "A large advertised reward is not meaningful without a credible stop and exit condition.",
    "Risking £100 to target £250 gives a planned 1:2.5 risk-to-reward ratio.",
    [
      "entry",
      "stop",
      "target"
    ]
  ],
  [
    "drawdown",
    "Drawdown",
    "trading",
    "The fall from a previous equity or balance peak to a later low.",
    "It describes actual losses from a high point and can trigger risk limits.",
    "An account falling from £10,000 to £9,000 has a 10% peak-to-trough drawdown.",
    [
      "equity peak",
      "daily limit",
      "maximum loss"
    ]
  ],
  [
    "trailing-drawdown",
    "Trailing drawdown",
    "trading",
    "A loss limit that may rise after new equity highs, depending on the account rules.",
    "Prop-account risk headroom can shrink even after earlier profits.",
    "The exact trailing method differs by programme and may use balance or equity.",
    [
      "rulebook",
      "high-water mark",
      "breach level"
    ]
  ],
  [
    "slippage",
    "Slippage",
    "trading",
    "The difference between the intended execution price and the price actually received.",
    "Stops and risk calculations can fail in fast or illiquid markets.",
    "A stop ordered at 100 might fill at 99 during a sharp gap.",
    [
      "liquidity",
      "spread",
      "news timing"
    ]
  ],
  [
    "open-interest",
    "Open interest",
    "trading",
    "The number of outstanding derivative contracts that have not been closed or settled.",
    "It helps assess participation but does not reveal whether traders are collectively bullish.",
    "Rising futures open interest can accompany both new longs and new shorts.",
    [
      "futures positions",
      "volume",
      "expiry"
    ]
  ]
];

export const LEARN_GLOSSARY_ADDITIONS: LearnConcept[] = LESSONS.map(
  ([key,label,topic,definition,whyItMatters,example,watch]) => ({
    key,label,topic,definition,whyItMatters,example,watch,aliases:[],regimes:[]
  })
);

export function assembleLearnGlossary(governed: CanonicalConcept[]): LearnConcept[] {
  const existing = governed.filter((concept) => concept.status === "active");
  const keys = new Set(existing.map((concept) => concept.key));
  for (const entry of LEARN_GLOSSARY_ADDITIONS) {
    if (keys.has(entry.key)) throw new Error("Learn glossary duplicates a governed concept: " + entry.key);
    keys.add(entry.key);
  }
  return [
    ...existing.map(({key,label,definition,whyItMatters,watch,aliases,regimes}) => ({
      key,label,definition,whyItMatters,watch,aliases,regimes,topic:"regime" as const
    })),
    ...LEARN_GLOSSARY_ADDITIONS
  ].sort((a,b) => a.label.localeCompare(b.label,"en-GB"));
}
