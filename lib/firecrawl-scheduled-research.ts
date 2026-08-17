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
  const recovered = await applyFirecrawlResearchFallback(input, now);
  return applyResearchDiscoveryProviders(recovered, slot, { now });
}
