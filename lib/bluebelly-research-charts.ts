import { createHash } from "node:crypto";
import type { ComparisonColumn, ComparisonKey } from "./bluebelly-industry-comparison.ts";
import type { CompareResearch } from "./bluebelly-compare-research.ts";
import { projectBondPressure } from "./bluebelly-bond-pressure.ts";
import { marketTrend } from "./market-trend-series.ts";
import type { MarketMonitorRow } from "./market-monitor.ts";
import { sourceDateFresh } from "./bluebelly-breadth-dated.ts";

export const RESEARCH_CHART_VERSION = "bluebelly/research-chart/1" as const;
type Mark = { label: string; value: number; sources: { name: string; url: string }[] };
type Spec = {
  id: string; title: string; asOf: string | null; frequency: "daily" | "monthly" | "quarterly";
  window: string; unit: "%" | "pp" | "USD bn" | "bp"; kind: "SOURCE_DATED_RETURN" | "SOURCE_DATED_SECONDARY" | "DERIVED_GAP" | "OBSERVED_HISTORY" | "VERIFIED_FILING" | "REVIEWED_ISSUER" | "REGIME_YIELD_PROXY";
  segments?: string[][];
  expected: number; marks: Mark[]; missing: string[];
};
export type ResearchChart = Spec & {
  version: typeof RESEARCH_CHART_VERSION;
  status: "READY" | "PARTIAL" | "UNAVAILABLE";
  dataHash: string; svg: string | null;
};
const source = (name: string | null | undefined, url: string | null | undefined) => {
  if (!url) return [];
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password) return [];
    return [{ name: name || u.hostname, url: u.toString() }];
  } catch { return []; }
};
const esc = (s: string) => s.replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
const usable = (m: Mark) => Number.isFinite(m.value) && m.sources.length > 0;
const recent = (date: string | null, now: Date): date is string =>
  Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date) && sourceDateFresh(date, now));
const fmt = (n: number) => n.toFixed(2).replace(/\.00$/, "");
// Only the small rendered SVG strings are cached; no new provider, persistence or schedule.
const rendered = new Map<string, string>();
function svg(s: Spec): string {
  if(s.kind==="OBSERVED_HISTORY")return historySvg(s);
  const width=880, left=210, right=690, top=100, step=36;
  const height=top+s.marks.length*step+108;
  const limit=Math.max(1,...s.marks.map(m=>Math.abs(m.value)));
  const lo=s.kind==="SOURCE_DATED_SECONDARY"?0:-limit;
  const hi=s.kind==="SOURCE_DATED_SECONDARY"?100:limit;
  const x=(v:number)=>left+(v-lo)/(hi-lo)*(right-left);
  const color=(v:number)=>(s.kind==="SOURCE_DATED_SECONDARY"||s.kind==="REGIME_YIELD_PROXY")?"#71638f":v<0?"#ad5447":"#42765a";
  const ticks=[lo,(lo+hi)/2,hi];
  const body=s.marks.map((m,i)=>{
    const y=top+i*step;
    const start=x(0),end=x(m.value);
    return '<text x="24" y="'+(y+18)+'" font-size="15">'+esc(m.label)+'</text>'
      +'<rect x="'+Math.min(start,end)+'" y="'+y+'" width="'+Math.abs(end-start)+'" height="24" rx="3" fill="'+color(m.value)+'"/>'
      +'<text x="710" y="'+(y+18)+'" font-size="15">'+esc(fmt(m.value)+" "+s.unit)+'</text>';
  }).join("");
  const provenance=s.marks.map(m=>m.label+": "+m.sources.map(p=>p.name+" "+p.url).join("; ")).join(" | ");
  const names=[...new Set(s.marks.flatMap(m=>m.sources.map(p=>p.name)))].join(" · ");
  const footer=top+s.marks.length*step;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+height+'" role="img">'
    +'<title>'+esc(s.title)+'</title><desc>'+esc(provenance+" | Missing: "+s.missing.join(", "))+'</desc>'
    +'<rect width="100%" height="100%" rx="12" fill="#fbf7ef"/>'
    +'<g font-family="Arial, sans-serif" fill="#302b26">'
    +'<text x="24" y="34" font-size="24" font-weight="bold">'+esc(s.title)+'</text>'
    +'<text x="24" y="58" font-size="15">'+esc(s.asOf+" UTC source date · "+s.window+" · "+s.unit+" · "+s.frequency+" · "+s.marks.length+"/"+s.expected)+'</text>'
    +ticks.map(t=>'<line x1="'+x(t)+'" x2="'+x(t)+'" y1="85" y2="'+footer+'" stroke="#d7cbbd"/><text x="'+x(t)+'" y="80" text-anchor="middle" font-size="12">'+fmt(t)+'</text>').join("")
    +body+'<text x="24" y="'+(footer+25)+'" font-size="13">'+esc("Source: "+names.slice(0,95))+'</text>'
    +'<text x="24" y="'+(footer+46)+'" font-size="13">'+esc((s.kind==="DERIVED_GAP"?"Derived left minus right; not causality.":s.kind==="SOURCE_DATED_SECONDARY"?"Secondary provider participation; proxies differ.":s.kind==="VERIFIED_FILING"?"Matched quarter filing amounts; not a forecast.":s.kind==="REVIEWED_ISSUER"?"Source-reviewed quarterly amounts; not adjusted estimates.":s.kind==="REGIME_YIELD_PROXY"?"Observed official yields; not a regime forecast.":"Recorded price returns; not fund flows."))+'</text>'
    +'<text x="24" y="'+(footer+67)+'" font-size="13">'+esc(s.missing.length?"Unavailable: "+s.missing.join(", ").slice(0,100):"All expected rows available")+'</text></g></svg>';
}
function historySvg(s: Spec): string {
  const width=880,height=390,left=90,right=840,top=93,bottom=298;
  const values=s.marks.map(m=>m.value), min=Math.min(...values),max=Math.max(...values);
  const pad=Math.max((max-min)*0.12,0.01);
  const lo=min-pad,hi=max+pad;
  const time=(label:string)=>Date.parse(label+"T00:00:00Z");
  const first=time(s.marks[0].label),last=time(s.marks.at(-1)!.label);
  const x=(label:string)=>left+(time(label)-first)/Math.max(1,last-first)*(right-left);
  const y=(v:number)=>bottom-(v-lo)/(hi-lo)*(bottom-top);
  const points=new Map(s.marks.map(m=>[m.label,m.value]));
  const grid=[0,1,2,3,4].map(i=>{const v=lo+i*(hi-lo)/4;return '<line x1="'+left+'" x2="'+right+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#d7cbbd"/><text x="'+(left-10)+'" y="'+(y(v)+4)+'" text-anchor="end" font-size="13">'+fmt(v)+'</text>';}).join("");
  const lines=(s.segments??[]).map(seg=>seg.length===1?'<circle cx="'+x(seg[0])+'" cy="'+y(points.get(seg[0])!)+'" r="3" fill="#71638f"/>':'<path d="'+seg.map((d,i)=>(i?"L":"M")+x(d).toFixed(2)+" "+y(points.get(d)!).toFixed(2)).join(" ")+'" fill="none" stroke="#71638f" stroke-width="2.5"/>').join("");
  const firstSource=s.marks[0].sources[0];
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+height+'" role="img"><title>'+esc(s.title)+'</title><desc>'+esc(firstSource.name+" "+firstSource.url+"; source observations only; gaps not interpolated.")+'</desc><rect width="100%" height="100%" rx="12" fill="#fbf7ef"/><g font-family="Arial, sans-serif" fill="#302b26"><text x="24" y="34" font-size="24" font-weight="bold">'+esc(s.title)+'</text><text x="24" y="59" font-size="15">'+esc(s.asOf+" source date · "+s.frequency+" · "+s.unit+" · "+s.marks.length+" observations")+'</text>'+grid+lines+'<text x="'+left+'" y="322" font-size="13">'+s.marks[0].label+'</text><text x="'+right+'" y="322" text-anchor="end" font-size="13">'+s.marks.at(-1)!.label+'</text><text x="24" y="350" font-size="13">'+esc("Source: "+firstSource.name.slice(0,95))+'</text><text x="24" y="371" font-size="13">Observed history; no extrapolation or gap filling.</text></g></svg>';
}
function finish(s: Spec): ResearchChart {
  const dataHash=createHash("sha256").update(JSON.stringify([RESEARCH_CHART_VERSION,s])).digest("hex");
  const status=s.marks.length<2?"UNAVAILABLE":s.marks.length<s.expected?"PARTIAL":"READY";
  let graphic:string|null=null;
  if(status!=="UNAVAILABLE"){
    graphic=rendered.get(dataHash)??svg(s);
    if(!rendered.has(dataHash)){
      rendered.set(dataHash,graphic);
      if(rendered.size>32)rendered.delete(rendered.keys().next().value!);
    }
  }
  return {...s,version:RESEARCH_CHART_VERSION,status,dataHash,svg:graphic};
}
/** Read-only chart projection of existing source-qualified Compare results.
 * Do not pass provider widgets, estimated values or narrative claims here. */
export function buildResearchCharts(data: CompareResearch): ResearchChart[] {
  const now=new Date(data.generatedAt);
  const charts:ResearchChart[]=[];
  for(const w of data.rotation){
    const marks=recent(w.asOf,now)?w.bars.map(b=>({label:b.symbol,value:b.changePercent,sources:source(b.sourceName,b.sourceUrl)})).filter(usable):[];
    const missing=[...new Set([...w.missing,...w.bars.filter(b=>!marks.some(m=>m.label===b.symbol)).map(b=>b.symbol)])].sort();
    charts.push(finish({id:"rotation-"+w.window,title:"XL sector rotation — "+w.window,asOf:marks.length?w.asOf:null,frequency:"daily",window:w.window,unit:"%",kind:"SOURCE_DATED_RETURN",expected:w.expected,marks,missing}));
  }
  const eligible=data.breadth.filter(b=>b.status==="SOURCE_DATED_SECONDARY" && recent(b.asOf,now) && b.level!==null && b.level>=0 && b.level<=100 && source(b.sourceName,b.sourceUrl).length);
  const date=eligible.map(b=>b.asOf!).sort().at(-1)??null;
  const breadth=eligible.filter(b=>b.asOf===date).map(b=>({label:b.symbol,value:b.level!,sources:source(b.sourceName,b.sourceUrl)}));
  charts.push(finish({id:"breadth",title:"Market participation — above moving averages",asOf:date,frequency:"daily",window:"source session",unit:"%",kind:"SOURCE_DATED_SECONDARY",expected:8,marks:breadth,missing:["S5TW","S5FI","S5OH","S5TH","NDFI","NDTH","R2FI","R2TH"].filter(s=>!breadth.some(m=>m.label===s))}));
  for(const w of data.divergences){
    const eligible=w.pairs.filter(p=>p.status!=="NOT_COMPARABLE" && recent(p.sourceSession,now) && p.gapPp!==null && Number.isFinite(p.gapPp) && source(null,p.leftSourceUrl).length && source(null,p.rightSourceUrl).length);
    const date=eligible.map(p=>p.sourceSession!).sort().at(-1)??null;
    const marks=eligible.filter(p=>p.sourceSession===date).map(p=>({label:p.left+" / "+p.right,value:p.gapPp!,sources:[...source(null,p.leftSourceUrl),...source(null,p.rightSourceUrl)]}));
    charts.push(finish({id:"divergence-"+w.window,title:"Relative market divergence — "+w.window,asOf:date,frequency:"daily",window:w.window,unit:"pp",kind:"DERIVED_GAP",expected:w.pairs.length,marks,missing:w.pairs.map(p=>p.left+" / "+p.right).filter(p=>!marks.some(m=>m.label===p)).sort()}));
  }
  return charts;
}

/** Bounded macro histories, using the same admitted MarketMonitor points and
 * marketTrend gap/age checks. No estimates, new requests or proxy substitution. */
export function buildMacroResearchCharts(rows:readonly MarketMonitorRow[],now:Date):ResearchChart[]{
 const targets=[
  {id:"us2y",title:"US 2-year Treasury yield",unit:"%" as const,type:"Rates"},
  {id:"us10y-fred",title:"US 10-year Treasury yield (FRED)",unit:"%" as const,type:"Rates"},
  {id:"hy-oas",title:"US high-yield option-adjusted spread",unit:"pp" as const,type:"Credit / Risk"},
 ];
 return targets.map(t=>{
  const row=rows.find(r=>r.id===t.id&&r.type===t.type&&r.frequency==="daily");
  const sources=source(row?.sourceName,row?.sourceUrl);
  const trend=row?marketTrend(row,"90D",now):null;
  const eligible=!!trend&&!trend.stale&&!trend.missing&&sources.length>0;
  const date=(time:number)=>new Date(time*1000).toISOString().slice(0,10);
  const marks=eligible?trend!.points.map(p=>({label:date(p.time),value:p.close,sources})):[];
  return finish({id:"macro-"+t.id,title:t.title,asOf:eligible?trend!.sourceDate:null,frequency:"daily",window:"90D",unit:t.unit,kind:"OBSERVED_HISTORY",expected:Math.max(2,marks.length),marks,missing:eligible?[]:[trend?.stale?"Stale source history":!sources.length?"Source unavailable":"Insufficient dated observations"],segments:eligible?trend!.segments.map(seg=>seg.map(p=>date(p.time))):[]});
 });
}

/** Reuse the MD7 quarterly financial comparison admission. No arithmetic on
 * narrative text, adjusted figures, or mismatched issuer quarters. */
export const RESEARCH_CASH_ISSUERS=["NVDA","AMD","DELL","MSFT","AMZN","ORCL"] as const;
export function buildIssuerCashCharts(columns:readonly ComparisonColumn[],now:Date):ResearchChart[]{
 const metrics:[ComparisonKey,string][]=[
  ["operating_cash_flow","Operating cash flow"],["capital_expenditure","Capital expenditure"],
  ["free_cash_flow","Free cash flow"],["net_income","Net income"],
 ];
 return RESEARCH_CASH_ISSUERS.map(ticker=>{
  const col=columns.find(c=>c.ticker.toUpperCase()===ticker);
  const reviewed=col?.state==="REVIEWED_SCORECARD";
  const kind=reviewed?"REVIEWED_ISSUER" as const:"VERIFIED_FILING" as const;
  const date=col?.releaseDay??null,stamp=date?Date.parse(date+"T00:00:00Z"):NaN;
  const eligible=!!col&&col.state!=="UNAVAILABLE"&&!!col.fiscalPeriod&&Number.isFinite(stamp)&&stamp<=now.getTime()&&stamp>=now.getTime()-90*86400000;
  const candidates=eligible?metrics.flatMap(([key,label])=>{
   const m=col!.cells[key];
   if(m.state!==(reviewed?"REVIEWED_NUMERIC":"VERIFIED_NUMERIC")||m.unit!=="USD"||m.value===null||!Number.isFinite(m.value)||!m.basis||!m.sourceUrl)return [];
   // The reviewed scorecard adapter explicitly stores the numeric receipt's period end in note.
   const period=reviewed?m.note?.match(/^Quarter ended (\d{4}-\d{2}-\d{2}) · /)?.[1]:col!.fiscalPeriod;
   if(!period||!source(m.basis,m.sourceUrl).length)return [];
   return [{label,value:m.value/1e9,sources:source(m.basis,m.sourceUrl),period,url:m.sourceUrl}];
  }):[];
  // Refuse to draw a comparison if the selected amounts have conflicting provenance.
  const matched=candidates.length>0&&candidates.every(m=>m.period===candidates[0].period&&m.url===candidates[0].url);
  const marks:Mark[]=matched?candidates.map(({label,value,sources})=>({label,value,sources})):[];
  const missing=metrics.map(([,label])=>label).filter(label=>!marks.some(m=>m.label===label));
  return finish({id:"cash-"+ticker.toLowerCase(),title:ticker+" — quarterly cash conversion",asOf:marks.length?date:null,frequency:"quarterly",window:col?.fiscalPeriod??"period unavailable",unit:"USD bn",kind,expected:metrics.length,marks,missing});
 });
}

/** Project the existing bond-regime measurement, without inventing a regime
 * confidence score or combining mismatched cash-yield sessions. */
export function buildBondRegimeCharts(rows:readonly MarketMonitorRow[],now:Date):ResearchChart[]{
 const reading=projectBondPressure(rows,now);
 const valid=reading.state==="READY"||reading.state==="LAST_REPORTED";
 const asOf=valid?reading.asOf:null;
 const curve=reading.curve.filter(m=>asOf!==null&&m.asOf===asOf&&m.last!==null&&Number.isFinite(m.last))
   .map(m=>({label:m.label,value:m.last!,sources:source(m.sourceName,m.sourceUrl)})).filter(usable);
 const charts=[finish({id:"regime-bond-curve",title:"Bond regime — official yield curve",asOf,frequency:"daily",window:"matched source session",unit:"%",kind:"REGIME_YIELD_PROXY",expected:reading.curve.length,marks:curve,missing:reading.curve.filter(m=>!curve.some(x=>x.label===m.label)).map(m=>m.label)})];
 const ten=reading.curve.find(m=>m.id==="us10y-fred"),thirty=reading.curve.find(m=>m.id==="us30y-fred");
 for(const w of reading.windows){
  const matched=valid&&w.from&&w.to===asOf&&w.tenYearBp!==null&&w.thirtyYearBp!==null;
  const marks=matched?[{label:"10Y",value:w.tenYearBp!,sources:source(ten?.sourceName,ten?.sourceUrl)},{label:"30Y",value:w.thirtyYearBp!,sources:source(thirty?.sourceName,thirty?.sourceUrl)}].filter(usable):[];
  charts.push(finish({id:"regime-duration-"+w.label,title:"Bond regime — yield change "+w.label,asOf:marks.length?asOf:null,frequency:"daily",window:matched?w.label+" · "+w.from+" to "+w.to:w.label,unit:"bp",kind:"REGIME_YIELD_PROXY",expected:2,marks,missing:["10Y","30Y"].filter(m=>!marks.some(x=>x.label===m))}));
 }
 return charts;
}
