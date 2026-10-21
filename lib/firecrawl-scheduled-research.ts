import { applyFirecrawlResearchFallback } from "@/lib/firecrawl-research-fallback";
import { applyHighImpactMarketDiscovery } from "@/lib/high-impact-market-discovery";
import { applyOfficialPressNewsIntake } from "@/lib/official-press-news-intake";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { selectStockMoveResearchTargets, type StockMoveResearchTarget } from "@/lib/stock-move-research-targets";
import { applyResearchDiscoveryProviders } from "@/lib/research-discovery-providers";
import { type CanonicalResearchSlot } from "@/lib/research-schedule-health";
import { buildScheduledResearchInput } from "@/lib/scheduled-research-input";

export async function buildScheduledResearchInputWithFirecrawl(
  slot: CanonicalResearchSlot,
  options: Parameters<typeof buildScheduledResearchInput>[1] = {},
) {
  const now = options.now ?? new Date();
  const input = await buildScheduledResearchInput(slot, options);
  // Bounded real first-party RSS + linked HTML read. The press release is
  // evidence for its own factual announcement, not an inferred stock move.
  const originalSourceInput = await applyOfficialPressNewsIntake(input, { now });

  // Preserve the desk's source hierarchy:
  // 1) deterministic first-party/direct acquisition,
  // 2) bounded normal-web discovery for current alternative sources,
  // 3) targeted high-impact macro/FX search with direct publisher reads,
  // 4) Firecrawl only for a specific blocked page/feed after direct access failed.
  // Search/index providers remain lead generators and the underlying publisher URL
  // remains the canonical provenance.
  const discoveryInput = originalSourceInput as Parameters<typeof applyResearchDiscoveryProviders>[0];
  const discovered = await applyResearchDiscoveryProviders(discoveryInput, slot, { now });
  const highImpactInput = discovered as Parameters<typeof applyHighImpactMarketDiscovery>[0];
  // Existing monitor calculates and source-dates each market move. There is
  // no second price engine or new schedule. Fail closed on incomplete data;
  // stale/monthly/ETF rows never become stock movement investigations.
  let stockMoveTargets: StockMoveResearchTarget[] = [];
  try {
    const monitor = await getMarketMonitor();
    stockMoveTargets = selectStockMoveResearchTargets(monitor, now);
  } catch {
    // Research discovery still runs; unavailable market data is never
    // interpreted as unchanged prices.
  }
  const highImpact = await applyHighImpactMarketDiscovery(highImpactInput, slot, {
    now,
    stockMoveTargets,
  });

  // Firecrawl intentionally owns a structurally duplicated transport type so its
  // Node tests do not depend on Next path aliases. This final pass only recovers
  // supported direct public sources that remain blocked.
  const fallbackInput = highImpact as Parameters<typeof applyFirecrawlResearchFallback>[0];
  return applyFirecrawlResearchFallback(fallbackInput, now);
}
