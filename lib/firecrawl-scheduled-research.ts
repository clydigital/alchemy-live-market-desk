import { applyFirecrawlResearchFallback } from "@/lib/firecrawl-research-fallback";
import { applyHighImpactMarketDiscovery } from "@/lib/high-impact-market-discovery";
import { applyResearchDiscoveryProviders } from "@/lib/research-discovery-providers";
import { type CanonicalResearchSlot } from "@/lib/research-schedule-health";
import { buildScheduledResearchInput } from "@/lib/scheduled-research-input";

export async function buildScheduledResearchInputWithFirecrawl(
  slot: CanonicalResearchSlot,
  options: Parameters<typeof buildScheduledResearchInput>[1] = {},
) {
  const now = options.now ?? new Date();
  const input = await buildScheduledResearchInput(slot, options);

  // Preserve the desk's source hierarchy:
  // 1) deterministic first-party/direct acquisition,
  // 2) bounded normal-web discovery for current alternative sources,
  // 3) targeted high-impact macro/FX search with direct publisher reads,
  // 4) Firecrawl only for a specific blocked page/feed after direct access failed.
  // Search/index providers remain lead generators and the underlying publisher URL
  // remains the canonical provenance.
  const discoveryInput = input as Parameters<typeof applyResearchDiscoveryProviders>[0];
  const discovered = await applyResearchDiscoveryProviders(discoveryInput, slot, { now });
  const highImpactInput = discovered as Parameters<typeof applyHighImpactMarketDiscovery>[0];
  const highImpact = await applyHighImpactMarketDiscovery(highImpactInput, slot, { now });

  // Firecrawl intentionally owns a structurally duplicated transport type so its
  // Node tests do not depend on Next path aliases. This final pass only recovers
  // supported direct public sources that remain blocked.
  const fallbackInput = highImpact as Parameters<typeof applyFirecrawlResearchFallback>[0];
  return applyFirecrawlResearchFallback(fallbackInput, now);
}
