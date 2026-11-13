import CurrentMarketUpdates from "@/components/blue-desk/CurrentMarketUpdates";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import {projectPublishedResearchFocus} from "@/lib/blue-desk-published-research-focus";
import Link from "next/link";
import {headers} from "next/headers";
import {blueDeskPublicHref,isBlueDeskPublicReaderHost} from "@/lib/blue-desk-host";
import BluebellyNewsWire from "@/components/blue-desk/BluebellyNewsWire";
import SectorDivergenceFeature from "@/components/blue-desk/SectorDivergenceFeature";
import DatedEquityArticleReader from "@/components/blue-desk/DatedEquityArticleReader";
import {getDatedEquityArticle} from "@/lib/bluebelly-dated-equity-articles";
import Newsroom48hTimeline from "@/components/blue-desk/Newsroom48hTimeline";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import {getPublishedMacroPulseBriefs} from "@/lib/blue-desk-macropulse-brief-server";
import {getManualSweeps} from "@/lib/bluebelly-manual-sweeps";
import SignalTags from "@/components/blue-desk/SignalTags";
import {suggestSignalTags} from "@/lib/bluebelly-signal-tags";
import {isJensenGovernanceWatchWindow} from "@/lib/bluebelly-jensen-governance-watch";
import JensenGovernanceWatch from "@/components/blue-desk/JensenGovernanceWatch";
import {readBluebellyQualifiedNews} from "@/lib/bluebelly-verified-event-server";
import {recentBankDecisions} from "@/lib/bluebelly-bank-decision-snapshots";
import {recentReportedEditorial} from "@/lib/bluebelly-reported-editorial";
import {selectPostEventRecaps} from "@/lib/bluebelly-post-event-recap";
import {getRecentArchivedPublicReaderItems} from "@/lib/bluebelly-publication-archive-server";
import {selectNewsroomHotPicks} from "@/lib/bluebelly-newsroom-hot-picks";
import {publicNewsroomEditorials} from "@/lib/bluebelly-public-newsroom-feed";
import {OCT30_SELL_OFF,oct30SelloffIsLead} from "@/lib/bluebelly-oct30-tech-selloff";
import {currentReviewedPublicFocus} from "@/lib/bluebelly-reviewed-public-focus";
import desk from "../blue-desk.module.css";
import ui from "./newsroom.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Newsroom | Bluebelly",description:"Source-verified markets, central-bank, AI, energy and corporate developments."};
type Props={searchParams:Promise<{q?:string|string[];category?:string|string[];signal?:string|string[];page?:string|string[];divergence?:string|string[]}>};
export default async function NewsroomPage({searchParams}:Props){
 const now=new Date();
 const host=(await headers()).get("host");
 // Exact allowlisted reader identity stays on the existing public Newsroom path.
 // An unknown query cannot expose a private Notion page or arbitrary article.
 const requested=await searchParams;
 const article=getDatedEquityArticle(typeof requested.divergence==="string"?requested.divergence:undefined);
 if(article)return <DatedEquityArticleReader article={article} host={host}/>;
 const [sourceFeed,params,archiveResult,researchDigests]=await Promise.all([
  readBluebellyQualifiedNews(now,18),
  searchParams,
  getRecentArchivedPublicReaderItems(now).then(items=>({items,available:true})).catch(()=>({items:[],available:false})),
  getPublishedMacroPulseBriefs(4).catch(()=>[]),
 ]);
 const news=sourceFeed.news;
 const query=typeof params.q==="string"?params.q:"";
 const readerHref=blueDeskPublicHref("/blue-desk/key-stories",host);
 // Manual notes are a separate, editor-committed evidence lane, never canonical news.
 const manualSweeps=(["hormuz","energy","ai","fed","bonds","breadth","housing"] as const)
  .flatMap(topic=>getManualSweeps(topic,now,2))
  .sort((a,b)=>b.researchAt.localeCompare(a.researchAt)||a.topic.localeCompare(b.topic))
  .slice(0,12);
 const bankDecisions=recentBankDecisions(now,48);
 const reported=recentReportedEditorial(now,48);
 // Source-reviewed articles belong to the same categorised Newsroom wire,
 // not permanent homepage hero banners or a separate unsearchable 48h strip.
 const editorials=publicNewsroomEditorials(news,now,host);
 const hotPicks=selectNewsroomHotPicks(news,archiveResult.items,now,5,editorials);
 return <main className={desk.page} data-public-newsroom="original-source-only">
  <BlueDeskHeader activePath="/blue-desk/newsroom"/>
    {!isBlueDeskPublicReaderHost(host)?<CurrentMarketUpdates host={host} mode="full" now={now}/>:null}
  <div className={desk.content}>
    <header className={ui.commandHero} data-v7-newsroom-command="source-qualified">
      <div className={ui.commandTitle}>
        <p className={ui.commandEyebrow}>BLUEBELLY / SOURCE WIRE · ORIGINAL-SOURCE RECORDS</p>
        <h1>Newsroom<span>.</span></h1>
        <p>What happened, when the source reported it, and where to investigate the market consequences. Dated records, not a simulated real-time news tape.</p>
      </div>
      <div className={ui.commandMetrics} aria-label="Current source-feed coverage">
        <div><small>SOURCE-QUALIFIED NEWS</small><strong>{news.length}</strong><span>Items in this reader window</span></div>
        <div><small>ARCHIVED READER ITEMS</small><strong>{archiveResult.items.length}</strong><span>Retrieved historical entries</span></div>
        <p>{Object.values(sourceFeed.sourceReads).includes("UNAVAILABLE")
          ?"Source coverage is partial; empty results do not mean a quiet market."
          :"Records are source-qualified; retrieval is not an event timestamp."}</p>
      </div>
    </header>
    <nav className={ui.newsroomDepthNav} aria-label="Newsroom reading depth" data-newsroom-deep-dives="single-editorial-destination">
      <span aria-current="page">Latest verified news</span>
      <Link href={readerHref}>Deep Dives · Key Stories</Link>
      <a href="#newsroom-manual-sweeps">Manual research checks</a>
    </nav>
    {isJensenGovernanceWatchWindow(now)?<JensenGovernanceWatch host={host}/>:null}
    {Object.values(sourceFeed.sourceReads).includes("UNAVAILABLE")?
      <p role="status">Verified-news coverage is degraded: at least one original-source reader is unavailable. This is not a confirmed quiet market.</p>:
      !news.length?<p role="status">No source-qualified news events in this reader window. This does not establish that markets are quiet.</p>:null}
      {oct30SelloffIsLead(now)&&+now-Date.parse(OCT30_SELL_OFF.occurredAt)<48*3600000&&currentReviewedPublicFocus(now).length===0?<article data-newsroom-lead="oct30-ai-selloff" className={ui.featureLead}>
        <p className={ui.featureKicker}>NEWSROOM LEAD · 30 OCTOBER 2026 · SOURCE-REPORTED INTRADAY REACTION</p>
        <h2 >{OCT30_SELL_OFF.headline}</h2>
        <p >{OCT30_SELL_OFF.fact} {OCT30_SELL_OFF.why}</p>
        <p className={ui.featureDate}>As-of: 30 Oct, 14:15 EDT / 31 Oct, 02:15 MYT. The crash is <strong>not</strong> confirmed; official 30 October closes and credit observations are pending for this edition.</p>
        <p><Link href={readerHref+OCT30_SELL_OFF.href}>Read the complete source-led Key Story →</Link>{" · "}<Link href={blueDeskPublicHref("/blue-desk/crash-opportunity",host)}>Crash vs Opportunity watch →</Link></p>
        <a href={OCT30_SELL_OFF.sourceUrl} target="_blank" rel="noopener noreferrer" className={ui.featureSource}>{OCT30_SELL_OFF.sourceName} ↗</a>
      </article>:null}
    <BluebellyNewsWire news={news} researchItems={projectPublishedResearchFocus(researchDigests,now,6)} archiveEntries={archiveResult.items} archiveAvailable={archiveResult.available} hotPicks={hotPicks} editorials={editorials}
      initialQuery={query} initialCategory={typeof params.category==="string"?params.category:"all"} initialSignal={typeof params.signal==="string"?params.signal:"all"}
      initialPage={typeof params.page==="string"?params.page:"1"}
      now={now.toISOString()} readerHref={readerHref}>
      <div className={ui.contextBridge}>
       <strong >HORMUZ / OIL & REFINED FUELS</strong> · Track maritime disruption against Brent, diesel/gasoil crack proxies, refinery runs and US distillate inventories.
       {" "}<Link href={blueDeskPublicHref("/blue-desk/hormuz",host)}>Open the physical-versus-market watch →</Link>
      </div>
      <Newsroom48hTimeline banks={bankDecisions} reports={reported} readerHref={readerHref}/>
    </BluebellyNewsWire>
    {manualSweeps.length>0?<section id="newsroom-manual-sweeps" className={ui.manualShelf}
      data-newsroom-manual-sweeps="editor-committed-source-labelled" aria-labelledby="newsroom-manual-title">
      <header className={ui.manualHeader}>
       <div><span className={ui.manualEyebrow}>RESEARCH FOLLOW-THROUGH / MANUAL SOURCE CHECKS</span>
        <h2 id="newsroom-manual-title">Latest sweep findings, with their status</h2>
        <p>Editor-committed research checks, not fresh verified headline releases or canonical Regime changes. An attributed lead is still a lead.</p>
       </div>
       <span className={ui.manualCount}>{manualSweeps.length} recent topic checks</span>
      </header>
      <div className={ui.manualGrid}>
       {manualSweeps.map(sweep=>{const best=sweep.findings.find(f=>f.status==="SOURCE_CORROBORATED")||sweep.findings[0];
         const target=sweep.topic==="hormuz"?"/blue-desk/hormuz":"/blue-desk/regime-watch/"+sweep.topic;
         return <article key={sweep.id} className={ui.manualCard} data-manual-sweep-topic={sweep.topic}>
          <small>{sweep.date} · {sweep.topic.toUpperCase()} · {best.status.replaceAll("_"," ")}</small>
          <h3><Link href={blueDeskPublicHref(target,host)}>{sweep.title}</Link></h3>
          <SignalTags tags={suggestSignalTags({title:sweep.title,detail:best.reason,evidence:best.status,reviewedValuation:best.reviewedValuation})}/>
          <p>{best.reason}</p>
          <div className={ui.manualLinks}>
            <Link href={blueDeskPublicHref(target,host)}>Open the regime / flow evidence →</Link>
            <a href={best.sourceUrl} target="_blank" rel="noopener noreferrer">{best.sourceName} · original source ↗</a>
          </div>
         </article>;
       })}
      </div>
      <p className={ui.manualNote}>Source-led manual findings are displayed separately from the verified Newsroom wire. Failed or unreviewed research does not silently become a public Story. Earlier checks remain available inside their relevant Regime Watch lenses.</p>
     </section>:null}
    <details id="historical-sector-editorial" className={ui.historicalEditorial}
      data-newsroom-historical-sector="collapsed-below-news-wire">
      <summary>
        <span className={ui.historicalEyebrow}>HISTORICAL RESEARCH / US CLOSE 4 NOVEMBER 2026</span>
        <strong>Sector divergence &amp; Solarvest company comparison</strong>
        <span className={ui.historicalHint}>Archived analysis · open full research and source links</span>
      </summary>
      <div className={ui.historicalContent}>
        <SectorDivergenceFeature mode="newsroom"
          articleHrefBase={blueDeskPublicHref("/blue-desk/newsroom",host)}
          crossLinkHref={blueDeskPublicHref("/blue-desk/markets",host)+"#sector-divergences"}/>
      </div>
    </details>
  </div>
 </main>;
}
