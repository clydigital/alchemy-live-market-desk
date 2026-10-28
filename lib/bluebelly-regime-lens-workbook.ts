import type {EditorialRegimeId} from "./bluebelly-editorial-architecture.ts";
import type {PublicSourceObservation} from "./blue-desk-source-observations-projector.ts";

/** A static editorial RESEARCH PLAN, not an observation, forecast, score or
 * second canonical Regime model. Each lens has a different causal pathway
 * and testable reading list. Numbers can only arrive through the existing
 * time-stamped evidence readers. */
export type LensMonitor={
 name:string; purpose:string; discriminator:string; sourceName:string;
 sourceUrl:string; cadence:string;
};
export type LensWorkbook={
 lead:string;
 causalPath:readonly string[];
 mechanismCaution:string;
 strengthen:string;
 challenge:string;
 monitors:readonly LensMonitor[];
 related:readonly {id:EditorialRegimeId; why:string}[];
 sourcePattern:RegExp;
 leadHeadlinePattern:RegExp;
};
const monitor=(name:string,purpose:string,discriminator:string,sourceName:string,sourceUrl:string,cadence:string):LensMonitor=>
 ({name,purpose,discriminator,sourceName,sourceUrl,cadence});
const T="https://home.treasury.gov/resource-center/data-chart-center/interest-rates";
const FED="https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
const SEC="https://www.sec.gov/search-filings";
const CREDIT="https://fred.stlouisfed.org/series/BAMLH0A0HYM2";

export const REGIME_LENS_WORKBOOKS:Record<EditorialRegimeId,LensWorkbook>={
 fed:{
  lead:"The same Fed cut can be good news about disinflation or a warning that demand is breaking. The distinction changes how we interpret yields, the dollar and risk assets.",
  causalPath:["Inflation and labour releases","Fed path repricing","US 2Y and real yields","USD, credit and equity reaction"],
  mechanismCaution:"A policy announcement and a market move occurring together do not prove the announcement caused the move.",
  strengthen:"Inflation eases without a material labour deterioration, while dated front-end yields and cross-asset reactions support a disinflation interpretation.",
  challenge:"Employment or demand weakens sharply, or inflation re-accelerates; price reactions cease to fit a benign policy easing.",
  monitors:[
   monitor("Inflation mix","Headline versus core CPI/PCE and revisions","Separate cooling prices from weakening demand","BLS CPI","https://www.bls.gov/cpi/","Monthly release"),
   monitor("Fed communications","Decision, statement, minutes and projections","Identify what policymakers actually changed","Federal Reserve",FED,"FOMC release"),
   monitor("Front-end yields","US 2Y compared with 10Y and the relevant pre-event close","Test whether the market repriced policy expectations","US Treasury",T,"Dated market close")
  ],
  related:[{id:"bonds",why:"Term premium can offset Fed easing"},{id:"gold",why:"Real yields help frame gold's reaction"}],
  leadHeadlinePattern:/\b(?:fomc|federal reserve|fed policy|fed rate|inflation|cpi|pce|payroll|rate expectations)\b/i,
  sourcePattern:/\b(?:fomc|federal reserve|fed funds|consumer price index|personal consumption expenditures|cpi|pce inflation|payrolls?|employment situation|two.year treasury)\b/i,
 },
 bonds:{
  lead:"Even if the Fed eases, long-term funding can stay expensive. Bond supply, inflation premia and credit quality determine whether that pain reaches borrowers.",
  causalPath:["Treasury financing and inflation expectations","Auction absorption and term premium","10Y/30Y and corporate spreads","Refinancing cost and equity duration"],
  mechanismCaution:"Do not attribute a Treasury sell-off to sovereign supply or AI borrowing without separating policy, real-yield and auction effects.",
  strengthen:"Weak auction absorption or higher long-end yields coincide with wider appropriately dated credit spreads or worse financing terms.",
  challenge:"Auction demand improves and long-end/credit yields fall without deterioration in refinancing access.",
  monitors:[
   monitor("Treasury curve","2Y, 10Y, 30Y and real-yield comparisons","Separate expected policy from long-end financing pressure","US Treasury",T,"Dated market close"),
   monitor("Auction demand","Auction results, bid-to-cover and indirect participation","Check actual debt absorption, not issuance headlines alone","TreasuryDirect","https://www.treasurydirect.gov/auctions/announcements-data-results/announcement-results-press-releases/auction-results/","Each auction"),
   monitor("High-yield credit spread","Option-adjusted spread with observation date","Determine whether sovereign stress is reaching corporate risk","FRED / ICE",CREDIT,"Daily series")
  ],
  related:[{id:"fed",why:"Separate expected policy from term premium"},{id:"ai",why:"Financing costs affect infrastructure returns"}],
  leadHeadlinePattern:/\b(?:treasury|treasuries|bond|credit|yield|funding|term premium|duration)\b/i,
  sourcePattern:/\b(?:treasur(?:y|ies)|auction|bond yields?|term premium|debt issuance|credit spread|high.yield|refinancing|municipal bond|yield curve)\b/i,
 },
 ai:{
  lead:"GPU orders are not shareholder returns. This lens tracks whether AI demand translates into pricing power and cash conversion after infrastructure, energy and financing costs.",
  causalPath:["Orders, users and capacity commitments","Revenue and gross margins","Cash capex, leases and funding","Free cash flow and valuation resilience"],
  mechanismCaution:"Capex commitments, reported capex, booked revenue and paid cash are different quantities; do not collapse them into one demand figure.",
  strengthen:"Comparable paid usage and revenue rise, margins remain defensible, and operating cash flow begins covering incremental infrastructure expenditure.",
  challenge:"Infrastructure spending or borrowing grows faster than monetisation, while FCF and pricing power deteriorate or delivery is delayed.",
  monitors:[
   monitor("Issuer revenue and guidance","Cloud/AI segment revenue with comparable baselines","Distinguish paid demand from announced capacity","SEC EDGAR",SEC,"Quarterly filing"),
   monitor("Cash conversion","Operating cash flow minus cash property/equipment, with lease basis","Test whether growth returns cash after reinvestment","SEC EDGAR",SEC,"Quarterly filing"),
   monitor("Financing burden","Debt maturity, leases, capex guidance and borrowing terms","Identify which expansion plans need outside money","SEC EDGAR",SEC,"Filings and financing disclosures")
  ],
  related:[{id:"bonds",why:"Credit conditions can raise build-out costs"},{id:"china",why:"Compute competition changes pricing power"}],
  leadHeadlinePattern:/\b(?:ai|artificial intelligence|semiconductor|nvidia|hyperscaler|gpu|capex|compute|data.cent)\b/i,
  sourcePattern:/\b(?:artificial intelligence|ai infrastruc|hyperscaler|semiconductor|gpu|nvidia|microsoft|alphabet|google cloud|amazon web services|meta platforms|data cent(?:re|er)|capex)\b/i,
 },
 china:{
  lead:"Lower-cost compute can expand AI use while compressing the margins of incumbents. The key is whether capability, access and actual revenue all change.",
  causalPath:["Export controls and chip availability","Model capability and inference economics","Pricing and adoption response","Supplier margins and investment returns"],
  mechanismCaution:"A benchmark score or headline model price is not the same as audited performance, total cost of ownership or realised enterprise adoption.",
  strengthen:"Independently comparable benchmarks and disclosed pricing show lower unit costs, followed by paid adoption that changes supplier economics.",
  challenge:"Hardware or export constraints persist, performance comparisons fail to reproduce, or cheaper access does not become sustained paid usage.",
  monitors:[
   monitor("Export restrictions","Exact rule, effective date, scope and licence terms","Separate policy change from commentary","BIS Export Administration Regulations","https://www.bis.gov/regulations/ear","Regulation change"),
   monitor("Supply-chain economics","Memory, compute and hardware disclosures","Identify where costs fall and whose margins are exposed","SEC EDGAR",SEC,"Issuer earnings"),
   monitor("Adoption and revenue","Paid usage, pricing and customer disclosures","Distinguish access from financially meaningful market share","SEC EDGAR",SEC,"Issuer filing")
  ],
  related:[{id:"ai",why:"Demand growth can coexist with margin compression"},{id:"breadth",why:"Market leadership may become less concentrated"}],
  leadHeadlinePattern:/\b(?:china|chinese|beijing|deepseek|export control|us.china|chip restriction)\b/i,
  sourcePattern:/\b(?:export controls?|semiconductor restrictions?|bis rule|china|chinese|beijing|deepseek|advanced computing|hbm|memory chip)\b/i,
 },
 energy:{
  lead:"The critical price can be diesel, gas or freight rather than Brent. Physical deliveries determine whether a supply story reaches inflation and growth.",
  causalPath:["Production, storage and transit constraints","Crude/product cracks, LNG and freight","Input prices and transport costs","Inflation expectations, rates and margins"],
  mechanismCaution:"Tanker disruption claims require actual dated crossings or physical flow data; oil futures alone are not a shipping observation.",
  strengthen:"Official inventory/flow data and product or freight indicators confirm sustained physical tightness beyond a short-lived crude-price reaction.",
  challenge:"Shipping, refining capacity and inventories normalise, while product premia and delivered costs retrace together.",
  monitors:[
   monitor("Oil and product inventories","Crude, gasoline and distillate stock change","Test whether refiners and consumers face real scarcity","EIA Weekly Petroleum","https://www.eia.gov/petroleum/supply/weekly/","Weekly release"),
   monitor("Crude versus distillates","Matched dated Brent/WTI and diesel product observations","Separate refinery bottlenecks from crude shortage","EIA Petroleum Data","https://www.eia.gov/petroleum/","Dated close"),
   monitor("Shipping and gas","Verified vessel crossings, LNG routes and freight basis","Check delivered supply rather than geopolitical assertion","EIA Natural Gas","https://www.eia.gov/naturalgas/","Weekly/route observations")
  ],
  related:[{id:"fed",why:"Energy inflation can alter the policy path"},{id:"bonds",why:"Inflation expectations affect long yields"}],
  leadHeadlinePattern:/\b(?:oil|brent|crude|diesel|distillate|lng|refining|hormuz|shipping|energy)\b/i,
  sourcePattern:/\b(?:eia|petroleum|crude oil|distillate|diesel|refiner|refinery|brent|wti|lng|natural gas|tanker|hormuz|opec|pipeline)\b/i,
 },
 yen:{
  lead:"Japan's policy path can alter the cost of yen funding abroad. The currency moving is only the first clue; actual carry unwinds require funding or positioning evidence.",
  causalPath:["BOJ policy and Japanese yields","Yen interest-rate differentials","Hedging and funding economics","Overseas bonds and risk assets"],
  mechanismCaution:"USD/JPY or a JGB yield move alone does not establish an actual carry unwind or repatriation flow.",
  strengthen:"Dated JGB/FX differential changes coincide with verified cross-border funding stress and exposed-asset reactions.",
  challenge:"Yen or JGB moves remain local, funding basis is stable, and no material overseas positioning or flow response is observed.",
  monitors:[
   monitor("BOJ outlook and policy","Rate decisions and inflation projections","Identify the policy path that could change carry costs","Bank of Japan","https://www.boj.or.jp/en/mopo/outlook/index.htm","BOJ meeting"),
   monitor("JPY and yield spread","USD/JPY alongside dated JGB and US Treasury yields","Test differential transmission, not direction alone","US Treasury",T,"Dated market close"),
   monitor("Funding stress","Basis, cross-border holdings or corroborated funding costs","Separate mechanical FX moves from real deleveraging","BIS Statistics","https://www.bis.org/statistics/","Quarterly or observed")
  ],
  related:[{id:"bonds",why:"Cross-border funding can affect sovereign demand"},{id:"breadth",why:"Risk-asset exposure can amplify yen shocks"}],
  leadHeadlinePattern:/\b(?:japan|japanese|yen|jgb|boj|carry|usd.?jpy)\b/i,
  sourcePattern:/\b(?:bank of japan|boj|jgb|japanese government bond|yen|usd.?jpy|jpy|japan policy|carry trade|yen funding)\b/i,
 },
 breadth:{
  lead:"Index highs can hide a weakening market. We need to distinguish durable earnings leadership from narrowing participation and worsening credit quality.",
  causalPath:["Earnings revisions and index concentration","Equal-weight versus cap-weight performance","Banks, credit and smaller companies","Durability of equity risk appetite"],
  mechanismCaution:"Narrow breadth indicates concentration; it is not by itself a timed sell signal or proof of imminent rollover.",
  strengthen:"Equal-weight, small-cap and financial participation improve alongside earnings quality without a material spread widening.",
  challenge:"A few megacaps sustain the headline index while earnings breadth narrows, banks deteriorate and credit stress rises.",
  monitors:[
   monitor("Equal-weight participation","Compare equal-weight S&P 500 with cap-weight and review window","Test how much of the move depends on a few names","S&P Dow Jones Indices","https://www.spglobal.com/spdji/en/","Dated market close"),
   monitor("Corporate earnings","Revisions, operating margins and financial-sector provisions","Distinguish price concentration from profit concentration","SEC EDGAR",SEC,"Earnings season"),
   monitor("High-yield spreads","Compare OAS direction with equity risk appetite","Check whether lenders confirm or reject the rally","FRED / ICE",CREDIT,"Daily series")
  ],
  related:[{id:"ai",why:"Megacap technology can dominate index weighting"},{id:"bonds",why:"Financing pressure can reveal weaker businesses"}],
  leadHeadlinePattern:/\b(?:breadth|equal.weight|market participation|equity leadership|small.cap|narrow leadership)\b/i,
  sourcePattern:/\b(?:equity breadth|equal.weight|advance.decline|s&p 500|nasdaq|small.cap|financial sector|earnings breadth|credit spread|bank provisions?)\b/i,
 },
 gold:{
  lead:"Gold may respond to lower real yields, central-bank reserve buying or a separate geopolitical premium. These explanations require different evidence.",
  causalPath:["Real yields and USD changes","Reserve allocation and geopolitical demand","Physical and investment gold demand","Spot gold relative to rate signals"],
  mechanismCaution:"Do not infer official central-bank buying from price appreciation; disclosed reserve changes lag and require measurement dates.",
  strengthen:"Matched real yields, dollar and gold returns support a rate channel, or dated reserve disclosures establish a separate buying channel.",
  challenge:"Real yields and USD contradict the rate explanation, while official reserve data fail to establish the claimed reserve shock.",
  monitors:[
   monitor("10Y real yield","Treasury inflation-protected real yield with matching gold date","Test gold's opportunity-cost channel","US Treasury",T,"Dated market close"),
   monitor("Official reserve holdings","Country reserve releases, tonnes and reporting period","Check physical reserve demand without guessing from price","IMF Data","https://data.imf.org/","Monthly/quarterly releases"),
   monitor("USD and gold timing","Spot gold with dollar and matched intraday/close window","Separate rate, dollar and residual risk explanations","US Treasury",T,"Matched market observation")
  ],
  related:[{id:"fed",why:"Policy and real yields affect gold's carry trade-off"},{id:"energy",why:"Geopolitical and inflation premia can overlap"}],
  leadHeadlinePattern:/\b(?:gold|bullion|xau|reserve allocation|central.bank buying)\b/i,
  sourcePattern:/\b(?:gold|xau|bullion|central bank reserves?|official reserves|real yield|gold holdings|monetary gold)\b/i,
 }
};

/** Editorial topic match only. Recent, original-source, public-approved records
 * are already admitted by the existing source-observation projector. Do not
 * call these matches linked Evidence, confirmation or causal market reactions. */
export function matchRecentLensObservations(
 id:EditorialRegimeId,items:readonly PublicSourceObservation[],now=new Date(),limit=3
):PublicSourceObservation[]{
 const pattern=REGIME_LENS_WORKBOOKS[id]?.sourcePattern;
 const current=now.getTime();
 if(!pattern||!Number.isFinite(current))return [];
 const seen=new Set<string>();
 return items.filter(item=>{
  const time=Date.parse(item.eventAt);
  if(!Number.isFinite(time)||time>current||current-time>48*60*60*1000)return false;
  if(!/^https:\/\//.test(item.sourceUrl)||seen.has(item.id))return false;
  if(!pattern.test(item.description))return false;
  seen.add(item.id);
  return true;
 }).slice(0,Math.max(0,Math.min(4,limit)));
}
