import { NextResponse } from "next/server";

import { runAutonomousOrchestration } from "@/lib/intelligence/coordinator";

export const dynamic = "force-dynamic";

function authorize(request: Request) {
  const header = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!header) return false;
  const updateToken = process.env.RESEARCH_UPDATE_TOKEN?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();
  return (updateToken && header === updateToken) || (cronSecret && header === cronSecret);
}

function getHostEndpoint(request: Request) {
  const hostHeader = request.headers.get("host") || "localhost:3000";
  const protocol = hostHeader.includes("localhost") || hostHeader.includes("127.0.0.1") ? "http" : "https";
  return `${protocol}://${hostHeader}/api/research-update`;
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") === "true";
    const host = getHostEndpoint(request);

    const result = await runAutonomousOrchestration({
      dryRun,
      host
    });

    return NextResponse.json({
      success: true,
      result
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Autonomous orchestrator failed."
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let body: { dryRun?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const host = getHostEndpoint(request);

    const result = await runAutonomousOrchestration({
      dryRun: body.dryRun === true,
      host
    });

    return NextResponse.json({
      success: true,
      result
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Autonomous orchestrator failed."
    }, { status: 500 });
  }
}
