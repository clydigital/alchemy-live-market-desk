import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import Link from "next/link";
import {headers} from "next/headers";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import BluebellyNewsWire from "@/components/blue-desk/BluebellyNewsWire";
import Newsroom48hTimeline from "@/components/blue-desk/Newsroom48hTimeline";
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
import desk from "../blue-desk.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Newsroom | Bluebelly",description:"Source-verified markets, central-bank, AI, energy and corporate developments."};
type Props={searchParams:Promise<{q?:string|string[]}>};
export default async function NewsroomPage({searchParams}:Props){
 const now=new Date();
 const host=(await headers()).get("host");
 const [raw,official,params,archiveResult]=await Promise.all([
  getCurrentVerifiedMarketMotion({limit:36}).catch(()=>[]),
  getOriginalPressNews(now,18,7).catch(()=>[]),
  searchParams,
  getRecentArchivedPublicReaderItems(now).then(items=>({items,available:true})).catch(()=>({items:[],available:false})),
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
 const hotPicks=selectNewsroomHotPicks(news,archiveResult.items,now,5,editorials);
 return <main className={desk.page} data-public-newsroom="original-source-only">
  <BlueDeskHeader activePath="/blue-desk/newsroom"/>
  <div className={desk.content}>
      {oct30SelloffIsLead(now)?<article data-newsroom-lead="oct30-ai-selloff" style={{margin:"3px 0 18px",padding:"clamp(18px,3vw,27px)",border:"1px solid var(--bb-card-border)",borderRadius:10,background:"var(--bb-surface)",color:"var(--bb-text)"}}>
        <p style={{fontSize:11,letterSpacing:".09em",fontWeight:800,color:"var(--bb-accent)"}}>NEWSROOM LEAD · 30 OCTOBER 2026 · SOURCE-REPORTED INTRADAY REACTION</p>
        <h2 style={{fontSize:"clamp(25px,3vw,37px)",lineHeight:1.16,margin:"10px 0"}}>{OCT30_SELL_OFF.headline}</h2>
        <p style={{lineHeight:1.65}}>{OCT30_SELL_OFF.fact} {OCT30_SELL_OFF.why}</p>
        <p style={{fontSize:12,color:"var(--bb-muted)"}}>As-of: 30 Oct, 14:15 EDT / 31 Oct, 02:15 MYT. The crash is <strong>not</strong> confirmed; official 30 October closes and credit observations are pending for this edition.</p>
        <p><Link href={readerHref+OCT30_SELL_OFF.href}>Read the complete source-led Key Story →</Link>{" · "}<Link href={blueDeskPublicHref("/blue-desk/crash-opportunity",host)}>Crash vs Opportunity watch →</Link></p>
        <a href={OCT30_SELL_OFF.sourceUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:12}}>{OCT30_SELL_OFF.sourceName} ↗</a>
      </article>:null}
    <BluebellyNewsWire news={news} archiveEntries={archiveResult.items} archiveAvailable={archiveResult.available} hotPicks={hotPicks} editorials={editorials}
      initialQuery={query} now={now.toISOString()} readerHref={readerHref}>
      <div style={{margin:"3px 0 16px",padding:"12px 15px",background:"#0b3246",border:"1px solid #346d83",borderRadius:"8px",fontSize:"13px",lineHeight:1.6}}>
       <strong style={{color:"#f0d39e"}}>HORMUZ / OIL & REFINED FUELS</strong> · Track maritime disruption against Brent, diesel/gasoil crack proxies, refinery runs and US distillate inventories.
       {" "}<Link href={blueDeskPublicHref("/blue-desk/hormuz",host)}>Open the physical-versus-market watch →</Link>
      </div>
      <Newsroom48hTimeline banks={bankDecisions} reports={reported} readerHref={readerHref}/>
    </BluebellyNewsWire>
  </div>
 </main>;
}
