import { NextResponse } from "next/server";

import { withinTimeout } from "@/lib/async-timeout";
import { intelligenceRest } from "@/lib/intelligence/supabase";
import { projectPublishedHorizon } from "@/lib/presenter-published-horizon";

export const dynamic = "force-dynamic";

type EditionRow = { id: string; published_at: string; payload: unknown };

// Public, minimal and read-only. No new Story/Regime reasoning is performed.
export async function GET() {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  };
  try {
    const rows = await withinTimeout("Frozen presenter event horizon", () =>
      intelligenceRest<EditionRow[]>(
        "hybrid_publication_snapshots?select=id,published_at,payload&snapshot_type=eq.daily_brief&order=published_at.desc,id.desc&limit=1",
      ), 4_000);
    const view = projectPublishedHorizon(rows[0] || null, new Date().toISOString());
    return NextResponse.json(view, { status: view.status === "AVAILABLE" ? 200 : 503, headers });
  } catch {
    return NextResponse.json(projectPublishedHorizon(null, new Date().toISOString()), { status: 503, headers });
  }
}
