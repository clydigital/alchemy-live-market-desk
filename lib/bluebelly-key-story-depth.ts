import type {NewsBriefV1} from "./market-brief-news.ts";

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
 ],
};

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
 return isExactOctoberFedReceipt(news)?OCTOBER_FED_DEPTH:
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
