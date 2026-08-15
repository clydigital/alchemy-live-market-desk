import { unstable_cache } from "next/cache";

import { buildGlobalFlowMonitorFromInputs, type GlobalFlowMonitor } from "@/lib/global-flow-monitor-core";
import { getMarketMonitor } from "@/lib/market-monitor";
import { fetchEiaWeeklyPetroleumSnapshot } from "@/lib/providers/eia-v2";

export * from "@/lib/global-flow-monitor-core";

const STRAITS_STATUS_URL = "https://straits.live/status";

async function straitsStatus() {
  try {
    const response = await fetch(STRAITS_STATUS_URL, {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) return null;
    return response.json() as Promise<Record<string, unknown>>;
  } catch {
    return null;
  }
}

async function loadGlobalFlowMonitor(): Promise<GlobalFlowMonitor> {
  const [statusRoot, market, eia] = await Promise.all([
    straitsStatus(),
    getMarketMonitor(),
    fetchEiaWeeklyPetroleumSnapshot(),
  ]);
  return buildGlobalFlowMonitorFromInputs(statusRoot, market, eia);
}

export const getGlobalFlowMonitor = unstable_cache(loadGlobalFlowMonitor, ["alchemy-global-flow-monitor-v2"], { revalidate: 300 });
