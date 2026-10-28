import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import {headers} from "next/headers";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import BluebellyNewsWire from "@/components/blue-desk/BluebellyNewsWire";
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
 return <main className={desk.page} data-public-newsroom="original-source-only">
  <BlueDeskHeader activePath="/blue-desk/newsroom"/>
  <div className={desk.content}>
    <BluebellyNewsWire news={news} initialQuery={query} now={now.toISOString()} readerHref={readerHref}>
      <NewsroomBriefableEvents topics={briefable} readerHref={readerHref}/>
    </BluebellyNewsWire>
  </div>
 </main>;
}
