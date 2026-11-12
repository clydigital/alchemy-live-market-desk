import Link from "next/link";
import {getPublishedMacroPulseBriefs} from "@/lib/blue-desk-macropulse-brief-server";
import {projectPublishedResearchFocus,researchForPublicLens} from "@/lib/blue-desk-published-research-focus";
import {headers} from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import HormuzCrossings from "@/components/blue-desk/HormuzCrossings";
import HormuzSituationBrief from "@/components/blue-desk/HormuzSituationBrief";
import EnergyAcceleratorDashboard from "@/components/blue-desk/EnergyAcceleratorDashboard";
import {getTopicInfluence} from "@/lib/bluebelly-topic-influence-server";
import {readBluebellyQualifiedNews} from "@/lib/bluebelly-verified-event-server";
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
 const [raw,incidents,researchDigests,wire,qualifiedNews]=await Promise.all([getGlobalFlowMonitor().catch(async()=>({
  hormuz:await getHormuzMonitor().catch(()=>({snapshot:null,checkedAt:now.toISOString(),nextAttemptAt:null,refreshFailed:true})),
  updatedAt:now.toISOString(),oil:[],gold:[],researchTriggers:[],coverageGaps:[]
 } satisfies GlobalFlowMonitor)),getHormuzIncidents(now),getPublishedMacroPulseBriefs(6).catch(()=>[]),getTopicInfluence("hormuz",now),readBluebellyQualifiedNews(now,18)]);
 const watch=projectHormuzPublicWatch(raw,now);
 const reviewedResearch=researchForPublicLens(projectPublishedResearchFocus(researchDigests,now,6),"hormuz");
 const pick=(ids:string[])=>ids.map(id=>watch.tiles.find(x=>x.id===id)).filter((x):x is HormuzWatchTile=>!!x);
 const crude=pick(["brent-confirmation","wti-confirmation"]);
 const products=pick(["distillate-crack","gasoline-crack","321-crack"]);
 const physical=pick(["hormuz-insurance"]);
 const balance=pick(["us-distillate-stocks","us-refinery-utilisation","us-crude-stocks","us-spr"]);
 return <main className={desk.page} data-bluebelly-hormuz="public-source-dated-physical-first">
  <BlueDeskHeader activePath="/blue-desk/hormuz"/>
  <div className={desk.content}>
   <header className={`${s.hero} ${s.compactHero}`}>
    <div className={s.heroCopy}>
     <p className={s.kicker}>HORMUZ WATCH / IRAN · SHIPS · FUEL</p>
     <h1>Hormuz: Talks, ships and fuel.</h1>
     <p className={s.lede}>Diplomacy first. Confirm against vessel traffic and fuel prices; a proposal is not a reopened route.</p>
     <div className={s.metaLine}>
      <span>Checked <time dateTime={now.toISOString()}>{formatHormuzET(now)}</time></span>
      <span>{watch.available}/{watch.tiles.length} source-dated market and fuel indicators</span>
     </div>
     <nav className={s.actions} aria-label="Related market research">
      <Link href="#mediation">Negotiations ↓</Link>
      <Link href="#energy-accelerators">Fuel accelerators ↓</Link>
      <Link href="#shipping">Ship crossings ↓</Link>
      <Link href="#fuels">Raw market readings ↓</Link>
     </nav>
    </div>

   </header>

   <HormuzSituationBrief newsroomHref={blueDeskPublicHref("/blue-desk/newsroom",host)}
     reviewed={reviewedResearch} news={qualifiedNews.news} wire={wire}
     newsCoverageDegraded={Object.values(qualifiedNews.sourceReads).includes("UNAVAILABLE")}
     crossingState={watch.crossingState} crossings={watch.crossing.snapshot?.total??null}
     crossingAt={watch.crossing.snapshot?.observedAt??null}
     incidentState={incidents.freshness} reportedIncidents={incidents.totalWindow??null}
     incidentAt={incidents.builtAt??null}/>

   <EnergyAcceleratorDashboard tiles={watch.tiles}/>

   <section className={s.risk} aria-label="Current evidence and source coverage">
    <div><span className={s.label}>PHYSICAL OBSERVATION</span>
     <strong>{watch.crossingState==="current"?"RECENT AIS READING":watch.crossingState==="stale"?"STALE AIS READING":"AIS UNAVAILABLE"}</strong>
     <details className={s.riskDetail}><summary>Evidence and limitations</summary><p>{watch.crossing.snapshot?
       `${watch.crossing.snapshot.total} completed vessel crossings in the observed rolling 24h, as of ${watch.crossing.snapshot.observedAt}. This is not oil cargo volume.`
       :"No accepted current crossing count. Unknown traffic is not zero."}</p></details>
    </div>
    <div><span className={s.label}>SECURITY / CONFLICT</span>
     <strong>{incidents.freshness==="recent"?incidents.totalWindow+" REPORTED GULF EVENTS / 14D":incidents.freshness==="stale"?"STALE INCIDENT COMPILATION":"INCIDENT FEED UNAVAILABLE"}</strong>
     <details className={s.riskDetail}><summary>Evidence and limitations</summary><p>UKMTO-attributed notices, independently unverified by Bluebelly. Compiled {incidents.builtAt||"unknown"}; missing or stale reports are never evidence of safe passage.</p></details>
     <a href={UKMTO} target="_blank" rel="noopener noreferrer">Check latest UKMTO incident reports ↗</a>
    </div>
    <div><span className={s.label}>CRITICAL SOURCE LIMIT</span><strong>AIS IS NOT AN OIL BARREL</strong>
     <details className={s.riskDetail}><summary>Evidence and limitations</summary><p>Disabling transponders, jamming and AIS spoofing can conceal ship movements. The IEA warns that observed traffic may underestimate actual passage.</p></details>
     <a href={IEA} target="_blank" rel="noopener noreferrer">IEA maritime chokepoints monitor ↗</a>
    </div>
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
    <div className={s.grid}>{products.slice(0,2).map(reading)}</div>
    <details className={s.inlineShelf} data-hormuz-fuel-proxies="collapsed">
      <summary>Composite refining margin proxy <span>3:2:1 crack · Expand</span></summary>
      <div className={s.grid}>{products.slice(2).map(reading)}</div>
    </details>
    <p className={s.note}>The US distillate crack is an observed US futures/spot proxy, not ICE gasoil, Singapore gasoil, jet fuel or a realised refinery cash margin. Comparable price timestamps are required before interpreting differences.</p>
   </section>

   <details className={`${s.section} ${s.evidenceShelf}`} id="incidents" aria-label="UKMTO-attributed maritime security notices" data-incident-status={incidents.freshness}>
    <summary className={s.evidenceSummary}><span>SECURITY / 14-DAY INCIDENT LOG</span><strong>Maritime security reports</strong>
      <small>{incidents.reports.length} reports · {incidents.freshness} · Expand</small></summary>
    <div className={s.evidenceBody}>
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
   </div>
   </details>

   <details className={`${s.section} ${s.evidenceShelf}`} id="inventory" aria-label="Energy balance inventory and refining">
    <summary className={s.evidenceSummary}><span>WEEKLY EIA / STOCKS & REFINERIES</span><strong>Fuel inventories and spare capacity</strong>
      <small>Four dated inventory and refinery metrics · Expand</small></summary>
    <div className={s.evidenceBody}>
    <div className={s.sectionHead}><span>03 / THE PHYSICAL BALANCE</span><h2>Can stockpiles and refineries absorb it?</h2>
     <p>Weekly US EIA data help separate a price shock from actual downstream fuel tightness. These are US observations, not proof of the global supply balance.</p></div>
    <div className={s.grid}>{balance.map(reading)}</div>
    <p className={s.note}>Weekly inventory periods are not intraday prices; a stock change must not be mislabelled as a same-day response to a Hormuz incident. <a href={EIA} target="_blank" rel="noopener noreferrer">EIA weekly petroleum report ↗</a></p>
   </div>
   </details>

   <details className={`${s.section} ${s.evidenceShelf}`} id="decisions" aria-label="Presenter scenario tests">
    <summary className={s.evidenceSummary}><span>SCENARIOS / CONDITIONAL TESTS</span><strong>Three ways the oil story could change</strong>
      <small>Physical confirmation and invalidation · Expand</small></summary>
    <div className={s.evidenceBody}>
    <div className={s.sectionHead}><span>04 / ON-AIR DECISION TREE</span><h2>Three questions before calling the next oil move.</h2>
     <p>These are conditional tests, not asserted current market outcomes or automated trading recommendations.</p></div>
    <div className={s.scenarios}>
     <article><span>SHIPPING NORMALISES</span><h3>Is the reopening real?</h3><p>Look for a sustained increase in completed transits and declining insurance stress. One diplomatic headline or one strong day of AIS data is insufficient.</p><strong>Invalidation: renewed attacks, fewer complete transits or stale tracking.</strong></article>
     <article><span>FUELS STAY TIGHT</span><h3>What if Brent falls but diesel doesn't?</h3><p>Compare US distillate crack trends with diesel inventories and refinery utilisation. Crude relief without fuel relief can keep freight and inflation pressure elevated.</p><strong>Invalidation: inventory replenishment and narrowing product cracks.</strong></article>
     <article><span>RISK PREMIUM REBUILDS</span><h3>Is it an actual supply interruption?</h3><p>First verify incident claims with UKMTO, then check traffic and dated price moves. Stronger crude and crack spreads may reflect different constraints rather than the same cause.</p><strong>Invalidation: unchanged logistics or unrelated market drivers.</strong></article>
    </div>
   </div>
   </details>

   <details className={`${s.section} ${s.evidenceShelf}`} id="coverage" aria-label="Missing data and original references">
    <summary className={s.evidenceSummary}><span>SOURCES / CAVEATS</span><strong>Coverage gaps and original documents</strong>
      <small>Missing data, AIS limits and EIA/IEA links · Expand</small></summary>
    <div className={s.evidenceBody}>
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
   </div>
   </details>
  </div>
 </main>;
}
