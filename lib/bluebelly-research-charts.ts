import { createHash } from "node:crypto";
import type { CompareResearch } from "./bluebelly-compare-research.ts";
import { sourceDateFresh } from "./bluebelly-breadth-dated.ts";

export const RESEARCH_CHART_VERSION = "bluebelly/research-chart/1" as const;
type Mark = { label: string; value: number; sources: { name: string; url: string }[] };
type Spec = {
  id: string; title: string; asOf: string | null; frequency: "daily";
  window: string; unit: "%" | "pp"; kind: "SOURCE_DATED_RETURN" | "SOURCE_DATED_SECONDARY" | "DERIVED_GAP";
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
  const width=880, left=210, right=690, top=100, step=36;
  const height=top+s.marks.length*step+108;
  const limit=Math.max(1,...s.marks.map(m=>Math.abs(m.value)));
  const lo=s.kind==="SOURCE_DATED_SECONDARY"?0:-limit;
  const hi=s.kind==="SOURCE_DATED_SECONDARY"?100:limit;
  const x=(v:number)=>left+(v-lo)/(hi-lo)*(right-left);
  const color=(v:number)=>s.kind==="SOURCE_DATED_SECONDARY"?"#71638f":v<0?"#ad5447":"#42765a";
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
    +'<text x="24" y="58" font-size="15">'+esc(s.asOf+" UTC source date · "+s.window+" · "+s.unit+" · daily · "+s.marks.length+"/"+s.expected)+'</text>'
    +ticks.map(t=>'<line x1="'+x(t)+'" x2="'+x(t)+'" y1="85" y2="'+footer+'" stroke="#d7cbbd"/><text x="'+x(t)+'" y="80" text-anchor="middle" font-size="12">'+fmt(t)+'</text>').join("")
    +body+'<text x="24" y="'+(footer+25)+'" font-size="13">'+esc("Source: "+names.slice(0,95))+'</text>'
    +'<text x="24" y="'+(footer+46)+'" font-size="13">'+esc((s.kind==="DERIVED_GAP"?"Derived left minus right; not causality.":s.kind==="SOURCE_DATED_SECONDARY"?"Secondary provider participation; proxies differ.":"Recorded price returns; not fund flows."))+'</text>'
    +'<text x="24" y="'+(footer+67)+'" font-size="13">'+esc(s.missing.length?"Unavailable: "+s.missing.join(", ").slice(0,100):"All expected rows available")+'</text></g></svg>';
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
