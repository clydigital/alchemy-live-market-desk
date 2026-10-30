import Link from "next/link";
import {headers} from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import EditorialStoryArt from "@/components/blue-desk/EditorialStoryArt";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import {getPublicThesisLedger} from "@/lib/blue-desk-thesis-ledger-server";
import {getPublicSourceObservations} from "@/lib/blue-desk-source-observations";
import {matchAssetSourceEvents,projectAssetTape} from "@/lib/bluebelly-regime-asset-context";
import {getMarketMonitor} from "@/lib/market-monitor-public";
import {FUNDAMENTAL_QUICK_VIEW,FUNDAMENTAL_VIEW_REVIEWED_ON,fundamentalSnapshotAgeDays} from "@/lib/bluebelly-fundamental-quickview";
import {groupPublicResearch} from "@/lib/bluebelly-editorial-architecture";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import type {EditorialMotif} from "@/lib/bluebelly-editorial-visuals";
import desk from "../blue-desk.module.css";
import styles from "./regime-watch.module.css";

export const dynamic="force-dynamic";
export const metadata={
 title:"Regime Watch | Bluebelly",
 description:"Nine dedicated research areas, each with historical public Story context and testable questions."
};

export default async function RegimeWatchPage(){
 const now=new Date(),host=(await headers()).get("host");
 const [theses,sourceObservations,marketMonitor]=await Promise.all([
  getPublicThesisLedger(now,38).catch(()=>null),
  getPublicSourceObservations(now,24).catch(()=>null),
  getMarketMonitor().catch(()=>null),
 ]);
 const lenses=groupPublicResearch(theses||[]);
 const snapshotAge=fundamentalSnapshotAgeDays(now);
 return <main className={desk.page} data-public-regime-watch="historical-story-research-no-verdict">
  <BlueDeskHeader activePath="/blue-desk/regime-watch"/>
  <div className={desk.content}>
   <header className={styles.intro}><span>ONGOING RESEARCH / NOT DAILY REPORTS</span>
    <h1>The market&apos;s bigger stories.</h1>
    <p>Nine persistent research questions, each with a dedicated workspace for recorded hypotheses, conflicting views and the evidence that could change the argument. Public Story snapshots are historical working views, not today&apos;s regime-engine verdicts.</p>
   </header>
   <section className={styles.quickSection} aria-labelledby="fundamental-quick-view" data-fundamental-quick-view="dated-editorial-opinion-not-canonical">
    <div className={styles.quickHead}>
     <div><span className={styles.kicker}>ONE-STOP FUNDAMENTALS / RESEARCH ASSESSMENT</span>
      <h2 id="fundamental-quick-view">Bullish, bearish or unresolved?</h2>
      <p>Reviewed {FUNDAMENTAL_VIEW_REVIEWED_ON} (MYT). New source items and dated prices appear separately; neither automatically changes a fundamental verdict.</p>
     </div>
     <div className={styles.quickAge} data-assessment-age={snapshotAge===null?"unknown":snapshotAge>7?"stale":"dated"}>
      <strong>{snapshotAge===null?"Review age unavailable":snapshotAge>7?"Assessment needs review":"Dated analyst assessment"}</strong>
      <small>{snapshotAge===null?"Clock unavailable":snapshotAge+" day(s) since reviewed"} · underlying source dates vary</small>
     </div>
    </div>
    <div className={styles.quickList} role="list">
     {FUNDAMENTAL_QUICK_VIEW.map(asset=>{
      const eventContext=matchAssetSourceEvents(asset.id,sourceObservations,now,2);
      const marketContext=projectAssetTape(asset.id,marketMonitor?.rows??null,now);
      return <article className={styles.quickRow} role="listitem" key={asset.id} data-asset={asset.id}>
       <div className={styles.quickAsset}>
        <Link href={blueDeskPublicHref("/blue-desk/regime-watch/"+asset.lens,host)}>{asset.asset} <span aria-hidden="true">↗</span></Link>
        <span>{asset.headline}</span>
       </div>
       <div className={styles.quickState}>
        <strong data-fundamental-bias={asset.bias}>{asset.bias==="UNRESOLVED"?"Not proven":asset.bias.toLowerCase()}</strong>
        <small>{asset.confidence.toLowerCase()} confidence</small>
       </div>
       <div className={styles.quickReason}>
        <p>{asset.reason}</p>
        <details><summary>Counterargument, next test &amp; sources</summary>
         <p><strong>Strongest objection:</strong> {asset.countercase}</p>
         <p><strong>What would change our assessment:</strong> {asset.decidingTest}</p>
         <ul>{asset.sources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a> · {source.role==="COMMENTARY"?"Attributed opinion":"Original source"} · {source.publicationDate}</li>)}</ul>
        </details>
       </div>
       <div className={styles.quickFresh}>
        <span>Reviewed reference: {asset.sourceObservationDate}</span>
        <strong>{eventContext.state==="UNAVAILABLE"?"Recent evidence feed unavailable":eventContext.state==="NO_MATCH"?"No direct source match in sample":eventContext.items.length+" qualified source match"+(eventContext.items.length===1?"":"es")}</strong>
        {eventContext.items.map(event=><div className={styles.quickUpdate} key={event.id}>
         <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer">{event.description.length>122?event.description.slice(0,119).replace(/\\s+\\S*$/,"")+"…":event.description}</a>
         <small>{event.sourceName} · {event.eventAt.slice(0,10)} · Original-source topic match</small>
        </div>)}
        <small>Rolling 48h bounded sample · not a verdict update</small>
       </div>
       <div className={styles.quickTape} data-tape-state={marketContext.state}>
        <span>MARKET TAPE · SEPARATE FROM FUNDAMENTALS {marketContext.state==="STALE"?"· STALE OBSERVATION":""}</span>
        {marketContext.last===null?<strong>{marketContext.note}</strong>:<>
         <strong>{marketContext.last.toLocaleString("en-US",{maximumFractionDigits:marketContext.changeUnit==="bp"?2:3})}{marketContext.changeUnit==="bp"?"%":""} {marketContext.instrument?"· "+marketContext.instrument:""}</strong>
         {marketContext.change!==null?<small>{marketContext.change>0?"+":""}{marketContext.change}{marketContext.changeUnit} vs previous close · {marketContext.observedAt}</small>:<small>{marketContext.state==="STALE"?"STALE · ": "Change unavailable · "}{marketContext.observedAt}</small>}
         <small>{marketContext.measurement}</small>
         {marketContext.sourceUrl?<a href={marketContext.sourceUrl} target="_blank" rel="noopener noreferrer">{marketContext.sourceName} ↗</a>:null}
        </>}
        <small>{marketContext.note}</small>
       </div>
      </article>;
     })}
    </div>
    <p className={styles.quickFoot}>Unknown is a valid result. The 48-hour source sample is bounded, so no match does not mean no market events. Market-level series may lag, and their movement does not establish cause. A reviewed fundamental judgement changes only after independent assessment, separate from the canonical Regime/Dossier state.</p>
   </section>
   <div className={styles.heading}>
    <h2>Explore a research lens</h2>
    <span>{theses===null?"Public Story coverage unavailable":theses.length+" public Story snapshots"} · Viewed <DualTimestamp value={now.toISOString()}/></span>
   </div>
   <div className={styles.cards}>{lenses.map(lens=>
    <Link key={lens.id} className={styles.card} data-research-lens={lens.id}
     href={blueDeskPublicHref("/blue-desk/regime-watch/"+lens.id,host)}
     aria-label={"Explore "+lens.name+" research"}>
      <div className={styles.art}><EditorialStoryArt headline={lens.name} motif={lens.motif as EditorialMotif} compact/></div>
      <div className={styles.content}>
       <span className={styles.kicker}>{lens.code} · RESEARCH LENS</span>
       <h3>{lens.name}</h3><p>{lens.question}</p>
       <div className={styles.coverage}>{theses===null?"Story coverage unavailable":lens.stories.length+" associated public Story snapshot"+(lens.stories.length===1?"":"s")}</div>
       <span className={styles.open}>Explore research and deciding tests <span aria-hidden="true">→</span></span>
      </div>
    </Link>
   )}</div>
   <section className={styles.transmission} aria-labelledby="coreweave-ai-financing">
    <h2 id="coreweave-ai-financing">AI infrastructure: the CoreWeave financing test</h2>
    <p>CoreWeave's June 2026 financials and Q2 institutional ownership disclosures raise questions about how contracted AI compute becomes debt-serviceable cash. Reported share sales and credit-market stress need dated, original-source verification; this is an issuer research warning, not a newly accepted AI-wide Regime verdict.</p>
    <div className={styles.pathGrid}>
     <Link className={styles.path} href={blueDeskPublicHref("/blue-desk/markets",host)+"#coreweave-credit-watch"}>
      <span>CRWV · FUNDING &amp; OWNERSHIP</span><strong>Read the CoreWeave cash-flow, institutional-activity and dilution investigation</strong><small>30 October 2026 research snapshot · Sources and next tests →</small>
     </Link>
    </div>
   </section>
   <section className={styles.transmission} aria-labelledby="tesla-spacex-financing" data-bluebelly-ai-financing-watch="source-dated-adjacent-exposure">
    <h2 id="tesla-spacex-financing">Tesla + SpaceX: AI expansion meets the cash test</h2>
    <p><strong>Original-source snapshot · 30 October 2026.</strong> SpaceX disclosed on 26 October a binding commitment for an approximately $40bn master finance lease of Nvidia GPU equipment. Closing conditions remain outstanding; lease schedules are expected to start when equipment arrives in the first half of 2027. A commitment is not the same as $40bn of chips already delivered or paid for.</p>
    <p>Tesla reported Q3 revenue of $28.046bn, operating profit of $0.718bn, operating cash flow of $6.263bn, cash capex of $4.732bn and free cash flow of $1.531bn. Its quarter-end cash and short-term investments were $45.447bn. The nine-month SEC filing also records a $2.00bn investment in SpaceX common stock; that is a disclosed equity exposure, not evidence of a planned merger.</p>
    <p><strong>The investor test:</strong> SpaceX may gain more compute capacity, but lease commitments eventually need paying customers and cash returns. Tesla has a substantial liquidity cushion, yet quarterly cash flow is not an unlimited source of funding for unrelated projects. Test deployment, lease liabilities, refinancing costs, Tesla cash conversion and any formally announced related-party transactions. A Tesla–SpaceX merger is a scenario, not a verified corporate action.</p>
    <div className={styles.pathGrid}>
     <a className={styles.path} href="https://ir.spacex.com/updates/releases-details/2026/SPACEX-SECURES-40-BILLION-IN-THE-LARGEST-GPU-FINANCING-EVER-2026-EnDqGhTAB3/" target="_blank" rel="noopener noreferrer"><span>SPCX · 26 OCT 2026</span><strong>SpaceX original $40bn GPU lease announcement</strong><small>Committed, subject to closing conditions; expected 2027 commencement ↗</small></a>
     <a className={styles.path} href="https://www.sec.gov/Archives/edgar/data/1318605/000162828026066775/tsla-20260930.htm" target="_blank" rel="noopener noreferrer"><span>TSLA · Q3 2026 SEC 10-Q</span><strong>Tesla cash flows, capex, liquidity and SpaceX-related investment</strong><small>Original quarterly filing · figures are dated, not live marks ↗</small></a>
    </div>
    <p>Regular Tesla and SpaceX surveillance belongs to the existing private AI-company review. This public card updates only when a separately verified and approved publication is made; a scheduled research run is not itself a public release.</p>
   </section>
   <section className={styles.transmission}><h2>Cross-regime transmission</h2>
    <p>These research questions often overlap. Follow the mechanism into its own research page, then check the dated observations.</p>
    <div className={styles.pathGrid}>{([
     ["fed","FED → DURATION → CREDIT","Lower policy rates do not necessarily mean cheaper long-term borrowing."],
     ["ai","AI ADOPTION → FINANCING","Growing model usage does not automatically create sufficient free cash flow."],
     ["energy","ENERGY → PRICES → RATES","Crude prices cannot stand in for delivered diesel, LNG or transport costs."],
     ["yen","JAPAN → FUNDING → EQUITIES","Yen funding repricing could transmit across borders; evidence is still needed."]
    ] as const).map(([id,label,copy])=><Link className={styles.path} key={id}
     href={blueDeskPublicHref("/blue-desk/regime-watch/"+id,host)}>
      <span>{label}</span><strong>{copy}</strong><small>Explore lens →</small>
    </Link>)}</div>
   </section>
  </div>
 </main>;
}
