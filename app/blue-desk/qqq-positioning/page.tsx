import {headers} from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import QqqPositioningPanel from "@/components/blue-desk/QqqPositioningPanel";
import CrashEvidenceAutoRefresh from "@/components/blue-desk/CrashEvidenceAutoRefresh";
import {getMarketMonitor} from "@/lib/market-monitor-public";
import {publicMarketObservations} from "@/lib/blue-desk-public-markets";
import {readQqqPositioning} from "@/lib/bluebelly-qqq-positioning";
import desk from "../blue-desk.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"QQQ Short Interest & Reversal Watch | Bluebelly",description:"Dated QQQ positions, matched market participation and conditional squeeze evidence."};
export default async function Page(){
 const now=new Date(),host=(await headers()).get("host");
 const [monitor,position]=await Promise.all([getMarketMonitor().catch(()=>null),readQqqPositioning()]);
 return <main className={desk.page}><BlueDeskHeader activePath="/blue-desk/markets"/><CrashEvidenceAutoRefresh/><div className={desk.content}>
  <QqqPositioningPanel detail rows={position.rows} checkedAt={position.checkedAt} market={publicMarketObservations(monitor?.rows??[],"all")} now={now} host={host}/>
 </div></main>;
}
