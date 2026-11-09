import {publicMarketWindowChange,type MarketChangeWindow} from "./blue-desk-market-filters";
import type {PublicMarketObservation} from "./blue-desk-public-markets";

/**
 * Source-session-matched ETF bars. This is a visual comparison of recorded
 * cumulative changes, not a return series, inferred fund flow or price chart.
 */
export type EtfRotationBar = {
  id:string;symbol:string;label:string;value:number;display:string;
  direction:"up"|"down"|"flat";widthPercent:number;leftPercent:number;
};
export type EtfRotationVisual = {
  asOf:string;window:MarketChangeWindow;bars:EtfRotationBar[];
  omitted:number;
};

export function projectEtfRotationVisual(
  rows:readonly PublicMarketObservation[],
  selected:readonly string[],
  window:MarketChangeWindow,
):EtfRotationVisual|null {
  const active=new Set(selected);
  const eligible=rows.filter(row=>active.has(row.symbol) && row.changeUnit==="%"
    && row.frequency==="daily" && row.dataStatus!=="UNAVAILABLE_OR_STALE"
    && row.asOf && /^\d{4}-\d{2}-\d{2}/.test(row.asOf)
    && Number.isFinite(publicMarketWindowChange(row,window)));
  const counts=new Map<string,number>();
  for(const row of eligible)counts.set(row.asOf!, (counts.get(row.asOf!)||0)+1);
  const sessions=[...counts].sort((a,b)=>b[1]-a[1] || b[0].localeCompare(a[0]));
  const asOf=sessions.find(([,count])=>count>=2)?.[0];
  if(!asOf)return null;
  const aligned=eligible.filter(row=>row.asOf===asOf);
  const maximum=Math.max(...aligned.map(row=>Math.abs(publicMarketWindowChange(row,window)!)));
  const bars=aligned.map(row=>{
    const value=publicMarketWindowChange(row,window)!;
    const widthPercent=maximum>0?Math.min(49,49*Math.abs(value)/maximum):0;
    return {
      id:row.id,symbol:row.symbol,label:row.label,value,
      display:`${value>0?"+":""}${value.toFixed(2)}%`,
      direction:value>0?"up" as const:value<0?"down" as const:"flat" as const,
      widthPercent,leftPercent:value<0?50-widthPercent:50,
    };
  }).sort((a,b)=>b.value-a.value || a.symbol.localeCompare(b.symbol));
  return {asOf,window,bars,omitted:active.size-bars.length};
}
