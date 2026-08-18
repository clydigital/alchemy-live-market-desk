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

  // Firecrawl intentionally owns a structurally duplicated transport type so its
  // Node tests do not depend on Next path aliases. It only passes recalibrations
  // through unchanged from the canonical scheduled input, so bridge that known
  // transport boundary here rather than weakening the canonical discovery type.
  const discoveryInput = recovered as Parameters<typeof applyResearchDiscoveryProviders>[0];
  return applyResearchDiscoveryProviders(discoveryInput, slot, { now });
}
