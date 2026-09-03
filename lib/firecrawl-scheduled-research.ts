import { applyFirecrawlResearchFallback } from "@/lib/firecrawl-research-fallback";
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
  // 3) Firecrawl only for direct sources that are still blocked.
  // Search providers remain lead generators and never become evidence authorities.
  const discoveryInput = input as Parameters<typeof applyResearchDiscoveryProviders>[0];
  const discovered = await applyResearchDiscoveryProviders(discoveryInput, slot, { now });

  // Firecrawl intentionally owns a structurally duplicated transport type so its
  // Node tests do not depend on Next path aliases. It only recovers supported
  // blocked public sources and preserves the original publisher/article provenance.
  const fallbackInput = discovered as Parameters<typeof applyFirecrawlResearchFallback>[0];
  return applyFirecrawlResearchFallback(fallbackInput, now);
}
