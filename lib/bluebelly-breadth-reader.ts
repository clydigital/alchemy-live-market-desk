import "server-only";

import { REVIEWED_BREADTH_SEED, type BreadthSeries } from "./bluebelly-breadth-dated";

// Only the two S&P breadth series have reviewed, public daily histories.
// We do not infer Nasdaq/Russell values from similarly named S&P series.
const SOURCES = REVIEWED_BREADTH_SEED;

export function parseBreadthHistoricalHtml(html: string, source: BreadthSeries): BreadthSeries | null {
  if (html.length > 3000000 || !html.includes("Historical")) return null;
  const clean = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g, " | ").replace(/&nbsp;|&#160;/g," ")
    .replace(/\s+/g," ").slice(0,1200000);
  const expression = /([A-Z][a-z]{2})\s+(\d{1,2}),\s+(20\d{2})\s*\|\s*(\d{1,3}(?:\.\d{1,4})?)/g;
  const months:Record<string,number> = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
  const observed = new Map<string,number>();
  for(const match of clean.matchAll(expression)){
    const month=months[match[1]],day=Number(match[2]),year=Number(match[3]),value=Number(match[4]);
    if(!month || day<1 || day>31 || value<0 || value>100)continue;
    const date=`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    if(!Number.isFinite(Date.parse(date+"T00:00:00Z")))continue;
    if(observed.has(date) && observed.get(date)!==value)return null;
    observed.set(date,value);
  }
  if(observed.size<6)return null;
  const dateOrder=[...observed.keys()].sort();
  const overlap=source.points.filter(p=>observed.has(p.date));
  // Dated seed acts as a consistency check, not permission to invent gaps.
  if(overlap.some(p=>Math.abs(observed.get(p.date)!-p.value)>0.02))return null;
  if(!overlap.length)return null;
  return {...source,points:dateOrder.map(date=>({date,value:observed.get(date)!})).slice(-50)};
}

export async function getSourceDatedBreadth(): Promise<{
  series:BreadthSeries[];
  retrievalStatus: "refreshed" | "fallback" | "mixed";
}> {
  const outcomes=await Promise.all(SOURCES.map(async source => {
    try {
      const response=await fetch(source.sourceUrl,{
        headers:{"accept":"text/html","user-agent":"Mozilla/5.0 (compatible; Bluebelly-Market-Research/1.0)"},
        next:{revalidate:21600},signal:AbortSignal.timeout(4500),
      });
      if(!response.ok)return {source,refreshed:false};
      const latest=parseBreadthHistoricalHtml(await response.text(),source);
      return {source:latest || source,refreshed:Boolean(latest)};
    } catch {return {source,refreshed:false};}
  }));
  const count=outcomes.filter(x=>x.refreshed).length;
  return {series:outcomes.map(x=>x.source),
    retrievalStatus:count===2?"refreshed":count===0?"fallback":"mixed"};
}
