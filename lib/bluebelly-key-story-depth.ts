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
  edition:string; topic:string; title:string; hook:string; lead:string;
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
 return isExactOctoberFedReceipt(news)?OCTOBER_FED_DEPTH:null;
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
