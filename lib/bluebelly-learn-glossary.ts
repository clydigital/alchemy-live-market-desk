import type { CanonicalConcept } from "./concepts.ts";

// Editorially curated public educational definitions, separate from the 28
// research-governed Regime concepts. No publication or Dossier authority.
export type LearnTopic = "foundations" | "rates" | "companies" | "energy" | "fx" | "trading";
export type LearnConcept = Pick<CanonicalConcept,"key"|"label"|"definition"|"whyItMatters"|"watch"|"aliases"|"regimes"> & {
  topic: LearnTopic | "regime";
  example?: string;
  explanation?: string;
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

const FINANCIAL_LITERACY_LESSONS: LessonRow[] = [
  [
    "trailing-twelve-months",
    "Trailing twelve months (TTM)",
    "companies",
    "The most recent rolling 12 months of results, usually the last four reported quarters added together.",
    "A TTM cash-flow number covers a full year even when it appears inside a quarterly earnings announcement.",
    "A company with quarterly cash flows of $8bn, $10bn, $12bn and $14bn reports $44bn TTM cash flow.",
    [
      "four-quarter window",
      "same-period comparisons",
      "fiscal year-end"
    ]
  ],
  [
    "financial-quarter",
    "Financial quarter (Q1–Q4)",
    "companies",
    "One of four roughly three-month reporting periods in a company's financial year.",
    "Quarterly results and TTM results cover different lengths of time and cannot be compared as if they were the same.",
    "Q3 AWS revenue growth describes one quarter versus the comparable quarter last year, not Amazon's entire TTM cash flow.",
    [
      "company fiscal calendar",
      "three-month period",
      "quarterly versus TTM"
    ]
  ],
  [
    "financial-year",
    "Financial year (FY)",
    "companies",
    "The 12-month accounting year a company uses for its annual statements; it need not end in December.",
    "'FY2026' may use dates different from the calendar year, so reporting periods must be checked.",
    "A business ending its financial year in June labels July–September as the first quarter of the next FY.",
    [
      "year-end date",
      "fiscal versus calendar",
      "annual report"
    ]
  ],
  [
    "year-over-year",
    "Year over year (YoY)",
    "companies",
    "A comparison with the equivalent period one year earlier.",
    "It helps separate true growth or deterioration from normal seasonal swings.",
    "Revenue of $120m versus $100m in the same quarter last year is 20% YoY growth.",
    [
      "comparable quarter",
      "accounting adjustments",
      "seasonality"
    ]
  ],
  [
    "quarter-over-quarter",
    "Quarter over quarter (QoQ)",
    "companies",
    "A comparison between one quarter and the quarter immediately before it.",
    "It can reveal acceleration, but seasonal businesses may fluctuate sharply between quarters.",
    "Revenue of $110m after $100m in the previous quarter is 10% QoQ growth.",
    [
      "sequential trend",
      "seasonality",
      "quarter-end dates"
    ]
  ],
  [
    "revenue",
    "Revenue (sales)",
    "companies",
    "Money the business earns from selling goods or services before deducting its expenses.",
    "Sales growth is encouraging only if enough of those sales eventually become profit and cash.",
    "A cloud unit bills customers $10bn for services, but servers, salaries and electricity still have to be paid.",
    [
      "segment sales",
      "growth rate",
      "profit margin"
    ]
  ],
  [
    "operating-income",
    "Operating income (operating profit)",
    "companies",
    "Profit left after the expenses of running the business, before interest and income taxes.",
    "It shows whether selling more is making the underlying operation more profitable.",
    "$100bn of revenue less $82bn operating expenses leaves $18bn operating income.",
    [
      "operating margin",
      "one-off expenses",
      "segment profit"
    ]
  ],
  [
    "net-income",
    "Net income (net profit)",
    "companies",
    "Accounting profit after recognised expenses, interest and taxes.",
    "A company can show positive net income while spending more on infrastructure than it generates in cash.",
    "Net income of $5bn does not mean the company has $5bn left in free cash flow.",
    [
      "one-off gains",
      "cash conversion",
      "earnings per share"
    ]
  ],
  [
    "property-plant-equipment",
    "Property, plant and equipment (PP&E)",
    "companies",
    "Long-lived physical business assets such as land, buildings, factories, machinery and data-centre servers.",
    "Buying PP&E uses cash today even though the asset can support revenue for years.",
    "Amazon buying AI servers adds to PP&E; the servers are not charged entirely as an operating expense on day one.",
    [
      "asset useful life",
      "capital expenditure",
      "depreciation"
    ]
  ],
  [
    "net-ppe-investment",
    "Net PP&E investment",
    "companies",
    "A cash measure of purchases of property, plant and equipment after specified offsets, such as asset-sale proceeds or incentives, depending on the issuer's definition.",
    "A company's net PP&E figure may differ from gross cash capex; match the issuer's adjustments before calculating FCF.",
    "In the quoted Amazon example, $210.7bn of TTM net PP&E investment is deducted from $168.3bn of TTM operating cash.",
    [
      "cash PP&E purchases",
      "sale proceeds or incentives",
      "issuer reconciliation"
    ]
  ],
  [
    "depreciation",
    "Depreciation",
    "companies",
    "The accounting process of spreading a physical asset's cost across the years it is used.",
    "Depreciation reduces reported profit without repeating the original cash purchase each year.",
    "A $10m server system with a five-year straight-line life may record $2m depreciation yearly, ignoring residual value.",
    [
      "asset life",
      "depreciation policy",
      "cash capex"
    ]
  ],
  [
    "ebitda",
    "EBITDA",
    "companies",
    "Earnings before interest, taxes, depreciation and amortisation.",
    "It is one way to compare operating earnings, but it does not pay for new servers, debt interest or taxes.",
    "A data-centre operator may report positive EBITDA yet negative FCF after building new facilities.",
    [
      "EBITDA adjustments",
      "capital expenditure",
      "operating cash"
    ]
  ],
  [
    "market-capitalisation",
    "Market capitalisation (market cap)",
    "companies",
    "The market value of a company's outstanding equity: share price multiplied by shares outstanding.",
    "It tells you what investors collectively value the shares at, not what the entire debt-inclusive business costs.",
    "One billion shares at $100 each gives a $100bn market capitalisation.",
    [
      "share count",
      "share price",
      "enterprise value"
    ]
  ],
  [
    "enterprise-value",
    "Enterprise value (EV)",
    "companies",
    "An estimate of total business value, roughly equity market value plus debt minus cash, with certain other adjustments where relevant.",
    "Two companies with the same market cap may have very different debt and cash positions.",
    "A $100bn market cap plus $20bn debt less $10bn cash suggests $110bn simplified EV.",
    [
      "net debt",
      "minority interests",
      "cash definition"
    ]
  ],
  [
    "ev-to-ebitda",
    "EV/EBITDA",
    "companies",
    "Enterprise value divided by a comparable annual or TTM EBITDA figure.",
    "It compares the price of the whole business with one measure of its earnings, but excludes the cost of replacing assets.",
    "An EV of $120bn and EBITDA of $10bn gives 12× EV/EBITDA.",
    [
      "EBITDA period",
      "debt levels",
      "capex intensity"
    ]
  ],
  [
    "price-to-earnings",
    "Price-to-earnings (P/E)",
    "companies",
    "Share price divided by earnings per share for a stated period, commonly the most recent 12 months.",
    "A high P/E can signal strong growth expectations or an expensive stock; the multiple is not a guarantee.",
    "A $100 share with $5 trailing annual EPS trades at 20× P/E.",
    [
      "trailing EPS",
      "one-off gains",
      "peer valuation"
    ]
  ],
  [
    "price-to-sales",
    "Price-to-sales (P/S)",
    "companies",
    "Market capitalisation divided by annual revenue, or share price divided by sales per share.",
    "It helps compare businesses with little reported profit, but ignores margins and costs.",
    "A $60bn market cap on $10bn annual sales is 6× sales.",
    [
      "revenue definition",
      "gross margin",
      "growth"
    ]
  ],
  [
    "price-to-book",
    "Price-to-book (P/B)",
    "companies",
    "Share price divided by book value per share, or market cap divided by shareholder equity.",
    "It is often used for banks and asset-heavy firms, but book value may not reflect economic value.",
    "Shares priced at $30 with $20 accounting equity per share trade at 1.5× book.",
    [
      "asset valuation",
      "return on equity",
      "intangible assets"
    ]
  ],
  [
    "peg-ratio",
    "PEG ratio",
    "companies",
    "P/E divided by the annual earnings growth rate expressed as a whole-number percentage; conventions vary.",
    "It tries to judge valuation relative to growth, but growth forecasts can be unstable.",
    "A P/E of 30 with a forecast earnings growth rate of 15% gives a PEG of 2 under this convention.",
    [
      "growth horizon",
      "estimated versus realised",
      "earnings basis"
    ]
  ],
  [
    "return-on-invested-capital",
    "Return on invested capital (ROIC)",
    "companies",
    "How much after-tax operating profit a business earns relative to the capital invested in operations.",
    "For AI spending, the question is whether new servers ultimately generate adequate returns on the money committed.",
    "$12bn in annual after-tax operating profit on $100bn invested capital is 12% ROIC on a simple basis.",
    [
      "invested capital definition",
      "cost of capital",
      "segment returns"
    ]
  ],
  [
    "net-debt",
    "Net debt",
    "companies",
    "Interest-bearing borrowings minus cash and qualifying cash equivalents.",
    "It indicates how much debt remains after liquid resources, but not when payments come due.",
    "$40bn in borrowings less $15bn cash equals $25bn net debt.",
    [
      "debt maturity",
      "restricted cash",
      "interest expense"
    ]
  ],
  [
    "stock-based-compensation",
    "Stock-based compensation (SBC)",
    "companies",
    "Paying employees using shares or share-linked awards, recognised as an accounting expense.",
    "It may reduce cash salary needs but can dilute shareholders; cash flow and per-share value must be considered together.",
    "If new employee shares increase the total share count, existing owners hold a smaller percentage.",
    [
      "diluted share count",
      "buybacks",
      "SBC expense"
    ]
  ],
  [
    "gaap",
    "Generally accepted accounting principles (GAAP)",
    "companies",
    "Standard accounting rules used for reported US financial statements.",
    "Reported GAAP profit includes required accounting items that an adjusted metric may exclude.",
    "Compare reported GAAP EPS with GAAP EPS for the same period, not unlabelled adjusted consensus.",
    [
      "GAAP reconciliation",
      "one-off gains",
      "reporting period"
    ]
  ],
  [
    "non-gaap",
    "Non-GAAP (adjusted results)",
    "companies",
    "A company-defined measure that modifies reported accounting results, often excluding selected costs or gains.",
    "Adjusted profit may clarify operations, but exclusions can flatter performance if recurring costs are removed.",
    "Adjusted EPS of $3 and GAAP EPS of $2 are not interchangeable without seeing the reconciliation.",
    [
      "excluded expenses",
      "issuer reconciliation",
      "GAAP comparison"
    ]
  ],
  [
    "working-capital",
    "Working capital",
    "companies",
    "Current operating assets minus current operating liabilities; changes in receivables, inventories and payables affect cash flow.",
    "Sales can rise before customers pay, leaving cash tied up in unpaid bills.",
    "A $100m increase in unpaid customer invoices can depress cash from operations.",
    [
      "receivables",
      "inventories",
      "payables"
    ]
  ],
  [
    "cash-conversion",
    "Cash conversion",
    "companies",
    "How effectively accounting earnings or sales become actual cash receipts, measured with a clearly stated ratio or bridge.",
    "Fast cloud growth is more valuable when customers pay and the cash ultimately covers infrastructure investment.",
    "A service can recognise $1bn of sales before collecting all $1bn from customers.",
    [
      "cash collections",
      "operating cash flow",
      "FCF conversion"
    ]
  ],
  [
    "asset-utilisation",
    "Asset utilisation",
    "companies",
    "How fully a business uses the capacity of factories, machines, data centres or other assets it has built.",
    "Idle AI servers still cost money; better utilisation can raise revenue without an equally large new investment.",
    "A data centre designed for 100 units of demand but serving 60 has 60% simple capacity utilisation.",
    [
      "server occupancy",
      "usage and pricing",
      "capacity growth"
    ]
  ],
  [
    "customer-prepayments",
    "Customer prepayments",
    "companies",
    "Cash received from customers before the promised products or services have been fully delivered.",
    "Prepayments may fund expansion and boost near-term operating cash flow, but the company still owes future service.",
    "A customer pays $12m up front for a three-year contract; receiving cash is not the same as earning all the revenue immediately.",
    [
      "deferred revenue",
      "contract obligations",
      "cash collections"
    ]
  ],
  [
    "lease-commitments",
    "Lease commitments",
    "companies",
    "Future payments promised under contracts to use buildings, equipment or other assets without necessarily owning them.",
    "Some AI infrastructure is financed through leases, so cash capex alone may not capture every future funding obligation.",
    "A long-term data-centre lease creates payments due even if new capacity is not fully used.",
    [
      "lease liabilities",
      "payment schedule",
      "FCF definition"
    ]
  ],
  [
    "ev-to-fcf",
    "EV/FCF",
    "companies",
    "Enterprise value divided by a defined annual free cash flow figure, when that figure is meaningfully positive.",
    "It compares business value with cash left after investment, but swings with capex timing and can be unusable for negative FCF.",
    "$100bn EV against $5bn annual FCF is 20× EV/FCF; a negative FCF does not give a useful conventional multiple.",
    [
      "cash-flow period",
      "net debt",
      "investment cycle"
    ]
  ],
  [
    "free-cash-flow-yield",
    "Free cash flow yield",
    "companies",
    "Annual free cash flow divided by equity market capitalisation, expressed as a percentage.",
    "It measures cash generation relative to the price of the shares, but is sensitive to capex and accounting definitions.",
    "$5bn FCF on a $100bn market cap gives a 5% FCF yield.",
    [
      "trailing versus forecast FCF",
      "buybacks",
      "capex cycle"
    ]
  ]
];

// Longer reader explanations are educational only, not current issuer observations.
const FINANCIAL_EXPLANATIONS: Record<string,string> = {
  "trailing-twelve-months": "Think of TTM as a moving one-year window. After each new quarter, drop the oldest quarter and add the newest. A single Q3 result covers about three months; TTM covers four quarters. Do not combine quarterly operating cash with TTM investment spending.",
  "financial-quarter": "Q3 does not always mean July to September: check the company's fiscal year-end. A Q3 year-on-year growth rate compares that quarter with Q3 a year ago. It does not describe full-year growth.",
  "free-cash-flow": "Worked Amazon example (figures supplied for the Q3 discussion, not a live quote): $168.3bn TTM operating cash flow minus $210.7bn TTM net PP&E investment equals −$42.4bn FCF. This is cash spent on infrastructure above cash generated in operations, NOT a $42.4bn accounting operating loss. The invested servers may generate revenue for years; future utilisation and cash collections determine the payoff.",
  "operating-cash-flow": "Cash flow from operations is often abbreviated OCF or CFO (cash from operations). It tracks the cash produced by running the business before subtracting cash spent buying or constructing PP&E. It can rise even if FCF falls because investment spending rose faster.",
  "capital-expenditure": "Cash capex is the outlay for long-lived business assets, not a one-quarter operating expense. Compare the company's stated gross and net PP&E measures, including sales, incentives and lease treatment, before subtracting capex from cash flow.",
  "property-plant-equipment": "Property, plant and equipment is the asset category; capex is spending to buy or build those assets. For cloud businesses, think data centres, networking equipment and servers. Cash is spent when assets are bought, while depreciation usually recognises their accounting cost over subsequent years.",
  "net-ppe-investment": "Net PP&E investment is not automatically identical to gross capital expenditure. A company might subtract asset sales, construction incentives or other offsets. The Amazon example specifically uses the issuer's stated TTM $210.7bn net figure; inspect that company's bridge rather than mixing definitions.",
  "price-to-earnings": "Trailing P/E is based on earnings already reported, commonly the last 12 months. At $100 per share and $5 trailing EPS, P/E is 20×. A company can be excellent but still a poor investment if buyers pay a multiple its future results cannot support.",
  "forward-pe": "Forward P/E instead uses forecasts. For the same $100 share, a $8 forecast next-12-month EPS gives 12.5× forward P/E even if trailing P/E was 20× at $5 EPS. The lower number assumes earnings will grow; forecasts can be cut.",
  "return-on-invested-capital": "The AI-capex question is not just 'How much did Amazon spend?' It is 'What future after-tax operating return will that additional capacity earn?' Compare ROIC against the cost of financing the investment and allow for the time before new facilities reach full utilisation.",
  "gaap": "GAAP is the official accounting basis. Adjusted or non-GAAP earnings remove items under a company's own rules. Always compare like with like: GAAP actual EPS against GAAP consensus, or adjusted actual EPS against adjusted consensus."
};

const LEARN_ALIASES: Record<string,string[]> = {
  "consumer-price-index":["cpi"],"pce-inflation":["pce","personal consumption expenditures"],
  "yield-to-maturity":["ytm"],"credit-spread":["credit spread","credit spreads"],
  "gross-domestic-product":["gdp"],"average-true-range":["atr"],
  "free-cash-flow":["fcf"],
  "exponential-moving-average":["ema"],"capital-expenditure":["capex"],
  "risk-reward":["rr","risk reward"],"standard-deviation":["sd","1sd"],
  "bollinger-bands":["bbands"],"share-dilution":["dilution"],
  "dxy-dollar-index":["dxy"],"forex-pair":["fx pair"],
  "operating-cash-flow":["ocf","cfo","cash from operations"],
  "trailing-twelve-months":["ttm","ltm","last twelve months","trailing 12 months"],
  "financial-quarter":["q1","q2","q3","q4","quarter"],"financial-year":["fy","fiscal year"],
  "year-over-year":["yoy","y/y"],"quarter-over-quarter":["qoq","q/q"],
  "revenue":["sales"],"operating-income":["operating profit"],"net-income":["net profit"],
  "property-plant-equipment":["pp&e","ppe"],"net-ppe-investment":["net pp&e purchases"],
  "market-capitalisation":["market cap"],"enterprise-value":["ev"],"ev-to-ebitda":["ev/ebitda"],
  "price-to-earnings":["p/e","trailing p/e","pe ratio"],"forward-pe":["forward p/e"],
  "price-to-sales":["p/s"],"price-to-book":["p/b"],"peg-ratio":["peg"],
  "return-on-invested-capital":["roic"],"stock-based-compensation":["sbc"],
  "ebitda":["ebitda"],"gaap":["gaap"],"non-gaap":["adjusted earnings"],
  "free-cash-flow-yield":["fcf yield"],"ev-to-fcf":["ev/fcf"],
};

export const LEARN_GLOSSARY_ADDITIONS: LearnConcept[] = [...LESSONS,...FINANCIAL_LITERACY_LESSONS].map(
  ([key,label,topic,definition,whyItMatters,example,watch]) => ({
    key,label,topic,definition,whyItMatters,example,explanation:FINANCIAL_EXPLANATIONS[key],watch,aliases:LEARN_ALIASES[key] || [],regimes:[]
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
