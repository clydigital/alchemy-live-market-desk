import Link from "next/link";
import {headers} from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import EditorialStoryArt from "@/components/blue-desk/EditorialStoryArt";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import {getPublicThesisLedger} from "@/lib/blue-desk-thesis-ledger-server";
import {groupPublicResearch} from "@/lib/bluebelly-editorial-architecture";
import {getLensOutlook,LENS_OUTLOOK_REVIEWED_ON} from "@/lib/bluebelly-regime-lens-outlook";
import {getRegimeEditorialUpdate} from "@/lib/bluebelly-regime-verified-crossasset";
import RegimeOutlookMeter from "@/components/blue-desk/RegimeOutlookMeter";
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
 const theses=await getPublicThesisLedger(now,38).catch(()=>null);
 const lenses=groupPublicResearch(theses||[]);
 return <main className={desk.page} data-public-regime-watch="dated-editorial-lens-outlooks">
  <BlueDeskHeader activePath="/blue-desk/regime-watch"/>
  <div className={desk.content}>
   <header className={styles.intro} data-regime-design="cyberpunk-field-guide">
    <div className={styles.introContent}>
     <span className={styles.kicker}>BLUEBELLY / REGIME INTELLIGENCE — FIELD GUIDE 01</span>
     <h1>THE BIGGER <em>MARKET</em> PICTURE.</h1>
     <p>Why the market behaves the way it does. Nine competing research lenses, the strongest case against each thesis and the evidence that would change the verdict.</p>
     <nav className={styles.heroActions} aria-label="Regime Watch page sections">
      <a href="#lens-grid">EXPLORE THE NINE LENSES <span aria-hidden="true">↗</span></a>
      <a href="#cross-regime-watch">THE CROSS-REGIME TEST <span aria-hidden="true">↗</span></a>
     </nav>
     <small>REVIEWED FUNDAMENTAL RESEARCH / NOT LIVE TRADING SIGNALS</small>
    </div>
    <div className={styles.introVisual} aria-hidden="true">
     <span className={styles.visualHeader}>// NINE INTERLOCKING MARKET SYSTEMS</span>
     <div className={styles.regimeMatrix}>{Array.from({length:9},(_,index)=><span key={index}>{String(index+1).padStart(2,"0")}</span>)}</div>
     <strong>09<span>/</span>REGIMES</strong>
     <span className={styles.visualFooter}>CONNECTIONS / NOT CONCLUSIONS</span>
    </div>
   </header>
   <div className={styles.intelStrip} aria-label="Regime Watch research scope">
    <div><span>01 / RESEARCH LENSES</span><strong>09</strong><small>DIFFERENT MARKET SYSTEMS</small></div>
    <div><span>02 / SOURCE CONTEXT</span><strong>{theses===null?"—":theses.length}</strong><small>ASSOCIATED PUBLIC STORY RECORDS</small></div>
    <div><span>03 / CROSS-REGIME WATCH</span><strong>01</strong><small>CRASH VERSUS OPPORTUNITY</small></div>
    <p>Every lens is a question, not a trade. Follow the evidence into its original context, then test the counterargument.</p>
   </div>
   <div className={styles.heading} id="lens-grid">
    <div><span className={styles.kicker}>01 / THE NINE RESEARCH FILES</span><h2>Choose the <em>pressure point.</em></h2></div>
    <span>Fundamental outlook reviewed {LENS_OUTLOOK_REVIEWED_ON} MYT · {theses===null?"Story coverage unavailable":theses.length+" public Story snapshots"} · Viewed <DualTimestamp value={now.toISOString()}/></span>
   </div>
   <p className={styles.lensIntro}>Each lens has its own outlook and confidence meter. These are reviewed fundamental judgements, not live price signals or automatic changes to canonical Regime state.</p>
   <section id="cross-regime-watch" className={styles.crashFeatured} aria-labelledby="crash-opportunity-featured" data-crash-watch-entry="own-research-watch">
    <div>
      <span className={styles.kicker}>FEATURED / CROSS-REGIME WATCH</span>
      <h2 id="crash-opportunity-featured">CRASH <em>VS</em> OPPORTUNITY</h2>
      <p>When the index hides a stealth bear market, is that the warning before a wider collapse—or the setup for a broad recovery? Compare the Kobeissi and Burry cases, sourced breadth/credit signals and seven historical market scares.</p>
      <span className={styles.crashNote}>Provisional research: contested · bull and bear evidence reviewed independently · no crash probability claimed</span>
    </div>
    <Link className={styles.crashFeaturedLink} href={blueDeskPublicHref("/blue-desk/crash-opportunity",host)}>OPEN THE TWO-SIDED INVESTIGATION <span aria-hidden="true">↗</span></Link>
   </section>
   <div className={styles.cards}>{lenses.map((lens,index)=>
    <Link key={lens.id} className={styles.card} data-research-lens={lens.id}
     href={blueDeskPublicHref("/blue-desk/regime-watch/"+lens.id,host)}
     aria-label={"Explore "+lens.name+" research"}>
      <div className={styles.art}><EditorialStoryArt headline={lens.name} motif={lens.motif as EditorialMotif} compact/><span className={styles.artSerial} aria-hidden="true">{String(index+1).padStart(2,"0")}</span></div>
      <div className={styles.content}>
       <div className={styles.cardHeading}><span className={styles.kicker}>{lens.code} / RESEARCH LENS</span><span className={styles.cardSerial}>FILE {String(index+1).padStart(2,"0")} / 09</span></div>
       <h3>{lens.name}</h3>
       <RegimeOutlookMeter assessment={getLensOutlook(lens.id)}/>
       <p className={styles.lensReason}><strong>Why:</strong> {getLensOutlook(lens.id).headline}</p>
       {getRegimeEditorialUpdate(lens.id)?<span className={styles.editorialUpdate}>30 OCT · FRESH POST-DECISION EDITORIAL CHECK</span>:null}
       <p>{lens.question}</p>
       <div className={styles.coverage}>{theses===null?"Story coverage unavailable":lens.stories.length+" associated public Story snapshot"+(lens.stories.length===1?"":"s")}</div>
       <span className={styles.open}>OPEN RESEARCH / EVIDENCE &amp; TESTS <span aria-hidden="true">↗</span></span>
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
 </main>;
}
