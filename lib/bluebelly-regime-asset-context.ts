import type { PublicSourceObservation } from "./blue-desk-source-observations-projector.ts";
import type { MarketMonitorRow } from "./market-monitor.ts";
import type { FundamentalQuickView } from "./bluebelly-fundamental-quickview.ts";

/** Presentation adapter only: qualified sources and dated market tape.
 * A source topic match is NOT a thesis change, verified causal link, or
 * evidence admission. Never infer a fundamental judgement from price direction.
 */
const ASSET_EVENT_PATTERNS: Record<FundamentalQuickView["id"], RegExp> = {
  brent: /\b(?:brent|wti|crude(?: oil)?|opec|hormuz|oil (?:production|supply|demand|inventor(?:y|ies))|tanker|strait of hormuz)\b/i,
  diesel: /\b(?:diesel|distillates?|gasoil|ulsd|heating oil|crack spread|jet fuel)\b/i,
  "energy-producers": /\b(?:shell|totalenergies|equinor|chevron|exxon|oil producers?|upstream|oil earnings)\b/i,
  "ai-buyers": /\b(?:amazon|aws|alphabet|google|microsoft|azure|meta platforms|oracle|coreweave|hyperscaler|data.cent(?:er|re)|ai capex)\b/i,
  "ai-suppliers": /\b(?:sandisk|sk hynix|samsung|intel|nvidia|amd|micron|hbm|high.bandwidth memory|dram|semiconductor (?:sales|earnings|shipment))\b/i,
  nasdaq: /\b(?:nasdaq|s&p 500|sp500|spx|qqq|breadth|equal.weight|equity index|stock index)\b/i,
  us10y: /\b(?:10.year|treasur(?:y|ies) (?:yields?|rates?|auction|curve|bonds?)|long.term (?:yield|rates)|term premium|bond yields?)\b/i,
  usd: /\b(?:dxy|us dollar|dollar index|foreign.exchange|eurusd|usd[jc]py|exchange.rate)\b/i,
  gold: /\b(?:gold|xau|bullion|gold reserves?|reserve gold|precious metals?)\b/i,
  yen: /\b(?:boj|bank of japan|yen|jpy|jgb|japanese bond|japan rate|carry trade|usd\/jpy|usdjpy)\b/i,
};

/** Strict instrument IDs. Proxies are omitted unless the UI names them. */
const MARKET_ROW: Partial<Record<FundamentalQuickView["id"],{
  ids: readonly string[]; measurement: string; unit: "dollars"|"index"|"yield"|"fx"|"commodity";
}>> = {
  brent: {ids:["brent"],measurement:"Brent source series (verify contract/basis)",unit:"commodity"},
  diesel: {ids:["distillate"],measurement:"Heating oil reference (not a diesel crack spread)",unit:"commodity"},
  nasdaq: {ids:["nasdaq-comp"],measurement:"Nasdaq Composite source series",unit:"index"},
  us10y: {ids:["us10y-fred","us10y"],measurement:"US 10Y nominal yield",unit:"yield"},
  gold: {ids:["gold"],measurement:"Gold source series",unit:"commodity"},
  yen: {ids:["usdjpy"],measurement:"USD/JPY (rising means yen weaker)",unit:"fx"},
};

export type AssetEventContext = {
  state: "UNAVAILABLE"|"NO_MATCH"|"MATCHES";
  /** Every source comes from the existing public admission path, not Notion directly. */
  items: PublicSourceObservation[];
  checkedWindowHours: 48;
  boundedSample: true;
};
export type AssetTapeContext = {
  state: "UNAVAILABLE"|"MISSING"|"STALE"|"DATED";
  instrument: string|null;
  last: number|null;
  change: number|null;
  changeUnit: "%"|"bp";
  observedAt: string|null;
  sourceName: string|null;
  sourceUrl: string|null;
  measurement: string|null;
  note: string;
};

function validTime(value:string, now:Date):number|null{
  const t=Date.parse(value);
  return Number.isFinite(t) && t<=+now+60*1000 ? t : null;
}
function safeHttps(value:string):boolean{
  try{
    const u=new URL(value);
    return u.protocol==="https:" && !u.username && !u.password && u.href.length<=2048;
  }catch{return false;}
}

/** Source matching is asset-specific; never copy a generic energy hit into
 * a diesel judgement. The input is a bounded public 48h sample; no hit is
 * a coverage statement, not proof of zero events globally.
 */
export function matchAssetSourceEvents(
 assetId:FundamentalQuickView["id"],
 observations:readonly PublicSourceObservation[]|null,
 now:Date,
 limit=2,
):AssetEventContext{
  if(observations===null||!Number.isFinite(+now))return {state:"UNAVAILABLE",items:[],checkedWindowHours:48,boundedSample:true};
  const pattern=ASSET_EVENT_PATTERNS[assetId];
  if(!pattern)return {state:"NO_MATCH",items:[],checkedWindowHours:48,boundedSample:true};
  const seen=new Set<string>();
  const matches=observations.filter(item=>{
    if(!item||seen.has(item.id)||!safeHttps(item.sourceUrl))return false;
    if(item.kind!=="ORIGINAL_RELEASE"&&item.kind!=="MARKET_OBSERVATION")return false;
    const time=validTime(item.eventAt,now);
    if(time===null||(+now-time)>48*3600000)return false;
    const hit=pattern.test(item.description);
    if(hit)seen.add(item.id);
    return hit;
  }).sort((a,b)=>Date.parse(b.eventAt)-Date.parse(a.eventAt)).slice(0,Math.max(0,Math.min(4,limit)));
  return {state:matches.length?"MATCHES":"NO_MATCH",items:matches,checkedWindowHours:48,boundedSample:true};
}

export function projectAssetTape(
 assetId:FundamentalQuickView["id"],
 rows:readonly MarketMonitorRow[]|null,
 now:Date,
):AssetTapeContext{
  const spec=MARKET_ROW[assetId];
  const base:AssetTapeContext={
    state:rows===null?"UNAVAILABLE":"MISSING",instrument:null,last:null,
    change:null,changeUnit:spec?.unit==="yield"?"bp":"%",
    observedAt:null,sourceName:null,sourceUrl:null,
    measurement:spec?.measurement??null,
    note:rows===null?"Public market monitor unavailable":spec?"No verified matching instrument":"No comparable single-instrument proxy for this group",
  };
  if(!spec||rows===null||!Number.isFinite(+now))return base;
  const row=spec.ids.map(id=>rows.find(candidate=>candidate.id===id)).find(Boolean);
  if(!row||row.frequency!=="daily"||row.last===null||!Number.isFinite(row.last)
   ||!row.asOf||!safeHttps(row.sourceUrl))return base;
  const at=validTime(row.asOf,now);
  if(at===null)return base;
  const tooOld=+now-at>96*3600000;
  const prev=row.previousClose;
  const change=tooOld||prev===null||!Number.isFinite(prev)||prev===0?null:
    spec.unit==="yield"?Number(((row.last-prev)*100).toFixed(1)):
      Number(((row.last/prev-1)*100).toFixed(2));
  return {
    state:tooOld?"STALE":"DATED",
    instrument:row.symbol,last:row.last,change,changeUnit:spec.unit==="yield"?"bp":"%",
    observedAt:row.asOf,sourceName:row.sourceName,sourceUrl:row.sourceUrl,
    measurement:spec.measurement,
    note:tooOld?"Last observation exceeds the 96-hour freshness limit; no daily change displayed.":"Observed market tape only; not a causal explanation or fundamental verdict.",
  };
}
