import { NextResponse } from "next/server";

import { enrichCaseMonitorBoards } from "@/lib/case-monitor-overlays";
import { buildCaseMonitorBoards } from "@/lib/case-monitors";
import { getDeskData, getHybridDeskData } from "@/lib/data";
import { getGlobalFlowMonitor, type GlobalFlowMonitor } from "@/lib/global-flow-monitor";
import { buildHybridPublicationContract, getHybridPublicationRecords } from "@/lib/hybrid-publication";
import type { MarketMonitor } from "@/lib/market-monitor";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { researchScheduleHealth } from "@/lib/research-update";
import { getStoryHeaderImages } from "@/lib/story-images";

type OptionalResult<T> = {
  value: T;
  warning: string | null;
};

async function optionalWithin<T>(
  label: string,
  work: () => Promise<T>,
  fallback: T,
  timeoutMs = 3_000,
): Promise<OptionalResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
    return { value, warning: null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { value: fallback, warning: `${label} unavailable: ${detail}` };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function getCanonicalPublicationResponse() {
  const generatedAt = new Date().toISOString();

  // Canonical Supabase-backed publication data is critical. Optional provider
  // enrichments are bounded so a slow upstream cannot make Hybrid discard V2.
  const [data, records] = await Promise.all([
    getHybridDeskData(),
    getHybridPublicationRecords(),
  ]);

  const emptyMarketMonitor: MarketMonitor = {
    updatedAt: generatedAt,
    rows: [],
    contradictions: [],
    researchTriggers: [],
    limitations: ["Market monitor provider unavailable for this refresh."],
  };
  const emptyFlowMonitor: GlobalFlowMonitor = {
    updatedAt: generatedAt,
    gold: [],
    oil: [],
    researchTriggers: [],
    coverageGaps: ["Global flow providers unavailable for this refresh."],
  };
  const emptyStoryImages: Awaited<ReturnType<typeof getStoryHeaderImages>> = new Map();
  const emptyCaseMonitors: Awaited<ReturnType<typeof buildCaseMonitorBoards>> = [];

  const [marketResult, flowResult, imageResult, baseMonitorResult] = await Promise.all([
    optionalWithin("Market monitor", getMarketMonitor, emptyMarketMonitor),
    optionalWithin("Global flow monitor", getGlobalFlowMonitor, emptyFlowMonitor),
    optionalWithin(
      "Story image enrichment",
      () => getStoryHeaderImages(data.stories.map((story) => story.id), data.sources),
      emptyStoryImages,
    ),
    optionalWithin(
      "Case monitor construction",
      async () => buildCaseMonitorBoards(await getDeskData()),
      emptyCaseMonitors,
    ),
  ]);

  const overlayResult = baseMonitorResult.value.length
    ? await optionalWithin(
        "Case monitor overlays",
        () => enrichCaseMonitorBoards(baseMonitorResult.value),
        baseMonitorResult.value,
        2_000,
      )
    : { value: baseMonitorResult.value, warning: null };

  const providerWarnings = [
    marketResult.warning,
    flowResult.warning,
    imageResult.warning,
    baseMonitorResult.warning,
    overlayResult.warning,
  ].filter((warning): warning is string => Boolean(warning));

  const contract = buildHybridPublicationContract({
    stories: data.stories,
    updates: data.updates,
    researchRuns: data.researchRuns,
    marketState: data.marketStateRecords as unknown as Array<Record<string, unknown>>,
    records,
    storyImages: imageResult.value,
    generatedAt,
  });

  const marketTriggers = [
    ...marketResult.value.researchTriggers,
    ...flowResult.value.researchTriggers,
  ].sort((a, b) => b.priority - a.priority).slice(0, 24);

  return NextResponse.json({
    version: 2,
    source: "alchemy-live-market-desk",
    generatedAt,
    ...contract,
    canonical: {
      ...contract.canonical,
      caseMonitors: overlayResult.value,
      marketMonitor: marketResult.value,
      flowMonitors: flowResult.value,
      providerWarnings,
    },
    research: {
      health: researchScheduleHealth(data.researchRuns),
      latestRun: data.researchRuns[0] || null,
      marketTriggers,
      marketCoverageGaps: [...flowResult.value.coverageGaps, ...providerWarnings],
    },
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
