import Link from "next/link";
import {getMarketMonitor} from "@/lib/market-monitor-public";
import {publicMarketObservations} from "@/lib/blue-desk-public-markets";
import {buildScannerDiscovery,type ScannerCandidate} from "@/lib/bluebelly-scanner-discovery";
import ui from "./NativeMarketsDiscovery.module.css";

const finvizQuality="https://finviz.com/screener.ashx?v=111&f=cap_midover,fa_fpe_u20,fa_epspos,ta_sma50_pb";
const finvizShort="https://finviz.com/screener.ashx?v=111&f=cap_midover,sh_floatshort_o10,sh_relvol_o2,ta_change_u";

function Candidates({rows}:{rows:ScannerCandidate[]}){
 return rows.length?<ul className={ui.candidates}>{rows.map(r=><li key={r.symbol}>
  <strong>{r.symbol} <span>{r.label===r.symbol?"":r.label}</span></strong>
  <p>{r.detail}</p>
  <details><summary>Research check</summary><p>{r.nextTest}</p></details>
  <small>{r.asOf} · <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">Source ↗</a>{r.comparisonUrl?<> · <a href={r.comparisonUrl} target="_blank" rel="noopener noreferrer">Comparison ↗</a></>:null}</small>
 </li>)}</ul>:<p className={ui.empty}>No qualifying observation in the available data. This does not imply no market opportunities.</p>;
}
export default async function NativeMarketsDiscovery({positioningHref}:{positioningHref:string}){
 const monitor=await getMarketMonitor().catch(()=>null);
 const d=buildScannerDiscovery(publicMarketObservations(monitor?.rows??[],"all"));
 return <section className={ui.root} aria-label="Intelligent screens" data-native-scanner="source-dated">
  <header><h2>Intelligent screens</h2><p>{d.session?"Latest admitted session: "+d.session+" · "+d.coverage+" instruments · "+d.stockCoverage+" monitored stocks":"Source coverage unavailable"} · Research leads, not trade signals.</p></header>
  <div className={ui.grid}>
   <article><h3>Quality stocks left behind</h3><p>Sector-relative laggards · profitability and valuation not yet verified.</p><Candidates rows={d.laggards}/><a href={finvizQuality} target="_blank" rel="noopener noreferrer">Check US value &amp; profitability filters ↗</a></article>
   <article><h3>Early rotation</h3><p>Sector ETFs gaining relative strength over 1D and 3D while still trailing on 5D.</p><Candidates rows={d.rotation}/></article>
   <article><h3>Short-squeeze candidates</h3><p>Volume and bullish technical triggers · individual short float unavailable.</p><Candidates rows={d.rebound}/><a href={finvizShort} target="_blank" rel="noopener noreferrer">Verify US short float &amp; volume ↗</a><br/><Link href={positioningHref}>QQQ positioning evidence →</Link></article>
   <article><h3>Cross-asset anomalies</h3><p>Large relative gaps or opposite moves, not statistical correlation breaks.</p><Candidates rows={d.cross}/></article>
  </div>
  <details className={ui.movers}><summary>Biggest and smallest stock moves · {d.stockCoverage} tracked stocks</summary><div className={ui.grid}><article><h3>Top gainers</h3><Candidates rows={d.gainers}/></article><article><h3>Top losers</h3><Candidates rows={d.losers}/></article><article><h3>Smallest absolute moves</h3><Candidates rows={d.quiet}/></article></div></details>
 </section>;
}
