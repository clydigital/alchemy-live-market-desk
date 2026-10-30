import type {MarketMonitorRow} from "./market-monitor.ts";

/**
 * A strictly public-safe, source-dated research view, never the System 2
 * Regime verdict. It reuses the existing Market Monitor; no provider calls,
 * persistence, schedule or model interpretation belong in this file.
 */
export type CrashSignal="BULL"|"BEAR"|"MIXED"|"UNKNOWN";
export type CrashLensPosition="BULL_LEAN"|"CONTESTED"|"BEAR_LEAN";
export type CrashReading=Readonly<{
  id:string;label:string;symbol:string;value:number|null;
  dayChange:number|null;fiveSessionChange:number|null;
  unit:"index"|"price"|"yield-percent"|"spread-percent";
  asOf:string|null;sourceName:string|null;sourceUrl:string|null;
  status:"DATED"|"STALE"|"MISSING"|"UNAVAILABLE";
  note:string;
}>;
export type CrashPillar=Readonly<{
  id:string;name:string;signal:CrashSignal;basis:string;nextTest:string;
  watchId:string;observedAt:string|null;
}>;
export type CrashWatchView=Readonly<{
  position:CrashLensPosition;confidence:"LOW"|"MEDIUM";
  lastReviewed:string;readings:readonly CrashReading[];
  pillars:readonly CrashPillar[];confirmedSignals:number;
  measurementCoverage:number;sourceStatus:"DATED"|"PARTIAL"|"UNAVAILABLE";
  caveat:string;
}>;

const IDS=["spx","rsp","nasdaq-comp","ndx","russell","smh","hy-oas","ig-oas","us10y-fred","brent","usdjpy"] as const;
const SPEC:Record<string,{unit:CrashReading["unit"];note:string}>={
  spx:{unit:"index",note:"S&P 500 cash price index, not an ETF total return"},
  rsp:{unit:"price",note:"RSP equal-weight ETF price; indicative participation proxy, not the official equal-weight index"},
  "nasdaq-comp":{unit:"index",note:"Nasdaq Composite price index"},
  ndx:{unit:"price",note:"QQQ ETF proxy, not the Nasdaq-100 cash index"},
  russell:{unit:"price",note:"IWM ETF proxy, not the Russell 2000 cash index"},
  smh:{unit:"price",note:"SMH semiconductor ETF price proxy"},
  "hy-oas":{unit:"spread-percent",note:"ICE BofA high-yield OAS via FRED; levels in percentage points, not HYG returns"},
  "ig-oas":{unit:"spread-percent",note:"ICE BofA investment-grade OAS via FRED; levels in percentage points"},
  "us10y-fred":{unit:"yield-percent",note:"Nominal ten-year Treasury yield from FRED"},
  brent:{unit:"price",note:"Brent provider contract/spot basis must be checked before macro attribution"},
  usdjpy:{unit:"price",note:"USDJPY source cross; a currency move alone cannot confirm carry unwinding"},
};
const ALLOWED_CREDIT:Record<string,string>={
  "hy-oas":"https://fred.stlouisfed.org/series/BAMLH0A0HYM2",
  "ig-oas":"https://fred.stlouisfed.org/series/BAMLC0A0CM",
};
function safeSource(url:string):boolean{
  try{const u=new URL(url);return u.protocol==="https:"&&!u.username&&!u.password&&url.length<2048;}catch{return false;}
}
function calendarDay(value:string|null|undefined):string|null{
  if(!value)return null;
  const day=value.slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return null;
  const timestamp=Date.parse(day+"T00:00:00Z");
  return Number.isFinite(timestamp)&&new Date(timestamp).toISOString().slice(0,10)===day?day:null;
}
function finite(value:number|null|undefined):number|null{
  return typeof value==="number"&&Number.isFinite(value)?value:null;
}
function reading(row:MarketMonitorRow|undefined,id:string,now:Date):CrashReading{
  const spec=SPEC[id], base={id,label:row?.label||id,symbol:row?.symbol||id,unit:spec.unit,
    note:spec.note,sourceName:null,sourceUrl:null,asOf:null,value:null,dayChange:null,fiveSessionChange:null} as const;
  if(!row)return {...base,status:"MISSING"};
  const day=calendarDay(row.asOf);
  const valid=day!==null&&row.frequency==="daily"&&safeSource(row.sourceUrl)&&finite(row.last)!==null;
  if(!valid)return {...base,status:"MISSING"};
  if(ALLOWED_CREDIT[id]&&row.sourceUrl!==ALLOWED_CREDIT[id])return {...base,status:"MISSING"};
  const obsTime=Date.parse(day+"T00:00:00Z"),today=Date.parse(now.toISOString().slice(0,10)+"T00:00:00Z");
  if(obsTime>today||today-obsTime>1000*60*60*24*5){
    return {...base,status:"STALE",value:row.last,asOf:day,sourceName:row.sourceName,sourceUrl:row.sourceUrl};
  }
  const last=finite(row.last);
  let fiveSessionChange: number|null=finite(row.change5d);
  if(spec.unit==="spread-percent"||spec.unit==="yield-percent"){
    fiveSessionChange=null;
    const validPoints=row.points.filter(p=>Number.isFinite(p.time)&&Number.isFinite(p.close))
      .sort((a,b)=>a.time-b.time);
    const latest=validPoints.at(-1);
    const prior=validPoints.at(-6);
    if(latest&&prior&&last!==null&&Math.abs(latest.close-last)<0.00001
      &&new Date(latest.time*1000).toISOString().slice(0,10)===day){
      fiveSessionChange=Number(((latest.close-prior.close)*100).toFixed(2)); // bp, not % return
    }
  }
  return {...base,status:"DATED",value:last,asOf:day,sourceName:row.sourceName,sourceUrl:row.sourceUrl,
    dayChange:finite(row.dayChange),fiveSessionChange};
}
function aligned(a:CrashReading|undefined,b:CrashReading|undefined):boolean{
  return !!a&&!!b&&a.status==="DATED"&&b.status==="DATED"&&a.asOf===b.asOf
    &&a.fiveSessionChange!==null&&b.fiveSessionChange!==null;
}
function signalForSpread(r:CrashReading|undefined):CrashSignal{
  if(!r||r.status!=="DATED"||r.fiveSessionChange===null)return "UNKNOWN";
  if(r.fiveSessionChange>=30)return "BEAR";
  if(r.fiveSessionChange<=-20)return "BULL";
  return "MIXED";
}
export function buildCrashWatchView(rows:readonly MarketMonitorRow[]|null,now:Date):CrashWatchView{
  const available=rows!==null&&Number.isFinite(now.getTime());
  const readings=IDS.map(id=>reading(available?rows!.find(row=>row.id===id):undefined,id,now));
  const get=(id:string)=>readings.find(row=>row.id===id);
  const spx=get("spx"),rsp=get("rsp"),hy=get("hy-oas");
  let breadth:CrashSignal="UNKNOWN",basis="A matched five-session S&P cash-index / RSP equal-weight ETF proxy comparison is unavailable.";
  if(aligned(spx,rsp)){
    const gap=Number((rsp!.fiveSessionChange!-spx!.fiveSessionChange!).toFixed(2));
    breadth=gap>=1?"BULL":gap<=-1?"BEAR":"MIXED";
    basis="RSP ETF versus S&P 500 cash index over the same five completed sessions: "
      +(gap>=0?"+":"")+gap.toFixed(2)+" percentage points. ETF versus index methodology is not identical.";
  }
  const credit=signalForSpread(hy);
  const pillars:CrashPillar[]=[
    {id:"breadth",name:"Breadth and leadership",signal:breadth,basis,nextTest:"Verify official equal-weight participation, new highs/lows and the 20-session advance-decline line.",watchId:"breadth",observedAt:aligned(spx,rsp)?spx!.asOf:null},
    {id:"credit",name:"Credit transmission",signal:credit,
      basis:hy?.status==="DATED"&&hy.fiveSessionChange!==null
        ?"High-yield OAS change over five source-dated observations: "+(hy.fiveSessionChange>=0?"+":"")+hy.fiveSessionChange.toFixed(1)+"bp; OAS widening is bearish for credit."
        :"Five-source-session high-yield OAS change unavailable; HYG ETF is not a substitute.",
      nextTest:"Check HY/CCC OAS, primary issuance, refinancing and repo before concluding financial contagion.",watchId:"bonds",observedAt:hy?.status==="DATED"?hy.asOf:null},
    {id:"earnings",name:"Valuation versus forward earnings",signal:"UNKNOWN",basis:"Company expectations and 12–18-month analyst revisions are not a qualified comparable public feed for this gauge.",nextTest:"Compare revised forward EPS with price-multiple changes and index concentration.",watchId:"breadth",observedAt:null},
    {id:"ai",name:"AI investment and cash returns",signal:"UNKNOWN",basis:"Existing AI issuer research contains verified financials but they are not admitted to this automatic market-wide score.",nextTest:"Separate paid AI usage from cash capex, leases, debt and matched fiscal-period FCF.",watchId:"ai",observedAt:null},
    {id:"rates",name:"Rates and policy flexibility",signal:"UNKNOWN",basis:"A Treasury yield move may reflect inflation, growth or liquidity; its direction alone is not a bull/bear verdict.",nextTest:"Match real yields, breakevens, Fed expectations and corporate spreads.",watchId:"bonds",observedAt:get("us10y-fred")?.asOf||null},
    {id:"energy",name:"Oil, diesel and inflation",signal:"UNKNOWN",basis:"Crude prices alone cannot distinguish supply normalisation from demand destruction.",nextTest:"Confirm physical Hormuz flows, diesel cracks, EIA inventories and inflation repricing.",watchId:"energy",observedAt:get("brent")?.asOf||null},
    {id:"yen",name:"Yen carry and forced selling",signal:"UNKNOWN",basis:"The yen moving does not establish position liquidation.",nextTest:"Check BOJ/US yields, currency basis, funding flows and risk-asset co-moves.",watchId:"yen",observedAt:get("usdjpy")?.asOf||null},
  ];
  const directional=pillars.filter(p=>p.signal==="BEAR"||p.signal==="BULL");
  const position=directional.length>=2&&directional.every(p=>p.signal==="BULL")?"BULL_LEAN":
    directional.length>=2&&directional.every(p=>p.signal==="BEAR")?"BEAR_LEAN":"CONTESTED";
  const coverage=pillars.filter(p=>p.signal!=="UNKNOWN").length;
  return {position,confidence:directional.length>=2?"MEDIUM":"LOW",
    lastReviewed:now.toISOString(),readings,pillars,confirmedSignals:directional.length,
    measurementCoverage:coverage,sourceStatus:!available?"UNAVAILABLE":coverage===7?"DATED":"PARTIAL",
    caveat:"A directional lean requires two independent, source-dated pillars agreeing. These thresholds are research heuristics, not backtested probabilities or the canonical Regime verdict. Missing and mixed inputs never count as confirming evidence."};
}

export const CRASH_HISTORY=[
 {id:"1998",year:"1998",name:"Russia / LTCM funding shock",drawdown:"~19%",recovered:"Late 1998",market:"S&P 500 / SPY comparison",lesson:"The liquidity shock eased and equities recovered, although later speculative vulnerability grew.",caution:"The commonly cited late-1998 SPY recovery uses dividend-adjusted data; do not mix with price-only SPX.",source:"https://www.federalreservehistory.org/essays/ltcm-near-failure"},
 {id:"2018",year:"2018",name:"Rate and growth scare",drawdown:"~20%",recovered:"23 April 2019",market:"S&P 500 price index",lesson:"A shift in the Fed's projected policy path helped investors reprice the future, even though growth risks had not disappeared.",caution:"A rebound was not guaranteed by the drawdown alone.",source:"https://www.federalreserve.gov/monetarypolicy/2019-07-mpr-part1.htm"},
 {id:"2020",year:"2020",name:"Pandemic forced liquidation",drawdown:"~34%",recovered:"18 August 2020",market:"S&P 500 price index",lesson:"The index recovered ahead of the real economy as liquidity, fiscal support and forward expectations changed.",caution:"A policy-supported recovery under low inflation is not directly transferable to a high-inflation crisis.",source:"https://www.federalreservehistory.org/essays/federal-reserve-history"},
 {id:"2022",year:"2022",name:"Inflation and rate repricing",drawdown:"~25%",recovered:"19 January 2024",market:"S&P 500 price index",lesson:"High rates compressed long-duration valuations; ultimately the index recovered without an immediate return to zero rates.",caution:"The path contained a lengthy drawdown and leadership concentration.",source:"https://www.schwab.com/learn/story/market-correction-what-does-it-mean"},
 {id:"2025",year:"2025",name:"April tariff shock",drawdown:"~19%",recovered:"27 June 2025",market:"S&P 500 price index",lesson:"BIS found much of the post-trough rebound reflected positive surprises unrelated to tariffs: the market absorbed new information rather than merely forgetting the threat.",caution:"Historical event attribution is model-based, not proof that unresolved tariffs became irrelevant.",source:"https://www.bis.org/publications/qr-202509/understanding-swift-market-recovery-after-april-2025-tariff-shock"},
 {id:"2000",year:"2000–02",name:"Dot-com expectation collapse",drawdown:"~49%",recovered:"2007",market:"S&P 500 price index",lesson:"Real internet adoption could not protect valuations reliant on unsupported distant profits; recovery took years.",caution:"Nasdaq Composite took until 2015 to regain its own 2000 nominal high; do not mix index horizons.",source:"https://www.schwab.com/secure/file/P-7881626"},
 {id:"2008",year:"2007–09",name:"Bank balance-sheet crisis",drawdown:"~57%",recovered:"March 2013",market:"S&P 500 price index",lesson:"Banking-system contraction made this very different from an isolated earnings scare; repairing funding took years.",caution:"Nominal index recovery is not inflation-adjusted or household-specific recovery.",source:"https://www.federalreservehistory.org/essays/great-recession-and-its-aftermath"},
] as const;

export const CRASH_LINKS=[
 {id:"ai",label:"AI capex and cash returns",mechanism:"Paid demand → operating cash → capex and leases → credit needs"},
 {id:"bonds",label:"Rates and corporate credit",mechanism:"Real yields and OAS → refinancing → forced selling"},
 {id:"energy",label:"Oil and inflation",mechanism:"Physical deliveries → diesel and CPI → Fed reaction"},
 {id:"yen",label:"JPY and carry funding",mechanism:"BOJ/yield differential → funding → leveraged overseas holdings"},
 {id:"breadth",label:"Equity breadth",mechanism:"Index concentration → rotation or broader liquidation"},
] as const;
