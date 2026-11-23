import { getEconomicCalendar } from "@/lib/calendar";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { acceptsResearchAuthorization } from "@/lib/research-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/** Daily idempotent discovery of dated, publisher-backed macro events.
 * Calendar dates without a verified timestamp remain date-precision only.
 * This does not fabricate actuals, consensus or earnings guidance.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !acceptsResearchAuthorization(request.headers.get("authorization"), [secret]))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  if (process.env.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED !== "true")
    return Response.json({ status: "disabled" }, { status: 503 });
  try {
    const now = new Date();
    const lower = new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10);
    const upper = new Date(now.getTime() + 90 * 86400000).toISOString().slice(0, 10);
    const events = (await getEconomicCalendar()).filter(e =>
      e.date >= lower && e.date <= upper && /^https:\/\//.test(e.sourceUrl) &&
      ["official-live", "official-schedule", "desk-record"].includes(e.sourceKind)
    );
    const db = createSupabaseAdminClient();
    let insertedOrUpdated = 0;
    for (const event of events) {
      const key = "calendar-source:" + event.id;
      const row = {
        event_key: key, occurrence_key: key,
        event_type: event.category === "Central bank" ? "central_bank_decision" : "economic_release",
        title: event.event,
        start_at: event.date + "T12:00:00Z",
        time_label: event.timeLabel || "Time unconfirmed",
        time_precision: "date",
        status: event.status === "Released" && event.actual ? "completed" : "scheduled",
        verification_state: event.sourceKind === "desk-record" ? "corroborated" : "official",
        source_name: event.sourceName, source_url: event.sourceUrl,
        decisive_variable: event.decidingQuestion || "",
        affected_assets: event.affectedAssets || [],
        geography: [event.country],
        payload: { calendar_source_id: event.id, reference_period: event.referencePeriod,
          actual: event.actual || null, consensus: event.consensus || null,
          source_kind: event.sourceKind, original_time_label: event.timeLabel },
        last_verified_at: now.toISOString(),
      };
      const { error } = await db.from("market_events").upsert(row, { onConflict: "event_key" });
      if (error) throw new Error("event_registry_write_failed: " + error.code);
      insertedOrUpdated++;
    }
    return Response.json({ status: "ok", checkedAt: now.toISOString(), discovered: events.length, upserted: insertedOrUpdated });
  } catch (error) {
    console.error("calendar_discovery_failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ status: "source_or_database_unavailable" }, { status: 503 });
  }
}
