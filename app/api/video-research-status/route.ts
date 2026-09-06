import { NextResponse } from "next/server";

import { getVideoResearchStatus } from "@/lib/video-research-status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await getVideoResearchStatus(), {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    return NextResponse.json({
      available: false,
      generatedAt: new Date().toISOString(),
      detail: "Video research status is unavailable.",
      channels: [],
    }, {
      status: 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
