import Link from "next/link";
import {headers} from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import HormuzCrossings from "@/components/blue-desk/HormuzCrossings";
import HormuzMediationFeature from "@/components/blue-desk/HormuzMediationFeature";
import {getGlobalFlowMonitor} from "@/lib/global-flow-monitor";
import {getHormuzMonitor} from "@/lib/hormuz-monitor";
import {getHormuzIncidents} from "@/lib/bluebelly-hormuz-incidents";
import {formatHormuzET} from "@/lib/bluebelly-hormuz-time";
import {projectHormuzPublicWatch,type HormuzWatchTile} from "@/lib/bluebelly-hormuz-public";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import type {GlobalFlowMonitor} from "@/lib/global-flow-monitor-core";
import desk from "../blue-desk.module.css";
import s from "./hormuz.module.css";

export const dynamic="force-dynamic";
export const metadata={title:"Hormuz War & Distillates Tracker | Bluebelly",
 description:"Source-dated Hormuz ship flows, crude, diesel crack proxies, refining and stockpile conditions. Physical evidence before the narrative."};

const UKMTO="https://www.ukmto.org/recent-incidents";
const IEA="https://www.iea.org/data-and-statistics/data-tools/middle-east-maritime-chokepoints-shipping-monitor";
const EIA="https://www.eia.gov/petroleum/supply/weekly/";

function reading(tile:HormuzWatchTile){
 return <article key={tile.id} className={s.metric} data-watch-metric={tile.id} data-freshness={tile.status}>
  <div className={s.metricTop}><span>{tile.label}</span>
   <strong className={tile.status==="available"?s.available:tile.status==="stale"?s.stale:s.unavailable}>
    {tile.status==="available"?"SOURCE DATED":tile.status==="stale"?"STALE":"NOT AVAILABLE"}
   </strong></div>
  <div className={s.number}>{tile.value??"—"}</div>
  <div className={s.change}>{tile.delta!==null?"Change: "+tile.delta:tile.previous!==null?"Previous: "+tile.previous:"Change unavailable"}</div>
  <p>{tile.explanation}</p>
  <footer>As of {tile.observedAt||"unknown"} · {tile.frequency}
   <span>{tile.sourceUrl?<a href={tile.sourceUrl} target="_blank" rel="noopener noreferrer">{tile.sourceName} ↗</a>:"Source not connected"}</span>
  </footer>
 </article>;
}
export default async function HormuzTracker(){
 const now=new Date(),host=(await headers()).get("host");
 const [raw,incidents]=await Promise.all([getGlobalFlowMonitor().catch(async()=>({
  hormuz:await getHormuzMonitor().catch(()=>({snapshot:null,checkedAt:now.toISOString(),nextAttemptAt:null,refreshFailed:true})),
  updatedAt:now.toISOString(),oil:[],gold:[],researchTriggers:[],coverageGaps:[]
 } satisfies GlobalFlowMonitor)),getHormuzIncidents(now)]);
 const watch=projectHormuzPublicWatch(raw,now);
 const pick=(ids:string[])=>ids.map(id=>watch.tiles.find(x=>x.id===id)).filter((x):x is HormuzWatchTile=>!!x);
 const crude=pick(["brent-confirmation","wti-confirmation"]);
 const products=pick(["distillate-crack","gasoline-crack","321-crack"]);
 const physical=pick(["hormuz-insurance"]);
 const balance=pick(["us-distillate-stocks","us-refinery-utilisation","us-crude-stocks","us-spr"]);
 return <main className={desk.page} data-bluebelly-hormuz="public-source-dated-physical-first">
  <BlueDeskHeader activePath="/blue-desk/hormuz"/>
  <div className={desk.content}>
   <header className={s.hero}>
    <div className={s.heroCopy}>
     <p className={s.kicker}>GEOPOLITICS / ENERGY / REFINING · CONTINUOUS SOURCE WATCH</p>
     <h1>Hormuz: the route, the barrels, the diesel squeeze.</h1>
     <p className={s.lede}>War headlines tell you what might be interrupted. Ship transits show part of what is actually moving. Crude, fuel cracks and inventories reveal whether downstream markets are absorbing the shock.</p>
     <div className={s.metaLine}>
      <span>Checked <time dateTime={now.toISOString()}>{formatHormuzET(now)}</time></span>
      <span>{watch.available}/{watch.tiles.length} market and fuel indicators within their date windows</span>
     </div>
     <nav className={s.actions} aria-label="Related market research">
      <Link href="#mediation">Mediation update ↓</Link>
      <Link href="#shipping">See physical traffic ↓</Link>
      <Link href="#fuels">Crude and distillates ↓</Link>
      <Link href={blueDeskPublicHref("/blue-desk/regime-watch/energy",host)}>Energy regime research →</Link>
     </nav>
    </div>
    <div className={s.pipeline} role="img" aria-label="Illustrative transmission chain: maritime risk affects physical shipments, crude balances, refined fuel margins, and final consumer costs. Not an accurate geographic map.">
     <span className={s.diagramTitle}>TRANSMISSION, NOT A PRICE FORECAST</span>
     <div><b>01</b><span>Transit risk</span><small>Vessel passage / war risk</small></div>
     <i aria-hidden="true">↓</i><div><b>02</b><span>Crude delivered</span><small>Brent · WTI · inventories</small></div>
     <i aria-hidden="true">↓</i><div><b>03</b><span>Refined fuels</span><small>Diesel / gasoil · refinery runs</small></div>
     <i aria-hidden="true">↓</i><div><b>04</b><span>Inflation & rates</span><small>Freight / CPI / policy path</small></div>
    </div>
   </header>

   <section id="mediation" aria-label="Dated Hormuz mediation report">
    <HormuzMediationFeature mode="preview" storyHref={blueDeskPublicHref("/blue-desk/key-stories",host)+"?feature=hormuz-mediation-november-2026"}/>
   </section>

   <section className={s.risk} aria-label="Current evidence and source coverage">
    <div><span className={s.label}>PHYSICAL OBSERVATION</span>
     <strong>{watch.crossingState==="current"?"RECENT AIS READING":watch.crossingState==="stale"?"STALE AIS READING":"AIS UNAVAILABLE"}</strong>
     <p>{watch.crossing.snapshot?
       `${watch.crossing.snapshot.total} completed vessel crossings in the observed rolling 24h, as of ${watch.crossing.snapshot.observedAt}. This is not oil cargo volume.`
       :"No accepted current crossing count. Unknown traffic is not zero."}</p>
    </div>
    <div><span className={s.label}>SECURITY / CONFLICT</span>
     <strong>{incidents.freshness==="recent"?incidents.totalWindow+" REPORTED GULF EVENTS / 14D":incidents.freshness==="stale"?"STALE INCIDENT COMPILATION":"INCIDENT FEED UNAVAILABLE"}</strong>
     <p>UKMTO-attributed notices, independently unverified by Bluebelly. Compiled {incidents.builtAt||"unknown"}; missing or stale reports are never evidence of safe passage.</p>
     <a href={UKMTO} target="_blank" rel="noopener noreferrer">Check latest UKMTO incident reports ↗</a>
    </div>
    <div><span className={s.label}>CRITICAL SOURCE LIMIT</span><strong>AIS IS NOT AN OIL BARREL</strong>
     <p>Disabling transponders, jamming and AIS spoofing can conceal ship movements. The IEA warns that observed traffic may underestimate actual passage.</p>
     <a href={IEA} target="_blank" rel="noopener noreferrer">IEA maritime chokepoints monitor ↗</a>
    </div>
   </section>

   <section className={s.section} id="incidents" aria-label="UKMTO-attributed maritime security notices" data-incident-status={incidents.freshness}>
    <div className={s.sectionHead}><span>SECURITY / INCIDENT WATCH · ORIGINAL UKMTO ATTRIBUTION</span>
     <h2>What has happened at sea?</h2>
     <p>Rolling 14-day Gulf-area reports from the existing ship-monitor provider's UKMTO-attributed incident feed. Report time, place and text are provider observations; UKMTO may subsequently update or reclassify an incident.</p></div>
    {incidents.reports.length?<div className={s.incidents}>
     {incidents.reports.slice(0,6).map(report=><article key={report.id} className={s.incidentCard}>
      <div className={s.incidentTop}><strong>{report.id} · {report.type}</strong>
       <time dateTime={report.occurredAt}>{formatHormuzET(new Date(report.occurredAt))}</time></div>
      <h3>{report.place}</h3><p>{report.description}</p>
      <div className={s.incidentFlags}><span>{report.vesselType}</span>
       {report.timeLate?<span>TIME-LATE REPORT</span>:null}
       {report.casualtyReported?<span>CASUALTIES REPORTED</span>:null}</div>
      <a href={report.sourceUrl} target="_blank" rel="noopener noreferrer">Original UKMTO incident registry ↗</a>
     </article>)}
    </div>:<p className={s.note}>{incidents.reason||"No matching Gulf reports in the available 14-day source window. This does not establish the absence of incidents."}</p>}
    <p className={s.note}>Provider compilation: {incidents.builtAt||"not available"} · {incidents.freshness}. Reports may be time-late or revised. Source adapter refreshes at most every 30 minutes; the original UKMTO notices remain authoritative. <a href={UKMTO} target="_blank" rel="noopener noreferrer">Read all original UKMTO notices ↗</a></p>
   </section>

   <section className={s.section} id="shipping" aria-label="Hormuz marine physical readings">
    <div className={s.sectionHead}><span>01 / PHYSICAL BOTTLENECK</span><h2>Are ships moving again?</h2>
     <p>Shipping evidence outranks rumours of reopening. A stronger source trend requires 14 complete UTC days; partial and missing days cannot be bridged.</p></div>
    <HormuzCrossings monitor={watch.crossing}/>
    <div className={s.gridOne}>{physical.map(reading)}</div>
   </section>

   <section className={s.section} id="fuels" aria-label="Oil and refined product prices">
    <div className={s.sectionHead}><span>02 / MARKET TRANSMISSION</span><h2>Crude is only half the story.</h2>
     <p>A falling oil benchmark does not automatically mean cheaper diesel. The product crack can rise while the barrel falls, signalling relative fuel scarcity or refinery constraints.</p></div>
    <div className={s.grid}>{crude.map(reading)}</div>
    <h3 className={s.subhead}>Distillates and refining spreads</h3>
    <div className={s.grid}>{products.map(reading)}</div>
    <p className={s.note}>The US distillate crack is an observed US futures/spot proxy, not ICE gasoil, Singapore gasoil, jet fuel or a realised refinery cash margin. Comparable price timestamps are required before interpreting differences.</p>
   </section>

   <section className={s.section} id="inventory" aria-label="Energy balance inventory and refining">
    <div className={s.sectionHead}><span>03 / THE PHYSICAL BALANCE</span><h2>Can stockpiles and refineries absorb it?</h2>
     <p>Weekly US EIA data help separate a price shock from actual downstream fuel tightness. These are US observations, not proof of the global supply balance.</p></div>
    <div className={s.grid}>{balance.map(reading)}</div>
    <p className={s.note}>Weekly inventory periods are not intraday prices; a stock change must not be mislabelled as a same-day response to a Hormuz incident. <a href={EIA} target="_blank" rel="noopener noreferrer">EIA weekly petroleum report ↗</a></p>
   </section>

   <section className={s.section} id="decisions" aria-label="Presenter scenario tests">
    <div className={s.sectionHead}><span>04 / ON-AIR DECISION TREE</span><h2>Three questions before calling the next oil move.</h2>
     <p>These are conditional tests, not asserted current market outcomes or automated trading recommendations.</p></div>
    <div className={s.scenarios}>
     <article><span>SHIPPING NORMALISES</span><h3>Is the reopening real?</h3><p>Look for a sustained increase in completed transits and declining insurance stress. One diplomatic headline or one strong day of AIS data is insufficient.</p><strong>Invalidation: renewed attacks, fewer complete transits or stale tracking.</strong></article>
     <article><span>FUELS STAY TIGHT</span><h3>What if Brent falls but diesel doesn't?</h3><p>Compare US distillate crack trends with diesel inventories and refinery utilisation. Crude relief without fuel relief can keep freight and inflation pressure elevated.</p><strong>Invalidation: inventory replenishment and narrowing product cracks.</strong></article>
     <article><span>RISK PREMIUM REBUILDS</span><h3>Is it an actual supply interruption?</h3><p>First verify incident claims with UKMTO, then check traffic and dated price moves. Stronger crude and crack spreads may reflect different constraints rather than the same cause.</p><strong>Invalidation: unchanged logistics or unrelated market drivers.</strong></article>
    </div>
   </section>

   <section className={s.section} id="coverage" aria-label="Missing data and original references">
    <div className={s.sectionHead}><span>05 / TRANSPARENCY</span><h2>What this desk still cannot measure</h2>
     <p>Gaps stay explicit rather than substituting estimates, US proxies or unsupported geopolitical claims.</p></div>
    <div className={s.gaps}>{watch.missingIds.map(x=><article key={x.label}><strong>{x.label}</strong><p>{x.note}</p></article>)}</div>
    <div className={s.sources}>
     <a href={UKMTO} target="_blank" rel="noopener noreferrer">UKMTO incident notices ↗</a>
     <a href={IEA} target="_blank" rel="noopener noreferrer">IEA observed flows / AIS caveats ↗</a>
     <a href={EIA} target="_blank" rel="noopener noreferrer">US EIA weekly distillate inventories ↗</a>
     <Link href={blueDeskPublicHref("/blue-desk/markets?group=energy",host)}>Live source-dated energy instruments →</Link>
     <Link href={blueDeskPublicHref("/blue-desk/newsroom?q=hormuz",host)}>Relevant verified Newsroom stories →</Link>
    </div>
    <p className={s.disclaimer}>{watch.noPriceCausality} {watch.dataLimit}</p>
   </section>
  </div>
 </main>;
}
