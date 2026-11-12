import {buildDirectionQuickRead,type DirectionEvidence,type DirectionQuickRead} from "./bluebelly-direction-quick-read.ts";

/** Qualitative editorial signals, independently scoped to each Regime question.
 * Only source-admitted, reviewed records live here: NO X/creator auto-classification
 * and NO automatic mutation of the fundamental Regime or a persisted Story.
 */
export const REGIME_DIRECTION_IDS=["energy","fed","bonds","ai","breadth"] as const;
export type RegimeDirectionId=typeof REGIME_DIRECTION_IDS[number];
type Packet={
 question:string;
 summary:string;
 meaning:string;
 followUpHref:string;
 followUpLabel:string;
 supportingTerm:string;
 opposingTerm:string;
 signals:readonly DirectionEvidence[];
};
const PACKETS:Record<RegimeDirectionId,Packet>={
 energy:{
  question:"Is the physical energy squeeze easing?",
  summary:"Delivered supply, LNG contractual disruption, and maritime attacks can move in opposite directions.",
  meaning:"Physical supply relief is not the same as safe passage, normal LNG delivery, or lower diesel margins. Source-publication days, not live oil quotes.",
  followUpHref:"#signals",followUpLabel:"Check energy sources and price tape",
  supportingTerm:"relief",opposingTerm:"pressure",
  signals:[
   {id:"energy-11-nov-navigation",date:"2026-11-11",direction:"worse",
    title:"Reported navigation-system attack keeps commercial shipping risks active",
    sourceName:"Reuters, 11 Nov",sourceUrl:"https://www.reuters.com/world/middle-east/iran-attacks-shipping-navigation-systems-omans-didamar-island-sources-say-2026-11-11/",
    limitation:"The suspected strike and operational impact were not independently confirmed by Reuters; not evidence of blocked barrels."},
   {id:"energy-11-nov-cargo-versus-attacks",date:"2026-11-11",direction:"mixed",
    title:"LNG departures increase while reported attacks continue",
    sourceName:"Reuters, 11 Nov",sourceUrl:"https://www.reuters.com/world/middle-east/hormuz-traffic-is-up-so-are-attacks-2026-11-11/",
    limitation:"October counts are not live voyage completion, delivered LNG tonnage, or a security guarantee."},
   {id:"energy-10-nov-shutins",date:"2026-11-10",direction:"better",
    title:"EIA estimates regional crude shut-ins fell from their May peak",
    sourceName:"EIA November STEO",sourceUrl:"https://www.eia.gov/outlooks/steo/marketreview/crude.php",
    limitation:"Regional crude estimates, not proof of safe Strait transit or normal product/LNG supply."},
   {id:"energy-10-nov-orlen",date:"2026-11-10",direction:"worse",
    title:"ORLEN formally ends one QatarEnergy LNG supply contract over prolonged force majeure",
    sourceName:"ORLEN regulatory release, 10 Nov",sourceUrl:"https://www.orlen.pl/en/investor-relations/reports-and-publications/regulatory-announcements/2026/03/Regulatory-announcement-no-39-2026",
    limitation:"One 1mtpa supply contract affected; it does not document a replacement LNG purchase from Venture Global."}
  ]
 },
 fed:{
  question:"Are inflation and Fed policy pressures easing?",
  summary:"Separate the official CPI print, Fed speakers, and the market-implied path; no speaker forecast is a policy decision.",
  meaning:"Easing means less price/policy pressure, not falling equity prices. Missing matched FedWatch observations cannot be promoted as odds.",
  followUpHref:"#signals",followUpLabel:"Inspect dated policy observations",
  supportingTerm:"easing",opposingTerm:"pressure",
  signals:[
   {id:"fed-11-nov-repricing",date:"2026-11-11",direction:"worse",
    title:"Equity-market reporting says at least a quarter-point December Fed hike is priced",
    sourceName:"Reuters, 11 Nov",sourceUrl:"https://www.reuters.com/business/sp-500-nasdaq-futures-rise-after-coreweave-soothes-ai-spending-fears-2026-11-11/",
    limitation:"A dated market-reporting snapshot, not an archived CME contract distribution or Fed decision."},
   {id:"fed-10-nov-cpi",date:"2026-11-10",direction:"worse",
    title:"BLS reports October CPI +0.4% headline, +0.3% core month over month",
    sourceName:"US BLS, 10 Nov",sourceUrl:"https://www.bls.gov/news.release/archives/cpi_11102026.htm",
    limitation:"Month-on-month releases; most October year-on-year figures are unavailable due to missing 2025 collection."},
   {id:"fed-10-nov-waller",date:"2026-11-10",direction:"worse",
    title:"Fed Governor Waller outlines conditions for a December rate hike",
    sourceName:"Federal Reserve speech, 10 Nov",sourceUrl:"https://www.federalreserve.gov/newsevents/speech/waller20261110a.htm",
    limitation:"The stated conditional preference does not bind the full FOMC or quantify live hike odds."}
  ]
 },
 bonds:{
  question:"Is borrowing-cost pressure easing for duration?",
  summary:"Track actual Treasury cash yields separately from TLT ETF proxies, policy expectations and real rates.",
  meaning:"No confirmed 11 November US bond cash session: the official market-close notice is a coverage warning, not a bearish market print.",
  followUpHref:"#signals",followUpLabel:"Inspect yield and TLT data clocks",
  supportingTerm:"relief",opposingTerm:"pressure",
  signals:[
   {id:"bonds-10-nov-yields",date:"2026-11-10",direction:"worse",
    title:"2-year and 10-year Treasury yields rise sharply after CPI",
    sourceName:"Reuters via MarketScreener, 10 Nov",sourceUrl:"https://www.marketscreener.com/news/us-yields-climb-stocks-fall-as-inflation-data-boosts-chances-for-larger-fed-rate-hike-ce785edad18ef224",
    limitation:"Reported +18.44bp 2Y and +12.55bp 10Y are dated 10 Nov observations, not 11 Nov closes or live yields."},
   {id:"bonds-10-nov-waller",date:"2026-11-10",direction:"worse",
    title:"Waller's conditional December hike path adds front-end duration pressure",
    sourceName:"Federal Reserve speech, 10 Nov",sourceUrl:"https://www.federalreserve.gov/newsevents/speech/waller20261110a.htm",
    limitation:"Policy transmission hypothesis; it does not determine long-end term premium or TLT's next return."}
  ]
 },
 ai:{
  question:"Are AI investment conditions strengthening?",
  summary:"Demand, issuer cash conversion, financing cost and Nvidia leadership risk are separate tests.",
  meaning:"A single AI stock rebound does not establish sector free cash flow, and a CEO allegation does not prove lost GPU orders.",
  followUpHref:"#signals",followUpLabel:"Inspect issuer and market evidence",
  supportingTerm:"strength",opposingTerm:"risk",
  signals:[
   {id:"ai-11-nov-governance",date:"2026-11-11",direction:"worse",
    title:"Reuters reports Nvidia board could consider CEO removal; company has not confirmed it",
    sourceName:"Reuters, 11 Nov",sourceUrl:"https://www.reuters.com/technology/nvidia-is-preparing-oust-ceo-jensen-huang-wsj-reports-2026-11-11/",
    limitation:"Reuters could not independently verify the report. A governance risk modifier, not a semiconductor-demand forecast."},
   {id:"ai-11-nov-rebound",date:"2026-11-11",direction:"better",
    title:"AI equities rebound after CoreWeave guidance, with Nasdaq and chips rising",
    sourceName:"Reuters, 11 Nov",sourceUrl:"https://www.reuters.com/business/sp-500-nasdaq-futures-rise-after-coreweave-soothes-ai-spending-fears-2026-11-11/",
    limitation:"Positive market reception is not evidence of industry-wide free-cash-flow improvement or sustained risk appetite."},
   {id:"ai-10-nov-coreweave",date:"2026-11-10",direction:"mixed",
    title:"CoreWeave lifts guidance and backlog while reporting heavy interest costs and losses",
    sourceName:"CoreWeave 3Q26 official release",sourceUrl:"https://investors.coreweave.com/news/news-details/2026/CoreWeave-Reports-Strong-Third-Quarter-2026-Results/default.aspx",
    limitation:"Revenue $3.661bn, net loss $709m and net interest expense $846m; stronger demand and costly financing coexist."},
   {id:"ai-10-nov-funding",date:"2026-11-10",direction:"worse",
    title:"Hot CPI and possible higher Fed rates challenge leveraged AI infrastructure financing",
    sourceName:"BLS October CPI",sourceUrl:"https://www.bls.gov/news.release/archives/cpi_11102026.htm",
    limitation:"Macro financing inference, not a measured widening in an individual AI issuer's credit spread."}
  ]
 },
 breadth:{
  question:"Is the equity rally broadening beyond megacaps?",
  summary:"Match SPY and RSP on completed US sessions; sector rallies alone cannot establish broad participation.",
  meaning:"Relative equal-weight participation is only one proxy. Confirmation still needs advancers, sectors, SMH/QQQ and 50/200-day breadth.",
  followUpHref:"#signals",followUpLabel:"Check index and breadth context",
  supportingTerm:"breadth",opposingTerm:"narrowing",
  signals:[
   {id:"breadth-11-nov-spy-rsp",date:"2026-11-11",direction:"worse",
    title:"Equal-weight RSP gains less than cap-weight SPY in the 11 November rebound",
    sourceName:"Yahoo Finance — RSP and SPY histories",sourceUrl:"https://finance.yahoo.com/quote/RSP/history/",
    comparisonSourceUrl:"https://finance.yahoo.com/quote/SPY/history/",
    limitation:"RSP +~0.56% and SPY +~1.32% from matched ETF closes; a daily relative lag, not whole-market decliners or failed breadth trend."},
   {id:"breadth-11-nov-chips",date:"2026-11-11",direction:"mixed",
    title:"Semiconductors lead the index rebound without proving equal-weight confirmation",
    sourceName:"Reuters, 11 Nov",sourceUrl:"https://www.reuters.com/business/sp-500-nasdaq-futures-rise-after-coreweave-soothes-ai-spending-fears-2026-11-11/",
    limitation:"Reported chip strength cannot identify whether the majority of stocks participated."},
   {id:"breadth-10-nov-relative",date:"2026-11-10",direction:"better",
    title:"RSP loses less than SPY on the preceding inflation-risk session",
    sourceName:"Yahoo Finance — RSP and SPY histories",sourceUrl:"https://finance.yahoo.com/quote/RSP/history/",
    comparisonSourceUrl:"https://finance.yahoo.com/quote/SPY/history/",
    limitation:"RSP approximately -0.03% and SPY -0.37% on 10 Nov: relative defence, not positive absolute breadth."}
  ]
 }
};
export type RegimeDirectionPacket=Omit<Packet,"signals">&{id:RegimeDirectionId;read:DirectionQuickRead};
export function getRegimeDirectionPacket(lensId:string,now=new Date()):RegimeDirectionPacket|null{
 if(!REGIME_DIRECTION_IDS.some(id=>id===lensId))return null;
 const id=lensId as RegimeDirectionId;
 const packet=PACKETS[id];
 return {id,question:packet.question,summary:packet.summary,meaning:packet.meaning,
  followUpHref:packet.followUpHref,followUpLabel:packet.followUpLabel,
  supportingTerm:packet.supportingTerm,opposingTerm:packet.opposingTerm,
  read:buildDirectionQuickRead(packet.signals,now)};
}
export function getRegimeDirectionPackets(now=new Date()){
 return REGIME_DIRECTION_IDS.map(id=>getRegimeDirectionPacket(id,now)!);
}
