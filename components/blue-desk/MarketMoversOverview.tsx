import Link from "next/link";
import type {buildScannerDiscovery,ScannerCandidate} from "@/lib/bluebelly-scanner-discovery";
import ui from "./MarketMoversOverview.module.css";

type Props={data:ReturnType<typeof buildScannerDiscovery>;compareHref:string;watchHref:string;scannerHref:string};
function Movers({title,rows}:{title:string;rows:ScannerCandidate[]}){
 return <article className={ui.panel}><h3>{title}</h3>
 {rows.length?<ol className={ui.list}>{rows.map(row=><li key={row.symbol}>
  <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" title={row.label+" · "+row.asOf+" · source"}><strong>{row.symbol}</strong><span>{row.label===row.symbol?"":row.label}</span></a>
  <b data-direction={row.detail.startsWith("+")?"up":row.detail.startsWith("-")?"down":"flat"}>{row.detail}</b>
 </li>)}</ol>:<p className={ui.empty}>No qualifying source-dated stocks.</p>}
 </article>;
}
export default function MarketMoversOverview({data:d,compareHref,watchHref,scannerHref}:Props){
 const sectorCount=d.sectors.filter(row=>row.change!==null).length;
 const fmt=(n:number)=> (n>0?"+":"")+n.toFixed(2)+"%";
 return <section id="market-movers" className={ui.root} aria-label="Market movers and XL sectors" data-market-movers-overview="source-dated">
  <header className={ui.head}><div><small>MARKET PULSE / 1D</small><h2>Market movers</h2>
   <p>{d.session?"Source session "+d.session+" · "+d.stockCoverage+" monitored stocks":"No verified recent equity session"} · tracked universe, not exchange-wide rankings.</p></div>
   <Link href={scannerHref}>Intelligent screens →</Link></header>
  <div className={ui.grid}><Movers title="Top gainers" rows={d.gainers}/><Movers title="Top losers" rows={d.losers}/><Movers title="Smallest moves" rows={d.quiet}/></div>
  <div className={ui.sectors} id="xl-sector-pulse">
   <header className={ui.head}><div><h3>XL sector performance</h3><p>{d.sectorSession?`Session ${d.sectorSession} · ${sectorCount}/11 same-session observations · 1D close-to-close${d.sectorDelayed?" · Delayed / last valid session":""}`:"No valid matched sector session"}{d.sectorProviderFailures?` · ${d.sectorProviderFailures} provider refresh failures`:""}</p></div><Link href={compareHref}>Full XL / RSP / SMH comparison →</Link></header>
   {sectorCount>0?<div className={ui.sectorGrid}>{d.sectors.map(r=><div key={r.symbol} className={ui.sector} data-direction={r.change===null?"unknown":r.change>0?"up":r.change<0?"down":"flat"}>
    {r.sourceUrl?<a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" title={r.label+" · original source"}>{r.symbol}</a>:<strong>{r.symbol}</strong>}<b>{r.change===null?(r.status==="provider-failed"?"Feed failed":"Missing"):fmt(r.change)}</b>
   </div>)}</div>:<p className={ui.empty}>{d.sectorProviderFailures?"Sector feed refresh failed; no valid sector session is available.":"Sector observations are missing; no verified session is available."}</p>}
  </div>
  <div className={ui.links}><Link href={compareHref}>Compare sectors &amp; breadth · 1D / 3D / 5D →</Link><Link href={watchHref}>Cross-asset divergence watch →</Link></div>
 </section>;
}
