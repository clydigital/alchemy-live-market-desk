import { getEconomicCalendar } from "@/lib/calendar";
import { getForwardEarningsEvents } from "@/lib/forward-earnings-sources";
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
    // Admit only issuer-confirmed dates. Provider estimates never become official
    // appointments and a call clock never becomes an asserted earnings release clock.
    const forward = await getForwardEarningsEvents({ now });
    const issuerEvents = forward.events.filter(event =>
      event.eventType === "earnings" && event.verificationState === "official" &&
      event.startAt && event.startAt.slice(0, 10) >= lower &&
      event.startAt.slice(0, 10) <= upper
    );
    for (const event of issuerEvents) {
      const { error } = await db.from("market_events").upsert({
        event_key: event.id, occurrence_key: event.occurrenceKey,
        event_type: "earnings", title: event.title,
        start_at: event.timePrecision === "date"
          ? event.startAt!.slice(0, 10) + "T12:00:00Z" : event.startAt,
        time_label: event.timeLabel,
        time_precision: event.timePrecision,
        status: event.status, verification_state: "official",
        source_name: event.sourceName, source_url: event.sourceUrl,
        decisive_variable: event.decisiveVariable,
        affected_assets: event.affectedAssets,
        geography: event.geography,
        expected_stage: event.expectedStage,
        last_verified_at: now.toISOString(),
      }, { onConflict: "event_key" });
      if (error) throw new Error("issuer_calendar_write_failed: " + error.code);
      insertedOrUpdated++;
    }
    // Persist an issuer-quarter obligation alongside calendar discovery. An
    // elapsed call is not proof of a published financial statement: it merely
    // becomes due for source verification. Never downgrade a verified result.
    let obligationsCreated = 0;
    for (const event of issuerEvents) {
      const ticker = event.affectedAssets[0];
      const fiscalPeriod = event.title.match(/(?:Q[1-4]\\s*(?:FY)?20\\d{2}|(?:FY)?20\\d{2}\\s*Q[1-4])/i)?.[0] || "";
      if (!ticker || !fiscalPeriod) continue;
      const { data: existing, error: readError } = await db.from("issuer_earnings_ingestion_state")
        .select("state").eq("ticker", ticker).eq("fiscal_period", fiscalPeriod).maybeSingle();
      if (readError) throw new Error("issuer_obligation_read_failed: " + readError.code);
      if (existing) continue;
      const isDue = Date.parse(event.startAt!) <= now.getTime();
      const { error: writeError } = await db.from("issuer_earnings_ingestion_state")
        .upsert({
          ticker, fiscal_period: fiscalPeriod, source_url: event.sourceUrl,
          state: isDue ? "due" : "scheduled",
          next_retry_at: isDue ? now.toISOString() : event.startAt,
          gap_reason: isDue ? "Original issuer results not yet independently verified" : null,
        }, { onConflict: "ticker,fiscal_period", ignoreDuplicates: true });
      if (writeError) throw new Error("issuer_obligation_write_failed: " + writeError.code);
      obligationsCreated++;
    }
    // Advance expired scheduled obligations without treating the webcast as
    // a financial release; bounded source retries are handled separately.
    const { data: scheduled, error: dueReadError } = await db.from("issuer_earnings_ingestion_state")
      .select("ticker,fiscal_period,next_retry_at")
      .eq("state", "scheduled").lte("next_retry_at", now.toISOString()).limit(100);
    if (dueReadError) throw new Error("issuer_due_read_failed: " + dueReadError.code);
    for (const item of scheduled || []) {
      const { error } = await db.from("issuer_earnings_ingestion_state")
        .update({ state: "due", gap_reason: "Original issuer results awaiting verification",
          next_retry_at: now.toISOString(), updated_at: now.toISOString() })
        .eq("ticker", item.ticker).eq("fiscal_period", item.fiscal_period).eq("state", "scheduled");
      if (error) throw new Error("issuer_due_write_failed: " + error.code);
    }
    return Response.json({ status: "ok", checkedAt: now.toISOString(), macro: events.length,
      issuerEarnings: issuerEvents.length, upserted: insertedOrUpdated,
      obligationsCreated, obligationsDue: (scheduled || []).length });
  } catch (error) {
    console.error("calendar_discovery_failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ status: "source_or_database_unavailable" }, { status: 503 });
  }
}
