import MarketStateBoard from "@/components/MarketStateBoard";
import LiveDeskShell from "@/components/live-desk/LiveDeskShell";
import { getDeskData } from "@/lib/data";
import { getMarketData } from "@/lib/market";

export const dynamic = "force-dynamic";

export default async function HeatmapsPage() {
  const [data, market] = await Promise.all([getDeskData(), getMarketData()]);

  return (
    <LiveDeskShell
      activePath="/data/heatmaps"
      title="Heatmaps"
      description="Sub-industry risks, boons and evidence are built from the current market series and reviewed Story state."
      meta={`${market.series.length} live series · ${market.breadth.length} breadth sets`}
    >
      <MarketStateBoard
        market={market}
        stories={data.stories}
        updates={data.updates}
        records={data.marketStateRecords}
      />
    </LiveDeskShell>
  );
}
