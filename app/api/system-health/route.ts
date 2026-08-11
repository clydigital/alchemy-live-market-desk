import { NextResponse } from "next/server";

import { getSystemHealth } from "@/lib/system-health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await getSystemHealth(), {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "System-health inspection failed.";
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      overall: { state: "unavailable", reason: detail },
    }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
