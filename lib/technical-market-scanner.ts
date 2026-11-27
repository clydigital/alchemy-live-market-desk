import type {PublicEquityCoverageRow} from "./bluebelly-equity-coverage.ts";
import type {MarketMonitorRow} from "./market-monitor.ts";
import type {EmaObservation} from "./bluebelly-equity-ema.ts";
import {SCANNER_US_ETFS as ETFs} from "./technical-scanner-etf-identities.ts";
export type Membership="Holding"|"Saved idea"|"Archived watch";
export type PrivateSymbol={ticker:string;name:string;memberships:Membership[];intent:"Buy / add"|"Sell / reduce"|"Watch"|"Unspecified";theme:string};
export type ScanAsset={ticker:string;name:string;category:string;theme:string;region:string;price:number|null;currency:string|null;asOf:string|null;sourceName:string|null;sourceUrl:string|null;quality:string;observations:EmaObservation[];memberships:Membership[];intent:PrivateSymbol["intent"];detail:boolean};
const aliases:Record<string,string>={MNHLDG:"0245.KL",UUE:"0310.KL",HEGROUP:"0296.KL",GAMUDA:"5398.KL",TENAGA:"5347.KL",MISC:"3816.KL",HIBISCS:"5199.KL",YTLPOWR:"6742.KL",DAYANG:"5141.KL","688825":"688825.SS"};
const safe=(s:unknown)=>typeof s==="string"?s.trim().slice(0,100):"";
export function projectPrivateSymbols(snapshot:unknown,ideas:readonly unknown[]):PrivateSymbol[]{
 const out=new Map<string,PrivateSymbol>();
 const obj=snapshot&&typeof snapshot==="object"?snapshot as Record<string,unknown>:{};
 const append=(list:unknown,membership:Membership,max:number)=>{
  if(!Array.isArray(list))return;
  for(const raw of list.slice(0,max)){
   if(!raw||typeof raw!=="object")continue;
   const r=raw as Record<string,unknown>,code=safe(r.ticker).toUpperCase(),ticker=aliases[code]??code;
   if(!/^[A-Z0-9][A-Z0-9.\-]{0,17}$/.test(ticker))continue;
   const previous=out.get(ticker),action=safe(r.action).toLowerCase();
   const intent:PrivateSymbol["intent"]=membership!=="Archived watch"?"Unspecified":/^(sell|short|trim|reduce)\b/.test(action)&&!/\b(buy|add|accumulate|avoid|not|no|wait)\b/.test(action)?"Sell / reduce":/^(buy|add|accumulate)\b/.test(action)&&!/\b(sell|short|trim|reduce|avoid|not|no|wait)\b/.test(action)?"Buy / add":"Watch";
   out.set(ticker,{ticker,name:previous?.name||safe(r.name)||ticker,memberships:[...new Set([...(previous?.memberships??[]),membership])],intent:intent==="Unspecified"?previous?.intent??intent:intent,theme:previous?.theme||safe(r.theme)});
  }
 };
 append(obj.holdings,"Holding",100);append(obj.watchlist,"Archived watch",200);append(ideas,"Saved idea",250);
 return [...out.values()];
}
// Explicit US ETF identity allowlist. Never interpret a cash index, yield or
// FX spot as an ETF; non-covered instruments remain visible without signals.
const bonds=new Set("TLT IEF SGOV SHY EDV ZROZ TIP LQD HYG AGG GOVT USFR TLH VGIT".split(" "));
const deepDive=new Set("SPY QQQ IWM SMH SOXX XLRE ITB XHB XLK XLP XLY XLE XLF XLI XLV XLU XLB XLC TLT HYG LQD GLD SLV USO UUP".split(" "));
export function buildScannerAssets(equities:readonly PublicEquityCoverageRow[],market:readonly MarketMonitorRow[],privateSymbols:readonly PrivateSymbol[],now=new Date()):ScanAsset[]{
 const assets=new Map<string,ScanAsset>();
 const membership=new Map(privateSymbols.map(r=>[r.ticker,r]));
 const flags=(ticker:string)=>({memberships:membership.get(ticker)?.memberships??[],intent:membership.get(ticker)?.intent??"Unspecified" as const});
 for(const r of equities){
  const ready=r.status==="SOURCE_DATED"&&r.region==="US"&&r.sessionFreshness==="LATEST_COMPLETED_US_SESSION"&&r.emaScan?.recentSessionQuality?.status==="VERIFIED";
  assets.set(r.ticker,{ticker:r.ticker,name:r.company,category:"Equity",theme:r.theme,region:r.region,price:r.price,currency:r.currency,asOf:r.asOf,sourceName:r.sourceName,sourceUrl:r.sourceUrl,quality:r.status!=="SOURCE_DATED"?"Unavailable":ready?"Verified sessions":r.region==="US"?"Stale / unverified sessions":"Local date · unverified calendar",observations:r.emaScan?.observations??[],detail:r.region==="US",...flags(r.ticker)});
 }
 for(const r of market){
  const ticker=r.symbol?.toUpperCase();if(!ticker||assets.has(ticker))continue;
  const isEtf=ETFs.has(ticker),age=r.asOf?+now-Date.parse(r.asOf+"T00:00:00Z"):NaN;
  const dated=r.frequency==="daily"&&Number.isFinite(age)&&age>=0&&age<=8*86400000&&r.last!==null&&Number.isFinite(r.last)&&r.last>0;
  const scan=dated?r.emaScan??null:null;
  const conflict=market.some(x=>x!==r&&x.symbol?.toUpperCase()===ticker&&x.asOf===r.asOf&&x.last!==null&&r.last!==null&&Math.abs(x.last-r.last)>Math.max(.000001,Math.abs(r.last)*.000001));
  const matched=isEtf&&!!scan&&scan.asOf===r.asOf&&scan.recentSessionQuality?.status==="VERIFIED"&&!conflict;
  assets.set(ticker,{ticker,name:r.label,category:isEtf?(bonds.has(ticker)?"Bond ETF":"ETF / proxy"):r.type,theme:r.type,region:isEtf?"US":"Other",price:dated?r.last:null,currency:r.currency??(isEtf?"USD":null),asOf:dated?r.asOf:null,sourceName:r.sourceName,sourceUrl:r.sourceUrl,quality:!dated?"Unavailable":conflict?"Conflicting observations":matched?"Verified sessions":isEtf?"Stale / unverified sessions":"Indicative · local calendar unverified",observations:scan&&scan.asOf===r.asOf&&!conflict?scan.observations:[],detail:deepDive.has(ticker),...flags(ticker)});
 }
 // Native spot symbols are separate 4H instruments; do not substitute ETF
 // prices or infer D/W/M levels from proxies.
 for(const [ticker,name,theme] of [["XAU/USD","Gold spot","Metal"],["USD/JPY","USD/JPY spot","FX"],["BTC/USD","Bitcoin spot","Crypto"]]){
  if(!assets.has(ticker))assets.set(ticker,{ticker,name,category:theme,theme,region:"Other",price:null,currency:ticker==="USD/JPY"?"JPY":"USD",asOf:null,sourceName:null,sourceUrl:null,quality:"4H provider only",observations:[],detail:false,...flags(ticker)});
 }
 for(const r of privateSymbols)if(!assets.has(r.ticker))assets.set(r.ticker,{ticker:r.ticker,name:r.name,category:bonds.has(r.ticker)?"Bond ETF":ETFs.has(r.ticker)?"ETF / proxy":"Other / unclassified",theme:r.theme||"Unclassified",region:ETFs.has(r.ticker)?"US":"Unknown",price:null,currency:null,asOf:null,sourceName:null,sourceUrl:null,quality:"Not covered by Markets",observations:[],detail:false,...flags(r.ticker)});
 return [...assets.values()];
}
export type ScannerSignal={kind:"Cross"|"Hold"|"Approach"|"Retest"|"Reset";direction:"up"|"down";boundary:"ema"|"lower"|"upper";date:string;level:number;distance:number};
export function scannerSignals(asset:ScanAsset,o:EmaObservation,window:"1"|"3"|"5"):ScannerSignal[]{
 if(asset.quality!=="Verified sessions"||o.warmup!=="READY"||asset.price===null)return [];
 // Keep property names explicit and distinguish daily closes against W/M
 // anchors from native weekly/monthly candle closes.
 const result:ScannerSignal[]=[];
 const add=(kind:ScannerSignal["kind"],direction:ScannerSignal["direction"],boundary:ScannerSignal["boundary"],date:string)=>{
  const level=o[boundary];if(level>0)result.push({kind,direction,boundary,date,level,distance:(asset.price!/level-1)*100});
 };
 const w=o.windows[window];
 for(const e of w?.events??[])add("Cross",e.direction,e.boundary,e.session);
 for(const a of w?.boundaryApproaches??[])add("Approach",a.direction,a.boundary,o.asOf);
 for(const h of o.closeHolds??[])if(h.status==="HOLD_CONFIRMED")add("Hold",h.direction,h.boundary,h.crossedOn);
 const r=o.bandRespect,t=r?.lastRetest;
 if(t&&r?.status==="RESPECTED"&&Date.parse(o.asOf)-Date.parse(t.session)>=0&&Date.parse(o.asOf)-Date.parse(t.session)<=7*86400000)add("Retest",t.direction==="support"?"up":"down",t.boundary,t.session);
 if(t&&r?.status==="RESET"&&r.resetOn&&Date.parse(o.asOf)-Date.parse(r.resetOn)>=0&&Date.parse(o.asOf)-Date.parse(r.resetOn)<=7*86400000)add("Reset",t.direction==="support"?"down":"up",t.boundary,r.resetOn);
 return result;
}

export const SCANNER_GROUPS=["All Markets","XLs","Metals","Indices","Tech","Healthcare","Yields","Bonds","Energy","FX","Crypto","Industrials","Consumer","Real estate","Equities","PowerStack"] as const;
export type ScannerGroup=typeof SCANNER_GROUPS[number];
export function scannerGroup(value:unknown):ScannerGroup{return SCANNER_GROUPS.find(g=>g===value)??"All Markets";}
const xl=new Set("XLB XLC XLE XLF XLI XLK XLP XLRE XLU XLV XLY".split(" "));
export function matchesScannerGroup(a:ScanAsset,group:ScannerGroup){
 switch(group){
 case "All Markets":return a.quality!=="Not covered by Markets";
 case "PowerStack":return a.memberships.length>0;
 case "XLs":return xl.has(a.ticker);
 case "Metals":return a.theme==="Metal"||["GLD","SLV","XAU/USD","XAG/USD"].includes(a.ticker);
 case "Indices":return a.theme==="Major Index"||["SPY","QQQ","IWM","DIA","RSP"].includes(a.ticker);
 case "Tech":return ["AI","AI / Semis","MAG7"].includes(a.theme)||["XLK","SMH","SOXX"].includes(a.ticker);
 case "Healthcare":return a.theme==="HEALTH"||a.ticker==="XLV";
 case "Yields":return a.theme==="Rates";
 case "Bonds":return bonds.has(a.ticker)||a.category==="Bond ETF"||a.theme==="Credit / Risk";
 case "Energy":return ["ENERGY","Energy","NUCLEAR"].includes(a.theme)||a.ticker==="XLE";
 case "FX":return a.theme==="FX"||a.ticker==="USD/JPY";
 case "Crypto":return a.theme==="Crypto"||a.ticker==="BTC/USD";
 case "Industrials":return a.theme==="INDUSTRIAL"||a.ticker==="XLI";
 case "Consumer":return ["CONSUMER","LUXURY"].includes(a.theme)||["XLP","XLY"].includes(a.ticker);
 case "Real estate":return a.theme==="REAL_ESTATE"||["XLRE","ITB","XHB"].includes(a.ticker);
 case "Equities":return a.category==="Equity";
 }
}
export type BandPosition="Above"|"Inside"|"Below";
export type BandState="Exiting ↑"|"Exiting ↓"|"Re-entering ↑"|"Re-entering ↓"|"Staying inside"|"Staying above"|"Staying below"|"Approaching ↑"|"Approaching ↓"|"Above"|"Inside"|"Below";
export function classifyBand(position:BandPosition,prior:BandPosition|null,approach:"up"|"down"|null):BandState{
 if(prior!==null&&prior!==position){
  if(position==="Above")return "Exiting ↑";
  if(position==="Below")return "Exiting ↓";
  return prior==="Above"?"Re-entering ↓":"Re-entering ↑";
 }
 if(approach)return approach==="up"?"Approaching ↑":"Approaching ↓";
 if(prior===position)return position==="Inside"?"Staying inside":position==="Above"?"Staying above":"Staying below";
 return position;
}
export type BandCell={period:number;state:BandState;position:BandPosition;side:"Above"|"Below"|"At";distance:number;edge:"upper"|"lower";date:string;quality:string;held:boolean};
const position=(p:string):BandPosition=>p==="above_upper"||p==="ABOVE"?"Above":p==="below_lower"||p==="BELOW"?"Below":"Inside";
function nearEdge(price:number,lo:number,hi:number){const lower=lo>0?(price/lo-1)*100:Infinity,upper=hi>0?(price/hi-1)*100:Infinity;return Math.abs(lower)<Math.abs(upper)?{edge:"lower" as const,distance:lower}:{edge:"upper" as const,distance:upper};}
export function dailyBandCell(a:ScanAsset,o:EmaObservation):BandCell|null{
 if(a.price===null||o.asOf!==a.asOf)return null;
 const verified=a.quality==="Verified sessions"&&o.warmup==="READY";
 const pos=position(o.band),prior=verified&&o.priorBand?position(o.priorBand):null;
 const edge=nearEdge(a.price,o.lower,o.upper);
 if(!Number.isFinite(edge.distance))return null;
 const approach=verified&&prior!==null?o.windows["1"]?.boundaryApproaches?.filter(e=>e.boundary!=="ema").sort((x,y)=>Math.abs(x.distancePct)-Math.abs(y.distancePct))[0]?.direction??null:null;
 return {period:o.period,state:classifyBand(pos,prior,approach),position:pos,side:o.side==="above"?"Above":o.side==="below"?"Below":"At",...edge,date:o.asOf,quality:o.warmup!=="READY"?"Short warm-up":verified?"Verified sessions":"Indicative / unverified",held:verified&&!!o.closeHolds?.some(h=>h.status==="HOLD_CONFIRMED"&&(pos==="Above"&&h.boundary==="upper"&&h.direction==="up"||pos==="Below"&&h.boundary==="lower"&&h.direction==="down"))};
}
export function fourHBandCells(r:import("./bluebelly-4h-levels.ts").FourHRead):BandCell[]{
 if(r.close===null||!r.asOf||r.status!=="INDICATIVE")return [];
 const price=r.close,date=r.asOf;
 return r.bands.flatMap(b=>{
  if(b.ema===null||b.lower===null||b.upper===null||b.position===null)return [];
  const ready=b.status==="READY",pos=position(b.position),prior=ready&&r.priorPositions?.[b.period]?position(r.priorPositions[b.period]!):null;
  const approach=ready&&prior!==null?r.events.filter(e=>e.period===b.period&&e.boundary!=="ema"&&e.kind==="APPROACH").sort((x,y)=>Math.abs(x.distancePct)-Math.abs(y.distancePct))[0]?.direction??null:null;
  const edge=nearEdge(price,b.lower,b.upper);if(!Number.isFinite(edge.distance))return [];
  return [{period:b.period,state:classifyBand(pos,prior,approach),position:pos,side:price>b.ema?"Above" as const:price<b.ema?"Below" as const:"At" as const,...edge,date,quality:ready?"4H indicative":"Short warm-up",held:ready&&r.events.some(e=>e.period===b.period&&e.kind==="HOLD"&&(pos==="Above"&&e.boundary==="upper"&&e.direction==="up"||pos==="Below"&&e.boundary==="lower"&&e.direction==="down"))}];
 });
}
