"use client";
import {Fragment,useMemo,useState} from "react";
import styles from "./OwnerPortfolioHome.module.css";

export type PortfolioLine={
 ticker:string; name:string; held:boolean; onWatchlist:boolean;
 quantity:number|null; currency:string; rank:number|null; score:number|null;
 close:number|null; day:number|null; threeDay:number|null; fiveDay:number|null;
 session:string|null; quantityAsOf:string|null;
 action:string; thesis:string; entry:string; invalidation:string;
};
type Column="ticker"|"group"|"quantity"|"close"|"day"|"threeDay"|"fiveDay"|"score"|"session";
type Direction="asc"|"desc";
const columns:Array<{key:Column;label:string;numeric:boolean}>= [
 {key:"ticker",label:"Instrument",numeric:false},{key:"group",label:"Group",numeric:false},
 {key:"quantity",label:"Recorded units",numeric:true},{key:"close",label:"Last close",numeric:true},
 {key:"day",label:"1D",numeric:true},{key:"threeDay",label:"3D",numeric:true},
 {key:"fiveDay",label:"5D",numeric:true},{key:"score",label:"Old score",numeric:true},
 {key:"session",label:"Session",numeric:false}
];
const numeric=(v:number|null,digits=2)=>v===null?"—":v.toLocaleString("en-GB",{maximumFractionDigits:digits});
const change=(v:number|null)=>v===null?"—":`${v>0?"+":""}${v.toFixed(2)}%`;
const group=(r:PortfolioLine)=>r.held?"Holding":r.onWatchlist?"Watchlist":"Research";
function value(row:PortfolioLine,col:Column):number|string|null{
 if(col==="ticker")return row.ticker;
 if(col==="group")return group(row);
 if(col==="quantity")return row.held?row.quantity:null;
 if(col==="close")return row.close;
 if(col==="day")return row.day;
 if(col==="threeDay")return row.threeDay;
 if(col==="fiveDay")return row.fiveDay;
 if(col==="score")return row.score;
 return row.session;
}
/** Sort is purely in browser memory, after owner RLS. No API call per click. */
export function sortPortfolioLines(rows:PortfolioLine[],sort:Column,direction:Direction){
 const mult=direction==="asc"?1:-1;
 return [...rows].sort((a,b)=>{
  const av=value(a,sort),bv=value(b,sort);
  if(av===null&&bv===null)return a.ticker.localeCompare(b.ticker);
  if(av===null)return 1;if(bv===null)return -1;
  const result=typeof av==="number"&&typeof bv==="number"
   ?av-bv:String(av).localeCompare(String(bv));
  return result*mult||a.ticker.localeCompare(b.ticker);
 });
}
export default function OwnerPortfolioSortableTable({lines,asOf}:{lines:PortfolioLine[];asOf:string|null}){
 const [sort,setSort]=useState<Column>("ticker");
 const [direction,setDirection]=useState<Direction>("asc");
 const [scope,setScope]=useState<"all"|"holdings"|"watchlist">("all");
 const [search,setSearch]=useState("");
 const [expanded,setExpanded]=useState<string|null>(null);
 const ordered=useMemo(()=>sortPortfolioLines(lines.filter(line=>
  (scope==="all"||scope==="holdings"&&line.held||scope==="watchlist"&&line.onWatchlist)
  &&(!search||[line.ticker,line.name,line.action].join(" ").toLowerCase().includes(search.trim().toLowerCase()))
 ),sort,direction),[lines,sort,direction,scope,search]);
 const toggle=(key:Column)=>{if(sort===key)setDirection(v=>v==="asc"?"desc":"asc");else {setSort(key);setDirection(["ticker","group","session"].includes(key)?"asc":"desc");}};
 return <section className={styles.compact} data-owner-single-market-table="true">
  <div className={styles.compactHead}>
   <div><h3>Portfolio &amp; watchlist</h3><p>One table · {lines.filter(x=>x.held).length} recorded holdings · {lines.filter(x=>x.onWatchlist).length} research names</p></div>
   <span className={styles.tableNote}>Last private scan: {asOf?asOf.slice(0,16).replace("T"," ")+" UTC":"unavailable"}</span>
  </div>
  <div className={styles.compactFilters}>
   <label>Find instrument<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ticker or company…" aria-label="Filter portfolio instruments"/></label>
   <div role="group" aria-label="Instrument group">{(["all","holdings","watchlist"] as const).map(s=>
     <button type="button" key={s} className={styles.compactChip} aria-pressed={scope===s} onClick={()=>setScope(s)}>{s==="all"?"All":s==="holdings"?"Holdings":"Watchlist"}</button>)}</div>
  </div>
  <div className={styles.tableWrap}><table className={styles.compactTable}>
   <thead><tr>{columns.map(col=><th key={col.key} scope="col" aria-sort={sort===col.key?direction==="asc"?"ascending":"descending":"none"}>
    <button type="button" onClick={()=>toggle(col.key)} className={styles.sortButton} aria-label={`Sort by ${col.label}`}>
     {col.label} <span aria-hidden="true">{sort===col.key?direction==="asc"?"▲":"▼":"↕"}</span>
    </button></th>)}</tr></thead>
   <tbody>{ordered.map(row=><Fragment key={row.ticker}>
    <tr data-held={row.held?"true":"false"}>
     <th scope="row"><button type="button" className={styles.instrumentButton} aria-expanded={expanded===row.ticker} onClick={()=>setExpanded(v=>v===row.ticker?null:row.ticker)}><strong>{row.ticker}</strong><span>{row.name}</span></button></th>
     <td>{group(row)}{row.held&&row.onWatchlist?<small>+ watchlisted</small>:null}</td>
     <td>{row.held?numeric(row.quantity,8):"—"}</td>
     <td>{row.close===null?"—":`${row.currency||""} ${numeric(row.close,3)}`}</td>
     {([row.day,row.threeDay,row.fiveDay] as const).map((v,i)=><td key={i} data-direction={v===null?"unknown":v>0?"up":v<0?"down":"flat"}>{change(v)}</td>)}
     <td>{numeric(row.score,1)}<small>{row.score!==null?"Archived":"Not scored"}</small></td>
     <td>{row.session||"—"}<small>{row.close===null?"Missing / stale price":"Closed session"}</small></td>
    </tr>
    {expanded===row.ticker?<tr className={styles.detailsRow}><td colSpan={9}>
     <div className={styles.rowDetailGrid}>
      <p><strong>Recorded research</strong> {row.action||row.thesis||"Research pending"}</p>
      <p><strong>Entry / confirmation</strong> {row.entry||"No approved entry condition"}</p>
      <p><strong>Invalidation</strong> {row.invalidation||"Not recorded"}</p>
      <p><strong>Quantity date</strong> {row.quantityAsOf||"Unknown"}</p>
     </div></td></tr>:null}
   </Fragment>)}{ordered.length===0?<tr><td colSpan={9} className={styles.filterEmpty}>No matching instruments in this archived owner snapshot.</td></tr>:null}</tbody>
  </table></div>
  <p className={styles.vintage}>Values are archived or completed-session observations, not brokerage-confirmed positions or real-time quotes. Missing/stale observations remain blank. Click a column heading to sort; click a ticker for its original research notes.</p>
 </section>;
}
