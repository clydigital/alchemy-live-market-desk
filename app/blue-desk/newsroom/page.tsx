import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import Link from "next/link";
import {headers} from "next/headers";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import BluebellyNewsWire from "@/components/blue-desk/BluebellyNewsWire";
import Newsroom48hTimeline from "@/components/blue-desk/Newsroom48hTimeline";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import {getPublishedMacroPulseBriefs} from "@/lib/blue-desk-macropulse-brief-server";
import {recentBankDecisions} from "@/lib/bluebelly-bank-decision-snapshots";
import {recentReportedEditorial} from "@/lib/bluebelly-reported-editorial";
import {projectNewsroomEditorial} from "@/lib/bluebelly-newsroom-editorial";
import {selectPostEventRecaps} from "@/lib/bluebelly-post-event-recap";
import {getCurrentVerifiedMarketMotion} from "@/lib/market-motion";
import {selectVerifiedNewsBriefs} from "@/lib/market-brief-news";
import {getOriginalPressNews} from "@/lib/blue-desk-original-press-news-server";
import {combineQualifiedNews} from "@/lib/blue-desk-qualified-news";
import {getRecentArchivedPublicReaderItems} from "@/lib/bluebelly-publication-archive-server";
import {selectNewsroomHotPicks} from "@/lib/bluebelly-newsroom-hot-picks";
import {OCT30_SELL_OFF,oct30SelloffIsLead} from "@/lib/bluebelly-oct30-tech-selloff";
import {currentReviewedPublicFocus} from "@/lib/bluebelly-reviewed-public-focus";
import desk from "../blue-desk.module.css";
import ui from "./newsroom.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Newsroom | Bluebelly",description:"Source-verified markets, central-bank, AI, energy and corporate developments."};
type Props={searchParams:Promise<{q?:string|string[]}>};
export default async function NewsroomPage({searchParams}:Props){
 const now=new Date();
 const host=(await headers()).get("host");
 const [raw,official,params,archiveResult,researchDigests]=await Promise.all([
  getCurrentVerifiedMarketMotion({limit:36}).catch(()=>[]),
  getOriginalPressNews(now,18,7).catch(()=>[]),
  searchParams,
  getRecentArchivedPublicReaderItems(now).then(items=>({items,available:true})).catch(()=>({items:[],available:false})),
  getPublishedMacroPulseBriefs(4).catch(()=>[]),
 ]);
 const news=combineQualifiedNews(selectVerifiedNewsBriefs(raw,now,18),official,18);
 const query=typeof params.q==="string"?params.q:"";
 const readerHref=blueDeskPublicHref("/blue-desk/key-stories",host);
 const bankDecisions=recentBankDecisions(now,48);
 const reported=recentReportedEditorial(now,48);
 // Source-reviewed articles belong to the same categorised Newsroom wire,
 // not permanent homepage hero banners or a separate unsearchable 48h strip.
 const editorials=projectNewsroomEditorial(
  recentBankDecisions(now,168),recentReportedEditorial(now,168),
  selectPostEventRecaps(news,now,8),readerHref,now,
 );
 // An already-reviewed public Key Story is searchable; never promote MacroPulse drafts.
 for(const focus of currentReviewedPublicFocus(now))editorials.push({
   id:focus.id,headline:focus.headline,summary:focus.fact,
   occurredAt:focus.eventDay,sourceName:focus.sourceName,
   sourceUrl:focus.sourceUrl,readerHref:readerHref+focus.href,
   topics:[...focus.topics],verificationLabel:"REVIEWED EDITORIAL · PROPOSAL NOT AGREEMENT",
   why:focus.mechanism,nextTest:focus.test,kind:"reported",
 });
 if(oct30SelloffIsLead(now))editorials.unshift({
   id:OCT30_SELL_OFF.id,headline:OCT30_SELL_OFF.headline,summary:OCT30_SELL_OFF.fact+" "+OCT30_SELL_OFF.why,
   occurredAt:OCT30_SELL_OFF.occurredAt,sourceName:OCT30_SELL_OFF.sourceName,
   sourceUrl:OCT30_SELL_OFF.sourceUrl,readerHref:readerHref+OCT30_SELL_OFF.href,
   topics:["ai","earnings"],verificationLabel:"DATED EDITORIAL · REPORTED INTRADAY",
   why:OCT30_SELL_OFF.mechanism,nextTest:OCT30_SELL_OFF.test,kind:"reported",
 });
 const hotPicks=selectNewsroomHotPicks(news,archiveResult.items,now,5,editorials);
 return <main className={desk.page} data-public-newsroom="original-source-only">
  <BlueDeskHeader activePath="/blue-desk/newsroom"/>
  <div className={desk.content}>
      {oct30SelloffIsLead(now)&&+now-Date.parse(OCT30_SELL_OFF.occurredAt)<48*3600000&&currentReviewedPublicFocus(now).length===0?<article data-newsroom-lead="oct30-ai-selloff" className={ui.featureLead}>
        <p className={ui.featureKicker}>NEWSROOM LEAD · 30 OCTOBER 2026 · SOURCE-REPORTED INTRADAY REACTION</p>
        <h2 >{OCT30_SELL_OFF.headline}</h2>
        <p >{OCT30_SELL_OFF.fact} {OCT30_SELL_OFF.why}</p>
        <p className={ui.featureDate}>As-of: 30 Oct, 14:15 EDT / 31 Oct, 02:15 MYT. The crash is <strong>not</strong> confirmed; official 30 October closes and credit observations are pending for this edition.</p>
        <p><Link href={readerHref+OCT30_SELL_OFF.href}>Read the complete source-led Key Story →</Link>{" · "}<Link href={blueDeskPublicHref("/blue-desk/crash-opportunity",host)}>Crash vs Opportunity watch →</Link></p>
        <a href={OCT30_SELL_OFF.sourceUrl} target="_blank" rel="noopener noreferrer" className={ui.featureSource}>{OCT30_SELL_OFF.sourceName} ↗</a>
      </article>:null}
    <BluebellyNewsWire news={news} archiveEntries={archiveResult.items} archiveAvailable={archiveResult.available} hotPicks={hotPicks} editorials={editorials}
      initialQuery={query} now={now.toISOString()} readerHref={readerHref}>
      <div className={ui.contextBridge}>
       <strong >HORMUZ / OIL & REFINED FUELS</strong> · Track maritime disruption against Brent, diesel/gasoil crack proxies, refinery runs and US distillate inventories.
       {" "}<Link href={blueDeskPublicHref("/blue-desk/hormuz",host)}>Open the physical-versus-market watch →</Link>
      </div>
      <Newsroom48hTimeline banks={bankDecisions} reports={reported} readerHref={readerHref}/>
    </BluebellyNewsWire>
    {researchDigests.length>0?<section id="macropulse-editorial" aria-label="Reviewed MacroPulse research dispatches" data-macropulse-editorial="research-derived-not-canonical" className={ui.contextBridge}>
      <details>
        <summary>Reviewed research dispatches · separate from verified news</summary>
        <p>These are dated, owner-reviewed MacroPulse interpretations. Their sources and counterarguments are preserved, but publication does not make their market explanations canonical evidence.</p>
        {researchDigests.map(brief=><article key={brief.id} style={{padding:"12px 0",borderTop:"1px solid currentColor"}}>
          <p><strong>{brief.primary_region.toUpperCase()} · RESEARCH-DERIVED · NOT CANONICAL</strong></p>
          <h3>{brief.headline}</h3>
          <p>{brief.standfirst}</p>
          <p><strong>What changed:</strong> {brief.what_changed}</p>
          <p><strong>Why it may matter:</strong> {brief.why_it_matters}</p>
          <p><strong>Countercase:</strong> {brief.countercase}</p>
          <p><strong>What to watch:</strong> {brief.watch_next}</p>
          <p><a href={brief.source_page_url} target="_blank" rel="noopener noreferrer">Original MacroPulse research</a> · Published <DualTimestamp value={brief.published_at}/></p>
          <p>{brief.source_links.map((source,i)=><span key={source.url}>{i>0?" · ":""}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></span>)}</p>
        </article>)}
      </details>
    </section>:null}
  </div>
 </main>;
}
