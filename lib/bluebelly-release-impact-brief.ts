import type {NewsBriefV1} from "./market-brief-news.ts";

/**
 * Read-only, source-bounded comparative context. This is NOT a canonical
 * Story/Regime judgement, market-price event study or automatic sentiment model.
 * Add new cases only when previous/revised/consensus vintages and source IDs
 * have been separately checked. Never create values from headline patterns.
 */
export type ReleaseContrast={
 id:string;
 metric:string;
 basis:string;
 period:string;
 actual:string;
 previous:string;
 previousVintage:string;
 expectation:string|null;
 deltaVsPrevious:string;
 deltaVsExpectation:string|null;
 sourceUrls:readonly string[];
 explanation:string;
};
export type DisruptionExposure={
 asset:string;
 name:string;
 tier:"ELEVATED"|"MODERATE"|"WATCH";
 direction:"MIXED"|"POTENTIAL_HEADWIND"|"POTENTIAL_TAILWIND";
 mechanism:string;
 counterforce:string;
 decidingTest:string;
 sourceUrl:string;
};
export type ReleaseImpactBrief={
 id:string; eventDate:string; title:string; lead:string;
 comparisonStatus:"SOURCE_CHECKED_CONTEXT";
 contrasts:readonly ReleaseContrast[];
 components:string;
 exposures:readonly DisruptionExposure[];
 observedMarketReaction:"NOT_MEASURED";
 reactionNote:string;
 sourceLedger:readonly {name:string;url:string;role:string}[];
};

export const PPI_OCT_2026_BLS_SEPT=
 "https://www.bls.gov/news.release/archives/ppi_10152026.htm";
export const PPI_OCT_2026_REPORTING=
 "https://www.reuters.com/business/us-producer-prices-rise-further-october-2026-11-13/";
export const PPI_OCT_2026_SECONDARY=
 "https://apnews.com/article/5f427443fd31a4aa2bd2a1b6cebfe549";

const OCTOBER_2026_PPI:ReleaseImpactBrief={
 id:"us-ppi-final-demand-2026-10",
 eventDate:"2026-11-13",
 title:"Wholesale inflation cooled month-to-month, but annual pressure increased",
 lead:"October final-demand PPI rose 0.3% after September's 1.4% revised rise, missing the 0.4% consensus on the cool side. Yet annual inflation climbed from 6.3% to 6.5%, while food, trucking and electronic components recorded notable increases. The headline is not a single-direction trading signal.",
 comparisonStatus:"SOURCE_CHECKED_CONTEXT",
 contrasts:[
  {id:"ppi-mom",metric:"Final-demand PPI · monthly",basis:"Seasonally adjusted % m/m",
   period:"October 2026 versus September 2026",
   actual:"+0.3%",previous:"+1.4%",previousVintage:"Originally +1.3%; subsequently revised to +1.4%",
   expectation:"+0.4% · Reuters poll published before the release",
   deltaVsPrevious:"−1.1 percentage points (versus revised September)",
   deltaVsExpectation:"−0.1 percentage point (cooler than consensus)",
   sourceUrls:[PPI_OCT_2026_BLS_SEPT,PPI_OCT_2026_REPORTING],
   explanation:"The monthly rate slowed, although the earlier month was exceptionally strong. A below-consensus print is different from a claim that wholesale prices fell."},
  {id:"ppi-yoy",metric:"Final-demand PPI · annual",basis:"Not seasonally adjusted % y/y",
   period:"October 2026 versus September 2026",
   actual:"+6.5%",previous:"+6.3%",previousVintage:"September 2026 published result",
   expectation:null,deltaVsPrevious:"+0.2 percentage points",
   deltaVsExpectation:null,
   sourceUrls:[PPI_OCT_2026_BLS_SEPT,PPI_OCT_2026_REPORTING],
   explanation:"Producer prices are still much higher than a year earlier. This annual comparison can accelerate while the latest month's increase moderates."}
 ],
 components:"Reuters reports October food producer prices +1.3% m/m, trucking freight +3.9% m/m and electronic components/accessories +4.2% m/m. These are component observations in reporting, not verified margins or same-event security returns.",
 exposures:[
  {asset:"XLI",name:"Freight-intensive industrial businesses",tier:"ELEVATED",direction:"POTENTIAL_HEADWIND",
   mechanism:"Truck freight prices rose 3.9% m/m. Industrial shippers with low pricing power could pay more to move output, squeezing margins; XLI is a broad proxy, not a pure trucking-cost basket.",
   counterforce:"Freight carriers could earn more revenue, while manufacturers able to pass costs through may preserve margins.",
   decidingTest:"Compare freight spend and gross-margin guidance at exposed issuers with rail/truck volumes and freight-rate indices.",
   sourceUrl:PPI_OCT_2026_REPORTING},
  {asset:"SMH",name:"AI hardware and electronics chain",tier:"ELEVATED",direction:"MIXED",
   mechanism:"Electronic components/accessories prices rose 4.2% m/m. Suppliers with pricing power may benefit, while equipment integrators and data-centre builders could pay more.",
   counterforce:"The producer-price category is not SMH constituents' profit data. A higher component price can mean stronger demand or supply friction; sector returns cannot be inferred.",
   decidingTest:"Check memory/component contract prices, chip-maker margins, AI-server bills of materials and next-quarter pricing guidance.",
   sourceUrl:PPI_OCT_2026_REPORTING},
  {asset:"US02Y",name:"US two-year Treasury yield",tier:"MODERATE",direction:"MIXED",
   mechanism:"Annual PPI inflation at 6.5% may keep restrictive Fed policy in view, supporting front-end yields if the expected policy path reprices higher.",
   counterforce:"The +0.3% monthly headline undershot the +0.4% poll. A softer surprise can pull rate expectations the other way; policy is not determined by this one release.",
   decidingTest:"Compare pre/post 08:30 ET fed-funds or OIS pricing and the 2Y yield in matched windows, with simultaneous releases controlled.",
   sourceUrl:PPI_OCT_2026_REPORTING},
  {asset:"TLT",name:"Long-duration US Treasury ETF",tier:"MODERATE",direction:"POTENTIAL_HEADWIND",
   mechanism:"Persistent annual producer inflation can increase inflation compensation or expected future rates, potentially pressuring long-duration bond prices if nominal yields rise.",
   counterforce:"Growth fears, real yields, issuance and term premium also move long bonds. Below-consensus monthly PPI can offset inflation concerns.",
   decidingTest:"Separate real yields, inflation breakevens, term premium and 10Y/30Y yield changes; measure a PPI-matched TLT price window.",
   sourceUrl:PPI_OCT_2026_REPORTING}
 ],
 observedMarketReaction:"NOT_MEASURED",
 reactionNote:"No independently aligned 08:30 ET PPI-to-asset reaction packet is attached. Daily ETF/yield moves, even on release day, cannot establish PPI causation or a trade entry.",
 sourceLedger:[
  {name:"BLS · September original release",url:PPI_OCT_2026_BLS_SEPT,
   role:"Previous +1.3% month-on-month original vintage and +6.3% annual comparison"},
  {name:"Reuters · 13 November 2026 PPI report",url:PPI_OCT_2026_REPORTING,
   role:"Attributed October result, revised September +1.4%, 0.4% pre-release consensus and component detail"},
  {name:"Associated Press · 13 November 2026",url:PPI_OCT_2026_SECONDARY,
   role:"Independent contemporaneous corroboration of monthly/annual results and freight/electronics channels"}
 ]
};

function isOctoberBlsPpi(news:NewsBriefV1):boolean{
 if(news.verification!=="SOURCE_VERIFIED"||news.sourceKind.toLowerCase()!=="official")return false;
 if(!/bureau of labor statistics|\bbls\b/i.test(news.sourceName))return false;
 let source:URL;
 try{source=new URL(news.sourceUrl);}catch{return false;}
 if(source.protocol!=="https:"||!["bls.gov","www.bls.gov"].includes(source.hostname))return false;
 if(!/\/(?:news\.release\/(?:archives\/)?ppi|ppi\/)/i.test(source.pathname))return false;
 const instant=Date.parse(news.occurredAt);
 if(!Number.isFinite(instant)||news.occurredAt.slice(0,10)!=="2026-11-13"||
    instant<Date.parse("2026-11-13T13:30:00Z"))return false;
 const corpus=news.headline+" "+news.summary;
 // Do not attach a source-reviewed October case to a different release or a
 // future/older item that happens to contain the letters PPI.
 return /(?:producer price index|\bppi\b)/i.test(corpus)&&/october 2026/i.test(corpus)&&
  /\b0\.3\b/.test(corpus)&&/\b6\.5\b/.test(corpus);
}

export function sourceCheckedReleaseImpact(news:NewsBriefV1):ReleaseImpactBrief|null{
 return isOctoberBlsPpi(news)?OCTOBER_2026_PPI:null;
}
