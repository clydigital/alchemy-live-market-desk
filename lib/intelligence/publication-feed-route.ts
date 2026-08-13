import { NextResponse } from "next/server";

import { enrichCaseMonitorBoards } from "@/lib/case-monitor-overlays";
import { buildCaseMonitorBoards } from "@/lib/case-monitors";
import { getEconomicCalendar } from "@/lib/calendar";
import { getDeskData, getHybridDeskData } from "@/lib/data";
import { getGlobalFlowMonitor, type GlobalFlowMonitor } from "@/lib/global-flow-monitor";
import { buildHybridPublicationContract, getHybridPublicationRecords } from "@/lib/hybrid-publication";
import { buildLiveDeskPulse } from "@/lib/live-desk-pulse";
import type { MarketMonitor } from "@/lib/market-monitor";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { researchScheduleHealth } from "@/lib/research-update";
import { getStoryHeaderImages } from "@/lib/story-images";

type OptionalResult<T> = {
  value: T;
  warning: string | null;
};

function liveMarketState(data: Awaited<ReturnType<typeof getHybridDeskData>>) {
  const storySlugById = new Map(data.stories.map((story) => [story.id, story.slug]));
  return data.marketStateRecords.map((record) => ({
    id: record.id,
    moduleKey: record.module_key,
    sector: record.sector,
    subIndustry: record.sub_industry,
    status: record.status,
    direction: record.direction,
    score: Math.round(((record.magnitude ?? 50) + (record.probability ?? 50)) / 2),
    magnitude: record.magnitude,
    probability: record.probability,
    risk: record.risk,
    boon: record.boon,
    beneficiaries: record.beneficiaries,
    losers: record.losers,
    evidenceSummary: record.evidence_summary,
    sourceName: record.source_name,
    sourceUrl: record.source_url,
    observedAt: record.observed_at,
    freshness: record.freshness_status,
    nextTest: record.next_test,
    storyId: record.story_id,
    storySlug: record.story_id ? storySlugById.get(record.story_id) || null : null,
    missionXp: 10,
  }));
}

function liveCalendar(
  data: Awaited<ReturnType<typeof getHybridDeskData>>,
  calendar: Awaited<ReturnType<typeof getEconomicCalendar>>,
) {
  const metricsByRelease = new Map<string, typeof data.macroReleaseMetrics>();
  for (const metric of data.macroReleaseMetrics) {
    const rows = metricsByRelease.get(metric.release_id) || [];
    rows.push(metric);
    metricsByRelease.set(metric.release_id, rows);
  }
  return calendar.map((release) => ({
    id: release.id,
    date: release.date,
    timeLabel: release.timeLabel,
    country: release.country,
    event: release.event,
    category: release.category,
    impact: release.impact,
    status: release.status,
    actual: release.actual,
    consensus: release.consensus,
    alchemyExpectation: release.alchemyExpectation ?? metricsByRelease.get(release.id)?.find((metric) => metric.alchemy_expectation !== null)?.alchemy_expectation ?? null,
    previous: release.previous,
    revisedPrevious: release.revisedPrevious ?? null,
    decidingQuestion: release.decidingQuestion,
    affectedAssets: release.affectedAssets,
    sourceName: release.sourceName,
    sourceUrl: release.sourceUrl,
    metrics: (metricsByRelease.get(release.id) || []).map((metric) => ({
      key: metric.metric_key,
      label: metric.label,
      geography: metric.geography,
      period: metric.period,
      frequency: metric.frequency,
      transformation: metric.transformation,
      unit: metric.unit,
      previous: metric.previous,
      revisedPrevious: metric.revised_previous,
      consensus: metric.consensus,
      alchemyExpectation: metric.alchemy_expectation,
      actual: metric.actual,
      surpriseVsConsensus: metric.surprise_vs_consensus,
      surpriseVsAlchemy: metric.surprise_vs_alchemy,
      sourceName: metric.source_name,
      observedAt: metric.observed_at,
    })),
    missionXp: 15,
  }));
}

function liveEarnings(data: Awaited<ReturnType<typeof getHybridDeskData>>) {
  return data.calls.map((call) => {
    const guidance = data.guidance.find((item) => item.ticker === call.ticker);
    const story = data.stories.find((item) => item.assets?.includes(call.ticker));
    return {
      id: call.id,
      ticker: call.ticker,
      companyName: call.company_name,
      fiscalPeriod: call.fiscal_period,
      callDate: call.call_date,
      transcriptStatus: call.transcript_status,
      summary: call.summary || call.relevance_reason || "Desk summary pending.",
      guidance: call.guidance || guidance?.current_view || null,
      capex: call.capex,
      demand: call.demand,
      whatChanged: call.prior_quarter_change || guidance?.wording_change || null,
      risk: story?.strongest_contradiction || call.relevance_reason || null,
      boon: story?.strongest_support || guidance?.market_interpretation || null,
      nextTest: story?.next_catalyst || guidance?.metric || "Next filing and earnings call.",
      storySlug: story?.slug || null,
      sourceUrl: guidance?.source_url || null,
      missionXp: call.transcript_status === "official" ? 25 : 15,
    };
  });
}

async function optionalWithin<T>(
  label: string,
  work: () => Promise<T>,
  fallback: T,
  timeoutMs = 2_000,
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
  const startedAt = Date.now();

  // Only canonical persisted publication data is allowed to block the feed.
  // Live provider/calendar enrichments are bounded so Hybrid can always consume
  // the latest canonical state even when an upstream source is slow.
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
  const emptyCalendar: Awaited<ReturnType<typeof getEconomicCalendar>> = [];

  const [calendarResult, marketResult, flowResult, imageResult, baseMonitorResult] = await Promise.all([
    optionalWithin("Economic calendar", getEconomicCalendar, emptyCalendar),
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
        1_000,
      )
    : { value: baseMonitorResult.value, warning: null };

  const providerWarnings = [
    calendarResult.warning,
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
  const latestRun = data.researchRuns[0] || null;
  const marketState = liveMarketState(data);
  const liveDeskPulse = buildLiveDeskPulse(data.marketStateRecords, latestRun);
  const openResearchDebt = data.researchDebt.filter((item) => item.status === "open");
  const elapsedMs = Date.now() - startedAt;

  return NextResponse.json({
    version: 2,
    source: "alchemy-live-market-desk",
    generatedAt,
    ...contract,
    canonical: {
      ...contract.canonical,
      liveDeskPulse,
      caseMonitors: overlayResult.value,
      marketMonitor: marketResult.value,
      flowMonitors: flowResult.value,
      providerWarnings,
    },
    liveDeskPulse,
    stories: contract.canonical.storyStates,
    marketState,
    calendar: liveCalendar(data, calendarResult.value),
    earnings: liveEarnings(data),
    accuracy: latestRun ? {
      checkedAt: latestRun.completed_at || latestRun.updated_at,
      status: latestRun.accuracy_gate === "open" ? "healthy" : "warning",
      score: latestRun.accuracy_gate === "open" ? 100 : latestRun.accuracy_gate === "review" ? 50 : 0,
      updateGate: latestRun.accuracy_gate,
      summary: latestRun.summary || "Latest persisted Live Desk research gate.",
    } : null,
    research: {
      health: researchScheduleHealth(data.researchRuns),
      latestRun,
      marketTriggers,
      marketCoverageGaps: [...flowResult.value.coverageGaps, ...providerWarnings],
      debt: {
        open: openResearchDebt.length,
        highPriority: openResearchDebt.filter((item) => item.severity === "high" || item.severity === "critical").length,
        items: openResearchDebt.slice(0, 20),
      },
      intelligence: {
        latestRun: data.intelligenceRuns[0] || null,
        latestStages: data.intelligenceStages.slice(0, 20),
        acquisitionFailures: data.acquisitionFailures.filter((failure) => !failure.resolved_at).slice(0, 20),
      },
      intake: {
        videos: data.researchIntake.filter((item) => item.item_type === "video").slice(0, 20),
      },
    },
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      "Server-Timing": `canonical-feed;dur=${elapsedMs}`,
      "X-Alchemy-Feed-Duration-Ms": String(elapsedMs),
      "X-Alchemy-Provider-Warnings": String(providerWarnings.length),
    },
  });
}
