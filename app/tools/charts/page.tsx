import LiveChartsWorkspace from "@/components/live-desk/LiveChartsWorkspace";
import LiveDeskShell from "@/components/live-desk/LiveDeskShell";
import { getDeskData } from "@/lib/data";
import { getMarketData } from "@/lib/market";

export const dynamic = "force-dynamic";

export default async function ChartsPage() {
  const [data, market] = await Promise.all([getDeskData(), getMarketData()]);

  return (
    <LiveDeskShell
      activePath="/tools/charts"
      title="Charts"
      description="Live market series remain visible beside Story-linked research requests, using the established chart workspace and current source data."
      meta={`${market.series.length} live series · ${data.charts.length} research requests`}
    >
      <LiveChartsWorkspace market={market} charts={data.charts} />
    </LiveDeskShell>
  );
}
