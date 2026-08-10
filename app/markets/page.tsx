import LiveDeskShell from "@/components/live-desk/LiveDeskShell";
import MarketsMonitor from "@/components/live-desk/MarketsMonitor";
import { getChallengerSnapshot } from "@/lib/challenger";
import { getGlobalFlowMonitor } from "@/lib/global-flow-monitor";
import { getMarketMonitor } from "@/lib/market-monitor-public";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export default async function MarketsPage() {
  const [monitor, flows, challenger] = await Promise.all([
    getMarketMonitor(),
    getGlobalFlowMonitor(),
    getChallengerSnapshot(),
  ]);
  return (
    <LiveDeskShell
      activePath="/markets"
      eyebrow="Cross-asset monitor"
      title="Markets"
      description="A compact research terminal for price action, momentum, cross-asset contradictions and the physical or sovereign flows that can change the Story."
      meta={<><span>Challenger {challenger.status.replace("_", " ")}</span><span>{monitor.rows.length} assets</span><span>{monitor.researchTriggers.length} research triggers</span></>}
    >
      <MarketsMonitor monitor={monitor} flows={flows} challenger={challenger} />
    </LiveDeskShell>
  );
}
