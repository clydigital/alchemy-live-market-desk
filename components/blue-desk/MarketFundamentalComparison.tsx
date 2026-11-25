"use client";
import {useState} from "react";
import type {FundamentalRow,FundamentalFact} from "@/lib/bluebelly-fundamental-comparison";
import styles from "./MarketFundamentalComparison.module.css";
function format(f:FundamentalFact){
 if(f.unit==="USD/shares")return "$"+f.value.toFixed(2);
 if(f.unit==="percent")return f.value.toFixed(1)+"%";
 if(f.unit==="multiple")return f.value.toFixed(1)+"x";
 return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:2}).format(f.value);
}
export default function MarketFundamentalComparison({rows,status}:{rows:FundamentalRow[];status:"OK"|"UNAVAILABLE"}){
 const [theme,setTheme]=useState("REAL_ESTATE"),[query,setQuery]=useState(""),[compare,setCompare]=useState<string[]>([]);
 const filtered=rows.filter(r=>(theme==="all"||r.theme===theme)&&(!query||[r.ticker,r.company].some(v=>v.toLowerCase().includes(query.toLowerCase()))));
 const shown=compare.length?filtered.filter(r=>compare.includes(r.ticker)):filtered;
 const available=filtered.filter(r=>r.status==="CURRENT").length;
 return <section id="market-fundamentals" className={styles.root} data-market-fundamentals="source-dated-read-only">
 <header><small>MARKET INSTRUMENTS / FUNDAMENTALS</small><h2>What are we paying for?</h2><p>Compare public issuer results and dated prices. Management guidance is not consensus or realised earnings. Private entry prices remain in Power Stack.</p></header>
 <div className={styles.controls}><label>Industry <select value={theme} onChange={e=>{setTheme(e.target.value);setCompare([]);}}><option value="all">All industries</option>{[...new Set(rows.map(r=>r.theme))].map(t=><option key={t} value={t}>{t.replaceAll("_"," ")}</option>)}</select></label><label>Search <input value={query} onChange={e=>{setQuery(e.target.value);setCompare([]);}} placeholder="Ticker or company"/></label>{compare.length?<button type="button" onClick={()=>setCompare([])}>Clear comparison</button>:null}</div>
 <p className={styles.note}>{available}/{filtered.length} with recent verified metrics · {status==="UNAVAILABLE"?"Issuer store unavailable; price coverage independent.":"Missing metrics remain unverified."} · Select up to 4 peers to compare.</p>
 <div className={styles.chips}>{filtered.map(r=><button type="button" aria-pressed={compare.includes(r.ticker)} key={r.ticker} disabled={!compare.includes(r.ticker)&&compare.length>=4} onClick={()=>setCompare(old=>old.includes(r.ticker)?old.filter(x=>x!==r.ticker):[...old,r.ticker])}>{r.ticker}</button>)}</div>
 <div className={styles.scroll}><table><thead><tr><th>Metric</th>{shown.map(r=><th key={r.ticker}>{r.ticker}<small>{r.company}</small></th>)}</tr></thead><tbody>
 <tr><th>Coverage</th>{shown.map(r=><td key={r.ticker}>{r.status}<small>{r.period??"No issuer period"} · {r.filingDay??"No source date"}</small></td>)}</tr>
 <tr><th>Latest dated price</th>{shown.map(r=><td key={r.ticker}>{r.price!==null?r.currency+" "+r.price.toFixed(2):"Unavailable"}<small>{r.priceSource?<a href={r.priceSource}>{r.priceDay}</a>:r.priceDay}</small></td>)}</tr>
 <tr><th>Guidance valuation</th>{shown.map(r=><td key={r.ticker}>{r.valuation?<>{r.valuation.label} {r.valuation.multiple.toFixed(1)}x<small>{r.valuation.yieldPct.toFixed(1)}% yield · <a href={r.valuation.sourceUrl}>{r.valuation.basis}</a></small></>:"Unavailable"}</td>)}</tr>
 {[...new Set(shown.flatMap(r=>r.facts.map(f=>f.key)))].map(key=><tr key={key}><th>{shown.flatMap(r=>r.facts).find(f=>f.key===key)?.label}</th>{shown.map(r=>{const f=r.facts.find(v=>v.key===key);return <td key={r.ticker}>{f?<>{format(f)}<small><a href={f.sourceUrl}>{f.period} · {f.filingDay}</a></small><small>{f.basis.replaceAll("_"," ")}</small></>:"—"}</td>})}</tr>)}
 </tbody></table></div><p className={styles.note}>Different fiscal periods and company-defined non-GAAP measures are labelled, not ranked as equivalent. No automatic buy or technical signal. Forward PEG needs separately verified estimate vintages; not available in this public reader.</p>
 </section>
}
