import { NextResponse } from "next/server";

import { getDeskData } from "@/lib/data";
import { buildHybridPublicationContract, getHybridPublicationRecords } from "@/lib/hybrid-publication";
import { researchScheduleHealth } from "@/lib/research-update";

export const revalidate = 60;

export async function GET() {
  const generatedAt = new Date().toISOString();
  const [data, records] = await Promise.all([
    getDeskData(),
    getHybridPublicationRecords(),
  ]);

  const contract = buildHybridPublicationContract({
    stories: data.stories,
    updates: data.updates,
    researchRuns: data.researchRuns,
    marketState: data.marketStateRecords as unknown as Array<Record<string, unknown>>,
    records,
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
