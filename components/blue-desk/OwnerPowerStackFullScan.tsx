import "server-only";
import {readOwnerPowerStackQuoteScan} from "@/lib/bluebelly-owner-power-stack-quote-scan";
import OwnerPortfolioSortableTable from "./OwnerPortfolioSortableTable";
import type {PortfolioLine} from "./OwnerPortfolioSortableTable";
import type {PortfolioTableQuery} from "@/lib/bluebelly-owner-portfolio-filter";

type Row=Record<string,unknown>;
const clean=(x:unknown,max=250)=>typeof x==="string"?x.trim().slice(0,max):"";
const number=(x:unknown)=>typeof x==="number"&&Number.isFinite(x)?x:null;
const safeTicker=(x:unknown)=>{const ticker=clean(x,20).toUpperCase();return /^[A-Z0-9][A-Z0-9.\-]{0,17}$/.test(ticker)?ticker:"";};
const rows=(v:unknown,cap:number):Row[]=>Array.isArray(v)?v.slice(0,cap).filter((x):x is Row=>Boolean(x)&&typeof x==="object"&&!Array.isArray(x)):[];
/** Server-only source projection: one row per symbol, never two competing tables.
 * Existing owner Supabase RLS/auth gate is in OwnerPortfolioHome. Quote data is
 * only previously collected, completed-session source evidence (no fetch here). */
export default function OwnerPowerStackFullScan({snapshot,ownerSnapshotAsOf,filters:_filters}:{
 snapshot:unknown;ownerSnapshotAsOf:string|null;filters:PortfolioTableQuery;
}){
 const input=snapshot&&typeof snapshot==="object"&&!Array.isArray(snapshot)?snapshot as Row:{};
 const scan=readOwnerPowerStackQuoteScan(snapshot);
 const lines=new Map<string,PortfolioLine>();
 for(const h of rows(input.holdings,100)){
  const ticker=safeTicker(h.ticker);if(!ticker)continue;
  const position=h.position&&typeof h.position==="object"&&!Array.isArray(h.position)?h.position as Row:{};
  const quote=scan?.holdingRows.get(ticker);
  lines.set(ticker,{
   ticker,name:clean(h.name,100)||ticker,held:true,onWatchlist:false,
   quantity:number(position.quantity),currency:clean(position.currency,8),
   quantityAsOf:clean(position.quantityAsOf,30)||null,rank:null,score:number(h.score),
   close:quote?.last??null,day:quote?.change??null,threeDay:quote?.change3d??null,
   fiveDay:quote?.change5d??null,session:quote?.asOf??null,
   action:clean(h.action,240),thesis:clean(h.verdict,240),
   entry:"",invalidation:clean(h.weakness,300)
  });
 }
 for(const w of rows(input.watchlist,200)){
  const ticker=safeTicker(w.ticker);if(!ticker)continue;
  const prev=lines.get(ticker);
  const quote=scan?.watchRows.get(ticker)||scan?.holdingRows.get(ticker);
  lines.set(ticker,{
   ticker,name:prev?.name||clean(w.name,100)||ticker,
   held:prev?.held||false,onWatchlist:true,
   quantity:prev?.quantity??null,currency:prev?.currency||"",
   quantityAsOf:prev?.quantityAsOf||null,rank:number(w.rank),
   score:number(w.score)??prev?.score??null,
   close:prev?.close??quote?.last??null,day:prev?.day??quote?.change??null,
   threeDay:prev?.threeDay??quote?.change3d??null,fiveDay:prev?.fiveDay??quote?.change5d??null,
   session:prev?.session??quote?.asOf??null,
   action:clean(w.latestDecision,240)||clean(w.action,240)||prev?.action||"",
   thesis:clean(w.thesis,260)||prev?.thesis||"",
   entry:clean(w.entry,320),invalidation:clean(w.invalidation,320)||prev?.invalidation||""
  });
 }
 const result=[...lines.values()];
 return <div data-power-stack-full-private-scan={scan?"source-dated":"missing"}
   data-owner-single-table={true} data-owner-snapshot-date={ownerSnapshotAsOf||"unavailable"}>
   <OwnerPortfolioSortableTable lines={result} asOf={scan?.asOf||null}/>
 </div>;
}
