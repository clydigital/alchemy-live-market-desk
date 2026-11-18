import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** External scheduler probe. Performs a real, bounded DB read; never exposes rows or credentials. */
export async function GET() {
  try {
    const db = createSupabaseAdminClient();
    const { error } = await db.from("power_stack_quote_observations")
      .select("ticker", { head: true, count: "exact" })
      .limit(1)
      .abortSignal(AbortSignal.timeout(8000));
    if (error) throw error;
    return NextResponse.json({ database: "reachable" }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ database: "unavailable" }, {
      status: 503, headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
