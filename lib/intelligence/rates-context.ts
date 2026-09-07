import type { EvidencePackItem } from "./schemas.ts";
import { RATES_CONTEXT_PREFIX } from "../rates-research-plan.ts";

export function isRatesContext(item: EvidencePackItem) {
  return String(item.structuredPayload?.itemKey || "").startsWith(RATES_CONTEXT_PREFIX);
}

/** Context can support a recruited catalyst but cannot recruit itself or resurrect stale news. */
export function attachRatesContext(seed: EvidencePackItem[], universe: EvidencePackItem[], asOf: string): EvidencePackItem[] {
  if (!seed.length) return seed;
  const keys = new Set(seed.filter((v) => !isRatesContext(v)).map((v) => v.structuredPayload?.itemKey));
  const ids = new Set(seed.map((v) => v.id));
  const urls = new Set(seed.flatMap((v) => v.provenanceUrls));
  const time = Date.parse(asOf);
  const context = universe.filter((v) => {
    if (!isRatesContext(v) || ids.has(v.id) || v.provenanceUrls.some((url) => urls.has(url))) return false;
    const metadata = v.structuredPayload?.ratesContext as { triggerItemKeys?: string[]; retrievedAt?: string } | undefined;
    const published = Date.parse(v.publishedAt || "");
    const retrieved = Date.parse(metadata?.retrievedAt || "");
    if (!Number.isFinite(published) || published > time || !Number.isFinite(retrieved) || retrieved > time || time - retrieved > 5 * 86400000) return false;
    if (!metadata?.triggerItemKeys?.some((key) => keys.has(key))) return false;
    v.provenanceUrls.forEach((url) => urls.add(url));
    return true;
  }).slice(0, 24);
  return [...seed, ...context];
}
