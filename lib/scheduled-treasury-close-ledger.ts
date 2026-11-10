/** Persist official Treasury *dated daily par yields*, not intraday cash-bond settlements.
 * Source-only acquisition: does not invoke or modify the Dossier, Story or reports.
 */
import { createSupabaseAdminClient } from "./supabase/admin.ts";
import {
  fetchTreasuryNominalCurve, NOMINAL_TREASURY_TENORS,
  type NominalTreasuryMonitorId, type TreasuryNominalCurve,
} from "./providers/treasury-nominal-curve.ts";

export const TREASURY_CLOSE_LEDGER_VERSION = "treasury-close-ledger/1" as const;
const IDS = Object.keys(NOMINAL_TREASURY_TENORS) as NominalTreasuryMonitorId[];

export type TreasuryDailyCloseRow = {
  id: string;
  tenor_id: NominalTreasuryMonitorId;
  observation_date: string;
  yield_percent: number;
  source_updated_at: string | null;
  source_url: string;
  collected_at: string;
};

export type TreasuryDailyCloseReceipt = {
  contractVersion: typeof TREASURY_CLOSE_LEDGER_VERSION;
  collectedAt: string;
  status: "RECORDED" | "PARTIAL" | "UPSTREAM_UNAVAILABLE" | "PERSISTENCE_FAILED";
  sourceStatus: TreasuryNominalCurve["status"];
  latestByTenor: Record<NominalTreasuryMonitorId, string | null>;
  observedRows: number;
  insertedRows: number;
  warnings: string[];
};

export function buildPublishedTreasuryCloseRows(
  curve: TreasuryNominalCurve, now: Date, sessions = 35,
): TreasuryDailyCloseRow[] {
  const result: TreasuryDailyCloseRow[] = [];
  const at = now.toISOString();
  for (const tenor of IDS) {
    const points = curve.series[tenor].slice(-Math.max(1, Math.min(50, sessions)));
    for (const point of points) {
      const day = Date.parse(point.date + "T00:00:00Z");
      const clock = point.sourceUpdatedAt ? Date.parse(point.sourceUpdatedAt) : NaN;
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(point.date)
        || !Number.isFinite(day) || day > now.getTime()
        || !Number.isFinite(point.yieldPercent)
        || point.yieldPercent < 0 || point.yieldPercent > 30
        || (point.sourceUpdatedAt && (!Number.isFinite(clock) || clock > now.getTime() + 300_000)))
        continue;
      // Value is part of the identity: later official revisions are append-only,
      // while retries and repeats with identical readings are idempotent.
      const rate = Number(point.yieldPercent.toFixed(4));
      result.push({
        id: `treasury-nominal:${tenor}:${point.date}:${rate.toFixed(4)}`,
        tenor_id: tenor,
        observation_date: point.date,
        yield_percent: rate,
        source_updated_at: point.sourceUpdatedAt,
        source_url: curve.sourceUrl,
        collected_at: at,
      });
    }
  }
  return result;
}

type Dependencies = {
  fetchCurve?: (now: Date) => Promise<TreasuryNominalCurve>;
  insert?: (rows: TreasuryDailyCloseRow[]) => Promise<string[]>;
  readBack?: (ids: string[]) => Promise<string[]>;
};

async function insertRows(rows: TreasuryDailyCloseRow[]): Promise<string[]> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from("treasury_daily_closes")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error("Treasury daily close insert failed: " + error.code);
  return (data ?? []).map((row) => String(row.id));
}

async function readBackRows(ids: string[]): Promise<string[]> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from("treasury_daily_closes")
    .select("id").in("id", ids);
  if (error) throw new Error("Treasury daily close readback failed: " + error.code);
  return (data ?? []).map((row) => String(row.id));
}

/** Called inside existing authenticated morning/evening research acquisition only. */
export async function collectScheduledTreasuryDailyCloses(
  now: Date, deps: Dependencies = {},
): Promise<TreasuryDailyCloseReceipt> {
  const latestByTenor = Object.fromEntries(IDS.map(id => [id, null])) as Record<NominalTreasuryMonitorId, string | null>;
  const base = { contractVersion: TREASURY_CLOSE_LEDGER_VERSION, collectedAt: now.toISOString(), latestByTenor };
  let sourceStatus: TreasuryNominalCurve["status"] = "UNAVAILABLE";
  try {
    const curve = await (deps.fetchCurve ?? fetchTreasuryNominalCurve)(now);
    sourceStatus = curve.status;
    const rows = buildPublishedTreasuryCloseRows(curve, now);
    for (const id of IDS) latestByTenor[id] = rows.filter(row => row.tenor_id === id).at(-1)?.observation_date ?? null;
    if (!rows.length) return {
      ...base, status: "UPSTREAM_UNAVAILABLE", sourceStatus,
      observedRows: 0, insertedRows: 0, warnings: [curve.warning ?? "No eligible dated Treasury values were returned"],
    };
    const inserted = await (deps.insert ?? insertRows)(rows);
    // Verify the latest published observation of *every available tenor* survived
    // persistence, including no-op duplicate runs; do not equate a 200 with storage.
    const latestIds = IDS.flatMap(id => rows.filter(row => row.tenor_id === id).slice(-1).map(row => row.id));
    const readback = new Set(await (deps.readBack ?? readBackRows)(latestIds));
    const missing = latestIds.filter(id => !readback.has(id));
    const warnings = [
      ...(curve.warning ? [curve.warning] : []),
      ...IDS.filter(id => !latestByTenor[id]).map(id => "TENOR_UNAVAILABLE:" + id),
      ...missing.map(id => "PERSISTED_READBACK_MISSING:" + id),
    ];
    return {
      ...base, status: missing.length ? "PERSISTENCE_FAILED" : warnings.length ? "PARTIAL" : "RECORDED",
      sourceStatus, observedRows: rows.length, insertedRows: inserted.length, warnings,
    };
  } catch (error) {
    return {
      ...base, status: sourceStatus === "UNAVAILABLE" ? "UPSTREAM_UNAVAILABLE" : "PERSISTENCE_FAILED",
      sourceStatus, observedRows: 0, insertedRows: 0,
      warnings: ["TREASURY_LEDGER_ERROR:" + (error instanceof Error ? error.message : "unavailable").slice(0, 140)],
    };
  }
}
