import {readPrivateProviderWidgets} from "@/lib/bluebelly-provider-widget-server";
import {SECTOR_TICKERS,BENCHMARK_TICKERS,FX_TICKERS,type WidgetRow} from "@/lib/bluebelly-provider-widget-data";
import styles from "./ProviderMarketWidgets.module.css";
const NAMES:Record<string,string>={XLB:"Materials",XLC:"Communication",XLE:"Energy",XLF:"Financials",XLI:"Industrials",XLK:"Technology",XLP:"Staples",XLRE:"Real estate",XLU:"Utilities",XLV:"Health care",XLY:"Discretionary",SPY:"S&P 500 ETF",QQQ:"Nasdaq 100 ETF",RSP:"Equal weight",SMH:"Semiconductors",SOXX:"Semiconductors","EUR/USD":"Euro","USD/JPY":"Yen","XAU/USD":"Gold spot","BTC/USD":"Bitcoin"};
function change(n:number|null){return n===null?"—":(n>0?"+":"")+n.toFixed(2)+"%";}
function price(row:WidgetRow){return row.close.toLocaleString("en-GB",{maximumFractionDigits:row.symbol==="EUR/USD"?5:2});}
function Tape({rows,expected}:{rows:WidgetRow[];expected?:string}){
 return <div className={styles.tape}>{rows.map(row=><div key={row.symbol} className={styles.tile}>
 <div><strong>{row.symbol}</strong><small>{NAMES[row.symbol]}</small></div>
 <b>{price(row)}</b><span data-direction={row.change===null?"unknown":row.change>0?"up":row.change<0?"down":"flat"}>{change(row.change)}</span>
 <small>{row.day}{row.priorDay?" vs "+row.priorDay:" · comparison unavailable"}</small>
 </div>)}{expected&&!rows.length?<p>Unavailable for {expected}. No substitute quote.</p>:null}</div>;
}
export default async function ProviderMarketWidgets({compact=false}:{compact?:boolean}){
 const data=await readPrivateProviderWidgets();if(!data)return null;
 const sectors=data.massive.filter(r=>(SECTOR_TICKERS as readonly string[]).includes(r.symbol));
 const ranked=sectors.filter(r=>r.change!==null).sort((a,b)=>b.change!-a.change!);
 const tape=data.massive.filter(r=>(BENCHMARK_TICKERS as readonly string[]).includes(r.symbol));
 const missing=SECTOR_TICKERS.filter(s=>!ranked.some(r=>r.symbol===s));
 const visible=compact?[...ranked.slice(0,3),...ranked.slice(Math.max(3,ranked.length-3))]:ranked;
 return <section className={styles.panel} aria-label="Private market data" data-provider-market-widgets="private">
 <header className={styles.head}><div><small>PRIVATE / SOURCE-DATED</small><h2>Market pulse</h2><p>Completed daily bars, not live quotes. Refresh cache: one hour.</p></div>{compact?<a href="/markets#provider-market-widgets">Full market pulse ↗</a>:null}</header>
 <div id="provider-market-widgets" className={styles.grid}>
 <section><h3>US sector rotation <small>Massive · {data.expected??"session unavailable"}</small></h3>
 {ranked.length?<div className={styles.ranks}>{visible.map(row=><div className={styles.rank} key={row.symbol}>
 <span><strong>{row.symbol}</strong> <small>{NAMES[row.symbol]}</small></span>
 <span className={styles.track}><i data-direction={row.change!>=0?"up":"down"} style={{width:Math.min(100,Math.abs(row.change!)/Math.max(0.1,...ranked.map(r=>Math.abs(r.change!)))*100)+"%"}}/></span>
 <b data-direction={row.change!>=0?"up":"down"}>{change(row.change)}</b></div>)}</div>:<p>Sector comparisons unavailable from Massive.</p>}
 <p className={styles.note}>{ranked.length}/11 sectors with comparable sessions{missing.length?" · Missing: "+missing.join(", "):""}.</p>
 </section>
 <section><h3>FX, gold &amp; Bitcoin <small>Twelve Data · daily</small></h3>
 <Tape rows={data.twelve} expected="the completed daily window"/>
 <p className={styles.note}>{data.twelve.length}/{FX_TICKERS.length} instruments available. Different market sessions are not a matched-session divergence.</p>
 </section></div>
 {!compact?<section><h3>Equity benchmarks <small>Massive · USD ETFs</small></h3><Tape rows={tape} expected={data.expected??"expected US session"}/></section>:null}
 </section>;
}
