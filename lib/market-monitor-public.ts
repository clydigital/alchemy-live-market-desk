import { getMarketMonitor as getRawMarketMonitor, type MarketMonitor } from "@/lib/market-monitor";

/**
 * Public/Hybrid-safe market monitor view.
 *
 * Some official fallback series, currently Euro-area and Japan long yields,
 * are monthly. Keep their latest level visible, but never expose monthly
 * observations through columns labelled Day, 3D, 5D, RSI, Stoch RSI or Vol.
 */
export async function getMarketMonitor(): Promise<MarketMonitor> {
  const raw = await getRawMarketMonitor();
  const monthlyIds = new Set(raw.rows.filter((row) => row.frequency !== "daily").map((row) => row.id));

  const rows = raw.rows.map((row) => row.frequency === "daily" ? row : {
    ...row,
    previousClose: null,
    sessionOpen: null,
    dayChange: null,
    gapChange: null,
    change3d: null,
    change5d: null,
    rsi: null,
    stochRsi: null,
    volPercentile: null,
    relative5d: null,
    attentionScore: 0,
    hot: false,
    contradiction: false,
    tags: ["MONTHLY LEVEL"],
  });

  const contradictions = raw.contradictions.filter((item) => !item.assets.some((asset) => monthlyIds.has(asset)));
  const researchTriggers = raw.researchTriggers.filter((item) => !item.assets.some((asset) => monthlyIds.has(asset)));

  return {
    ...raw,
    rows,
    contradictions,
    researchTriggers,
    limitations: [
      ...raw.limitations,
      "SPCX is SpaceX Class A publicly listed common stock, separate from the Renaissance IPO ETF. Related-party/merger headlines remain conditional research, not a trade verdict.",
      "The curated Europe Stock monitor uses unofficial delayed local listing quotes and local-currency identity; unavailable is not a zero change or a US ADR proxy.",
    ],
  };
}
