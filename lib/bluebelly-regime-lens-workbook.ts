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
 policyDilemma?:{question:string;answer:string;housingConstraint:string;policyConstraint:string};
 scenarios?:readonly {title:string;setup:string;crossMarketEffects:readonly string[]}[];
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
 },
 housing:{
  lead:"US housing is an affordability, inflation and credit channel—not a single house-price chart. The tracker separates borrowing costs, household budgets, activity, shelter inflation and borrower stress, then follows the links into bonds, the dollar, equities, banks and gold.",
  causalPath:["Inflation, income and mortgage rates","Affordability, turnover and construction","Rents / owners' equivalent rent and household balance sheets","Treasury yields, USD, bank credit, equities and gold"],
  mechanismCaution:"High home prices do not automatically mean high current inflation: CPI shelter measures rent and owners' equivalent rent, and these can lag real-time asking rents. A high mortgage rate can reduce demand while also worsening monthly affordability and discouraging existing owners from selling. Do not infer a housing-credit crisis from low sales alone.",
  strengthen:"Mortgage payments remain elevated relative to incomes while transactions, starts or permits weaken; shelter inflation stays persistent; or official delinquency data show broadening borrower stress. Require dated observations and distinguish level, direction and lag.",
  challenge:"Income growth and new supply improve affordability, sales stabilise without renewed price pressure, shelter inflation cools, and delinquency measures remain contained.",
  monitors:[
   monitor("Mortgage borrowing cost","Freddie Mac 30-year fixed mortgage-rate series with its weekly observation date","Separate Treasury-yield moves from the rate households actually face","Freddie Mac PMMS","https://www.freddiemac.com/pmms","Weekly release"),
   monitor("Affordability and home prices","Payment-to-income or price-to-income measure, with methodology and period","Test whether affordability improves through income, rates, prices or a mix","National Association of Realtors","https://www.nar.realtor/research-and-statistics/housing-statistics","Monthly release"),
   monitor("Sales, inventory and construction","Existing/new-home sales, months of supply, housing starts and permits","Determine whether weak demand is meeting a supply response","US Census Bureau","https://www.census.gov/construction/nrc/","Monthly release"),
   monitor("Shelter inflation","CPI rent of primary residence and owners' equivalent rent, with monthly and annual changes","Measure the inflation series the Fed sees; do not substitute home prices","US Bureau of Labor Statistics","https://www.bls.gov/cpi/","Monthly release"),
   monitor("Mortgage performance","Delinquencies and transitions by loan type, with quarter and denominator","Check whether affordability pressure has become realised credit stress","Federal Reserve Bank of New York","https://www.newyorkfed.org/microeconomics/hhdc.html","Quarterly release"),
   monitor("Housing prices","FHFA purchase-only index and release period; compare with income and rents","Separate asset-price inflation from transaction volumes and CPI shelter","Federal Housing Finance Agency","https://www.fhfa.gov/data/hpi","Monthly / quarterly release"),
  ],
  related:[{id:"fed",why:"Policy decisions respond to inflation and employment, not home prices alone"},{id:"bonds",why:"Treasury yields and mortgage pricing transmit funding costs"},{id:"breadth",why:"Builders, banks and consumer-facing companies can carry the shock into equities"},{id:"gold",why:"Real yields, the dollar and growth stress frame gold's competing channels"}],
  leadHeadlinePattern:/\b(?:housing|mortgage|home prices?|home sales|homebuilders?|shelter inflation|housing affordability)\b/i,
  sourcePattern:/\b(?:freddie mac|mortgage rates?|home prices?|housing starts|building permits|home sales|housing inventory|rent of primary residence|owners' equivalent rent|owners equivalent rent|housing affordability|mortgage delinquen|fhfa house price|existing.home sales|new.home sales)\b/i,
  policyDilemma:{
   question:"Can the Fed hike rates while housing is already expensive?",
   answer:"Yes. The Fed sets policy against its inflation and employment mandate; a high purchase price is not a rate-setting veto. If inflation remains too persistent, policymakers can keep rates restrictive or hike even while housing activity is weak.",
   housingConstraint:"The trade-off is that higher policy rates can keep mortgage borrowing costs high, worsen the monthly payment for new buyers, suppress transactions and construction, and keep owners with older low-rate mortgages from listing. Prices may stay sticky because supply is constrained even as affordability deteriorates.",
   policyConstraint:"The Fed cannot directly target house prices. Shelter in CPI/PCE—rent and owners' equivalent rent—matters for inflation, but it adjusts with a lag. Policymakers must weigh that lag against current inflation, labour demand and the risk that restrictive rates amplify housing and credit stress.",
  },
  scenarios:[
   {title:"Sticky inflation, housing stagnation",setup:"Shelter inflation remains firm while high mortgage costs suppress turnover and construction; household credit remains broadly orderly.",crossMarketEffects:["2Y yields: hike / higher-for-longer pricing can lift the front end.","10Y yields: inflation persistence may lift yields; weaker housing growth can partly offset it.","DXY: may firm if US policy pricing rises relative to peers.","Equities: rate-sensitive builders, REITs, banks and consumer cyclicals face pressure; broad index impact depends on earnings breadth.","Gold: higher real yields can weigh, while growth or policy uncertainty can support demand."]},
   {title:"Gradual affordability repair",setup:"Mortgage costs ease or incomes and supply improve; sales recover without a renewed surge in home prices or shelter inflation.",crossMarketEffects:["2Y yields: can fall if inflation cools without a damaging employment shock.","10Y yields: may ease as inflation risk recedes, though stronger growth can limit the move.","DXY: can soften if the expected US rate advantage narrows.","Equities: homebuilders, mortgage lenders, housing-related retailers and REITs may benefit if financing and demand improve.","Gold: lower real yields can help, while a steadier growth backdrop may reduce defensive demand."]},
   {title:"Housing-led credit downturn",setup:"Delinquencies broaden, forced sales or lender losses rise, and falling activity spreads beyond housing into consumption and employment.",crossMarketEffects:["2Y yields: may fall as markets price cuts, unless inflation prevents easing.","10Y yields: can fall on weaker growth or rise on renewed inflation / fiscal risk; identify the driver.","DXY: safe-haven demand can support it, while faster expected Fed easing can pull the other way.","Equities: banks, builders, REITs and consumer cyclicals are exposed; credit spreads and earnings revisions test contagion.","Gold: may benefit from lower real yields or risk demand, but a stronger dollar can offset part of the move."]},
  ],
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
