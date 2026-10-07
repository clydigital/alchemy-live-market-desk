import { NextResponse } from "next/server";
import { runAccuracyCheck } from "@/lib/accuracy";
import { getMarketData } from "@/lib/market";

// This endpoint fans out to live market-data providers. It must only execute
// at request time; static export can otherwise hang while waiting on external
// providers during production builds.
export const dynamic = "force-dynamic";

export async function GET() {
  const market = await getMarketData();
  const report = runAccuracyCheck(market);
  return NextResponse.json(report, {
    status: report.status === "fail" ? 503 : 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
