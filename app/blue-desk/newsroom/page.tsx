import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import Link from "next/link";
import {headers} from "next/headers";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import BluebellyNewsWire from "@/components/blue-desk/BluebellyNewsWire";
import Newsroom48hTimeline from "@/components/blue-desk/Newsroom48hTimeline";
import NextBankCatalysts from "@/components/blue-desk/NextBankCatalysts";
import {sourceScheduledBankWatch} from "@/lib/bluebelly-next-bank-catalysts";
import {recentBankDecisions} from "@/lib/bluebelly-bank-decision-snapshots";
import {recentReportedEditorial} from "@/lib/bluebelly-reported-editorial";
import NewsroomBriefableEvents from "@/components/blue-desk/NewsroomBriefableEvents";
import {getEconomicCalendar} from "@/lib/calendar";
import {getForwardEarningsEvents} from "@/lib/forward-earnings-sources";
import {buildPresenterCalendar} from "@/lib/presenter-calendar";
import {decisionTopics} from "@/lib/bluebelly-decision-brief";
import {getCurrentVerifiedMarketMotion} from "@/lib/market-motion";
import {selectVerifiedNewsBriefs} from "@/lib/market-brief-news";
import {getOriginalPressNews} from "@/lib/blue-desk-original-press-news-server";
import {combineQualifiedNews} from "@/lib/blue-desk-qualified-news";
import desk from "../blue-desk.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Newsroom | Bluebelly",description:"Source-verified markets, central-bank, AI, energy and corporate developments."};
type Props={searchParams:Promise<{q?:string|string[]}>};
export default async function NewsroomPage({searchParams}:Props){
 const now=new Date();
 const host=(await headers()).get("host");
 const [raw,official,macro,earnings,params]=await Promise.all([
  getCurrentVerifiedMarketMotion({limit:36}).catch(()=>[]),
  getOriginalPressNews(now,18,7).catch(()=>[]),
  getEconomicCalendar().catch(()=>[]),
  getForwardEarningsEvents({now}).catch(()=>({events:[],coverage:"unavailable" as const,warning:"Earnings provider unavailable"})),
  searchParams,
 ]);
 const news=combineQualifiedNews(selectVerifiedNewsBriefs(raw,now,18),official,18);
 const query=typeof params.q==="string"?params.q:"";
 const readerHref=blueDeskPublicHref("/blue-desk/key-stories",host);
 const calendar=buildPresenterCalendar(macro,earnings,now);
 const briefable=decisionTopics(news,calendar,now);
 const bankDecisions=recentBankDecisions(now,48);
 const reported=recentReportedEditorial(now,48);
 const nextBanks=sourceScheduledBankWatch(now);
 const briefableNoDuplicate=briefable.filter(t=>!(t.id==="rbnz-october-2026-editorial" &&
   bankDecisions.some(b=>b.id==="rbnz-2026-10-28")));
 return <main className={desk.page} data-public-newsroom="original-source-only">
  <BlueDeskHeader activePath="/blue-desk/newsroom"/>
  <div className={desk.content}>
    <BluebellyNewsWire news={news} initialQuery={query} now={now.toISOString()} readerHref={readerHref}>
      <div style={{margin:"3px 0 16px",padding:"12px 15px",background:"#0b3246",border:"1px solid #346d83",borderRadius:"8px",fontSize:"13px",lineHeight:1.6}}>
       <strong style={{color:"#f0d39e"}}>HORMUZ / OIL & REFINED FUELS</strong> · Track maritime disruption against Brent, diesel/gasoil crack proxies, refinery runs and US distillate inventories.
       {" "}<Link href={blueDeskPublicHref("/blue-desk/hormuz",host)}>Open the physical-versus-market watch →</Link>
      </div>
      <Newsroom48hTimeline banks={bankDecisions} reports={reported} readerHref={readerHref}/>
      <NextBankCatalysts items={nextBanks}/>
      <NewsroomBriefableEvents topics={briefableNoDuplicate} readerHref={readerHref}/>
    </BluebellyNewsWire>
  </div>
 </main>;
}
