import Link from "next/link";
import {headers} from "next/headers";
import {notFound} from "next/navigation";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import EditorialStoryArt from "@/components/blue-desk/EditorialStoryArt";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import {getPublicThesisLedger} from "@/lib/blue-desk-thesis-ledger-server";
import {getPublicSourceObservations} from "@/lib/blue-desk-source-observations";
import {scanRegimeViews} from "@/lib/bluebelly-regime-view-scan";
import {EDITORIAL_REGIME_LENSES,groupPublicResearch} from "@/lib/bluebelly-editorial-architecture";
import {REGIME_LENS_WORKBOOKS,matchRecentLensObservations} from "@/lib/bluebelly-regime-lens-workbook";
import {quickViewsForLens} from "@/lib/bluebelly-fundamental-quickview";
import {matchAssetSourceEvents,projectAssetTape} from "@/lib/bluebelly-regime-asset-context";
import {getMarketMonitor} from "@/lib/market-monitor-public";
import {getLensOutlook} from "@/lib/bluebelly-regime-lens-outlook";
import {getRegimeEditorialUpdate} from "@/lib/bluebelly-regime-verified-crossasset";
import RegimeOutlookMeter from "@/components/blue-desk/RegimeOutlookMeter";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import type {EditorialMotif} from "@/lib/bluebelly-editorial-visuals";
import desk from "../../blue-desk.module.css";
import styles from "./lens.module.css";

type Props={params:Promise<{lensId:string}>};
export const dynamic="force-dynamic";

export function generateStaticParams(){
 return EDITORIAL_REGIME_LENSES.map(lens=>({lensId:lens.id}));
}
export async function generateMetadata({params}:Props){
 const {lensId}=await params;
 const lens=EDITORIAL_REGIME_LENSES.find(item=>item.id===lensId);
 return {title:lens?lens.name+" | Regime Watch | Bluebelly":"Research Lens | Bluebelly",
  description:lens?.question||"Bluebelly's public thematic research lenses."};
}

export default async function ResearchLensPage({params}:Props){
 const {lensId}=await params;
 const definition=EDITORIAL_REGIME_LENSES.find(item=>item.id===lensId);
 if(!definition)notFound();
 const now=new Date(),host=(await headers()).get("host");
 const [publicTheses,sourceObservations,marketMonitor]=await Promise.all([
  getPublicThesisLedger(now,38).catch(()=>null),
  getPublicSourceObservations(now,24).catch(()=>null),
  getMarketMonitor().catch(()=>null),
 ]);
 const lens=groupPublicResearch(publicTheses||[]).find(item=>item.id===lensId)!;
 const lensNumber=String(EDITORIAL_REGIME_LENSES.findIndex(item=>item.id===lensId)+1).padStart(2,"0");
 const workbook=REGIME_LENS_WORKBOOKS[lens.id];
 const outlook=getLensOutlook(lens.id);
 const viewScan=scanRegimeViews(lens.id,outlook.reviewedAt,publicTheses,sourceObservations,now);
 const latestEditorial=getRegimeEditorialUpdate(lens.id);
 const assessments=quickViewsForLens(lens.id);
 const assetContext=assessments.map(asset=>({asset,sources:matchAssetSourceEvents(asset.id,sourceObservations,now),tape:projectAssetTape(asset.id,marketMonitor?.rows??null,now)}));
 const recent=matchRecentLensObservations(lens.id,sourceObservations||[],now);
 const newest=lens.stories.find(story=>workbook.leadHeadlinePattern.test(story.title))||null;
 const base=blueDeskPublicHref("/blue-desk/regime-watch",host);
 return <main className={desk.page} data-public-research-lens={lens.id} data-evidence-scope="public-historical-story-snapshots">
  <BlueDeskHeader activePath="/blue-desk/regime-watch"/>
  <div className={desk.content}>
   <nav className={styles.breadcrumb} aria-label="Research breadcrumb">
    <Link href={base}>Regime Watch</Link><span aria-hidden="true">/</span><span>{lens.name}</span>
   </nav>
   <header className={styles.hero} data-regime-design="cyberpunk-research-file">
    <div className={styles.heroText}>
     <span className={styles.kicker}>BLUEBELLY / REGIME INTELLIGENCE — RESEARCH FILE {lensNumber} / 09</span>
     <h1>{lens.name}</h1>
     <p className={styles.question}>{lens.question}</p>
     <p className={styles.scope}>{workbook.lead}</p>
     <div className={styles.heroActions}><a href="#lens-outlook">READ THE OUTLOOK <span aria-hidden="true">↗</span></a><a href="#decision-fork">WHAT WOULD CHANGE IT <span aria-hidden="true">↗</span></a></div>
     <div className={styles.meta}>
      <span>{publicTheses===null?"Stored Story read unavailable":lens.stories.length+" associated public Story record"+(lens.stories.length===1?"":"s")}</span>
      <span>Page viewed <DualTimestamp value={now.toISOString()}/></span>
     </div>
    </div>
    <div className={styles.heroArt}>
     <span className={styles.artCaption}>// RESEARCH SYSTEM {lensNumber}</span>
     <EditorialStoryArt headline={lens.name} motif={lens.motif as EditorialMotif}/>
     <strong className={styles.artNumber} aria-hidden="true">{lensNumber}</strong>
     <span className={styles.artFootnote}>MONITOR / CHALLENGE / REVISE</span>
    </div>
   </header>
   <div className={styles.lensQuickStrip} aria-label="Research file orientation">
    <div><span>01 / REVIEWED DIRECTION</span><strong>{outlook.outlook}</strong><small>For {outlook.directionTarget}</small></div>
    <div><span>02 / CONFIDENCE</span><strong>{outlook.confidence}</strong><small>Qualitative evidence judgement</small></div>
    <div><span>03 / NEXT DECIDING TEST</span><p>{outlook.decidingTest}</p></div>
   </div>


   <section id="lens-outlook" className={styles.outlookPanel} data-lens-outlook={outlook.outlook} data-lens-confidence={outlook.confidence} aria-labelledby="lens-outlook-title">
    <div className={styles.outlookTop}>
     <aside className={styles.outlookMeterPanel} aria-label="Lens outlook and confidence">
      <RegimeOutlookMeter assessment={outlook} size="full"/>
      <small>Editorial review: {outlook.reviewedAt} MYT. Meter position shows direction, not a statistical probability.</small>
     </aside>
     <div className={styles.outlookNarrative}>
      <span className={styles.kicker}>WHY THIS OUTLOOK? · FUNDAMENTALS, NOT PRICE FORECAST</span>
      <h2 id="lens-outlook-title">{outlook.headline}</h2>
      <p>{outlook.why}</p>
     </div>
    </div>
    <div className={styles.outlookWhy}>
     <div><span className={styles.kicker}>WHAT SUPPORTS THIS VIEW</span><p>{outlook.supporting}</p></div>
     <div><span className={styles.kicker}>WHAT CHALLENGES IT</span><p>{outlook.opposing}</p></div>
     <div><span className={styles.kicker}>WHAT WOULD CHANGE THE CALL</span><p>{outlook.decidingTest}</p></div>
    </div>
    <div className={styles.outlookFooter}>
     <p><strong>Evidence confidence:</strong> {outlook.evidenceStatus} New source matches do not automatically change the dated editorial assessment.</p>
     <p><strong>Source references:</strong> {outlook.sources.map((source,index)=><span key={source.url}>{index>0?" · ":" "}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a> ({source.kind==="COMMENTARY"?"attributed creator opinion":source.kind==="REPORTING"?"dated independent reporting":"original source"}; {source.asOf})</span>)}</p>
    </div>
   </section>

   {latestEditorial?<section className={styles.verifiedEditorial} id="latest-editorial" aria-labelledby="verified-editorial-title"
    data-regime-editorial-verified={latestEditorial.lens} data-editorial-vintage={latestEditorial.asOf}>
    <header className={styles.verifiedHead}>
     <div>
      <span className={styles.kicker}>POST-DECISION EDITORIAL CROSS-CHECK · {latestEditorial.asOf}</span>
      <h2 id="verified-editorial-title">{latestEditorial.headline}</h2>
      <p className={styles.verifiedSubhead}>{latestEditorial.title}</p>
     </div>
     <span className={styles.verifiedKind}>{latestEditorial.freshness==="PROXY_QUALIFIED"?"SOURCE-CHECKED / TECHNICAL PROXY":"DATED MARKET SESSION"}</span>
    </header>
    <p className={styles.verifiedStory}>{latestEditorial.story}</p>
    <div className={styles.verifiedInterpretations}>
     <div><span className={styles.kicker}>WHAT THE NEW DATA CONFIRMS</span><p>{latestEditorial.confirmation}</p></div>
     <div><span className={styles.kicker}>WHAT STILL COULD MISLEAD</span><p>{latestEditorial.dissent}</p></div>
    </div>
    <p className={styles.verifiedTest}><strong>Next confirming / invalidating test:</strong> {latestEditorial.nextTest}</p>
    <details className={styles.verifiedSources}>
     <summary>See exact observation clocks and original, vendor, or reporting evidence ({latestEditorial.evidence.length})</summary>
     <ul>{latestEditorial.evidence.map(source=><li key={source.name}>
      <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a>
      <span>{source.value}</span><small>{source.at} · {source.sourceType.replace("_"," ").toLowerCase()} · {source.scope}</small>
     </li>)}</ul>
    </details>
   </section>:null}

   <section id="view-scan" className={styles.changeScan} data-regime-view-scan={viewScan.state} aria-labelledby="lens-scan-heading">
    <span className={styles.kicker}>AUTOMATIC SOURCE + VIEW RECHECK / SINCE {outlook.reviewedAt} MYT</span>
    <h2 id="lens-scan-heading">Has the evidence or the market view changed?</h2>
    <p>The current stored position is checked against new publicly tracked views, revisions to existing Story records and newer source-qualified observations. None automatically changes the editorial meter above; the underlying research system must verify the implications.</p>
    {viewScan.state==="PARTIAL"||viewScan.state==="UNAVAILABLE"?
     <p className={styles.changeWarning}>Source comparison incomplete. The missing reader is not evidence of a quiet market.</p>:null}
    <div className={styles.changeCounts}>
     <div><strong>{viewScan.newViews.length}</strong><span>New tracked views</span></div>
     <div><strong>{viewScan.updatedRecords.length}</strong><span>Existing Story updates</span></div>
     <div><strong>{viewScan.sourceInputs.length}</strong><span>New original-source inputs</span></div>
    </div>
    {viewScan.newViews.length>0?<div className={styles.changeGroup}>
     <h3>New views that entered the Story memory</h3>
     {viewScan.newViews.slice(0,4).map(story=><article key={story.id}>
      <strong>{story.title}</strong><small>{story.status==="develop"?"Working/developing view":"Tracked Story"} · <DualTimestamp value={story.createdAt||story.updatedAt}/></small>
      <p>{story.thesis}</p><p><strong>Current challenge:</strong> {story.contradiction||"Countercase not recorded."}</p>
     </article>)}
    </div>:null}
    {viewScan.updatedRecords.length>0?<div className={styles.changeGroup}>
     <h3>Previously tracked views with newer records</h3>
     {viewScan.updatedRecords.slice(0,4).map(story=><article key={story.id}>
      <strong>{story.title}</strong><small>Stored record updated <DualTimestamp value={story.updatedAt}/></small>
      <p>{story.thesis}</p><p><strong>What would invalidate it:</strong> {story.invalidation||"No invalidation trigger recorded."}</p>
     </article>)}
     <small>An updated timestamp alone is not proof of a changed thesis or material Regime decision.</small>
    </div>:null}
    {viewScan.sourceInputs.length>0?<div className={styles.changeGroup}>
     <h3>Newly available original observations to test</h3>
     {viewScan.sourceInputs.map(item=><article key={item.id}>
      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.description}</a>
      <small>{item.sourceName} · Event <DualTimestamp value={item.eventAt}/> · Recorded <DualTimestamp value={item.recordedAt}/></small>
     </article>)}
     <small>Topical source matches, not evidence that the currently held view is confirmed or disproved.</small>
    </div>:null}
    {!viewScan.newViews.length&&!viewScan.updatedRecords.length&&!viewScan.sourceInputs.length&&
      viewScan.state!=="UNAVAILABLE"&&viewScan.state!=="PARTIAL"?
     <p>No qualifying new inputs found in this bounded scan. The latest full research review may still identify changes beyond this public 48-hour source window.</p>:null}
    <p className={styles.changeFoot}>This page reuses existing Story memory and source-ingestion results; it does not poll creators, trigger another model run, or issue a new fundamental verdict.</p>
   </section>
   <nav className={styles.pageNav} aria-label="Sections in this research lens">
    <a href="#view-scan">Changes since review</a>
    <a href="#lens-outlook">Outlook &amp; confidence</a>
    {latestEditorial?<a href="#latest-editorial">Latest editorial evidence</a>:null}
    {assessments.length?<a href="#asset-monitoring">Latest original sources &amp; tape</a>:null}
    <a href="#research-position">Recorded position</a>
    {workbook.policyDilemma?<a href="#policy-dilemma">Fed policy dilemma</a>:null}
    <a href="#mechanism">Transmission</a>
    <a href="#signals">Monitoring desk</a>
    <a href="#recent-sources">Recent sources</a>
    <a href="#decision-fork">Decision tests</a>
    <a href="#story-history">Story records</a>
   </nav>



   {assetContext.length?<section id="asset-monitoring" className={styles.section} aria-label="Dated original-source and market tape context" data-regime-asset-live-context="qualified-readers-only">
    <span className={styles.kicker}>SOURCE CHECK / PRICE TAPE / FRESHNESS</span>
    <h2>What has actually been observed since the review?</h2>
    <p>This separate read reuses qualified public originals and the existing Market Monitor. Observed prices and 48-hour topic matches can change without implying that the reviewed fundamental verdict has changed. The source sample is bounded; unreported events remain unknown.</p>
    <div className={styles.forkGrid}>{assetContext.map(({asset,sources,tape})=><article className={styles.fork} key={asset.id} data-asset-evidence={asset.id}>
     <span className={styles.kicker}>{asset.asset.toUpperCase()} · DATED DATA</span>
     <h3>{tape.last===null?"Market observation unavailable":tape.last.toLocaleString("en-US",{maximumFractionDigits:3})+(tape.changeUnit==="bp"?"%":"")+(tape.instrument?" · "+tape.instrument:"")}</h3>
     <p>{tape.change===null?"Dated daily change not available":(tape.change>0?"+":"")+tape.change+tape.changeUnit+" versus previous close"} {tape.observedAt?"· "+tape.observedAt:""}</p>
     <small>{tape.measurement||"No suitable direct market instrument"} · {tape.note}</small>
     {tape.sourceUrl?<p><a href={tape.sourceUrl} target="_blank" rel="noopener noreferrer">{tape.sourceName} · original market feed ↗</a></p>:null}
     <h4>Recent original-source matches</h4>
     {sources.state==="UNAVAILABLE"?<p>Source feed unavailable—not a quiet-market reading.</p>:
      sources.items.length===0?<p>No directly matched 48-hour source item in this bounded sample.</p>:
      <ul>{sources.items.map(item=><li key={item.id}>
       <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.description}</a>
       <small> {item.sourceName} · {item.eventAt.slice(0,10)} · topical match only</small>
      </li>)}</ul>}
    </article>)}</div>
   </section>:null}

   <section id="research-position" className={styles.atGlance} aria-labelledby="research-position-heading">
    <div className={styles.atGlanceMain}>
     <span className={styles.kicker}>RESEARCH POSITION / STORED CONTEXT</span>
     <h2 id="research-position-heading">{newest?newest.title:"No directly relevant Story lead yet"}</h2>
     <p>{newest?newest.thesis:publicTheses===null?"Stored Story retrieval is unavailable. The monitoring plan is still readable.":lens.stories.length?"Related public Story records are listed below, but none has a sufficiently direct headline to represent this lens as its lead.":"No public Story record is currently associated with this theme. The monitoring plan still stands."}</p>
     <div className={styles.snapshotMeta}>
      {newest?<><span>Recorded status: {newest.status.toUpperCase()}</span><span>Last stored update <DualTimestamp value={newest.updatedAt}/></span></>:null}
      {publicTheses===null?<span>Public Story service unavailable — not evidence of no activity.</span>:null}
     </div>
     {newest?<a className={styles.jump} href={"#story-"+newest.slug}>Examine the supporting and opposing case →</a>:null}
    </div>
    <div className={styles.atGlanceAside}>
     <span className={styles.kicker}>THE SINGLE MOST IMPORTANT TEST</span>
     <p>{lens.nextTest}</p>
     <small>This is the deciding research question, not a completed measurement or trading trigger.</small>
    </div>
   </section>

   {workbook.policyDilemma?<section className={styles.section} id="policy-dilemma" aria-labelledby="policy-dilemma-heading">
    <span className={styles.kicker}>POLICY DILEMMA / CROSS-MARKET TRANSMISSION</span>
    <h2 id="policy-dilemma-heading">{workbook.policyDilemma.question}</h2>
    <p className={styles.policyAnswer}>{workbook.policyDilemma.answer}</p>
    <div className={styles.forkGrid}>
     <div className={styles.fork}><span className={styles.kicker}>WHY HOUSING CAN MAKE TIGHTENING PAINFUL</span><p>{workbook.policyDilemma.housingConstraint}</p></div>
     <div className={styles.fork}><span className={styles.kicker}>WHAT THE FED IS ACTUALLY WEIGHING</span><p>{workbook.policyDilemma.policyConstraint}</p></div>
    </div>
    {workbook.scenarios?<div className={styles.scenarioGrid} aria-label="Conditional housing market scenarios">
     {workbook.scenarios.map(scenario=><article className={styles.scenario} key={scenario.title}>
      <h3>{scenario.title}</h3><p>{scenario.setup}</p>
      <ul>{scenario.crossMarketEffects.map(effect=><li key={effect}>{effect}</li>)}</ul>
     </article>)}
    </div>:null}
    <p className={styles.caveat}>These are conditional transmission paths, not forecasts. Markets can react differently when inflation, growth, credit and policy signals conflict.</p>
   </section>:null}

   <section className={styles.section} id="mechanism" aria-labelledby="mechanism-heading">
    <span className={styles.kicker}>01 / HOW THE THEME COULD REACH MARKETS</span>
    <h2 id="mechanism-heading">Follow the economic transmission</h2>
    <p>A conditional explanation of where the pressure travels. The arrows do not assert that every link has happened.</p>
    <ol className={styles.mechanismRail}>
     {workbook.causalPath.map((step,index)=><li key={step}>
      <span className={styles.stepNum}>{String(index+1).padStart(2,"0")}</span>
      <strong>{step}</strong>
     </li>)}
    </ol>
    <p className={styles.mechanismNote}><strong>The important limitation:</strong> {workbook.mechanismCaution}</p>
   </section>

   <section className={styles.section} id="signals" aria-labelledby="signals-heading">
    <span className={styles.kicker}>02 / SIGNAL MONITOR</span>
    <h2 id="signals-heading">What to check before making a call</h2>
    <p>Each reading answers a different part of the question. These are monitoring specifications, not live quotes or measurements.</p>
    <div className={styles.monitorGrid}>{workbook.monitors.map((monitor,index)=>
     <article className={styles.monitor} key={monitor.name}>
      <div className={styles.monitorTop}><span>{String(index+1).padStart(2,"0")} / WATCH</span><small>{monitor.cadence}</small></div>
      <h3>{monitor.name}</h3>
      <p>{monitor.purpose}</p>
      <div className={styles.discriminator}><strong>Deciding question</strong><p>{monitor.discriminator}</p></div>
      <a href={monitor.sourceUrl} target="_blank" rel="noopener noreferrer">Check {monitor.sourceName} ↗</a>
      <small className={styles.measurementState}>Value / observation date: not supplied by this research plan</small>
     </article>)}</div>
    <p className={styles.caveat}>Sources are reference entry points, not verified observations until their specific dates, units and readings are captured.</p>
   </section>

   <section className={styles.section} id="recent-sources" aria-labelledby="recent-sources-heading">
    <span className={styles.kicker}>03 / RECENT ORIGINAL-SOURCE CONTEXT</span>
    <h2 id="recent-sources-heading">Source observations from the last 48 hours</h2>
    <p>Only already qualified, source-linked public observations are eligible. A text match places an item in this research lens for reading; it does not establish a causal link, prove the thesis or change canonical Regime state. This is a bounded sample, not an exhaustive source scan.</p>
    {sourceObservations===null?
     <div className={styles.empty}><strong>Source observation service unavailable.</strong><p>Do not infer that nothing has happened. Check official sources and the Newsroom.</p></div>:
     recent.length===0?
      <div className={styles.empty}><strong>No matching original-source observation in this limited 48-hour sample.</strong><p>This is a coverage result, not proof of a quiet market or confirmation of a theory.</p></div>:
      <div className={styles.recentList}>{recent.map(item=>
       <article key={item.id} className={styles.recentItem}>
        <span className={styles.kicker}>{item.kind==="MARKET_OBSERVATION"?"DATED MARKET OBSERVATION":"ORIGINAL-SOURCE RELEASE"} · EDITORIAL TOPIC MATCH</span>
        <p>{item.description}</p>
        <small>Event <DualTimestamp value={item.eventAt}/> · {item.sourceName}</small>
        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Read original source ↗</a>
       </article>)}</div>}
    <p className={styles.sourceFooter}><Link href={blueDeskPublicHref("/blue-desk/newsroom",host)}>See verified Newsroom coverage →</Link> <Link href={blueDeskPublicHref("/blue-desk/calendar",host)}>Upcoming event calendar →</Link></p>
   </section>

   <section className={styles.section} id="decision-fork" aria-labelledby="decision-fork-heading">
    <span className={styles.kicker}>04 / THE INVESTOR TEST</span>
    <h2 id="decision-fork-heading">What would change the interpretation?</h2>
    <p>The following are conditional, forward-looking tests. Neither outcome is asserted as current fact.</p>
    <div className={styles.forkGrid}>
     <div className={styles.fork}>
      <span className={styles.kicker}>STRENGTHENS THE HYPOTHESIS</span>
      <p>{workbook.strengthen}</p>
     </div>
     <div className={styles.fork}>
      <span className={styles.kicker}>WEAKENS THE HYPOTHESIS</span>
      <p>{workbook.challenge}</p>
     </div>
    </div>
    <div className={styles.decision}><strong>The next discriminator</strong><p>{lens.nextTest}</p></div>
   </section>

   <div className={styles.layout}>
    <div className={styles.primary}>
     <section className={styles.section} id="story-history" aria-labelledby="lens-story-history">
      <span className={styles.kicker}>05 / STORED RESEARCH CONTEXT</span>
      <h2 id="lens-story-history">The public Story records behind this lens</h2>
      <p>These are up to six currently stored public Story records, ordered by update date and grouped by a topic match. They are not a complete immutable edition history. A revised stored field must not be mistaken for the exact wording of an earlier publication.</p>
      {publicTheses===null?
       <div className={styles.empty}><strong>Public Story history could not be loaded.</strong><p>The research question remains available. No market conclusion is implied by this retrieval failure.</p></div>
      :lens.stories.length===0?
       <div className={styles.empty}><strong>No matching public Story records in this bounded sample.</strong><p>That does not mean the theme is inactive. The next evidence test remains open.</p></div>
      :<div className={styles.stories}>{lens.stories.map((story,index)=>
       <article className={styles.story} key={story.id} id={"story-"+story.slug}>
        <header className={styles.storyHead}>
         <span className={styles.kicker}>RECORD {String(index+1).padStart(2,"0")} · STORED {story.status.toUpperCase()}</span>
         <h3>{story.title}</h3>
         <p className={styles.recorded}>Record last updated <DualTimestamp value={story.updatedAt}/></p>
        </header>
        <div className={styles.thesis}><strong>Recorded thesis</strong><p>{story.thesis}</p></div>
        <details className={styles.storyEvidence} open={index===0}>
         <summary>Read the supporting case, countercase and next tests</summary>
         <div className={styles.evidenceGrid}>
          <div><h4>What the snapshot cites in support</h4>
           <p>{story.support||"No supporting statement is present in this public record."}</p>
          </div>
          <div><h4>What challenges the argument</h4>
           <p>{story.contradiction||"No competing statement is present in this public record."}</p>
          </div>
         </div>
         {story.pricedAssessment?<p className={styles.pricing}><strong>Recorded market-pricing interpretation:</strong> {story.pricedAssessment}</p>:null}
         <div className={styles.tests}>
          <h4>What the stored Story proposes to watch</h4>
          {story.confirmation?<p><strong>Would strengthen:</strong> {story.confirmation}</p>:null}
          {story.invalidation?<p><strong>Would weaken:</strong> {story.invalidation}</p>:null}
          {story.nextTest?<p><strong>Next recorded test:</strong> {story.nextTest}</p>:null}
          {!story.confirmation&&!story.invalidation&&!story.nextTest?<p>Specific confirmation and invalidation tests are not in this public record.</p>:null}
         </div>
        </details>
       </article>)}</div>}
     </section>
    </div>
    <aside className={styles.sidebar} aria-label="Research navigation and limitations">
     <section className={styles.railCard}>
      <span className={styles.kicker}>CONTINUE THE INVESTIGATION</span>
      <h2>Cross-market checks</h2>
      <p>These neighbouring questions may help test the transmission pathway, without inheriting this lens&apos;s conclusion.</p>
      {workbook.related.map(item=><Link key={item.id}
       href={blueDeskPublicHref("/blue-desk/regime-watch/"+item.id,host)}>
       <strong>{EDITORIAL_REGIME_LENSES.find(x=>x.id===item.id)?.name}</strong><small>{item.why}</small>
      </Link>)}
      <Link href={blueDeskPublicHref("/blue-desk/markets",host)}>Open dated Markets observations →</Link>
     </section>
     {lens.stories.length>0?<nav className={styles.railCard} aria-label="Stories in this research lens">
      <span className={styles.kicker}>JUMP TO A RECORDED STORY</span>
      {lens.stories.map(story=><a key={story.id} href={"#story-"+story.slug}>{story.title}</a>)}
     </nav>:null}
     <section className={styles.railCard}>
      <span className={styles.kicker}>EVIDENCE BOUNDARY</span>
      <h2>What this page cannot claim</h2>
      <p>Topic associations and transmission diagrams are editorial navigation, not a fresh price observation, verified causal explanation, evidence UUID link or new System 2 Regime verdict.</p>
      <p>Private technical readings, exact historical editions and changes to the canonical thesis remain with their existing authorised systems.</p>
     </section>
    </aside>
   </div>
   <section className={styles.otherLenses} aria-labelledby="explore-related">
    <div className={styles.otherHead}><h2 id="explore-related">Explore another research lens</h2><Link href={base}>View all nine →</Link></div>
    <div className={styles.otherGrid}>{EDITORIAL_REGIME_LENSES.filter(item=>item.id!==lens.id).map(item=>
      <Link key={item.id} href={blueDeskPublicHref("/blue-desk/regime-watch/"+item.id,host)}>
       <span>{item.code}</span><strong>{item.name}</strong><span aria-hidden="true">→</span>
      </Link>)}</div>
   </section>
  </div>
 </main>;
}
