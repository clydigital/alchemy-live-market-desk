import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import Link from "next/link";
import {headers} from "next/headers";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import BluebellyNewsWire from "@/components/blue-desk/BluebellyNewsWire";
import Newsroom48hTimeline from "@/components/blue-desk/Newsroom48hTimeline";
import {recentBankDecisions} from "@/lib/bluebelly-bank-decision-snapshots";
import {recentReportedEditorial} from "@/lib/bluebelly-reported-editorial";
import {getCurrentVerifiedMarketMotion} from "@/lib/market-motion";
import {selectVerifiedNewsBriefs} from "@/lib/market-brief-news";
import {getOriginalPressNews} from "@/lib/blue-desk-original-press-news-server";
import {combineQualifiedNews} from "@/lib/blue-desk-qualified-news";
import {getRecentArchivedPublicReaderItems} from "@/lib/bluebelly-publication-archive-server";
import {selectNewsroomHotPicks} from "@/lib/bluebelly-newsroom-hot-picks";
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
 const hotPicks=selectNewsroomHotPicks(news,archiveResult.items,now);
 const bankDecisions=recentBankDecisions(now,48);
 const reported=recentReportedEditorial(now,48);
 return <main className={desk.page} data-public-newsroom="original-source-only">
  <BlueDeskHeader activePath="/blue-desk/newsroom"/>
  <div className={desk.content}>
    <BluebellyNewsWire news={news} archiveEntries={archiveResult.items} archiveAvailable={archiveResult.available} hotPicks={hotPicks}
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
