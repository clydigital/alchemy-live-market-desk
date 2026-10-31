import type { MarketSeries, PricePoint } from "./market.ts";
import type { MarketMonitorRow } from "./market-monitor.ts";

/** Read-only correlations from already-acquired daily observations. Never a trade signal. */
export const CORRELATION_WINDOWS = [20, 60, 120] as const;
export type CorrelationWindow = typeof CORRELATION_WINDOWS[number];
type Source = { origin: "core" | "monitor"; id: string; unit: "log-return" | "bp-change" };
type PairSpec = {
  id: string; label: string; relationship: string; left: Source; right: Source;
  proxyNote: string;
};
export type CorrelationCell = { coefficient: number | null; observations: number };
export type CorrelationReadout = {
  id: string; label: string; relationship: string; proxyNote: string;
  status: "measured" | "stale" | "insufficient" | "unavailable";
  asOf: string | null; sourceLeft: string | null; sourceRight: string | null;
  labelLeft: string | null; labelRight: string | null;
  urlLeft: string | null; urlRight: string | null;
  dateLeft: string | null; dateRight: string | null;
  matchedReturns: number;
  values: Record<CorrelationWindow, CorrelationCell>;
};

const PAIRS: PairSpec[] = [
  { id:"dollar-gold",label:"US dollar / gold",relationship:"Dollar strength against precious metals",
    left:{origin:"core",id:"UUP",unit:"log-return"},right:{origin:"core",id:"GLD",unit:"log-return"},
    proxyNote:"UUP dollar ETF versus GLD gold ETF; neither is the DXY index nor cash XAUUSD." },
  { id:"dollar-euro",label:"US dollar / EURUSD",relationship:"Broad dollar versus euro exposure",
    left:{origin:"core",id:"UUP",unit:"log-return"},right:{origin:"core",id:"FXE",unit:"log-return"},
    proxyNote:"UUP dollar ETF versus FXE euro ETF; FXE is an EURUSD-direction proxy, not spot." },
  { id:"nasdaq-bitcoin",label:"Nasdaq / Bitcoin",relationship:"Equity risk appetite versus crypto exposure",
    left:{origin:"core",id:"^IXIC",unit:"log-return"},right:{origin:"monitor",id:"btc-proxy",unit:"log-return"},
    proxyNote:"Nasdaq Composite versus IBIT ETF, not 24/7 BTC spot; US sessions only." },
  { id:"2y-yen",label:"US 2Y / USDJPY",relationship:"Front-end Treasury yields versus yen exchange rate",
    left:{origin:"monitor",id:"us2y",unit:"bp-change"},right:{origin:"core",id:"JPY=X",unit:"log-return"},
    proxyNote:"Two-year yield changes in basis points versus ECB-derived USDJPY; different publication clocks." },
  { id:"gold-real-yield",label:"Gold / real yields",relationship:"Gold pricing versus 10Y inflation-adjusted yields",
    left:{origin:"core",id:"GLD",unit:"log-return"},right:{origin:"monitor",id:"us10y-real",unit:"bp-change"},
    proxyNote:"GLD ETF returns versus 10-year real-yield basis-point changes, not spot gold." },
  { id:"oil-inflation",label:"Oil / inflation expectations",relationship:"WTI price versus five-year US breakevens",
    left:{origin:"core",id:"CL=F",unit:"log-return"},right:{origin:"monitor",id:"us5y-breakeven",unit:"bp-change"},
    proxyNote:"EIA WTI spot price returns versus FRED five-year breakeven changes in basis points." },
  { id:"equity-vol",label:"S&P 500 / volatility futures",relationship:"Equity exposure versus short-term VIX futures ETF",
    left:{origin:"core",id:"^GSPC",unit:"log-return"},right:{origin:"monitor",id:"vixy",unit:"log-return"},
    proxyNote:"SPY proxy versus VIXY futures ETF; VIXY is NOT the VIX spot index and has roll decay." },
  { id:"yen-carry-equities",label:"USDJPY / Nasdaq",relationship:"Yen-funded risk appetite versus technology equities",
    left:{origin:"core",id:"JPY=X",unit:"log-return"},right:{origin:"core",id:"^IXIC",unit:"log-return"},
    proxyNote:"ECB-derived daily USDJPY cross versus Nasdaq Composite; does not measure intraday funding or yen carry positions." },
  { id:"rates-dollar",label:"US 2Y / dollar",relationship:"Front-end US yield repricing versus broad dollar strength",
    left:{origin:"monitor",id:"us2y",unit:"bp-change"},right:{origin:"core",id:"UUP",unit:"log-return"},
    proxyNote:"Official US two-year yield changes versus UUP ETF; not same-minute DXY or Fed-funds futures." },
  { id:"real-yields-growth",label:"Real yields / Nasdaq",relationship:"Inflation-adjusted yields versus technology duration",
    left:{origin:"monitor",id:"us10y-real",unit:"bp-change"},right:{origin:"core",id:"^IXIC",unit:"log-return"},
    proxyNote:"Daily 10Y TIPS real-yield changes versus Nasdaq Composite returns; not an intraday event-study measure." },
  { id:"equal-weight-breadth",label:"Equal-weight / S&P 500",relationship:"Broader equity participation versus capitalisation-weighted leadership",
    left:{origin:"core",id:"RSP",unit:"log-return"},right:{origin:"core",id:"^GSPC",unit:"log-return"},
    proxyNote:"RSP equal-weight ETF versus SPY ETF proxy; compare relative returns to assess leadership, not correlation alone." },
  { id:"semis-nasdaq",label:"Semiconductors / Nasdaq",relationship:"AI hardware leadership versus wider technology risk",
    left:{origin:"core",id:"SOXX",unit:"log-return"},right:{origin:"core",id:"^IXIC",unit:"log-return"},
    proxyNote:"SOXX semiconductor ETF versus Nasdaq Composite; a high correlation does not prove relative outperformance." },
  { id:"miners-gold",label:"Gold miners / gold",relationship:"Mining equity confirmation versus gold prices",
    left:{origin:"core",id:"GDX",unit:"log-return"},right:{origin:"core",id:"GLD",unit:"log-return"},
    proxyNote:"GDX miners ETF versus GLD bullion ETF; miners add equity, operating and cost risk." },
  { id:"credit-equities",label:"High-yield spreads / equities",relationship:"Corporate credit stress versus equity risk appetite",
    left:{origin:"monitor",id:"hy-oas",unit:"bp-change"},right:{origin:"core",id:"^GSPC",unit:"log-return"},
    proxyNote:"FRED high-yield option-adjusted spread daily bp changes versus SPY ETF proxy, with different measurement clocks." },
  { id:"oil-energy-equities",label:"WTI / energy equities",relationship:"Crude price changes versus energy-sector equity returns",
    left:{origin:"core",id:"CL=F",unit:"log-return"},right:{origin:"monitor",id:"xle",unit:"log-return"},
    proxyNote:"EIA WTI spot versus XLE energy-sector ETF; producers' profits also depend on costs, hedges and company exposure." },
  { id:"brent-distillate",label:"Brent / distillate",relationship:"Crude futures narrative versus physical refined-product prices",
    left:{origin:"core",id:"BZ=F",unit:"log-return"},right:{origin:"core",id:"HO=F",unit:"log-return"},
    proxyNote:"EIA Brent spot and NY Harbor heating-oil spot daily returns; differing price units; correlation is not a crack spread." },
];

export type CorrelationHistorySource = { id:string; label:string; sourceName:string; sourceUrl:string; points:PricePoint[]; frequency?:string };
type SourceSeries = Omit<CorrelationHistorySource,"id">;
const emptyCell = (): CorrelationCell => ({ coefficient:null, observations:0 });
const emptyValues = (): Record<CorrelationWindow, CorrelationCell> => ({20:emptyCell(),60:emptyCell(),120:emptyCell()});

function dailyPoints(points: PricePoint[], now: Date) {
  const byDay = new Map<string,number>();
  const limit = now.getTime() + 60_000; // Exclude future observations; tolerate no future trading date.
  for(const point of [...points].sort((a,b)=>a.time-b.time)){
    if(!Number.isFinite(point.time)||!Number.isFinite(point.close)||point.time*1000>limit) continue;
    const date = new Date(point.time*1000).toISOString().slice(0,10);
    byDay.set(date,point.close);
  }
  return byDay;
}
function change(before:number, after:number, unit:Source["unit"]):number|null {
  if(unit==="bp-change") return (after-before)*100;
  if(before<=0||after<=0) return null;
  const v=100*Math.log(after/before);
  return Number.isFinite(v)?v:null;
}
function coefficient(x:number[],y:number[]):number|null {
  if(x.length!==y.length||x.length<2) return null;
  const n=x.length;
  const mx=x.reduce((a,b)=>a+b,0)/n;
  const my=y.reduce((a,b)=>a+b,0)/n;
  let xx=0,yy=0,xy=0;
  for(let i=0;i<n;i++){const a=x[i]-mx,b=y[i]-my;xx+=a*a;yy+=b*b;xy+=a*b;}
  if(xx<=1e-16||yy<=1e-16) return null;
  const r=xy/Math.sqrt(xx*yy);
  return Number.isFinite(r)?Math.max(-1,Math.min(1,Number(r.toFixed(3)))):null;
}
function dayAge(now:Date,day:string) {
  return (Date.parse(now.toISOString().slice(0,10)+"T00:00:00Z")-Date.parse(day+"T00:00:00Z"))/86400000;
}
function computePair(pair:PairSpec,core:Map<string,SourceSeries>,monitor:Map<string,SourceSeries>,now:Date):CorrelationReadout {
  const left=(pair.left.origin==="core"?core:monitor).get(pair.left.id);
  const right=(pair.right.origin==="core"?core:monitor).get(pair.right.id);
  const basic:CorrelationReadout={
    id:pair.id,label:pair.label,relationship:pair.relationship,proxyNote:pair.proxyNote,
    status:"unavailable",asOf:null,
    sourceLeft:left?.sourceName??null,sourceRight:right?.sourceName??null,
    labelLeft:left?.label??null,labelRight:right?.label??null,
    urlLeft:left?.sourceUrl??null,urlRight:right?.sourceUrl??null,
    dateLeft:null,dateRight:null,matchedReturns:0,values:emptyValues(),
  };
  if(!left||!right||left.frequency==="monthly"||right.frequency==="monthly")return basic;
  const lhs=dailyPoints(left.points,now),rhs=dailyPoints(right.points,now);
  const leftDays=[...lhs.keys()].sort(),rightDays=[...rhs.keys()].sort();
  basic.dateLeft=leftDays.at(-1)??null;basic.dateRight=rightDays.at(-1)??null;
  const common=leftDays.filter(d=>rhs.has(d)).sort();
  basic.asOf=common.at(-1)??null;
  if(common.length<2) return basic;
  const moves:Array<{a:number;b:number}>=[];
  for(let i=1;i<common.length;i++){
    const start=common[i-1],end=common[i];
    // Do not invent one-day returns across long source outages.
    if((Date.parse(end)-Date.parse(start))/86400000>7)continue;
    const a=change(lhs.get(start)!,lhs.get(end)!,pair.left.unit);
    const b=change(rhs.get(start)!,rhs.get(end)!,pair.right.unit);
    if(a!==null&&b!==null)moves.push({a,b});
  }
  basic.matchedReturns=moves.length;
  for(const window of CORRELATION_WINDOWS){
    if(moves.length<window)continue;
    const slice=moves.slice(-window);
    basic.values[window]={coefficient:coefficient(slice.map(v=>v.a),slice.map(v=>v.b)),observations:window};
  }
  const measured=CORRELATION_WINDOWS.some(window=>basic.values[window].coefficient!==null);
  if(!measured){basic.status="insufficient";return basic;}
  const age=Math.max(dayAge(now,basic.asOf!),dayAge(now,basic.dateLeft!),dayAge(now,basic.dateRight!));
  basic.status=age>7||dayAge(now,basic.asOf!)>5?"stale":"measured";
  return basic;
}

/** Use long, cached internal histories only for the owner research page. The
 * usual MarketMonitorRow keeps the smaller public/hybrid series payload.
 * Never replace a newer observed source with an older longer cached one.
 */
export function buildMarketToolsCorrelations(
  marketSeries:MarketSeries[], monitorRows:MarketMonitorRow[], now=new Date(),
  extendedSources:CorrelationHistorySource[]=[],
):CorrelationReadout[] {
  const core=new Map<string,SourceSeries>(marketSeries.map(s=>[s.symbol,s]));
  const monitor=new Map<string,SourceSeries>(monitorRows.map(s=>[s.id,s]));
  for(const extra of extendedSources){
    const base=monitor.get(extra.id);
    if(extra.frequency==="monthly"||extra.points.length<2)continue;
    if(base?.frequency==="monthly")continue;
    const rawLatest=extra.points.at(-1)?.time??0;
    const baseLatest=base?.points.at(-1)?.time??0;
    // Prefer the public row when history is short or source observations differ.
    if((!base||extra.points.length>base.points.length) && rawLatest>=baseLatest)
      monitor.set(extra.id,extra);
  }
  return PAIRS.map(pair=>computePair(pair,core,monitor,now));
}
