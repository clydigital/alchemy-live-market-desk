import type {EditorialRegimeId} from "./bluebelly-editorial-architecture.ts";

/** Source-dated public editorial follow-ups, reviewed after the original morning
 * Regime Watch assessment. Values from independent market reporters, licensed
 * provider readings and automated chart proxies MUST retain their distinctions.
 * This is not a live price feed or a System-2/Regime publication writer.
 */
export type RegimeEditorialUpdate=Readonly<{
 lens:EditorialRegimeId;
 title:string;
 asOf:string;
 headline:string;
 story:string;
 confirmation:string;
 dissent:string;
 nextTest:string;
 evidence:readonly {name:string;value:string;at:string;scope:string;url:string;sourceType:"ORIGINAL"|"DATA_VENDOR"|"REPORTING"|"TECHNICAL_PROXY"}[];
 freshness:"DATED_SESSION"|"PROXY_QUALIFIED";
}>;

export const REGIME_EDITORIAL_SWEEP_REVIEWED_ON="2026-10-30" as const;
export const REGIME_EDITORIAL_SWEEP_VERSION="bluebelly/regime/post-boj-crossasset/2026-10-30/2" as const;
export const REGIME_EDITORIAL_UPDATES:Readonly<Partial<Record<EditorialRegimeId,RegimeEditorialUpdate>>>={
 yen:{
  lens:"yen",title:"BoJ decision versus the actual yen response",asOf:"30 Oct 2026 · Asia session; pre-Ueda press conference",
  headline:"The yen has strengthened, but two forces are helping it.",
  story:"The BoJ did not raise rates today. It held at 1.25% by an 8–1 vote, with Hajime Takata arguing for 1.50%. Its inflation forecast moved higher and the bank kept the door open to future hikes. That is a more hawkish pause than the word ‘hold’ suggests. Reuters observed USD/JPY at 157.115 in the Asian session, while the dollar was also pressured by falling US yields and technology-stock risk aversion. So the yen's move is real, but giving the BoJ sole credit would be a mistake.",
  confirmation:"A Reuters-dated USD/JPY reading near 157.115 and the official 1.25%/8–1 policy outcome support the bullish-yen fundamental call. A separate FX vendor observation near 157.305 at 04:21 UTC shows the pair can rebound within the same session; these are different clocks, not one fixed quote. A fully closed 28 Oct daily USD/JPY candle was 157.810; a vendor-close EMA20 computed from 193 sessions was about 157.730 and EMA50 about 157.930. The 30 Oct spot reading is below those reference bands, but this is a cross-date comparison, not a completed 30 Oct daily bar.",
  dissent:"Falling US yields and risk aversion can drive USD/JPY without any yen-carry liquidation. Technical cross-checks before the BoJ differed, and provider FX daily bars dated 29–30 Oct contain sparse/partial observations. Do not advertise a certified post-decision 4H close or a confirmed carry unwind.",
  nextTest:"Reconcile closed 4H bars after the announcement (4H 20/50 EMA and ±1 standard deviation), 30 Oct completed daily USDJPY/DXY candles, JGB 2Y/10Y and USD–JPY cross-currency basis. A sustained recovery above the cited 157.7–157.9 daily reference area would weaken the immediate JPY-bullish interpretation.",
  freshness:"PROXY_QUALIFIED",
  evidence:[
   {name:"BoJ announcement","value":"Policy held 1.25%, vote 8–1; Takata preferred 1.50%",at:"30 Oct, Japan meeting",scope:"Original release listing plus Reuters meeting report",url:"https://www.boj.or.jp/en/mopo/mpmdeci/state_2026/",sourceType:"ORIGINAL"},
   {name:"USD/JPY after policy","value":"157.115 JPY per USD",at:"30 Oct, Reuters Asia-session reporting",scope:"Dated FX quote; not a 5-minute attribution window",url:"https://www.reuters.com/world/asia-pacific/yen-steady-before-boj-ai-jitters-drive-treasury-rally-weigh-dollar-2026-10-30/",sourceType:"REPORTING"},
   {name:"FX vendor later quote","value":"157.305 JPY per USD",at:"30 Oct 04:21 UTC",scope:"FMP USDJPY quoted snapshot; later than Reuters, not a candle close",url:"https://financialmodelingprep.com/developer/docs",sourceType:"DATA_VENDOR"},
   {name:"USDJPY prior completed daily","value":"28 Oct close 157.810; calculated EMA20 ~157.730, EMA50 ~157.930",at:"28 Oct daily close; 193 vendor sessions since Feb 2026",scope:"FMP spot-pair daily series; cross-date reference, NOT 30 Oct completed candle",url:"https://financialmodelingprep.com/developer/docs",sourceType:"DATA_VENDOR"}
  ]
 },
 gold:{
  lens:"gold",title:"Gold: real yields, positioning and the broken recovery",asOf:"30 Oct 2026 · Asia-session spot / 29 Oct US Treasury close",
  headline:"Gold is still weak even when yields retreat. The chart and flows deserve a separate test.",
  story:"Gold's retreat toward $4,000 is not simply an inflation hedge failing. September CPI rose 3.7% year on year, and the Fed held 3.75–4.00% on 28 October with two members favouring a hike. That makes high real yields a serious opportunity cost: the 10-year TIPS yield was 2.63% on 29 October, versus 2.67% on the 28th, while the 10-year breakeven edged down from 2.38% to 2.35%. Yet spot gold fell on 29 October despite this easing and a softer dollar, and Reuters reported about $3,997 on 30 October. The missing link is positioning and the damaged price trend: selling, ETF withdrawals or liquidity needs may be overpowering a normally helpful yield move. Those are candidates, not observed trader identities.",
  confirmation:"Dated futures proxies still signal weakness, but each instrument must be kept separate. On the 29 October 23:07 UTC 4H Binance-futures proxy, price was below EMA20 (~$4,044) and EMA50 (~$4,067); its daily proxy was below EMA20 (~$4,104) and EMA50 (~$4,187). A separate FMP GCUSD daily futures series through 29 October showed a $4,031.4 close below EMA20 (~$4,131) and EMA50 (~$4,224). January's spot record near $5,595 was followed by a 30 January plunge of roughly 9.5% in Reuters reporting, supporting a broken-momentum context rather than a fresh price breakout. These are not interchangeable spot-chart entry levels.",
  dissent:"A weak near-term price chart does not erase reserve diversification. The World Gold Council measured 288.9 tonnes of official-sector net buying in Q2 2026, up 62% year on year, without implying a hard floor under the market. Gold also rose in parts of 2024–25 while real yields were elevated, so 'gold always follows real yields' is too absolute. Creator historical recovery windows and weekly levels in the supplied transcripts are hypotheses, not independently validated forecasts or spot 1SD bands. A safe-haven bid or policy pivot could reverse the technical setup. The futures readings are NOT a certified single-feed spot 4H/1D signal.",
  nextTest:"First check completed spot XAU/USD 4H, daily and weekly closes against its own 20/50 EMA ±1SD bands, with matched 10Y TIPS real yields (DFII10), breakevens (T10YIE), DXY, ETF holdings, CFTC futures positioning and gold-miner relative strength. Separate inflation-driven real-yield pressure from gold weakening even as real yields fall. If spot stabilises and reclaims its own trend bands with improving flows, downgrade the bearish call; if a verified weekly support break persists while the S&P remains resilient, the longer-trap risk strengthens. Do not use creator-quoted price levels as current execution signals without a single verified chart feed.",
  freshness:"PROXY_QUALIFIED",
  evidence:[
   {name:"Fed hold and two hike dissents",value:"Held 3.75–4.00%; Cook and Hammack preferred +25bp",at:"28 Oct 2026, 14:00 ET",scope:"Official FOMC policy statement; not a December decision",url:"https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm",sourceType:"ORIGINAL"},
   {name:"September US CPI",value:"3.7% YoY; gasoline +9.1% MoM",at:"14 Oct 2026, 08:30 ET",scope:"Official BLS CPI; not a real-yield observation",url:"https://www.bls.gov/news.release/cpi.nr0.htm",sourceType:"ORIGINAL"},
   {name:"10Y inflation breakeven",value:"29 Oct 2.35%; 28 Oct 2.38%",at:"29 Oct US market observation",scope:"FRED T10YIE; nominal-minus-TIPS proxy includes risk and liquidity premia",url:"https://fred.stlouisfed.org/series/T10YIE",sourceType:"DATA_VENDOR"},
   {name:"10Y Treasury real yield",value:"29 Oct 2.63%; 28 Oct 2.67% (−4bp)",at:"29 Oct US market close",scope:"Original US Treasury daily par real yield curve; FRED DFII10 cache can lag",url:"https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?field_tdr_date_value_month=202610&type=daily_treasury_real_yield_curve",sourceType:"ORIGINAL"},
   {name:"Gold spot snapshot",value:"About $3,997; −0.6% at Reuters snapshot",at:"30 Oct 2026 Asian session",scope:"Reuters spot XAU/USD quote; NOT FMP/Binance futures close",url:"https://www.reuters.com/world/india/gold-slips-higher-oil-us-inflation-data-bolster-fed-hike-bets-2026-10-30/",sourceType:"REPORTING"},
   {name:"Q2 official reserve demand",value:"288.9 tonnes net purchases; +62% YoY",at:"30 Jul 2026 release covering Q2",scope:"World Gold Council Gold Demand Trends; longer-horizon reserve demand, not a spot-price floor",url:"https://www.gold.org/goldhub/research/gold-demand-trends/gold-demand-trends-q2-2026/central-banks",sourceType:"ORIGINAL"},
   {name:"Gold 4H technical proxy",value:"4H down; EMA20 ~$4,044; EMA50 ~$4,067",at:"29 Oct 23:07 UTC provider snapshot",scope:"MakeEA Binance gold futures; NOT certified spot XAU/USD EMA/SD",url:"https://makeea.com/markets/xauusd",sourceType:"TECHNICAL_PROXY"},
   {name:"Independent daily futures proxy",value:"29 Oct GCUSD $4,031.4; computed EMA20 ~$4,131; EMA50 ~$4,224",at:"29 Oct completed futures day",scope:"FMP futures series, not same contract as Reuters spot",url:"https://financialmodelingprep.com/developer/docs",sourceType:"DATA_VENDOR"}
  ]
 },
 breadth:{
  lens:"breadth",title:"The market is broader than the Nasdaq headline",asOf:"29 Oct 2026 · completed US cash session; credit through 28 Oct",
  headline:"A weak Nasdaq disguised a broad rally—not a credit panic.",
  story:"The Nasdaq fell around 1.4% after Alphabet's selloff. Yet the average US stock did much better. A market breadth monitor counted 406 S&P constituents up and 97 down, and Russell 2000 gained about 1%. Equal-weight RSP rose around 1.20% while cap-weight SPY lost about 0.38%. That is what rotation looks like: a few giants drag down the index while many smaller holdings advance. The distinction matters before labelling one technology shock a whole-market breakdown.",
  confirmation:"Breadth across the monitored S&P constituent set finished 406 advancing versus 97 declining, and 63.6% were above their own 50-day averages, up from 57.3% a session earlier. Another source reported 60% of 4,555 eligible US common stocks advanced. ICE BofA US high-yield OAS was 3.14% on 28 Oct versus 3.18% on 27 Oct, so the latest available dated spread sample had tightened rather than blown out.",
  dissent:"High-yield OAS is lagged one US session behind 29 Oct breadth, so the two readings cannot establish a same-moment credit reaction. The 63-session advance share of the broader 4,555-stock universe was just 47.6%, showing that one strong day does not yet prove persistent participation. Mega-cap AI valuations and private AI-funding risks remain distinct problems.",
  nextTest:"Verify 30 Oct US cash-close breadth after the session happens, RSP/SPY 3–5-session relative return, 20/50/200-day participation and next published ICE high-yield and IG spreads. A broad fall in advancers while OAS widens would reverse the bullish breadth argument.",
  freshness:"DATED_SESSION",
  evidence:[
   {name:"S&P breadth by constituent","value":"406 advancers / 97 decliners; 63.6% above 50DMA",at:"29 Oct US close",scope:"Secondary 503-issue basket; constituent-based universe documented",url:"https://deanfi.com/insights/marketpulse/2026-10-29/",sourceType:"REPORTING"},
   {name:"Equal-weight versus mega-cap","value":"RSP +1.20%; SPY −0.38%; 9 of 11 sectors up",at:"29 Oct US close",scope:"Separate price-based ETFs and sector observations",url:"https://stocks.pkladog.com/reports/2026-10-29/",sourceType:"DATA_VENDOR"},
   {name:"Broader US equity universe","value":"2,735 advancers vs 1,707 decliners; ~60% advanced",at:"29 Oct US close",scope:"4,555 eligible common shares; distinct universe from S&P set",url:"https://www.thetrading.tools/advance-decline-line",sourceType:"DATA_VENDOR"},
   {name:"High-yield OAS prior session","value":"3.14% (314bp), down 4bp from 27 Oct",at:"28 Oct US close, not 29 Oct",scope:"ICE BofA series BAMLH0A0HYM2 via date-specific FRED mirror; licensing applies",url:"https://equibles.com/economicdata/bamlh0a0hym2/2026-10-28",sourceType:"DATA_VENDOR"}
  ]
 },
 bonds:{
  lens:"bonds",title:"The Treasury rally is not the same as cheaper credit",asOf:"29 Oct 2026 US Treasury close / 30 Oct Asia reporting",
  headline:"Both nominal and real US yields fell. Inflation did not vanish.",
  story:"The 10-year Treasury yield fell from 5.05% on 28 October to 4.98% on the 29th. A saved Treasury real-curve series shows the matching inflation-adjusted 10-year yield falling from 2.67% to 2.63%. The simple matched nominal-minus-real difference narrowed from 2.38 to 2.35 percentage points. This means government-bond prices rallied in spite of sticky inflation, but it does not mean markets suddenly expect easy money or that a debt-laden AI project can borrow at sovereign rates.",
  confirmation:"The 2Y nominal yield also slipped 4.67% to 4.61% on 29 Oct, supporting a broad Treasury rally. Reuters later reported further safe-haven buying in the Asian session. A separately dated ICE high-yield OAS reading through 28 Oct was tightening, not flashing a system-wide public high-yield panic.",
  dissent:"The 29 Oct Treasury curve is a US indicative close before Amazon's after-hours earnings. The 30 Oct Reuters quote is an intraday Asian mark, not that same Treasury settlement. Real-yield data from an independent Treasury-derived history is not an official feed readback in this audit; breakeven is only a simple yield difference, not a direct market inflation-expectations survey or term premium.",
  nextTest:"Read the next official Treasury real/nominal close, auction receipts and the next dated ICE OAS observation, and distinguish easing driven by lower expected rates from term-premium moves. A 10Y yield rebound above the 5.05% reference close would challenge the immediate Treasury-price bullish view.",
  freshness:"DATED_SESSION",
  evidence:[
   {name:"US Treasury par yield curve","value":"2Y 4.61% (−6bp), 10Y 4.98% (−7bp)",at:"29 Oct US indicative ~15:30 ET",scope:"Official US Treasury daily nominal series; before AMZN after-hours report",url:"https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value_month=202610",sourceType:"ORIGINAL"},
   {name:"10Y real yield (saved Treasury observation)","value":"29 Oct 2.63% vs 28 Oct 2.67%; simple 10Y breakeven 2.35% vs 2.38%",at:"29 Oct saved observation",scope:"Treasury-source history mirrored by independent provider, not live FRED readback",url:"https://tipsyield.com/30-year-tips-yield",sourceType:"DATA_VENDOR"},
   {name:"30 Oct Treasury safe-haven move","value":"US long yields declined further in early Asia",at:"30 Oct Reuters Asia session",scope:"Journalistic market mark; not 29 Oct Treasury settlement",url:"https://www.reuters.com/world/asia-pacific/yen-steady-before-boj-ai-jitters-drive-treasury-rally-weigh-dollar-2026-10-30/",sourceType:"REPORTING"}
  ]
 },
 fed:{
  lens:"fed",title:"The dollar is reacting differently from the Fed's inflation problem",asOf:"29 Oct 2026 DXY close / 30 Oct 2026 Asia session",
  headline:"A hawkish Fed story can coexist with a weaker dollar.",
  story:"September headline PCE at 3.6% and two Fed hike dissents still argue against a rapid return to easing. Yet the dollar index slipped from 102.19 on 28 October to 102.04 on the 29th, while a 30 October intraday quote was around 101.72. That is not evidence that inflation disappeared. Relative yields, technology-stock flight-to-safety into Treasuries and the hawkish BoJ provide competing reasons for the dollar to weaken even as the Fed stays restrictive.",
  confirmation:"Two successive dated DXY declines accompany the latest bond rally and a post-BoJ yen bid. That specifically challenges the oversimplified claim that sticky PCE must lift DXY immediately.",
  dissent:"The 30 Oct DXY value is an intraday mark, not a completed daily candle, and no aligned DXY 4H 20/50/100/200 EMA plus 1SD calculation from an admissible complete data series was obtained. A bearish DXY technical break-and-hold is not certified by two lower daily prints alone.",
  nextTest:"Use same-source DXY 4H/daily closed bars to check the 20 EMA ±1SD bands, and reconcile dated Fed OIS, 2Y yields and BoJ/JPY response. Treat the Fed policy outlook and DXY price trend as separate, potentially divergent calls.",
  freshness:"DATED_SESSION",
  evidence:[
   {name:"DXY last completed sessions","value":"28 Oct 102.19; 29 Oct 102.04",at:"29 Oct daily close",scope:"Investing.com historical price series",url:"https://www.investing.com/indices/usdollar-historical-data?cid=1224074",sourceType:"DATA_VENDOR"},
   {name:"DXY 30 Oct intraday","value":"~101.72, −0.31% versus prior session",at:"30 Oct intraday, update time on provider page",scope:"Not a completed 30 Oct close or 4H EMA",url:"https://www.investing.com/indices/usdollar-historical-data?cid=1224074",sourceType:"DATA_VENDOR"},
   {name:"US inflation and Fed policy","value":"September headline PCE +3.6% YoY; Fed hold 3.75–4.00%",at:"29 Oct BEA / 28 Oct FOMC originals",scope:"Policy fundamentals, not a contemporaneous DXY technical signal",url:"https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026",sourceType:"ORIGINAL"}
  ]
 }
};

export function getRegimeEditorialUpdate(lens:EditorialRegimeId):RegimeEditorialUpdate|null{
 return REGIME_EDITORIAL_UPDATES[lens]??null;
}
