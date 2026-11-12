import type {NewsBriefV1} from "./market-brief-news.ts";
import type {MarketImpactFramework} from "./bluebelly-editorial-market-framework.ts";

/**
 * Publicly checked, dated analysis overlays on existing SOURCE_VERIFIED news.
 * Overlays improve reading depth, never promote intake/Notion notes into
 * canonical Story or Regime evidence. Never call an LLM from a public GET.
 */
export type EvidenceItem={
  label:string;
  baseline:string;
  expected:string;
  observed:string;
  change:string;
  basis:string;
  sourceName:string;
  sourceUrl:string;
};
export type PublicStoryDepth={
  edition:string; eventAt:string; topic:string; title:string; hook:string; lead:string;
  chronology:readonly string[];
  numbers:readonly EvidenceItem[];
  whatChanged:readonly string[];
  explanation:readonly string[];
  countercase:readonly string[];
  marketTape:readonly string[];
  theQuestion:string; nextTests:readonly string[];
  missing:readonly string[];
  sources:readonly {label:string;url:string;role:string}[];
  relatedHref?:string;
  /** Explicit source-checked market interpretation, not automatic headline sentiment. */
  impact?:MarketImpactFramework;
  /** Optional original-source-checked, article-specific teaching notes.
   * Not a blanket source-verified economic conclusion or Regime change. */
  concepts?:readonly {term:string;meaning:string;marketUse:string}[];
  decisionSignals?:readonly {
    decision:string;signal:string;meaning:string;efficiency:string;
    supplyDemand:string;uncertainty:string;confirmation:string;
  }[];
};
const FED="https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm";
const PRIOR="https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm";
const TREASURY="https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value_month=202610";
const REUTERS_EXPECTATION="https://www.reuters.com/business/fed-likely-go-into-wait-and-see-mode-rates-2026-10-28/";
const REUTERS_REACTION="https://www.reuters.com/business/view-fomc-holds-rates-steady-markets-mostly-follow-suit-2026-10-28/";

/** Frozen publication context, with independently dated public original sources.
 * The vote, direction and time are not derived from the event headline.
 */
export const OCTOBER_FED_DEPTH:PublicStoryDepth={
 edition:"29 October 2026 · post-statement editorial · not a live market quote",
 eventAt:"2026-10-28T18:00:00.000Z",
 topic:"US monetary policy and Treasury funding",
 title:"The Fed held rates. The real change was inside the vote.",
 hook:"Markets largely expected no move. Two officials wanted higher rates anyway, and the Fed quietly strengthened its description of the economy.",
 lead:"Imagine a business asking its bank whether financing is about to get cheaper. The bank holds the rate unchanged, but two members of its committee want to raise it and the committee now says the economy is stronger than previously described. The cost today is unchanged; the likelihood of tomorrow's decision may not be.",
 chronology:[
  "16 September: the FOMC voted 12–0 to raise its target by 25 basis points to 3.75–4.00%. It described US growth as 'solid', and said the hike should support a timely inflation return.",
  "Before 14:00 ET on 28 October: investors widely expected a hold. Reuters' pre-release reporting described roughly 90% implied probability of no change. That probability is a reported market estimate, not a futures strip Bluebelly independently reconstructed.",
  "14:00 ET on 28 October: the Fed kept rates at 3.75–4.00%, this time by a 10–2 vote. Lisa Cook and Beth Hammack preferred a 25-basis-point hike. The statement upgraded growth language to 'strong' and emphasised gathering further information.",
  "Later in the afternoon: investors processed the statement and Warsh's press conference. An initial yield move and the final Treasury curve need separate timestamps; an entire session's repricing cannot be attributed to a single sentence."
 ],
 numbers:[
  {label:"Federal funds target range",baseline:"3.75–4.00% after September hike",expected:"Hold widely priced (~90% in Reuters' pre-release account)",observed:"3.75–4.00% · HOLD",change:"0 basis points; the hold itself was broadly expected",basis:"Rate range / before versus after policy action",sourceName:"Federal Reserve October statement; Reuters expectations",sourceUrl:FED},
  {label:"Committee vote",baseline:"12–0 in September, unanimously in favour of a hike",expected:"Exact October split not established in the frozen pre-release research",observed:"10–2 · Cook and Hammack favoured +25bp",change:"Two officials dissented; their preferred action was a hike",basis:"Different meeting decisions: compare the stance, not simply 12 versus 10",sourceName:"Federal Reserve September and October statements",sourceUrl:FED},
  {label:"Activity assessment",baseline:"September: growth expanding at a 'solid' pace",expected:"No sourced single-line wording consensus",observed:"October: growth expanding at a 'strong' pace",change:"Policy language upgraded despite unchanged rate",basis:"Statement-to-statement textual comparison",sourceName:"Federal Reserve original statements",sourceUrl:PRIOR},
  {label:"2Y Treasury close",baseline:"28 Oct previous close approx. 4.70%",expected:"Not an economist consensus release",observed:"4.67% on 28 Oct",change:"−3bp versus prior Treasury observation",basis:"Treasury daily par yield, NOT a minute-by-minute Fed event window",sourceName:"US Treasury",sourceUrl:TREASURY},
  {label:"10Y Treasury close",baseline:"28 Oct previous close approx. 4.99%",expected:"Not an economist consensus release",observed:"5.05% on 28 Oct",change:"+6bp versus prior Treasury observation",basis:"Treasury daily par yield, not a clean 14:00 ET reaction",sourceName:"US Treasury",sourceUrl:TREASURY},
  {label:"30Y Treasury close",baseline:"28 Oct previous close approx. 5.30%",expected:"Not an economist consensus release",observed:"5.37% on 28 Oct",change:"+7bp versus prior Treasury observation",basis:"Treasury daily par yield, not a clean 14:00 ET reaction",sourceName:"US Treasury",sourceUrl:TREASURY}
 ],
 whatChanged:[
  "The important result was not the unchanged policy range. It was the combination of two hike dissents, a stronger assessment of activity and an inflation outlook that remains uncomfortable.",
  "The Fed did not publish an October Summary of Economic Projections or a new dot plot. The decision alone therefore does not establish the probability of a December hike.",
  "The difference from September is subtle but consequential: September's rate increase was unanimous; October's pause was opposed by members who thought borrowing costs should already be higher."
 ],
 explanation:[
  "Short-term Treasuries usually respond to the expected path of Fed policy. Long-dated yields also reflect inflation, fiscal supply and the term premium. That is why a hold can coexist with a steeper curve.",
  "A steeper curve raises the question of how companies with large financing and refinancing bills will cope. For Amazon and other AI infrastructure buyers, examine operating cash after capex and their own bond spreads. A higher Treasury yield by itself is not proof of company-specific credit stress.",
  "Gold and the dollar may respond to expected real interest rates and relative yields. Those mechanisms are conditional until matched gold, DXY and Treasury price observations are available."
 ],
 countercase:[
  "An expected hold is not necessarily a hawkish surprise. Investors can weigh Warsh's remarks, softer future inflation or concern about slowing growth against the two dissenters.",
  "The 10-year yield's same-day increase is not evidence that the vote caused it. Oil prices, Treasury supply, global rates and positioning may also influence the session. Real causality needs a comparable observation window."
 ],
 marketTape:[
  "Official 28 October Treasury daily readings: 2Y 4.67% (−3bp on the day), 10Y 5.05% (+6bp), 30Y 5.37% (+7bp). The 30Y–2Y difference rose to approximately 70bp from around 60bp.",
  "Reuters' later reaction account described modest US equity gains and a softer dollar. These are attributed afternoon snapshots, not an independently calculated event-study reaction.",
  "Do not mix a market price measured at 14:05 ET with one recorded after the press conference or at the Treasury's indicative end-of-day observation."
 ],
 theQuestion:"If policy stayed unchanged, why did the bond market's longer end get more expensive for borrowers?",
 nextTests:[
  "Reconcile the next PCE/inflation readings, jobs and ISM against the Fed's stated inflation and employment concerns.",
  "Freeze the November/December implied Fed path from a named, timestamped futures/OIS series before stating a probability or a change in probability.",
  "Compare the 2Y, 10Y and 30Y after the announcement with truly matched pre-decision and post-press-conference observations, not unaligned daily closes.",
  "Inspect corporate bond spreads and the AI infrastructure companies' debt maturities before calling the move a funding shock."
 ],
 missing:[
  "No independently retrieved, timestamp-matched 5-minute/30-minute DXY, gold, Treasury futures and front-end yield study around 14:00/14:30 ET.",
  "No directly observed Fed-funds futures/OIS strip to validate the reported pre-meeting ~90% hold pricing or to measure the December repricing.",
  "No same-tenor issuer credit-spread comparison proving that a specific corporate borrower was penalised."
 ],
 sources:[
  {label:"Federal Reserve · 28 October policy statement",url:FED,role:"Official decision, votes, growth language"},
  {label:"Federal Reserve · 16 September policy statement",url:PRIOR,role:"Previous decision, rate range and 12–0 comparison"},
  {label:"US Treasury · October 2026 yield curve",url:TREASURY,role:"Daily closing par yields, not a short-window event study"},
  {label:"Reuters · pre-decision pricing",url:REUTERS_EXPECTATION,role:"Attributed pre-event hold probability"},
  {label:"Reuters · afternoon reaction",url:REUTERS_REACTION,role:"Dated secondary reactions and opinions"}
 ],
 impact:{
  asOf:"2026-10-29",sourceUrl:FED,
  decisionSignal:"An expected Fed hold contained two votes for higher rates and firmer language on activity. The unchanged decision itself was not a surprise; the forward path remains disputed.",
  uncertaintyDirection:"MIXED",uncertaintyWhy:"The near-term policy rate was settled, reducing uncertainty for that meeting, but two hike dissents keep the next decision and inflation reaction unsettled. A vote split does not quantify a probability.",
  assetValence:"MIXED_BY_EXPOSURE",beneficiaries:"Cash yields and interest income can remain attractive if short rates stay restrictive; the exact beneficiaries depend on balance-sheet duration and funding mix.",
  pressured:"Leveraged and long-duration borrowers face potential refinancing costs if yields stay elevated; no issuer-specific credit penalty has been measured.",
  supplyEffect:"Higher risk-free yields may restrain new borrowing, investment and housing supply over time, not directly change today's physical goods supply.",
  demandEffect:"Restrictive credit can moderate interest-sensitive spending; a firmer economy may keep underlying demand resilient.",
  financingEffect:"The 2Y and long-end yields respond to different expectations, inflation and term premiums. A change in the longer end is not automatically caused by the Fed vote.",
  expectedReaction:"Relative to a neutral hold, unexpectedly hawkish communication would conventionally support front-end yields and the dollar and weigh on duration-sensitive assets.",
  observedReaction:"The official 28 October 2Y reading fell 3bp while 10Y and 30Y yields rose 6bp and 7bp; these are daily observations, not a controlled Fed event-window study.",
  tapeStatus:"DATED_NOT_CAUSAL",divergence:"MIXED",
  alternative:"Previously priced policy, term premiums, supply and commodity developments may explain different yield directions.",
  nextTest:"Freeze same-clock Treasury futures/OIS, DXY and gold observations and upcoming CPI/PCE before assigning a causal or directional verdict."
 },
 relatedHref:"?feature=fomc-october-2026",
};


const JOLTS_BLS="https://www.bls.gov/news.release/archives/jolts_11032026.htm";
const JOLTS_PREVIEW="https://bofa-equities.econoday.com/byshoweventarticle?cust=bofa-equities&fid=708820&lid=0&year=2026";
const JOLTS_REUTERS="https://www.reuters.com/business/us-job-openings-increase-sharply-september-2026-11-03/";
const JOLTS_MARKETWATCH="https://www.marketwatch.com/livecoverage/stock-market-today-dow-s-p-500-nasdaq-us-midterm-elections-loom-amd-earnings-results/card/treasury-yields-remain-higher-after-u-s-job-openings-jump-sharply-in-september-E9xfyoipMtj6ZDutFlbC";

/**
 * The original source-only JOLTS record was reviewed again on 5 November
 * after the public reader exposed an unfinished comparison. Keep the event's
 * exact identity and distinguish retrospectively recovered pre-release
 * published expectations from a desk-frozen forecast or event-window tape.
 * This is a dated human-reviewed reader pack, not a canonical Motion verdict.
 */
export const SEPTEMBER_JOLTS_DEPTH:PublicStoryDepth={
 edition:"5 November 2026 · retrospective research recovery · source-dated, not live",
 eventAt:"2026-11-03T15:00:00.000Z",
 topic:"US labour market, Fed policy and Treasury yields",
 title:"Job Openings Beat Expectations. Is the US Labour Market Tightening Again?",
 hook:"US employers listed 7.523 million openings in September, almost 389,000 more than an independently published pre-release forecast. But the more revealing tension is that quits also rose while hiring remained subdued.",
 lead:"A business may advertise more jobs without filling them. September openings rose by 333,000 from a revised August figure, voluntary departures climbed and layoffs eased. That combination looks more resilient than a labour market on the brink of contraction, but it does not establish another hiring boom. The November 3 release arrived amid election-driven moves and other macro catalysts.",
 chronology:[
  "2 November: Econoday published a 7.134 million JOLTS openings consensus for September, with a forecast range of 7.060–7.225 million. This pre-release publication was recovered retrospectively, not captured in Bluebelly's database before release.",
  "3 November, 10:00 EST / 23:00 MYT: BLS released 7.523 million September job openings. August was revised up to 7.190 million from 7.079 million; September exceeded the revised August figure by 333,000.",
  "3 November session: MarketWatch/FactSet reported the 10-year Treasury yield up six basis points to 4.961%. This is a reported session snapshot, not a measured 10:00–10:30 EST JOLTS response.",
 ],
 numbers:[
  {label:"September job openings",baseline:"August 7.190M, revised from 7.079M",expected:"Econoday 2 Nov survey: 7.134M",observed:"7.523M",change:"+0.389M versus Econoday; +0.333M month on month",basis:"Seasonally adjusted openings, millions; pre-release external survey verified retrospectively, NOT a desk-frozen forecast",sourceName:"BLS original; Econoday 2 Nov pre-release forecast",sourceUrl:JOLTS_PREVIEW},
  {label:"August revision",baseline:"Originally reported 7.079M",expected:"Not a forecast metric",observed:"Revised to 7.190M",change:"+0.111M revision",basis:"Same August reference period, new release vintage; not September growth",sourceName:"BLS · 3 November release",sourceUrl:JOLTS_BLS},
  {label:"Quits",baseline:"August revised 3.044M",expected:"Separate pre-release quits consensus not checked",observed:"September 3.365M",change:"+0.321M; quits rate rose to 2.1% from 1.9%",basis:"Seasonally adjusted voluntary separations, millions; not job openings",sourceName:"BLS · September JOLTS",sourceUrl:JOLTS_BLS},
  {label:"Layoffs and discharges",baseline:"August revised 1.768M",expected:"Separate survey not checked",observed:"September 1.641M",change:"−0.127M; rate 1.0% from 1.1%",basis:"Seasonally adjusted involuntary separations, millions",sourceName:"BLS · September JOLTS",sourceUrl:JOLTS_BLS},
  {label:"Hires",baseline:"August revised 5.271M",expected:"Separate pre-release hires consensus not checked",observed:"September 5.402M",change:"+0.131M; hires rate 3.4% from 3.3%",basis:"Seasonally adjusted hires, millions",sourceName:"BLS · September JOLTS",sourceUrl:JOLTS_BLS},
 ],
 whatChanged:[
  "The headline was not just 7.5 million openings. The BLS release reported 7.523 million, versus an Econoday forecast published the day before of 7.134 million and an upwardly revised August count of 7.190 million.",
  "Quits increased 321,000 while layoffs fell 127,000. Labour-market confidence may be firmer than the weak recent payrolls data alone suggested, but openings are vacancies, not new payroll jobs.",
  "Reuters separately reported a 7.100 million economist forecast, illustrating that survey providers differ. Do not silently treat Reuters and Econoday estimates as one universal consensus.",
 ],
 explanation:[
  "Employers demand labour when they have positions to fill, but a vacancy is not a hire. A labour market with modest payroll growth and stronger openings can reflect hiring frictions or hesitation rather than rapid employment expansion.",
  "More voluntary quits can indicate confidence in finding another job, while fewer layoffs support the 'low-hire, low-fire' interpretation. These are clues, not proof of faster wage growth or a Fed policy change.",
  "For rates, the conditional mechanism is stronger labour demand reducing the urgency of easier policy and potentially lifting short-dated yields. The dated 10-year yield report is an observation, not evidence that this exact mechanism drove Tuesday's entire bond move.",
 ],
 countercase:[
  "The survey counts unfilled positions and has a low response rate; its month-to-month estimates and revisions can be sizeable. The November reading may revise this September result.",
  "The improvement in quits was concentrated in accommodation and food services. One industry can disproportionately influence headline momentum.",
  "Treasury yields also reflect elections, fiscal funding, inflation, term premium and other releases. Do not attribute the full reported session rise to JOLTS without matched pre/post market data.",
 ],
 marketTape:[
  "MarketWatch, citing FactSet, reported that on 3 November the 10-year Treasury yield was six basis points higher at 4.961% and the 30-year yield was also up six basis points at 5.328%. These are dated session observations, not a controlled JOLTS event-window reaction.",
  "No independently retrieved, source-timed 09:55–10:05 / 10:30 EST US2Y, DXY, equity-futures or Fed-funds-futures comparison is included. An inferred dollar reaction or policy-probability change would be unsupported.",
 ],
 theQuestion:"If employers want more workers, why are hires still modest—and will stronger vacancies translate into pay pressure or just unfilled positions?",
 nextTests:[
  "Compare the 6 November October payrolls, unemployment and wage data with the September JOLTS quits and hires picture; do not equate JOLTS vacancies with realised employment.",
  "Watch the 10 November October CPI release and subsequently available inflation expectations before claiming the Fed's next decision changed.",
  "Recheck the September JOLTS vintage when BLS publishes its next revision. Record which figures were revised rather than editing historical values silently.",
  "If licensed intraday observations become available, compare identical instruments at pre-release and 5/30-minute post-release timestamps, separated from election-day drivers.",
 ],
 missing:[
  "No internally frozen and read-back pre-3 November JOLTS consensus snapshot. The Econoday survey was published on 2 November but recovered afterwards; it is not proof of Bluebelly's pre-release capture.",
  "No independent minute-matched US2Y, DXY or equity-futures JOLTS event study or causality estimate. MarketWatch's yield move is a dated session snapshot only.",
  "No independently measured pre/post announcement Fed-path futures repricing; stronger labour demand does not automatically establish a changed central-bank probability.",
 ],
 sources:[
  {label:"BLS · 3 November original release, tables and August revision",url:JOLTS_BLS,role:"Official actual, previous and components"},
  {label:"Econoday · 2 November pre-release consensus",url:JOLTS_PREVIEW,role:"Retrospectively recovered externally published pre-release forecast (7.134M)"},
  {label:"Reuters · 3 November labour-market analysis",url:JOLTS_REUTERS,role:"Separately attributed 7.100M Reuters consensus and labour-market interpretation"},
  {label:"MarketWatch / FactSet · dated 3 November Treasury session",url:JOLTS_MARKETWATCH,role:"Attributed session yield observations; not 10:00 EST event-window pricing"},
 ], impact:{
  asOf:"2026-11-05",sourceUrl:JOLTS_BLS,
  decisionSignal:"Advertised US job openings exceeded an independently published forecast, while quits rose and layoffs declined. This signals more resilient labour demand but not a new surge in actual hiring.",
  uncertaintyDirection:"MIXED",uncertaintyWhy:"Stronger vacancies reduce some immediate employment-collapse worries, but the survey's revisions and modest hiring leave wage and Fed-policy implications unresolved.",
  assetValence:"MIXED_BY_EXPOSURE",beneficiaries:"Employment-sensitive businesses may benefit if vacancies translate to actual hires and household income.",
  pressured:"Rate-sensitive borrowers and long-duration equities could face pressure if confirmed labour strength changes the expected Fed path.",
  supplyEffect:"Vacancies represent unfilled labour positions, not increased labour supply or production capacity until hiring occurs.",
  demandEffect:"Potential employment and wage income can support consumption; higher openings alone do not prove spending growth.",
  financingEffect:"Stronger labour data could reduce expectations of easier policy and raise borrowing costs, but that transmission is not established by the observed session yield alone.",
  expectedReaction:"A clear upside jobs-demand surprise would ordinarily put upward pressure on front-end yields if it changed the policy path.",
  observedReaction:"A secondary 3 November report described higher Treasury yields during the session, without a timestamp-matched 10:00 ET JOLTS event study.",
  tapeStatus:"DATED_NOT_CAUSAL",divergence:"MIXED",
  alternative:"Election headlines, inflation risk, positioning and the Treasury term premium may also explain the session.",
  nextTest:"Measure matched pre/post-JOLTS US2Y and DXY; compare later payrolls, hires, quit-rate revisions and actual Fed-funds expectations."
 },
};

const NOV_EIA="https://www.eia.gov/pressroom/releases/press594.php";
const NOV_EIA_NATGAS="https://www.eia.gov/outlooks/steo/report/natgas.php";
const NOV_EIA_REPORT="https://www.eia.gov/outlooks/steo/";

export const NOVEMBER_EIA_GAS_DEPTH:PublicStoryDepth={
 edition:"12 November 2026 · primary-source editorial research; forecast vintage 10 November, compiled 5 November",
 eventAt:"2026-11-10T17:00:00.000Z",
 topic:"US gas supply versus global fuel inflation",
 title:"US Natural Gas Gets Cheaper. Why Is Diesel Still Expensive?",
 hook:"A warm November has given America more gas for winter and lowered the EIA's Henry Hub outlook. Yet the same report warns that global diesel and other refined fuels could remain tight through 2027.",
 lead:"The EIA expects 3,840 billion cubic feet in US natural gas storage at the end of November, 67 Bcf more than it estimated a month ago. With less heating demand, it now forecasts an average Henry Hub price of $2.87 per million Btu from November through March, down 16% from its previous outlook. Cheaper domestic gas is not the same as cheaper fuel everywhere.",
 chronology:[
  "5 November: the EIA completed its November forecast, using an assumption that US November heating-degree days would be 13% below the 10-year average. This is a weather/forecast assumption, not the final month's observed temperature.",
  "10 November: the EIA published its Short-Term Energy Outlook and raised its forecast for end-November US working gas inventories by 67 Bcf to 3,840 Bcf.",
  "The same forecast continued to project global refined-product supply constraints through 2027, raised US 2027 retail diesel and petrol price forecasts, and expected additional US LNG export capacity to lift exports in 2027."
 ],
 numbers:[
  {label:"US gas storage, end November",baseline:"Prior October forecast approximately 3,773 Bcf",expected:"EIA's October forecast (not an external market consensus)",observed:"3,840 Bcf forecast",change:"+67 Bcf versus EIA's prior forecast",basis:"Forecast comparison, not an actual weekly EIA storage reading",sourceName:"EIA November STEO · natural gas",sourceUrl:NOV_EIA_NATGAS},
  {label:"Henry Hub, November–March average",baseline:"October winter forecast, implied approximately $3.42/MMBtu",expected:"No independently frozen futures-market expectation",observed:"$2.87/MMBtu forecast",change:"16% lower than October winter forecast; 36% below last winter",basis:"Forecast of monthly-average spot prices; not a spot quote",sourceName:"EIA November STEO · natural gas",sourceUrl:NOV_EIA_NATGAS},
  {label:"US retail diesel, 2027 average",baseline:"October STEO forecast: $4.49/US gallon",expected:"Earlier EIA forecast, not pre-release consensus",observed:"$5.03/US gallon forecast",change:"+$0.54/gal revision",basis:"2027 projection; different market from Henry Hub gas",sourceName:"EIA · 10 November press release",sourceUrl:NOV_EIA},
  {label:"US retail petrol, 2027 average",baseline:"October STEO forecast: $3.56/US gallon",expected:"Earlier EIA forecast, not pre-release consensus",observed:"$3.73/US gallon forecast",change:"+$0.17/gal revision",basis:"2027 projection; not November pump prices",sourceName:"EIA · 10 November press release",sourceUrl:NOV_EIA},
  {label:"US gross LNG exports",baseline:"Approximately 15 Bcf/day in 2025",expected:"EIA medium-term projection, not announced sales contracts",observed:"Approximately 19 Bcf/day in 2027",change:"+4 Bcf/day forecast increase versus 2025 level",basis:"Projected gross daily exports, dependent on capacity and operation",sourceName:"EIA November STEO",sourceUrl:NOV_EIA_REPORT}
 ],
 whatChanged:[
  "The warm start to November changed the US gas inventory and winter-price outlook. Higher expected storage means less immediate urgency to pay up for heating supply.",
  "The contradiction is in other fuels: the EIA revised next year's retail diesel and petrol forecasts higher because it still expects global refined-product supply constraints.",
  "US LNG exports are forecast to expand. Domestic Henry Hub pricing, international LNG pricing and diesel refining margins therefore need separate monitoring; they are not interchangeable energy indicators."
 ],
 explanation:[
  "Homes and businesses need less gas for heating when temperatures stay mild. More gas is left in storage, which can make near-term American natural gas cheaper. Gas-fired electricity generators may also benefit if that forecast becomes reality.",
  "Diesel is made from crude oil, not natural gas. Refinery capacity, shipping and available finished fuel can remain under pressure even while US gas storage improves. Higher diesel costs can continue to affect freight, farms and consumer prices.",
  "The difference between US Henry Hub and overseas LNG prices can encourage exports, subject to terminal capacity. Export growth could absorb some US supply over time; it does not cancel the EIA's near-term winter price projection."
 ],
 countercase:[
  "Winter weather can change quickly. A cold December or unusually high demand could reduce inventories and invalidate the softer gas-price outlook.",
  "The EIA's crude and fuel figures are forecasts, not realised market prices. Shipping disruption, refinery outages and demand surprises may move refined fuels differently from the central forecast.",
  "The 10 November press-release summary labels some annual forecast table values as draft/pending reconciliation. Use the detailed STEO for the cited winter gas figures, and refresh annual projections when EIA issues revisions."
 ],
 marketTape:[
  "The verified evidence establishes a revised EIA forecast, not an independently measured 5-minute, 30-minute or next-session Henry Hub, Brent, diesel or energy-stock reaction.",
  "Physical-market stress and financial-futures prices should be compared on matching observation dates before claiming that an oil or gas trade has changed."
 ],
 theQuestion:"Can cheaper US gas offset pressure from still-expensive diesel and global LNG?",
 nextTests:[
  "Compare each new EIA weekly working-gas storage release with the 3,840 Bcf end-November forecast and monitor revisions to heating-degree-day expectations.",
  "Track Henry Hub against TTF or Asian LNG benchmarks and actual LNG exports, recording contract units and dates.",
  "Compare Brent/WTI, ULSD diesel crack spreads, refinery utilisation and distillate stocks rather than assuming crude and products move together.",
  "Recheck the next STEO on 8 December 2026 before altering the longer-term energy-security regime."
 ],
 missing:[
  "No matched, independently verified Henry Hub or related-equity reaction immediately following the 10 November release.",
  "No contemporaneous futures consensus with comparable winter reference dates.",
  "No new canonical System 2 energy-regime adjudication for this event."
 ],
 sources:[
  {label:"EIA · 10 November 2026 original press release",url:NOV_EIA,role:"US inventory, natural-gas and refined-fuel forecasts"},
  {label:"EIA · November natural-gas STEO detail",url:NOV_EIA_NATGAS,role:"3,840 Bcf, +67 Bcf, winter $2.87/MMBtu and weather assumption"},
  {label:"EIA · full November STEO",url:NOV_EIA_REPORT,role:"Refined-product constraints and LNG export outlook"}
 ],
  concepts:[
  {term:"EIA / STEO",meaning:"The US Energy Information Administration publishes the Short-Term Energy Outlook (STEO), a monthly forecast of energy supply, use and prices. It is a forecast, not a purchase order or a new inventory measurement.",marketUse:"The surprise is the CHANGE in its outlook. Compare it with the previous forecast and the market's own pre-release pricing before calling it bullish or bearish."},
  {term:"Working gas, Bcf and heating-degree days",meaning:"Working gas is natural gas held in underground storage that operators can withdraw and sell. Bcf means billion cubic feet, a volume unit. Heating-degree days estimate how much heating buildings need: fewer days generally mean less fuel burned.",marketUse:"Warm weather usually reduces heating demand, leaving more gas in storage. This is a demand effect, not evidence that wells or power stations became more efficient."},
  {term:"Henry Hub / MMBtu",meaning:"Henry Hub is the US wholesale natural-gas pricing benchmark. MMBtu means one million British thermal units, a unit of energy. A $2.87/MMBtu winter forecast is not today's exact spot price.",marketUse:"Lower expected Henry Hub gas prices can reduce fuel costs for US gas-fired electricity and gas-intensive industries, but bills depend on contracts, network costs and timing."},
  {term:"LNG, liquefaction, TTF and JKM",meaning:"LNG is natural gas cooled to liquid form so ships can carry it overseas. Liquefaction takes energy and special export terminals. TTF is a European gas-price benchmark; JKM is an Asian delivered-LNG benchmark.",marketUse:"A large overseas price premium can encourage US LNG exports, increasing demand for American gas while adding potential supply for importing countries. Compare prices from the same date and contract month."},
  {term:"Diesel, ULSD and crack spread",meaning:"Diesel is a liquid transport fuel refined from crude oil, not natural gas. ULSD is ultra-low-sulphur diesel. A diesel crack spread is roughly the market price of diesel minus the cost of the crude used to make it; it helps indicate refining profitability.",marketUse:"Expensive diesel can reflect too little refined fuel even if crude falls or US gas becomes cheap. Strong crack spreads may encourage refineries to run harder, subject to capacity and crude grade."}
 ],
 decisionSignals:[
  {decision:"EIA raises expected November US gas storage",signal:"Near-term gas price relief; mixed for producers",meaning:"A warmer start to the month and growing US output are expected to leave more gas available for winter. The figure is a revised forecast, not barrels or molecules newly produced by the announcement.",efficiency:"Lower heating demand means less gas is consumed, not that a furnace has become more efficient. Power producers may pay less for fuel, but their generating efficiency has not automatically improved.",supplyDemand:"Demand for heating gas is lower than previously assumed while production keeps growing. Supply available relative to demand increases; that ordinarily weighs on Henry Hub. Consumers and gas-fired power buyers may benefit, but gas-producer margins can weaken.",uncertainty:"A cold snap, unexpected export flows or production outages could reverse the inventory cushion. The market may already have priced in the weather.",confirmation:"Check weekly EIA storage versus forecast, US production, weather revisions and Henry Hub futures on matched dates."},
  {decision:"EIA projects stronger LNG exports as overseas gas stays dear",signal:"Constructive for LNG export economics; mixed for US buyers",meaning:"Exporters have an incentive to liquefy US gas and sell to higher-priced markets, but only where terminals, ships and contracts allow it.",efficiency:"Higher terminal utilisation can spread fixed costs over more shipments; liquefaction and shipping still consume energy. No new improvement in physical conversion efficiency is proven.",supplyDemand:"Exports add demand for US gas, potentially lifting domestic prices relative to a no-export scenario. They also add available imported gas overseas, potentially easing international shortages once cargoes arrive. New capacity changes potential supply, not immediate deliveries.",uncertainty:"The global price premium, shipping/insurance risks, terminal constraints and US production can all change. The report does not establish a same-day Henry Hub–TTF spread.",confirmation:"Track LNG export volumes and utilisation, terminal start-ups and same-date Henry Hub versus TTF/JKM prices net of shipping and liquefaction."},
  {decision:"EIA raises next year's diesel and petrol forecasts",signal:"Inflation risk persists despite cheaper US gas",meaning:"Crude must be turned into diesel and petrol at refineries. A shortage of finished products can remain even if gas storage is comfortable.",efficiency:"More refinery throughput can spread costs, but cannot exceed physical capacity or solve shipping disruptions. Higher refining margins are not automatically better efficiency.",supplyDemand:"Tight refining and transport capacity restrain finished-fuel supply. If diesel demand stays firm, the imbalance supports diesel and freight costs and can add inflation pressure. The EIA's forecast revision is not an observed immediate pump-price change.",uncertainty:"Weak industrial/freight demand, improved shipping or new refinery output could lower product prices. Brent and diesel do not have to move together.",confirmation:"Monitor ULSD crack spreads, US distillate stocks, refinery utilisation, tanker/insurance conditions and next EIA diesel revisions."}
 ],
 impact:{
  asOf:"2026-11-12",sourceUrl:NOV_EIA_NATGAS,
  decisionSignal:"A warmer November changes the EIA's US gas-storage and winter-price forecasts; separately, globally tight diesel and refined fuels keep another inflation channel open.",
  uncertaintyDirection:"MIXED",uncertaintyWhy:"The new EIA forecast clarifies the current winter baseline and reduces near-term gas scarcity concern, but weather, shipping, overseas LNG and refined-product disruptions remain unpredictable.",
  assetValence:"MIXED_BY_EXPOSURE",beneficiaries:"US gas-consuming households, power generators and energy-intensive buyers may benefit if cheaper Henry Hub prices materialise; refiners could benefit from stronger fuel cracks depending on costs.",
  pressured:"Domestic gas producers may face lower realised prices; freight and diesel-heavy firms remain exposed to elevated finished-fuel costs.",
  supplyEffect:"Lower heating use leaves more gas in storage relative to demand; overseas LNG and refined-fuel availability still depend on terminals, tankers and refineries.",
  demandEffect:"Warmer weather lowers gas-heating demand, while higher export capacity can increase demand for US feedgas. Industrial and freight diesel demand is a separate market.",
  financingEffect:"Reduced domestic gas input costs can ease operating cash needs for some businesses, while persistent diesel prices can keep inflation and rates restrictive.",
  expectedReaction:"An unanticipated higher inventory forecast would ordinarily pressure near-term Henry Hub futures; constrained diesel supply can support product margins despite softer US gas.",
  observedReaction:"No independently matched release-window Henry Hub, Brent, diesel or energy-stock response has been attached; EIA projections are not spot prints.",
  tapeStatus:"NOT_MEASURED",divergence:"UNTESTED",
  alternative:"Weather shifts, export nominations, crude supply and pre-release positioning can independently determine actual prices.",
  nextTest:"Compare weekly actual storage against the forecast and matched-date Henry Hub, TTF/JKM, diesel crack and freight observations."
 },
 relatedHref:"?category=Energy",
};

const NOV_NVLINK="https://nvidianews.nvidia.com/news/nvidia-rebellions-and-sk-telecom-announce-collaboration-to-advance-sovereign-ai-infrastructure-with-nvidia-nvlink-fusion";

export const NOVEMBER_NVLINK_DEPTH:PublicStoryDepth={
 edition:"12 November 2026 · original-NVIDIA-release editorial analysis; announced 9 November Korea time",
 eventAt:"2026-11-09T05:00:00.000Z",
 topic:"Korean sovereign AI, custom chips and NVIDIA infrastructure",
 title:"NVIDIA May Benefit Even When Its Customers Use Rival AI Chips",
 hook:"NVIDIA is helping SK Telecom link Korean-designed AI chips to NVIDIA networking and racks. The unusual opportunity is selling infrastructure even when the accelerator isn't NVIDIA's own.",
 lead:"NVIDIA, Rebellions and SK Telecom announced plans to develop rack-scale AI systems combining Rebellions' next-generation R200 neural processors with NVIDIA's NVLink Fusion networking and MGX rack design. SK Telecom plans to deploy them for Korean sovereign-AI services. This is an engineering and deployment collaboration, not a disclosed sales contract.",
 chronology:[
  "Before the announcement: AI data-centre infrastructure commonly depended on accelerator choices, proprietary interconnect and rack design. No dated consensus forecast for this specific collaboration was established.",
  "9 November in Korea (8 November on NVIDIA's global newsroom): the companies announced their partnership, supported by Korea's Ministry of Science and ICT.",
  "Next proposed step: Rebellions develops R200 systems connected through NVLink Fusion and MGX, while SK Telecom plans data-centre deployment. NVIDIA says R200 systems are expected to be ready for deployment in 2028; commercial shipment volumes, contract value and measured customer savings were not announced."
 ],
 numbers:[
  {label:"Custom accelerator",baseline:"No independently verified prior volume or signed order baseline",expected:"No pre-release deployment consensus established",observed:"Rebellions next-generation R200 NPU planned",change:"Proposed integration with NVIDIA NVLink Fusion",basis:"Technical design intention, not shipped units",sourceName:"NVIDIA original announcement",sourceUrl:NOV_NVLINK},
  {label:"Inference workload allocation",baseline:"No comparative throughput/cost benchmark disclosed",expected:"No verified cost-per-token target",observed:"GPU prefill plus Rebellions NPU decode proposed",change:"Workload split could reduce the cost of token generation if benchmarks confirm it",basis:"Planned disaggregated inference; not measured commercial savings",sourceName:"NVIDIA original announcement",sourceUrl:NOV_NVLINK},
  {label:"Infrastructure platform",baseline:"No project-specific infrastructure revenue disclosed",expected:"No contract-value guidance",observed:"NVIDIA NVLink Fusion + MGX rack framework planned",change:"Custom processor might still use NVIDIA networking and shared rack ecosystem",basis:"Architecture collaboration; no margin or revenue forecast",sourceName:"NVIDIA original announcement",sourceUrl:NOV_NVLINK}
 ],
 whatChanged:[
  "Rebellions plans to connect its R200 NPUs to NVIDIA's rack-scale platform using NVLink Fusion. SK Telecom plans to deploy the architecture in its AI data centres.",
  "NVLink is a high-speed processor interconnect; NVLink Fusion enables partner-designed processors to join an NVIDIA-based infrastructure ecosystem. MGX supplies modular rack/server reference designs, including common power and cooling elements.",
  "The longer-term investor question is whether NVIDIA can retain networking and systems revenue as more customers use custom accelerators rather than buying only NVIDIA GPUs."
 ],
 explanation:[
  "Large AI models divide work among many processors. If the chips cannot exchange data efficiently, the network can become a bottleneck even when the processors are fast.",
  "An AI request has two useful phases: prefill processes the prompt; decode generates the answer token by token. The partners propose using NVIDIA GPUs for prefill and Rebellions NPUs for decode, assigning the jobs to different chips.",
  "NVIDIA could still supply the networking and shared rack infrastructure surrounding those custom processors. That is a possible ecosystem advantage, not proof of exclusive adoption or stronger future margins."
 ],
 countercase:[
  "This announcement does not disclose a signed order value, scheduled commercial capacity, verified cost-per-token reduction or booked NVIDIA revenue.",
  "Customers might use alternative networks and processors, and a jointly developed platform could face technical or economic integration problems.",
  "A strong technology partnership does not prove that NVIDIA shares immediately repriced because of it; rates, AI spending and other events affect the stock."
 ],
 marketTape:[
  "No independently verified timestamp-matched NVIDIA, SK Telecom or semiconductor-index reaction to this announcement is attached.",
  "Treat the collaboration as an infrastructure adoption lead; do not infer a revenue or market-share change from the headline alone."
 ],
 theQuestion:"Could NVIDIA own more of the AI factory even when competitors make some of the chips?",
 nextTests:[
  "Check Rebellions' 2028 R200 deployment-readiness milestone, independent GPU/NPU prefill-and-decode benchmarks and actual deployment capacity at SK Telecom.",
  "Look for announced capex budgets, signed purchase orders and reported project economics rather than treating collaboration language as contracted sales.",
  "Monitor NVIDIA's next networking/data-centre disclosures for realised revenue and margins attributable to infrastructure, without assuming NVLink Fusion already dominates custom AI silicon.",
  "Compare sovereign AI deployment evidence with the AI capital-cycle regime and any offsetting customer cash-flow or funding stress."
 ],
 missing:[
  "No verified signed project value, product volume or economic payback data; Rebellions' R200 systems are expected to be ready for deployment in 2028.",
  "No independently benchmarked energy efficiency or inference cost saving for the proposed R200 architecture.",
  "No causal event-window market-price study or canonical System 2 AI-regime change linked to this exact release."
 ],
 sources:[
  {label:"NVIDIA Newsroom · original collaboration announcement",url:NOV_NVLINK,role:"Partners, architecture, deployment plans and limitations"}
 ],
  concepts:[
  {term:"GPU versus NPU / custom accelerator",meaning:"A graphics processing unit (GPU) is a flexible parallel processor widely used in AI. A neural processing unit (NPU) is a specialised chip designed for neural-network work. Rebellions' planned R200 is an NPU; custom chips are not automatically faster at every task.",marketUse:"Mixing processors creates a possible cheaper alternative for selected workloads. It may reduce demand for GPUs used in those jobs while increasing demand for shared networking and complementary GPU tasks."},
  {term:"NVLink versus NVLink Fusion",meaning:"NVLink is NVIDIA's fast chip-to-chip connection technology. NVLink Fusion is an integration platform that lets supported partner-designed processors join NVIDIA's high-speed, rack-scale networking ecosystem. It is not a guarantee that every chip will work without engineering.",marketUse:"NVIDIA may capture networking and systems value even when a customer chooses another company's AI processor. Compatibility, performance, pricing and adoption remain to be tested."},
  {term:"MGX, rack-scale and cooling",meaning:"A rack is a cabinet containing servers and networking equipment. Rack-scale means designing the processors, power delivery, cooling and connections as one system. MGX is NVIDIA's modular rack/server reference design and partner ecosystem.",marketUse:"Reusing standard rack components can shorten engineering and installation time, but does not prove lower electricity use or lower all-in capital costs."},
  {term:"Inference, prefill, decode and token",meaning:"Inference is using an already trained AI model to answer a question. Prefill processes the user's prompt; decode generates the reply one token (a small piece of text) at a time. The partners propose GPUs for prefill and Rebellions NPUs for decode.",marketUse:"If each chip handles a stage more efficiently, the data centre may produce more answers per second or at lower cost per token. That is still a proposed advantage, not a measured R200 result."},
  {term:"Throughput, latency, watts and cost per token",meaning:"Throughput is how much work the system completes per second; latency is how long a user waits; watts measure power draw. Cost per token is the operating/equipment cost allocated to generating a unit of AI output.",marketUse:"A faster system is not necessarily cheaper or more power-efficient. Benchmark throughput, latency, watts per token and total installed cost at the same workload."},
  {term:"Sovereign AI and AI for All",meaning:"Sovereign AI means building or controlling chips, computing infrastructure, models or data services within a country. Korea's AI for All is the public-service goal named in the partnership, not proof of a funded purchase order.",marketUse:"Government and local-industry demand could broaden the pool of AI customers. Confirm procurement, budgets and deployment rather than counting announced ambitions as sales."}
 ],
 decisionSignals:[
  {decision:"Rebellions chooses NVLink Fusion for its future R200 systems",signal:"Potential positive for NVIDIA infrastructure; unproven sales",meaning:"Rebellions wants its specialised processors to communicate inside an NVIDIA-based rack rather than designing every connection and shared system component alone.",efficiency:"Fast interconnects and reusable designs could cut integration bottlenecks and time to market. The announcement gives no verified per-rack price, integration cost or performance benchmark.",supplyDemand:"This could increase the supply of compatible custom AI computing and create demand for NVIDIA networking, MGX ecosystem components and Rebellions chips. Custom NPUs might substitute for some GPUs while complementary workloads still need GPUs.",uncertainty:"Engineering complexity, vendor dependence, pricing and competitors' interconnect solutions may limit adoption. R200 is expected to be ready for deployment in 2028, not immediately.",confirmation:"Verify R200 samples and 2028 shipment/deployment milestones, compatible system orders and independently compared networking performance."},
  {decision:"The partners split AI prompts between GPUs and NPUs",signal:"Potentially constructive for cost per AI response; efficiency not yet demonstrated",meaning:"They plan to give GPU processors the initial prompt-reading work and let Rebellions NPUs generate subsequent answer tokens, each doing the job the system designers think suits it.",efficiency:"If proven, more useful answers could be delivered per unit of electricity or per dollar of installed equipment. Moving data between two types of chips adds complexity and could erase some savings.",supplyDemand:"Lower cost per answer effectively expands the supply of affordable AI services. It can also increase demand as more firms and users find AI economical. Greater total usage could still raise aggregate data-centre electricity needs even if each answer uses fewer watts.",uncertainty:"There are no independently demonstrated R200 throughput, latency, power-per-token or lifetime-cost results for this architecture.",confirmation:"Demand controlled, apples-to-apples benchmarks including token/s, delay, watts/token, full rack capex, utilisation and integration overhead."},
  {decision:"SK Telecom plans to bring Korean sovereign AI services into its data centre",signal:"Long-run demand opportunity; near-term revenue uncertain",meaning:"The telecom operator would combine domestically designed chips, its AI models and services with standardised rack infrastructure. The ministry's support is an endorsement, not disclosed purchase funding.",efficiency:"Standard rack footprints, cooling and power interfaces might speed rollout and simplify maintenance; actual power usage, payback and service pricing remain unknown.",supplyDemand:"A working deployment could add more AI-service capacity for Korean institutions and businesses, raising demand for compute, networking, electricity and data-centre investment. If capacity grows faster than paying users, utilisation and returns may disappoint.",uncertainty:"No signed project value, customer uptake, binding 2028 order volume or realised NVIDIA margin is disclosed. Local content and data requirements may also affect costs.",confirmation:"Look for SK Telecom funded capex, signed procurement, utilisation, customer contracts, measured inference costs and realised partner revenue."}
 ],
 impact:{
  asOf:"2026-11-12",sourceUrl:NOV_NVLINK,
  decisionSignal:"NVIDIA is extending its networking ecosystem to partner-designed NPUs rather than insisting every accelerator must be NVIDIA-built. This signals a potential infrastructure revenue hedge against custom-chip adoption.",
  uncertaintyDirection:"MIXED",uncertaintyWhy:"The partnership makes intended architecture and partners clearer, but no binding order value, delivered capacity, payback or independent performance results are verified.",
  assetValence:"MIXED_BY_EXPOSURE",beneficiaries:"NVIDIA networking/rack suppliers, Rebellions and SK Telecom may benefit if the systems are deployed economically and customer use rises.",
  pressured:"Some general-purpose GPU demand could be displaced by cost-effective specialised NPUs; custom integration failure or excess capacity could burden buyers.",
  supplyEffect:"Interoperable custom accelerators could expand available AI inference capacity and lower bottlenecks, conditional on actual 2028 product delivery.",
  demandEffect:"Lower realised cost per answer could increase paid AI adoption and demand for networking, chips and electricity; efficiency may increase total usage rather than total electricity savings.",
  financingEffect:"Standardised rack infrastructure may reduce integration time and uncertainty, but no cost-per-token, deployment capex or customer return-on-investment has yet been demonstrated.",
  expectedReaction:"If verified demand and margins expand, infrastructure suppliers could benefit; custom NPUs may also challenge GPU unit economics. Without orders, no specific share-price magnitude is defensible.",
  observedReaction:"No same-event NVDA, SK Telecom or semiconductor-index market-price reaction is independently attached to the release.",
  tapeStatus:"NOT_MEASURED",divergence:"UNTESTED",
  alternative:"Broader AI financing concerns and separate NVIDIA governance headlines could dominate the stock reaction even if this partnership is technically positive.",
  nextTest:"Verify purchase orders, R200 shipment readiness, SK Telecom funded capacity, independent tokens-per-watt and networking margins."
 },
 relatedHref:"?category=AI",
};

function exactNovemberRelease(news:NewsBriefV1,id:string,url:string,day:string):boolean{
 const event=Date.parse(news.occurredAt), observed=Date.parse(news.observedAt);
 return news.id===id && news.sourceUrl===url &&
  news.verification==="SOURCE_VERIFIED" && ["official","primary"].includes(news.sourceKind.toLowerCase()) &&
  event===Date.parse(day) && Number.isFinite(observed) && observed>=event;
}

function isExactSeptemberJoltsReceipt(news:NewsBriefV1):boolean{
 const t=Date.parse(news.occurredAt);
 const seen=Date.parse(news.observedAt);
 return news.id==="official-macro-us-bls-2026-11-03-jolts-september-2026"&&
  news.verification==="SOURCE_VERIFIED"&&news.sourceKind==="official"&&
  news.sourceUrl===JOLTS_BLS&&news.summary.includes("Job openings 7.5M")&&
  t===Date.parse(SEPTEMBER_JOLTS_DEPTH.eventAt)&&
  Number.isFinite(seen)&&seen>=t;
}

const FED_ORIGINAL_PATH="/newsevents/pressreleases/monetary20261028a.htm";
function isExactOctoberFedReceipt(news:NewsBriefV1){
 try{
  const url=new URL(news.sourceUrl);
  if(url.hostname!=="www.federalreserve.gov"||url.pathname!==FED_ORIGINAL_PATH)return false;
  const t=Date.parse(news.occurredAt);
  return news.verification==="SOURCE_VERIFIED"&&t>=Date.parse("2026-10-28T17:45:00Z")&&t<Date.parse("2026-10-30T00:00:00Z");
 }catch{return false;}
}
/** An event identity is checked against the original URL, clock and qualification.
 * The query-string UUID alone grants no access to an editorial research pack.
 */
export function storyDepthForNews(news:NewsBriefV1):PublicStoryDepth|null{
 return exactNovemberRelease(news,"1acd67c7-e804-48bf-9ee7-97a2f96be283",NOV_EIA,NOVEMBER_EIA_GAS_DEPTH.eventAt)?NOVEMBER_EIA_GAS_DEPTH:
  exactNovemberRelease(news,"fdddf542-68f9-4576-9fde-812af424c724",NOV_NVLINK,NOVEMBER_NVLINK_DEPTH.eventAt)?NOVEMBER_NVLINK_DEPTH:
  isExactOctoberFedReceipt(news)?OCTOBER_FED_DEPTH:
  isExactSeptemberJoltsReceipt(news)?SEPTEMBER_JOLTS_DEPTH:null;
}

/** A missing research pack is a clearly marked coverage debt, NOT an
 * instruction to invent previous, consensus, event reaction or a verdict.
 */
export type StoryCoverageStatus={status:"RESEARCH_ENRICHED"|"SOURCE_ONLY"; missing:readonly string[]};
export function storyCoverageForNews(news:NewsBriefV1):StoryCoverageStatus{
 const pack=storyDepthForNews(news);
 return pack?{status:"RESEARCH_ENRICHED",missing:pack.missing}:{
  status:"SOURCE_ONLY",
  missing:["Previous comparable observation not yet linked","Frozen pre-release expectation not yet linked",
  "Actual-versus-expected comparison requires matching metric and source",
  "Dated market reaction not verified","Underlying financial or policy mechanism not yet reviewed"]
 };
}
