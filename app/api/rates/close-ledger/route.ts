import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchTreasuryNominalCurve, NOMINAL_TREASURY_TENORS } from "@/lib/providers/treasury-nominal-curve";
import { scheduledSourceOnlyEnabled } from "@/lib/bluebelly-source-only-research";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const TENORS = Object.keys(NOMINAL_TREASURY_TENORS) as Array<keyof typeof NOMINAL_TREASURY_TENORS>;

type Stored = {
  tenor_id: string;
  observation_date: string;
  yield_percent: number;
  source_updated_at: string | null;
  collected_at: string;
};

/** Official government-source only. Source-only writes are separately authorised by the
 * existing acquisition cron. Never promote a Dossier or expose private data tables. */
export async function GET() {
  const generatedAt = new Date().toISOString();
  try {
    const [source, stored] = await Promise.all([
      fetchTreasuryNominalCurve(),
      createSupabaseAdminClient().from("treasury_daily_closes")
        .select("tenor_id,observation_date,yield_percent,source_updated_at,collected_at")
        .in("tenor_id", TENORS)
        .order("observation_date", { ascending: false })
        .order("collected_at", { ascending: false })
        .limit(220),
    ]);
    if (stored.error) throw new Error("Ledger read not available");
    const latestRows = new Map<string, Stored>();
    for (const row of (stored.data ?? []) as Stored[]) {
      if (!latestRows.has(row.tenor_id)) latestRows.set(row.tenor_id, row);
    }
    const tenors = TENORS.map(id => {
      const incoming = source.series[id].at(-1) ?? null;
      const saved = latestRows.get(id) ?? null;
      const sourceDay = incoming?.date ?? null;
      const storedDay = saved?.observation_date ?? null;
      const updateMs = incoming?.sourceUpdatedAt ? Date.parse(incoming.sourceUpdatedAt) : NaN;
      const ageMs = Number.isFinite(updateMs) ? Date.now() - updateMs : NaN;
      const state = !incoming ? "UPSTREAM_UNAVAILABLE"
        : storedDay === sourceDay ? "RECORDED"
        : Number.isFinite(ageMs) && ageMs >= 12 * 60 * 60_000 ? "RECORDING_LAG"
        : "PENDING_COLLECTION";
      return {
        tenor: id, state, sourceObservationDate: sourceDay,
        sourceUpdatedAt: incoming?.sourceUpdatedAt ?? null,
        sourceYieldPercent: incoming?.yieldPercent ?? null,
        storedObservationDate: storedDay,
        storedYieldPercent: saved?.yield_percent ?? null,
        storedAt: saved?.collected_at ?? null,
      };
    });
    const status = tenors.some(r => r.state === "RECORDING_LAG") ? "ACTION_REQUIRED"
      : tenors.every(r => r.state === "RECORDED") ? "OK" : "WATCH";
    return NextResponse.json({
      contractVersion: "treasury-close-ledger/1", generatedAt, status,
      collectionMode: scheduledSourceOnlyEnabled(process.env) ? "SOURCE_ONLY" : "LEGACY",
      unit: "percent", definition: "Official daily Treasury par yield (not intraday cash bond settlement)",
      sourceStatus: source.status, sourceUrl: source.sourceUrl, tenors,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({
      contractVersion: "treasury-close-ledger/1", generatedAt,
      status: "UNAVAILABLE", reason: "LEDGER_OR_PROVIDER_UNAVAILABLE",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
