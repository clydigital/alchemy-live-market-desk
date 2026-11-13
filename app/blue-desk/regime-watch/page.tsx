import CurrentMarketUpdates from "@/components/blue-desk/CurrentMarketUpdates";
import Link from "next/link";
import {headers} from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import EditorialStoryArt from "@/components/blue-desk/EditorialStoryArt";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import {getPublicThesisLedger} from "@/lib/blue-desk-thesis-ledger-server";
import {getPublicSourceObservations} from "@/lib/blue-desk-source-observations";
import {scanRegimeViews,summarizeRegimeScans} from "@/lib/bluebelly-regime-view-scan";
import {groupPublicResearch,EDITORIAL_REGIME_LENSES} from "@/lib/bluebelly-editorial-architecture";
import {getTopicInfluences} from "@/lib/bluebelly-topic-influence-server";
import {getManualSweeps} from "@/lib/bluebelly-manual-sweeps";
import {getLensOutlook,LENS_OUTLOOK_REVIEWED_ON} from "@/lib/bluebelly-regime-lens-outlook";
import {getRegimeEditorialUpdate} from "@/lib/bluebelly-regime-verified-crossasset";
import RegimeOutlookMeter from "@/components/blue-desk/RegimeOutlookMeter";
import RegimeResearchClocks from "@/components/blue-desk/RegimeResearchClocks";
import RegimeSignalRadar from "@/components/blue-desk/RegimeSignalRadar";
import {buildSignalRadar} from "@/lib/bluebelly-signal-radar";
import {getMarketMonitor} from "@/lib/market-monitor-public";
import {getSourceDatedBreadth} from "@/lib/bluebelly-breadth-reader";
import {calculateBreadthRow} from "@/lib/bluebelly-breadth-dated";
import {projectRegimeMeterReadings} from "@/lib/bluebelly-regime-market-meter";
import {publicMarketObservations} from "@/lib/blue-desk-public-markets";
import {buildMarketDivergenceWatch} from "@/lib/bluebelly-market-divergence-watch";
import {projectBondPressure} from "@/lib/bluebelly-bond-pressure";
import {getRegimeShadowHealth} from "@/lib/regime-engine";
import MarketCompass from "@/components/blue-desk/MarketCompass";
import {buildMarketCompassSummary} from "@/lib/bluebelly-market-compass";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import type {EditorialMotif} from "@/lib/bluebelly-editorial-visuals";
import desk from "../blue-desk.module.css";
import styles from "./regime-watch.module.css";

export const dynamic="force-dynamic";
export const metadata={
 title:"Regime Watch | Bluebelly",
 description:"Nine thematic research lenses and a dedicated market crash versus opportunity watch, with dated evidence and historical mirrors."
};

export default async function RegimeWatchPage(){
 const now=new Date(),host=(await headers()).get("host");
 const [theses,observations,topicReasons,shadowHealth,monitor,breadthFeed]=await Promise.all([
  getPublicThesisLedger(now,38).catch(()=>null),
  getPublicSourceObservations(now,12).catch(()=>null),
  getTopicInfluences(EDITORIAL_REGIME_LENSES.map(lens=>lens.id),now).catch(()=>[]),
  getRegimeShadowHealth().catch(()=>null),
  getMarketMonitor().catch(()=>null),
  getSourceDatedBreadth().catch(()=>({series:[],retrievalStatus:"fallback" as const})),
 ]);
 const lenses=groupPublicResearch(theses||[]);
 const scans=lenses.map(lens=>scanRegimeViews(lens.id,getLensOutlook(lens.id).reviewedAt,theses,observations,now));
 const changes=summarizeRegimeScans(scans);
 const measuredMarket=buildMarketDivergenceWatch(publicMarketObservations(monitor?.rows??[],"all"),"1D");
 const signalRadar=buildSignalRadar(topicReasons,now,12,measuredMarket,"1D");
 const bondPressure=projectBondPressure(monitor?.rows??null,now);
 const breadth50=calculateBreadthRow("S5FI","S&P 500 above 50-day MA",breadthFeed.series.find(row=>row.symbol==="S5FI"),now);
 const meterReadings=projectRegimeMeterReadings(publicMarketObservations(monitor?.rows??[],"all"),breadth50,bondPressure,now);
 const compassSummary=buildMarketCompassSummary(measuredMarket,now);
 return <main className={desk.page} data-public-regime-watch="dated-editorial-lens-outlooks">
  <BlueDeskHeader activePath="/blue-desk/regime-watch"/>
  <div className={desk.content}>
   <MarketCompass summary={compassSummary} readings={meterReadings} host={host}/>
   <p style={{margin:"10px 0 14px",fontSize:"12px",color:"var(--bb-muted)"}}>The directional reading summarises one matched equity session. Deeper research, nine regime lenses and evidence follow below; no tape signal automatically changes a fundamental thesis.</p>
   <RegimeResearchClocks sources={observations} editorialReviewedOn={LENS_OUTLOOK_REVIEWED_ON} shadow={shadowHealth}/>
   <RegimeSignalRadar entries={signalRadar}/>
   <details className={styles.archivedOverview} data-regime-overview-editorial="collapsed-by-default">
    <summary><strong>Previously reviewed cross-asset interpretation · 11 November 2026</strong>
     <span>Historic research context, not a current regime verdict</span></summary>
   <aside id="nov11-regime-challenge" data-regime-research-delta="2026-11-11-provisional" style={{border:"1px solid var(--bb-card-border)",background:"var(--bb-surface)",borderRadius:10,padding:"18px 22px",margin:"18px 0"}}>
    <span className={styles.kicker}>DATED CROSS-ASSET RESEARCH · 11 NOVEMBER 2026</span>
    <h2 style={{fontSize:"clamp(22px,2.5vw,30px)",margin:"9px 0"}}>Rates restrictive. AI shares rebound. What changes the regime?</h2>
    <p>October CPI and the 10 November Treasury yield jump support restrictive financing conditions. But 11 November's <strong>intraday</strong> AI rebound followed stronger CoreWeave guidance, while 20-session equal-weight participation challenged the narrow-rally narrative. The US bond market was closed on 11 November: there is no same-session Treasury confirmation of the rebound.</p>
    <p><strong>Open questions:</strong> Is this durable earnings-led absorption, mechanical short covering, or rotation that still leaves AI financing fragile? The current Regime verdict is not revised by this editorial assessment.</p>
    <Link href={blueDeskPublicHref("/blue-desk/crash-opportunity",host)+"#nov11-challenge"}>Examine the sources, three competing interpretations and deciding tests →</Link>
   </aside>
   </details>
   <div className={styles.intelStrip} aria-label="Regime Watch research scope">
    <div><span>01 / RESEARCH LENSES</span><strong>09</strong><small>DIFFERENT MARKET SYSTEMS</small></div>
    <div><span>02 / SOURCE CONTEXT</span><strong>{theses===null?"—":theses.length}</strong><small>ASSOCIATED PUBLIC STORY RECORDS</small></div>
    <div><span>03 / CROSS-REGIME WATCH</span><strong>01</strong><small>CRASH VERSUS OPPORTUNITY</small></div>
    <p>Every lens is a question, not a trade. Follow the evidence into its original context, then test the counterargument.</p>
   </div>
   <div className={styles.heading} id="lens-grid">
    <div><span className={styles.kicker}>01 / THE NINE RESEARCH FILES</span><h2>Choose the <em>pressure point.</em></h2></div>
    <span><span className={styles.reviewDate}>Reviewed {LENS_OUTLOOK_REVIEWED_ON} MYT</span><span className={styles.reviewMeta}> · {theses===null?"Story coverage unavailable":theses.length+" public Story snapshots"} · Viewed <DualTimestamp value={now.toISOString()}/></span></span>
   </div>
   <p className={styles.lensIntro}>Explore a research lens. Check the dated outlook, countercase and next test. Not a live trading signal.</p>
   <div className={styles.cards}>{lenses.map((lens,index)=>
    <Link key={lens.id} className={styles.card} data-research-lens={lens.id}
     href={blueDeskPublicHref("/blue-desk/regime-watch/"+lens.id,host)}
     aria-label={"Explore "+lens.name+" research"}>
      <div className={styles.art}><EditorialStoryArt headline={lens.name} motif={lens.motif as EditorialMotif} compact/><span className={styles.artSerial} aria-hidden="true">{String(index+1).padStart(2,"0")}</span></div>
      
        <div className={styles.content}>
       <div className={styles.cardHeading}><span className={styles.kicker}>{lens.code} / RESEARCH LENS</span><span className={styles.cardSerial}>FILE {String(index+1).padStart(2,"0")} / 09</span></div>
       <h3>{lens.name}</h3>
       <small className={styles.archivedContext}>HISTORICAL 30 OCT EDITORIAL · NOT THE CURRENT 1D SIGNAL</small>
       <div className={styles.lensActivity} aria-label={
        scans[index].newViews.length+" new views, "+scans[index].updatedRecords.length+
        " updated records, "+scans[index].sourceInputs.length+" new original-source inputs since review"}>
        <span data-activity={scans[index].newViews.length>0?"new":"none"} title="New views"/>
        <span data-activity={scans[index].updatedRecords.length>0?"new":"none"} title="Updated records"/>
        <span data-activity={scans[index].sourceInputs.length>0?"new":"none"} title="New source inputs"/>
        <small>NEW VIEWS / RECORDS / SOURCES</small>
       </div>
       <div className={styles.archivedMeterHidden} aria-hidden="true">
        <RegimeOutlookMeter assessment={getLensOutlook(lens.id)} size="summary"/>
        <p className={styles.lensReason}><strong>Why:</strong> {getLensOutlook(lens.id).headline}</p>
        {getRegimeEditorialUpdate(lens.id)?<span className={styles.editorialUpdate}>30 OCT · POST-DECISION EDITORIAL CHECK</span>:null}
       </div>
       <p className={styles.lensReason}><strong>Next deciding test:</strong> {lens.nextTest}</p>
       <span className={styles.viewState} data-view-scan-state={scans[index].state}>
        {scans[index].newViews.length?scans[index].newViews.length+" new tracked view(s) to assess":
         scans[index].updatedRecords.length?scans[index].updatedRecords.length+" existing record(s) updated since review":
         scans[index].sourceInputs.length?scans[index].sourceInputs.length+" new original-source item(s) to check":
         scans[index].state==="UNAVAILABLE"||scans[index].state==="PARTIAL"?"Source comparison incomplete":
         "No newer inputs in bounded scan"}
       </span>
       <div className={styles.coverage}>{theses===null?"Story coverage unavailable":lens.stories.length+" associated public Story snapshot"+(lens.stories.length===1?"":"s")}</div>
       <span className={styles.open}>OPEN RESEARCH / EVIDENCE &amp; TESTS <span aria-hidden="true">↗</span></span>
      </div>
    </Link>
   )}</div>
   <section id="source-reasons" className={styles.transmission} data-regime-source-reasons="live-source-linked-not-canonical">
    <div className={styles.pulseHeading}>
     <div><span className={styles.kicker}>LIVE RESEARCH / X WIRE + REVIEWED TRANSCRIPTS</span>
      <h2>What is making us check these views again?</h2>
      <p>Latest source-linked reasons and dated research. These trigger checks, not automatic changes to the reviewed outlook.</p>
     </div>
     <span className={styles.pulseStatus}>{topicReasons.filter(item=>item.x.length+item.creators.length>0||getManualSweeps(item.topic,now,1).length>0).length} / 09 ACTIVE LENSES</span>
    </div>
    <div className={styles.pulsePreview} data-regime-pulse-preview="three-sourced-highlights">
     {topicReasons.filter(item=>getManualSweeps(item.topic,now,1).length>0).slice(0,3).map(item=>{
      const sweep=getManualSweeps(item.topic,now,1)[0];
      const name=EDITORIAL_REGIME_LENSES.find(lens=>lens.id===item.topic)?.name||item.topic;
      return <Link key={item.topic} className={styles.pulseHighlight}
       href={blueDeskPublicHref("/blue-desk/regime-watch/"+item.topic,host)+"#influence-"+item.topic}>
       <span>{name} · {sweep.date} MANUAL SWEEP</span>
       <strong>{sweep.title}</strong>
       <small>{sweep.findings.length} dated source findings · Open evidence ↗</small>
      </Link>;
     })}
    </div>
    <details className={styles.pulseAll} data-regime-pulse-all="progressive-disclosure">
     <summary>Browse all research reasons <span>Live X Wire, creator reviews and dated manual sweeps ↗</span></summary>
    <div className={styles.pathGrid}>{topicReasons.filter(item=>item.x.length+item.creators.length>0||getManualSweeps(item.topic,now,1).length>0).map(item=>{
     const leads=[...item.x,...item.creators].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
     const name=EDITORIAL_REGIME_LENSES.find(lens=>lens.id===item.topic)?.name||item.topic;
     const sweep=getManualSweeps(item.topic,now,1)[0];
     return <Link key={item.topic} className={styles.path} href={blueDeskPublicHref("/blue-desk/regime-watch/"+item.topic,host)+"#influence-"+item.topic}>
      <span>{name} · {sweep?sweep.date+" MANUAL SWEEP FINDINGS":leads.length+" live source reasons"}</span>
      <strong>{sweep?.findings[0]?.reason||leads[0]?.reason||"Review the newest source-linked research"}</strong>
      <small>{sweep?"Read original-source manual findings + "+leads.length+" current X / video leads":"Most recent source "+leads[0]?.publishedAt.slice(0,10)} →</small>
     </Link>;
    })}</div>

    </details>
    {!topicReasons.some(item=>item.x.length+item.creators.length||getManualSweeps(item.topic,now,1).length)?
     <p>No matching recent reasons in this bounded source window. Missing leads are not proof that a thesis is unchanged.</p>:null}
   </section>
   <section id="cross-regime-watch" className={styles.crashFeatured} aria-labelledby="crash-opportunity-featured" data-crash-watch-entry="own-research-watch">
    <div>
      <span className={styles.kicker}>FEATURED / CROSS-REGIME WATCH</span>
      <h2 id="crash-opportunity-featured">CRASH <em>VS</em> OPPORTUNITY</h2>
      <p>When the index hides a stealth bear market, is that the warning before a wider collapse—or the setup for a broad recovery? Compare the Kobeissi and Burry cases, sourced breadth/credit signals and seven historical market scares.</p>
      <span className={styles.crashNote}>Provisional research: contested · bull and bear evidence reviewed independently · no crash probability claimed</span>
    </div>
    <Link className={styles.crashFeaturedLink} href={blueDeskPublicHref("/blue-desk/crash-opportunity",host)}>OPEN THE TWO-SIDED INVESTIGATION <span aria-hidden="true">↗</span></Link>
   </section>

   <details id="view-changes" className={styles.viewScan} data-regime-view-scan="stored-stories-and-admitted-original-sources" aria-labelledby="view-scan-title">
    <summary className={styles.reviewSummary}>
     <span className={styles.kicker}>REVIEW QUEUE / EVIDENCE CHANGES</span>
     <strong>What has changed since the last review?</strong>
     <small>{changes.newViewLenses} new-view lenses · {changes.revisedRecordLenses} updated-record lenses · {changes.sourceInputLenses} new-source lenses · Expand details</small>
    </summary>
    <div className={styles.viewScanHead}>
     <div><span className={styles.kicker}>AUTOMATED REVIEW QUEUE / EXISTING + EMERGING VIEWS</span>
      <h2 id="view-scan-title">What has changed since the last review?</h2>
      <p>Bluebelly compares the existing tracked Story views with newly recorded views and source-qualified releases. These are reasons to revisit a thesis—not automatic changes to the nine reviewed outlooks.</p>
     </div>
     <div className={styles.viewScanCounts}>
      <div><strong>{changes.newViewLenses}</strong><span>LENSES WITH NEW VIEWS</span></div>
      <div><strong>{changes.revisedRecordLenses}</strong><span>LENSES WITH UPDATED RECORDS</span></div>
      <div><strong>{changes.sourceInputLenses}</strong><span>LENSES WITH NEW SOURCES</span></div>
     </div>
    </div>
    {changes.incompleteLenses>0?<p className={styles.scanCaution}>Partial coverage: at least one source reader is unavailable. Do not treat missing updates as a verified unchanged market.</p>:null}
    <div className={styles.viewScanList}>
     {scans.filter(scan=>scan.newViews.length||scan.updatedRecords.length||scan.sourceInputs.length).slice(0,6).map(scan=>{
      const lens=lenses.find(item=>item.id===scan.lens)!;
      return <Link key={scan.lens} href={blueDeskPublicHref("/blue-desk/regime-watch/"+scan.lens,host)+"#view-scan"}>
       <strong>{lens.name}</strong>
       <span>{scan.newViews.length} new view{scan.newViews.length===1?"":"s"} · {scan.updatedRecords.length} updated record{scan.updatedRecords.length===1?"":"s"} · {scan.sourceInputs.length} newly available original source{scan.sourceInputs.length===1?"":"s"}</span>
      </Link>;
     })}
     {!scans.some(scan=>scan.newViews.length||scan.updatedRecords.length||scan.sourceInputs.length)?
      <p>No newer qualifying inputs were found in this bounded scan. This does not mean all nine market theses are unchanged.</p>:null}
    </div>
    <small>Existing Story memory and a bounded 48-hour sample of tier-1/2 original observations only. Creator/X opinions remain research leads until independently verified and admitted. No separate polling or research job.</small>
   </details>
   <details id="deep-research" className={styles.deepShelf} data-regime-deeper-files="collapsed-by-default">
    <summary><span className={styles.kicker}>DEEP RESEARCH / OPTIONAL READING</span>
     <strong>Issuer investigations &amp; transmission pathways</strong>
     <small>4 Nov dated desk editorial · CoreWeave · Tesla / SpaceX · Cross-regime pathways</small>
    </summary>
    <div className={styles.deepShelfBody}>
     <CurrentMarketUpdates host={host} mode="compact"/>
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
   <section className={styles.transmission} id="transmission"><span className={styles.kicker}>02 / THE TRANSMISSION MAP</span><h2>Cross-regime transmission</h2>
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
   </details>
  </div>
 </main>;
}
