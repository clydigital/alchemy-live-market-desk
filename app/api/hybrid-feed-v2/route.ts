import { NextResponse } from "next/server";

import { enrichCaseMonitorBoards } from "@/lib/case-monitor-overlays";
import { buildCaseMonitorBoards } from "@/lib/case-monitors";
import { getDeskData } from "@/lib/data";
import { buildHybridPublicationContract, getHybridPublicationRecords } from "@/lib/hybrid-publication";
import { researchScheduleHealth } from "@/lib/research-update";
import { getStoryHeaderImages } from "@/lib/story-images";

export const revalidate = 60;

export async function GET() {
  const generatedAt = new Date().toISOString();
  const [data, records] = await Promise.all([
    getDeskData(),
    getHybridPublicationRecords(),
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
