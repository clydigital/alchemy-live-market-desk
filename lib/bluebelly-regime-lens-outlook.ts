import type {EditorialRegimeId} from "./bluebelly-editorial-architecture.ts";

/** A human-reviewed, source-dated editorial thesis about each *research lens*.
 * Distinct from asset-specific tape, creator opinion and the canonical
 * System-2 Regime/Dossier state. These fields cannot be changed by news ingestion.
 */
export type LensOutlook="BEARISH"|"MIXED"|"BULLISH";
export type LensConfidence="LOW"|"MEDIUM"|"HIGH";
export type LensResearchOutlook=Readonly<{
 lens:EditorialRegimeId;
 outlook:LensOutlook;
 confidence:LensConfidence;
 /** Precisely what the directional meter measures, not a view on every asset. */
 directionTarget:string;
 horizon:string;
 headline:string;
 why:string;
 supporting:string;
 opposing:string;
 decidingTest:string;
 reviewedAt:string;
 evidenceStatus:string;
 sources:readonly {name:string;url:string;asOf:string;kind:"PRIMARY"|"REPORTING"|"COMMENTARY"}[];
}>;

export const LENS_OUTLOOK_REVIEWED_ON="2026-10-30" as const;
export const LENS_OUTLOOK_VERSION="bluebelly/editorial-lens-outlook/2026-10-30/3" as const;

export const LENS_RESEARCH_OUTLOOKS:Readonly<Record<EditorialRegimeId,LensResearchOutlook>>={
 fed:{
  lens:"fed",
  outlook:"BEARISH",
  confidence:"HIGH",
  directionTarget:"Prospects for near-term Fed easing",
  horizon:"Next 1–3 policy meetings",
  headline:"Rate-cut hopes face a stronger inflation barrier",
  why:"September headline PCE rose 3.6% year on year and core PCE 3.1%. The Fed held its policy band at 3.75–4.00%, with two voters preferring a hike. Yet DXY's 29 October session close at 102.04 was below the previous 102.19, and a 30 October Asian intraday quote was around 101.72. Restrictive US policy and a softer dollar can coexist when US yields decline and Japan signals further tightening. This bearish meter rates near-term Fed easing prospects, not DXY.",
  supporting:"The official inflation print exceeds the Fed's 2% headline-PCE goal; two explicit hike dissents reinforce the hawkish policy risk.",
  opposing:"Real spending was approximately flat and disposable income fell. A sharper labour deterioration or lower core services inflation would make the Fed more sensitive to growth risks.",
  decidingTest:"Check the next inflation and jobs releases and source-dated Fed-funds futures/OIS, 2Y yields and dollar reactions on the same event windows; an easing bias requires inflation relief or labour weakness that shifts the policy path.",
  reviewedAt:"2026-10-30",
  evidenceStatus:"Policy, inflation and the 28–29 October DXY decline are now checked. No complete same-feed 4H DXY 20-EMA ±1SD or certified future Fed/OIS settlement was available; cross-market explanations stay conditional.",
  sources:[
   {name:"Federal Reserve 28 Oct 2026 FOMC statement",url:"https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm",asOf:"28 Oct 2026, 14:00 ET",kind:"PRIMARY"},
   {name:"BEA September PCE and personal income",url:"https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026",asOf:"29 Oct 2026, 08:30 ET",kind:"PRIMARY"},
  ]
 },
 bonds:{
  lens:"bonds",
  outlook:"BULLISH",
  confidence:"MEDIUM",
  directionTarget:"US Treasury prices, not speculative corporate credit",
  horizon:"Days to several weeks",
  headline:"Safety buying is lifting Treasuries even with inflation high",
  why:"The 10-year nominal Treasury yield fell 5.05→4.98% from 28 to 29 October; a saved US Treasury real-yield observation shows 2.67→2.63%. The simple matched nominal-minus-real 10Y difference narrowed from 2.38 to 2.35 percentage points. Reuters reported additional safe-haven Treasury demand during the 30 October Asian session. The dated move favours government-bond prices even though US inflation has not vanished. It does not show that private AI-borrower credit is cheaper.",
  supporting:"The US 2Y fell from 4.67% to 4.61% on 29 October, alongside 10Y weakness. Risk aversion favoured government bonds, and high-yield spreads had narrowed to about 314bp by 28 October from 340bp on the 22nd.",
  opposing:"Headline PCE at 3.6%, long-term debt supply and still-high real yields can reverse duration gains. Narrower high-yield spreads are not proof that individual leveraged borrowers can refinance.",
  decidingTest:"Match the next 2Y/10Y/30Y Treasury closes, inflation-indexed yields, auctions, and dated IG/HY credit spreads; downgrade the bullish Treasury-price call if yields reclaim the late-October highs on confirming real-rate pressure.",
  reviewedAt:"2026-10-30",
  evidenceStatus:"29 Oct nominal close checked against Treasury, 29 Oct real yield through a dated Treasury-derived mirror and Reuters 30 Oct intraday follow-up. The 28 Oct ICE OAS reading is separate, not the same-day post-earnings credit settlement.",
  sources:[
   {name:"US Treasury daily par yields",url:"https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value_month=202610",asOf:"29 Oct 2026, indicative close",kind:"PRIMARY"},
   {name:"Reuters 30 Oct Treasury and dollar session",url:"https://www.reuters.com/world/asia-pacific/yen-steady-before-boj-ai-jitters-drive-treasury-rally-weigh-dollar-2026-10-30/",asOf:"30 Oct 2026, Asia session",kind:"REPORTING"},
   {name:"ICE BofA OAS via dated credit chart",url:"https://markets.akyla.ai/charts/rates-credit-spreads",asOf:"28 Oct 2026 observation",kind:"REPORTING"},
  ]
 },
 ai:{
  lens:"ai",
  outlook:"BEARISH",
  confidence:"MEDIUM",
  directionTarget:"High-capex AI buyer valuations and shareholder cash conversion",
  horizon:"Next earnings and financing cycle",
  headline:"The market is questioning the bill for AI, not the demand",
  why:"Amazon's AWS sales climbed 39.3% to $46.0bn in Q3, but group trailing-12-month free cash flow fell to a $42.4bn outflow while 2026 cash capex is expected near $220bn. That is a cash-return warning, not an operating loss. Alphabet's sharp 29 October share selloff and widespread tech repricing signal a high bar for promised AI returns. Microsoft remained free-cash-flow positive and memory suppliers reported real growth: the bearish call applies to capex-heavy buyer valuation risk, not the whole AI supply chain.",
  supporting:"Faster spending than cash recovery raises funding and return-on-capital questions; Amazon shares lost a further 7.3% in a dated post-release after-hours snapshot while investors scrutinised Q4 guidance and cash usage.",
  opposing:"AWS and profitable suppliers have real paying demand; Microsoft demonstrates that substantial AI investment need not prevent positive free cash flow. Large up-front builds can earn returns later.",
  decidingTest:"For each buyer separately, reconcile quarterly and trailing CFO minus cash capex, data-centre leases, debt and promised capacity versus realised customer receipts. Reassess if incremental utilisation and free cash flow accelerate for two reporting periods.",
  reviewedAt:"2026-10-30",
  evidenceStatus:"AMZN original published and post-close quote separately dated; the cash flows of Microsoft, Meta and Alphabet differ. A system-wide AI insolvency cascade remains unverified.",
  sources:[
   {name:"Amazon Q3 2026 issuer release",url:"https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Third-Quarter-Results/default.aspx",asOf:"29 Oct 2026, US after close",kind:"PRIMARY"},
   {name:"Microsoft fiscal 2027 Q1 issuer release",url:"https://www.microsoft.com/en-us/Investor/earnings/FY-2027-Q1/press-release-webcast",asOf:"28 Oct 2026",kind:"PRIMARY"},
   {name:"Reuters Amazon cash-spending market reaction",url:"https://www.reuters.com/business/retail-consumer/amazon-projects-fourth-quarter-sales-below-estimates-2026-10-29/",asOf:"29 Oct 2026 US after close",kind:"REPORTING"},
   {name:"Why X: leverage, valuation and forced-selling hypothesis",url:"https://www.youtube.com/watch?v=YgqpOe2H17o",asOf:"30 Oct 2026; speech indexed, no certified timecodes",kind:"COMMENTARY"},
  ]
 },
 china:{
  lens:"china",
  outlook:"MIXED",
  confidence:"MEDIUM",
  directionTarget:"China–US comparative compute economics",
  horizon:"Coming quarters",
  headline:"China's electronics profits surge; relative compute leadership remains unproven",
  why:"China's statistics bureau reports January–September profit growth of 103.8% for computer, communications and electronics manufacturing, evidence of genuine sector momentum. Yet total fixed-asset investment fell 7.2% and property weakness persists. Strong electronics profits do not establish superior AI-model economics, HBM yields, export-control immunity or paid compute adoption versus US peers. Mixed here reflects a real two-sided divergence—not a default refusal to judge.",
  supporting:"Official NBS electronics manufacturing profit growth of 103.8% year on year, against 15.5% for all larger industrial enterprises, shows concentration of industrial strength in the tech chain.",
  opposing:"Broad fixed investment declined 7.2%, property drag continues, and equipment/export rules and unverified model efficiency can limit the translation from hardware profit to scalable AI leadership.",
  decidingTest:"Compare independent matched model cost-quality tests, documented deployment revenue, current export-rule effects, HBM production yields and issuer margins. A reliable peer-normalised economic advantage would move the outlook out of Mixed.",
  reviewedAt:"2026-10-30",
  evidenceStatus:"Official September industrial results and first-three-quarter activity data available; no comparable current US-China model margin, price and utilisation dataset certified.",
  sources:[
   {name:"China NBS industrial profits January–September",url:"https://www.stats.gov.cn/english/PressRelease/202610/t20261028_1965704.html",asOf:"28 Oct 2026",kind:"PRIMARY"},
   {name:"China NBS first-three-quarter economic conditions",url:"https://www.stats.gov.cn/english/PressRelease/202610/t20261019_1965619.html",asOf:"19 Oct 2026",kind:"PRIMARY"},
   {name:"China NBS Q3 GDP by industry",url:"https://www.stats.gov.cn/english/PressRelease/202610/t20261021_1965671.html",asOf:"21 Oct 2026",kind:"PRIMARY"},
  ]
 },
 energy:{
  lens:"energy",
  outlook:"BULLISH",
  confidence:"HIGH",
  directionTarget:"Physical diesel/gasoil scarcity and refined-product pricing power",
  horizon:"Q4 2026 into 2027",
  headline:"A product shortage is more durable than a one-day oil rally",
  why:"The IEA's October report shows September global diesel exports about 700,000 barrels a day below a year earlier, with depleted stock buffers and continuing shipping disruption. It expects gasoil supply to fall short of demand in Q4 and material inventory replenishment unlikely before the second half of 2027. This strongly supports the scarcity case for diesel and physical product premiums. Brent futures, oil-producer shares and refinery profits are different exposures and may not rise together.",
  supporting:"The IEA documents Middle East/Russian product losses, exceptional backwardation and global stocks about 509m barrels below end-February; refined-product constraints remain more severe than crude recovery.",
  opposing:"The IEA expects demand destruction as high prices curb deliveries; easing Gulf disruptions, more refinery runs or weaker industrial activity could materially relieve product shortages.",
  decidingTest:"Track weekly EIA distillates and refinery runs, IEA export updates, tanker flows, diesel cracks and product backwardation. If stock cover begins rebuilding earlier than expected, cut this bullish scarcity view.",
  reviewedAt:"2026-10-30",
  evidenceStatus:"High confidence refers to the documented physical product shortage, not the probability of Brent appreciating; high-frequency Hormuz data have separate freshness rules.",
  sources:[
   {name:"IEA October 2026 Oil Market Report",url:"https://www.iea.org/reports/oil-market-report-october-2026",asOf:"14 Oct 2026",kind:"PRIMARY"},
   {name:"EIA Weekly Petroleum Status Report",url:"https://www.eia.gov/petroleum/supply/weekly/",asOf:"latest source series, individual week must be identified",kind:"PRIMARY"},
  ]
 },
 yen:{
  lens:"yen",
  outlook:"BULLISH",
  confidence:"MEDIUM",
  directionTarget:"Japanese yen versus US dollar (JPY up / USDJPY down)",
  horizon:"Near-term Asian FX sessions",
  headline:"Hawkish BoJ pause meets an actual yen bid",
  why:"The BoJ held at 1.25% on 30 October by an 8–1 vote, with Hajime Takata advocating 1.50%. Reuters observed USD/JPY near 157.115 in Asia while falling US Treasury yields added dollar pressure. An independent later FX-provider mark near 157.305 at 04:21 UTC confirms the pair did not remain fixed at the earlier trough. This supports a bullish near-term JPY view, but the BoJ is not proved to be the only cause.",
  supporting:"The published BoJ vote, upside inflation risk, expectations of future tightening, and falling US Treasury yields favour a narrower funding differential.",
  opposing:"The 1.25% hold was expected and the yen remains sensitive to risk swings, US rate repricing and Japanese cross-border flows; a December hike is not yet guaranteed.",
  decidingTest:"Match Ueda's remarks and official Outlook to JGB 2Y/10Y, USDJPY across the decision window, currency basis and foreign bond flows. A renewed USDJPY advance despite narrowing rate differentials would weaken the JPY call.",
  reviewedAt:"2026-10-30",
  evidenceStatus:"BoJ official 30 Oct release indexed; Reuters post-decision USDJPY ~157.115 and a later FX vendor ~157.305 dated separately. Prior completed daily USDJPY is under its 20/50 EMA references; a source-identical post-decision closed 4H check and funding-flow confirmation are not certified.",
  sources:[
   {name:"Bank of Japan official meeting release calendar",url:"https://www.boj.or.jp/en/mopo/mpmsche_minu/",asOf:"30 Oct 2026 scheduled decision",kind:"PRIMARY"},
   {name:"Reuters 30 Oct BoJ 8–1 hold and inflation outlook",url:"https://www.reuters.com/world/asia-pacific/boj-keeps-interest-rates-steady-signals-further-rate-hikes-2026-10-30/",asOf:"30 Oct 2026",kind:"REPORTING"},
   {name:"FXStreet dated JPY reaction after BoJ",url:"https://www.fxstreet.com/news/japanese-yen-strengthens-vs-usd-on-bojs-hawkish-pause-focus-shifts-uedas-presser-202610300326",asOf:"30 Oct 2026 03:26 GMT",kind:"REPORTING"},
  ]
 },
 breadth:{
  lens:"breadth",
  outlook:"BULLISH",
  confidence:"MEDIUM",
  directionTarget:"US market participation outside mega-cap AI",
  horizon:"Recent sessions; reconfirm next US cash open",
  headline:"Broad US participation outran mega-cap damage",
  why:"On 29 October, Nasdaq fell around 1.4%, yet a monitored S&P constituent basket recorded 406 advancers versus 97 decliners; most US listed stocks rose and the Russell 2000 gained about 1%. Equal-weight RSP gained roughly 1.20% while SPY fell about 0.38%. Around 63.6% of monitored S&P constituents traded above their 50-day averages. The 28 October ICE BofA high-yield OAS observation narrowed to 3.14% from 3.18% on 27 October. This backs improving US participation outside tech leaders, not a universal risk-on forecast.",
  supporting:"AP's 29 October closing report records a rising majority of stocks and Russell 2000 +1% even as Nasdaq −1.4%; dated US high-yield spreads narrowed from 340bp on 22 Oct to 314bp on 28 Oct.",
  opposing:"Nasdaq concentration remains vulnerable, and on 30 October early Asian trading the Nikkei and Kospi were down sharply. A one-day US participation improvement can reverse.",
  decidingTest:"Watch 3–5 US cash sessions of S&P equal-weight versus cap-weight, advance/decline lines, Russell relative performance, and IG/HY OAS on matching dates. Broad participation failure would turn this negative.",
  reviewedAt:"2026-10-30",
  evidenceStatus:"29 Oct constituent-level advance/decline, ETF equal-weight spread and 20/50/200-day participation checked across secondary price readers, with AP corroboration. 28 Oct HY OAS separately dated; next public 29 Oct spread and further sessions not yet confirmed.",
  sources:[
   {name:"AP 29 Oct US market breadth versus Nasdaq",url:"https://apnews.com/article/2c26b0b1bbc3bfab9f3f4b902172f458",asOf:"29 Oct 2026 US close",kind:"REPORTING"},
   {name:"ICE BofA credit OAS dated series mirror",url:"https://markets.akyla.ai/charts/rates-credit-spreads",asOf:"28 Oct 2026",kind:"REPORTING"},
   {name:"AP early Asia stocks 30 Oct",url:"https://apnews.com/article/16c266731fdf64178f38070af2b42497",asOf:"30 Oct 2026 Asia session",kind:"REPORTING"},
   {name:"Why X structural leverage discussion",url:"https://www.youtube.com/watch?v=YgqpOe2H17o",asOf:"30 Oct 2026, commentary only",kind:"COMMENTARY"},
  ]
 },
 gold:{
  lens:"gold",
  outlook:"BEARISH",
  confidence:"MEDIUM",
  directionTarget:"Spot gold price in the near term, not long-run reserve ownership",
  horizon:"Days to weeks",
  headline:"Gold's weakness persists despite lower real yields",
  why:"On 29 October, 10-year Treasury real yields eased from 2.67% to 2.63%, while the dollar index also weakened. Gold nevertheless fell; Reuters observed spot around $3,997 on 30 October. A dated automated Binance gold-futures proxy reported both 4H and daily downtrends, with price below the 4H EMA20/50 and daily EMA20/50. A separate GCUSD futures price series also closed below its 20/50-day averages. This supports a near-term bearish *price* view while reserve-allocation motives remain distinct.",
  supporting:"A dated XAU/USD session fell even as 10Y yields and DXY retreated, showing price weakness beyond the usual dollar-rate explanation. Reuters reports further 30 October weakness around $4,000.",
  opposing:"Geopolitical risk, falling real yields, reserve purchases and renewed dip buying could rapidly restore safe-haven demand. A short price decline is not proof of structural gold liquidation.",
  decidingTest:"Match spot XAUUSD to DXY, 10Y TIPS and risk assets in the same windows; require stabilisation above the recent lows with independent flow/real-yield confirmation to upgrade.",
  reviewedAt:"2026-10-30",
  evidenceStatus:"Spot decline, 29 Oct real-yield/DXY observations and two independent gold-futures daily chart sources now checked; 4H futures trend is proxy-qualified, not a single-feed spot confirmation or documented seller identity.",
  sources:[
   {name:"Reuters 30 Oct gold and rate-hike pricing",url:"https://www.reuters.com/world/india/gold-slips-higher-oil-us-inflation-data-bolster-fed-hike-bets-2026-10-30/",asOf:"30 Oct 2026",kind:"REPORTING"},
   {name:"OANDA XAU/USD 29 Oct close attribution",url:"https://www.ausecure.com/gold-market-close-oct-29-2026/",asOf:"29 Oct 2026 US close",kind:"REPORTING"},
   {name:"US Treasury real and nominal yield series",url:"https://home.treasury.gov/resource-center/data-chart-center/interest-rates",asOf:"29 Oct 2026 nominal; real yield vintage varies",kind:"PRIMARY"},
  ]
 },
 housing:{
  lens:"housing",
  outlook:"BEARISH",
  confidence:"HIGH",
  directionTarget:"US housing affordability and new-build demand, not systemic bank solvency",
  horizon:"Current quarter into next quarter",
  headline:"Mortgage relief has not made US housing affordable",
  why:"Freddie Mac's 30-year mortgage average was 7.24% on 29 October, down from 7.32% the prior week but well above 6.17% a year earlier. September housing starts were an annualised 1.221m, down 5.2% from August; existing-home sales improved 1.5% month on month to 3.99m but were still 2.2% below a year ago. These conditions justify a bearish affordability/activity reading, without implying lenders are in a demonstrated crisis.",
  supporting:"High mortgage borrowing costs relative to a year ago coincide with weaker construction starts and still-negative year-on-year existing-home sales.",
  opposing:"Weekly mortgage rates have eased 8bp, sales improved versus August, and limited available supply can stabilise prices despite low transaction volumes.",
  decidingTest:"Require several months of lower mortgage rates, improving starts/sales and resilient household debt-service performance before upgrading. For contagion, separately verify delinquencies, bank charge-offs and CRE exposures.",
  reviewedAt:"2026-10-30",
  evidenceStatus:"Latest Freddie Mac survey, US Census starts and NAR sales reports all original and dated; credit-contagion assertion not established.",
  sources:[
   {name:"Freddie Mac weekly mortgage rates",url:"https://www.freddiemac.com/pmms",asOf:"29 Oct 2026",kind:"PRIMARY"},
   {name:"US Census September housing starts",url:"https://www.census.gov/economic-indicators/2026-calendar-listview.html",asOf:"20 Oct 2026 release",kind:"PRIMARY"},
   {name:"NAR September existing-home sales",url:"https://www.nar.realtor/newsroom/existing-home-sales-increased-1-5-in-september-according-to-nar-report",asOf:"13 Oct 2026",kind:"PRIMARY"},
  ]
 },
};

export function getLensOutlook(id:EditorialRegimeId):LensResearchOutlook{return LENS_RESEARCH_OUTLOOKS[id]}

/** Relative editorial opinion, not a numeric forecast or model confidence. */
export function outlookPosition(outlook:LensOutlook):1|3|5{
 return outlook==="BEARISH"?1:outlook==="BULLISH"?5:3;
}
export function confidenceSegments(confidence:LensConfidence):1|2|3{
 return confidence==="HIGH"?3:confidence==="MEDIUM"?2:1;
}
