import { NextResponse } from "next/server";

import { getDeskData } from "@/lib/data";
import { buildHybridPublicationContract, getHybridPublicationRecords } from "@/lib/hybrid-publication";
import { getMarketData } from "@/lib/market";
import { researchScheduleHealth } from "@/lib/research-update";
import { getStoryHeaderImages } from "@/lib/story-images";
import { getAllStoryMonitorPacks } from "@/lib/story-monitors";

export const revalidate = 60;

export async function GET() {
  const generatedAt = new Date().toISOString();
  const [data, records, market] = await Promise.all([
    getDeskData(),
    getHybridPublicationRecords(),
    getMarketData(),
  ]);
  const [storyImages, storyMonitors] = await Promise.all([
    getStoryHeaderImages(data.stories.map((story) => story.id), data.sources),
    getAllStoryMonitorPacks({
      stories: data.stories,
      market,
      macroReleases: data.macroReleases,
      statements: data.statements,
      researchIntake: data.researchIntake,
      updates: data.updates,
    }),
  ]);

  const contract = buildHybridPublicationContract({
    stories: data.stories,
    updates: data.updates,
    researchRuns: data.researchRuns,
    marketState: data.marketStateRecords as unknown as Array<Record<string, unknown>>,
    records,
    storyImages,
    storyMonitors,
    generatedAt,
  });

  return NextResponse.json({
    version: 2,
    source: "alchemy-live-market-desk",
    generatedAt,
    ...contract,
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
