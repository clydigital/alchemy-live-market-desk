import { NextResponse } from "next/server";

import { enrichCaseMonitorBoards } from "@/lib/case-monitor-overlays";
import { buildCaseMonitorBoards } from "@/lib/case-monitors";
import { getChallengerSnapshot } from "@/lib/challenger";
import { getDeskData } from "@/lib/data";
import { getGlobalFlowMonitor } from "@/lib/global-flow-monitor";
import { buildHybridPublicationContract, getHybridPublicationRecords } from "@/lib/hybrid-publication";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { researchScheduleHealth } from "@/lib/research-update";
import { getStoryHeaderImages } from "@/lib/story-images";

export const revalidate = 60;

export async function GET() {
  const generatedAt = new Date().toISOString();
  const [data, records, marketMonitor, flowMonitors, challenger] = await Promise.all([
    getDeskData(),
    getHybridPublicationRecords(),
    getMarketMonitor(),
    getGlobalFlowMonitor(),
    getChallengerSnapshot(),
  ]);
  const [storyImages, baseCaseMonitors] = await Promise.all([
    getStoryHeaderImages(data.stories.map((story) => story.id), data.sources),
    buildCaseMonitorBoards(data),
  ]);
  const caseMonitors = await enrichCaseMonitorBoards(baseCaseMonitors);

  const contract = buildHybridPublicationContract({
    stories: data.stories,
    updates: data.updates,
    researchRuns: data.researchRuns,
    marketState: data.marketStateRecords as unknown as Array<Record<string, unknown>>,
    records,
    storyImages,
    generatedAt,
  });

  const marketTriggers = [
    ...marketMonitor.researchTriggers,
    ...flowMonitors.researchTriggers,
  ].sort((a, b) => b.priority - a.priority).slice(0, 24);

  return NextResponse.json({
    version: 2,
    source: "alchemy-live-market-desk",
    generatedAt,
    ...contract,
    canonical: {
      ...contract.canonical,
      caseMonitors,
      marketMonitor,
      flowMonitors,
      challenger,
    },
    research: {
      health: researchScheduleHealth(data.researchRuns),
      latestRun: data.researchRuns[0] || null,
      marketTriggers,
      marketCoverageGaps: flowMonitors.coverageGaps,
    },
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
