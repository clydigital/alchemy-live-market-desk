import "server-only";
import {getMarketMonitor} from "@/lib/market-monitor-public";
export default async function OwnerInvestmentResearchPanel(){
 const monitor=await getMarketMonitor().catch(()=>null);
 return <section data-investment-research="independent-private">
  <h3>Independent investment check</h3>
  <p>Bluebelly Markets source: {monitor?.updatedAt||"unavailable"}. The investment comparison is read-only.</p>
 </section>;
}
