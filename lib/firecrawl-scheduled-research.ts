import { applyFirecrawlResearchFallback } from "@/lib/firecrawl-research-fallback";
import {expectedIssuerReceiptGaps} from "@/lib/scheduled-issuer-receipt-coverage";
import { applyHighImpactMarketDiscovery } from "@/lib/high-impact-market-discovery";
import { applyOfficialPressNewsIntake } from "@/lib/official-press-news-intake";
import {applyIssuerResultsPressIntake} from "@/lib/issuer-results-press-intake";
import { applyMaterialSecProspectusIntake } from "@/lib/material-sec-prospectus-intake";
import {getXWireDurable} from "@/lib/x-wire-durable";
import {attachXWireResearchLeads} from "@/lib/x-wire-scheduled-research-leads";
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
  // Bounded material original SEC S-1/F-1 prospectus discovery uses the same
  // existing scheduled research run. No new cron, source table or Story writer.
  const issuerResults = await applyIssuerResultsPressIntake(originalSourceInput,{now});
  const originalFilings = await applyMaterialSecProspectusIntake(issuerResults, { now });

  // Preserve the desk's source hierarchy:
  // 1) deterministic first-party/direct acquisition,
  // 2) bounded normal-web discovery for current alternative sources,
  // 3) targeted high-impact macro/FX search with direct publisher reads,
  // 4) Firecrawl only for a specific blocked page/feed after direct access failed.
  // Search/index providers remain lead generators and the underlying publisher URL
  // remains the canonical provenance.
  let xEnrichedInput = originalFilings;
  // X Wire's durable cursor/cooldown is reused inside the EXISTING scheduled
  // morning/evening acquisition, not a new cron. Social posts remain LEADs.
  // The service-role writer owns checkpoint persistence and never requests
  // authenticated provider account credentials from a browser.
  if (slot==="morning" || slot==="evening") {
    try {
      const wire=await getXWireDurable({now});
      xEnrichedInput=attachXWireResearchLeads(originalFilings,wire,now);
      if(!wire.storageHealthy||wire.health.inaccessible>0)
        console.warn(JSON.stringify({event:"x_wire_scheduled_source_partial",
         storageHealthy:wire.storageHealthy,inaccessible:wire.health.inaccessible}));
    }catch{
      xEnrichedInput={...originalFilings,
       summary:(originalFilings.summary||"")+" X Wire scheduled retrieval unavailable; no X coverage claimed."};
    }
  }
  const discoveryInput = xEnrichedInput as Parameters<typeof applyResearchDiscoveryProviders>[0];
  const discovered = await applyResearchDiscoveryProviders(discoveryInput, slot, { now });
  const highImpactInput = discovered as Parameters<typeof applyHighImpactMarketDiscovery>[0];
  // Existing monitor calculates and source-dates each market move. There is
  // no second price engine or new schedule. Fail closed on incomplete data;
  // stale/monthly/ETF rows never become stock movement investigations.
  let stockMoveTargets: StockMoveResearchTarget[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    // Market-monitor cold caches may contact many providers. The research
    // cycle must never be held hostage by a separate market-data outage.
    const read = getMarketMonitor().then(monitor =>
      selectStockMoveResearchTargets(monitor, now)).catch(() => null);
    const budget = new Promise<null>(resolve => {
      timer = setTimeout(() => resolve(null), 8_000);
    });
    const selected = await Promise.race([read, budget]);
    if (selected === null) {
      console.warn(JSON.stringify({ event: "stock_move_research_source_unavailable" }));
    } else {
      stockMoveTargets = selected;
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
  const highImpact = await applyHighImpactMarketDiscovery(highImpactInput, slot, {
    now,
    stockMoveTargets,
  });

  // Firecrawl intentionally owns a structurally duplicated transport type so its
  // Node tests do not depend on Next path aliases. This final pass only recovers
  // supported direct public sources that remain blocked.
  const fallbackInput = highImpact as Parameters<typeof applyFirecrawlResearchFallback>[0];
  const recovered=await applyFirecrawlResearchFallback(fallbackInput, now);
  const automationCoverageAlerts=expectedIssuerReceiptGaps(recovered,now);
  if(automationCoverageAlerts.length)console.warn(JSON.stringify({
    event:"scheduled_official_issuer_receipt_coverage_gap",
    slot,runKey:recovered.runKey,
    expectedOriginalReleaseCount:automationCoverageAlerts.length,
    missing:automationCoverageAlerts,
  }));
  return {...recovered,automationCoverageAlerts};
}
