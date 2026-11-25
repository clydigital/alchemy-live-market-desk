import {headers} from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import CreatorIntelligencePanel from "@/components/blue-desk/CreatorIntelligencePanel";
import {getMarketMonitor} from "@/lib/market-monitor-public";
import {publicMarketObservations} from "@/lib/blue-desk-public-markets";
import {readQqqPositioning} from "@/lib/bluebelly-qqq-positioning";
import {getOwnerCreatorSignalDigest} from "@/lib/bluebelly-creator-signals-server";
import desk from "../blue-desk/blue-desk.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"CREATOR INTEL | Bluebelly"};
export default async function Page(){
 const now=new Date(),host=(await headers()).get("host");
 const read=await getOwnerCreatorSignalDigest(now);
 const [monitor,position]=await Promise.all([getMarketMonitor().catch(()=>null),readQqqPositioning()]);
 return <main className={desk.page}><BlueDeskHeader activePath="/creator-intelligence"/><div className={desk.content}>
 <p style={{margin:"8px 0"}}><a href="/owner/research#hypothesis-evidence">Open cross-source hypotheses and evidence gems ↗</a> · Creator interpretations remain attributed until independently checked.</p>
 <CreatorIntelligencePanel rows={position.rows} market={publicMarketObservations(monitor?.rows??[],"all")} now={now} host={host} readOverride={read}/>
 </div></main>;
}
