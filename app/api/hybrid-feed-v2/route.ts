import { NextResponse } from "next/server";

import { enrichCaseMonitorBoardsWithCompanyData } from "@/lib/case-monitor-company-overlays";
import { enrichCaseMonitorBoardsWithFred } from "@/lib/case-monitor-fred-overlays";
import { enrichCaseMonitorBoardsWithMarketData } from "@/lib/case-monitor-market-overlays";
import { enrichCaseMonitorBoards } from "@/lib/case-monitor-overlays";
import { buildCaseMonitorBoards } from "@/lib/case-monitors";
import { getDeskData } from "@/lib/data";
import { buildHybridPublicationContract, getHybridPublicationRecords } from "@/lib/hybrid-publication";
import { getMarketData } from "@/lib/market";
import { researchScheduleHealth } from "@/lib/research-update";
import { getStoryHeaderImages } from "@/lib/story-images";

export const revalidate = 60;

export async function GET() {
  const generatedAt = new Date().toISOString();
  const [data, records, market] = await Promise.all([
    getDeskData(),
    getHybridPublicationRecords(),
    getMarketData(),
  ]);
  const [storyImages, baseCaseMonitors] = await Promise.all([
    getStoryHeaderImages(data.stories.map((story) => story.id), data.sources),
    buildCaseMonitorBoards(data),
  ]);
  const physicalCaseMonitors = await enrichCaseMonitorBoards(baseCaseMonitors);
  const marketCaseMonitors = await enrichCaseMonitorBoardsWithMarketData(physicalCaseMonitors, market);
  const fredCaseMonitors = await enrichCaseMonitorBoardsWithFred(marketCaseMonitors);
  const caseMonitors = enrichCaseMonitorBoardsWithCompanyData(fredCaseMonitors, data.calls, data.guidance);

  const contract = buildHybridPublicationContract({
    stories: data.stories,
    updates: data.updates,
    researchRuns: data.researchRuns,
    marketState: data.marketStateRecords as unknown as Array<Record<string, unknown>>,
    records,
    storyImages,
    generatedAt,
  });

  return NextResponse.json({
    version: 2,
    source: "alchemy-live-market-desk",
    generatedAt,
    ...contract,
    canonical: {
      ...contract.canonical,
      caseMonitors,
    },
    research: {
      health: researchScheduleHealth(data.researchRuns),
      latestRun: data.researchRuns[0] || null,
    },
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
