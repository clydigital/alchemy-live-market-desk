import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      status: "paused",
      detail: "Automated production cron runs are temporarily paused.",
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
