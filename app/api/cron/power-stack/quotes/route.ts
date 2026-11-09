import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getMarketMonitor } from "@/lib/market-monitor-public";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
const VALID = /^[A-Z0-9][A-Z0-9.\-]{0,17}$/;

function symbolsFromSnapshot(snapshot: unknown): string[] {
  if (!snapshot || typeof snapshot !== "object") return [];
  const s = snapshot as Record<string, unknown>;
  const rows = [...(Array.isArray(s.holdings) ? s.holdings : []),
    ...(Array.isArray(s.watchlist) ? s.watchlist : [])];
  return [...new Set(rows.flatMap(row => {
    if (!row || typeof row !== "object") return [];
    const ticker = (row as { ticker?: unknown }).ticker;
    return typeof ticker === "string" && VALID.test(ticker.toUpperCase())
      ? [ticker.toUpperCase()] : [];
  }))].slice(0, 250);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = createSupabaseAdminClient();
    const { data: snapshots, error } = await db.from("power_stack_owner_snapshots")
      .select("owner_user_id,snapshot,legacy_source_retired,snapshot_as_of")
      .eq("legacy_source_retired", true)
      .order("snapshot_as_of", { ascending: false }).limit(200);
    if (error) throw error;
    const latest = new Map<string, unknown>();
    for (const row of snapshots ?? []) {
      if (!latest.has(row.owner_user_id)) latest.set(row.owner_user_id, row.snapshot);
    }
    const monitor = await getMarketMonitor();
    const indexed = new Map(monitor.rows
      .filter(row => row.last !== null && row.asOf && row.sourceName && row.sourceUrl)
      .map(row => [row.symbol.toUpperCase(), row]));
    let written = 0, missing = 0;
    for (const [owner, snapshot] of latest) {
      const observations = symbolsFromSnapshot(snapshot).flatMap(ticker => {
        const quote = indexed.get(ticker);
        if (!quote || quote.last === null || !quote.asOf) { missing++; return []; }
        const observedOn = quote.asOf.slice(0,10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(observedOn)) { missing++; return []; }
        // Do not label old observations as fresh, even when cache fetched recently.
        return [{
          owner_user_id: owner, ticker, observed_on: observedOn,
          price: quote.last, currency: "USD",
          source_name: quote.sourceName, source_url: quote.sourceUrl,
        }];
      });
      if (!observations.length) continue;
      const { error: writeError } = await db.from("power_stack_quote_observations")
        .upsert(observations, { onConflict: "owner_user_id,ticker,observed_on" });
      if (writeError) throw writeError;
      written += observations.length;
    }
    return NextResponse.json({
      status: "ok", ownerCount: latest.size, observationsUpserted: written,
      symbolsWithoutSupportedQuotes: missing, providerSnapshotAt: monitor.updatedAt,
      note: "Source observation dates, not ingestion times, determine freshness.",
    });
  } catch (error) {
    return NextResponse.json({
      error: "Quote refresh failed",
      detail: error instanceof Error ? error.message : "unknown",
    }, { status: 503 });
  }
}
