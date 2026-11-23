import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, Panel } from "@/components/live-desk/LiveDeskUi";
import { getEconomicCalendar, type EconomicCalendarEvent } from "@/lib/calendar";
import { getForwardEarningsEvents } from "@/lib/forward-earnings-sources";
import { getIsmSchedule } from "@/lib/ism-forward-schedule";
import { calendarTimePresentation } from "@/lib/market-calendar-clock";
import type { MarketEventV1 } from "@/lib/market-events";

export const dynamic = "force-dynamic";

function mytDay(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value.slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value || "";
  return [get("year"), get("month"), get("day")].join("-");
}
function localDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
}
type Entry = { kind: "Macro" | "Earnings"; id: string; day: string; title: string; at: string; sortAt: number; why: string; assets: string[]; sourceName: string; sourceUrl: string; state: string; details: string };
function fromMacro(row: EconomicCalendarEvent): Entry {
  return {
    kind: "Macro", id: row.id, day: row.date, title: row.event,
    at: calendarTimePresentation(row.date, row.timeLabel, row.date).timeText,
    sortAt: calendarTimePresentation(row.date, row.timeLabel, row.date).sortAt,
    why: row.decidingQuestion,
    assets: row.affectedAssets, sourceName: row.sourceName, sourceUrl: row.sourceUrl,
    state: row.status === "Released" ? "Reported" : row.sourceKind === "official-live" ? "Official live schedule" : row.sourceKind === "desk-record" ? "Desk record" : "Official dated schedule",
    details: "Consensus " + (row.consensus || "unavailable") + " · Previous " + (row.revisedPrevious || row.previous || "unavailable") + (row.actual ? " · Actual " + row.actual : ""),
  };
}
function fromEarnings(row: MarketEventV1): Entry {
  return {
    kind: "Earnings", id: row.id, day: mytDay(row.startAt || ""), title: row.title,
    at: calendarTimePresentation(row.startAt, row.timeLabel, mytDay(row.startAt || "")).timeText,
    sortAt: calendarTimePresentation(row.startAt, row.timeLabel, mytDay(row.startAt || "")).sortAt,
    why: row.decisiveVariable,
    assets: row.affectedAssets, sourceName: row.sourceName, sourceUrl: row.sourceUrl,
    state: row.verificationState === "official" ? "Issuer confirmed" : "Provider date · unconfirmed",
    details: (row.expectedStage || "Earnings") + (row.expectation ? " · " + row.expectation : ""),
  };
}

export default async function LiveMarketCalendar({ searchParams }: { searchParams: Promise<{ window?: string }> }) {
  const params = await searchParams;
  const days = params.window === "7" ? 7 : params.window === "90" ? 90 : 30;
  const [macro, earnings, ism] = await Promise.all([getEconomicCalendar(), getForwardEarningsEvents(), getIsmSchedule()]);
  // Read canonical release outcomes and issuer guidance independently of the forward-only feed.
  const db = createSupabaseAdminClient();
  const [resultsResponse, guidanceResponse, eventsResponse] = await Promise.all([
    db.from("macro_releases").select("id,release_name,release_date,status,actual,consensus,previous,revised_previous,market_interpretation,source_url").lte("release_date", new Date().toISOString()).order("release_date", { ascending: false }).limit(40),
    db.from("guidance_items").select("id,entity,ticker,period,metric,current_view,prior_view,market_interpretation,source_url,published_at").order("published_at", { ascending: false }).limit(40),
    db.from("market_events").select("id,title,start_at,time_label,source_name,source_url,status,decisive_variable,affected_assets,verification_state,event_type").gte("start_at", new Date().toISOString()).order("start_at", { ascending: true }).limit(100),
  ]);
  const results = resultsResponse.data || [];
  const guidance = guidanceResponse.data || [];
  const registryEvents = eventsResponse.data || [];
  const today = mytDay(new Date().toISOString());
  const cutoff = new Date(Date.parse(today + "T00:00:00Z") + days * 86_400_000).toISOString().slice(0, 10);
  const registryEntries: Entry[] = registryEvents.map(row => ({
    kind: row.event_type === "earnings" ? "Earnings" as const : "Macro" as const,
    id: row.id, day: mytDay(row.start_at), title: row.title,
    at: calendarTimePresentation(row.start_at, row.time_label || "", mytDay(row.start_at)).timeText,
    sortAt: calendarTimePresentation(row.start_at, row.time_label || "", mytDay(row.start_at)).sortAt,
    why: row.decisive_variable || "Monitor the verified event and its market transmission.",
    assets: row.affected_assets || [], sourceName: row.source_name || "Source registry", sourceUrl: row.source_url || "",
    state: row.verification_state === "official" ? "Official event" : "Date requires confirmation",
    details: row.status || "Scheduled",
  }));
  const entries: Entry[] = [...macro.map(fromMacro), ...earnings.events.map(fromEarnings), ...registryEntries]
    .filter(entry => entry.day >= today && entry.day <= cutoff)
    .filter((entry, index, all) => all.findIndex(other => other.title.toLowerCase() === entry.title.toLowerCase() && other.day === entry.day) === index)
    .sort((a, b) => a.day.localeCompare(b.day) || a.sortAt - b.sortAt || a.title.localeCompare(b.title));
  const summary = [ism.warning, earnings.warning].filter(Boolean);
  return (
    <LiveDeskShell
      activePath="/calendar"
      eyebrow="Upcoming market catalysts"
      title="Market Calendar"
      description="One sourced forward calendar for economic releases and earnings. Confirmed issuer times and third-party estimates are never treated as the same evidence."
      meta={<span>{entries.length} scheduled items · Next {days} days</span>}
    >
      <div className={styles.grid}>
        <Panel title="Calendar horizon" description="Upcoming dates are read from the same source modules used by scheduled Hybrid editions.">
          <p>
            {[7, 30, 90].map(n => <span key={n} style={{ marginRight: 16 }}>
              <Link className={styles.link} href={"/calendar?window=" + n}>{n} days {n === days ? "· selected" : "→"}</Link>
            </span>)}
          </p>
          <p className={styles.meta}>ISM schedule: {ism.state.replaceAll("_", " ")} · Earnings: {earnings.coverage.replaceAll("_", " ")} · Times shown in MYT where exact timestamps are known.</p>
        </Panel>
        {summary.length ? <DataState title="Calendar source coverage" detail={summary.join(" ")} /> : null}
        <Panel title="Economic releases & earnings" description="Dates, decisive variables, expectations and source provenance. Commentary is conditional; a scheduled catalyst is not an accepted Dossier conclusion.">
          <div className={styles.recordList}>
            {entries.map(entry => (
              <article className={styles.record} key={entry.kind + ":" + entry.id}>
                <div className={styles.recordHeader}>
                  <div>
                    <span className={styles.kicker}>{entry.kind.toUpperCase()} · {localDay(entry.day)} · {entry.at}</span>
                    <h3>{entry.title}</h3>
                  </div>
                  <Badge tone={entry.state.includes("unconfirmed") ? "warn" : "default"}>{entry.state}</Badge>
                </div>
                <p><strong>What matters:</strong> {entry.why}</p>
                <p className={styles.meta}>{entry.details}</p>
                <p className={styles.meta}>Affected: {entry.assets.join(" · ") || "Market relevance not mapped"}</p>
                <a className={styles.link} href={entry.sourceUrl} target="_blank" rel="noreferrer">{entry.sourceName} ↗</a>
              </article>
            ))}
            {!entries.length ? <DataState title="No verified dates in this window" detail="Calendar sources may be unavailable or a date is not yet announced. No earnings date or consensus is inferred." /> : null}
          </div>
        </Panel>
        <Panel title="Results · released economic data" description="Officially recorded actuals and prior readings. Missing consensus is not interpreted as an in-line result.">
          <div className={styles.recordList}>
            {results.filter(row => row.actual).slice(0, 20).map(row => <article className={styles.record} key={row.id}>
              <span className={styles.kicker}>{localDay(mytDay(row.release_date))} · {row.status}</span>
              <h3>{row.release_name}</h3>
              <p><strong>Actual:</strong> {row.actual}</p>
              <p className={styles.meta}>Consensus: {row.consensus || "Not verified"} · Previous: {row.revised_previous || row.previous || "Not available"}</p>
              {row.market_interpretation ? <p>{row.market_interpretation}</p> : null}
              {row.source_url ? <a className={styles.link} href={row.source_url} target="_blank" rel="noreferrer">Official release ↗</a> : null}
            </article>)}
            {!results.some(row => row.actual) ? <DataState title="No verified results available" detail="Actuals will appear only after canonical release ingestion." /> : null}
          </div>
        </Panel>
        <Panel title="Company guidance" description="Issuer guidance and changes are displayed only when source-backed records have been ingested.">
          <div className={styles.recordList}>
            {guidance.map(row => <article className={styles.record} key={row.id}>
              <span className={styles.kicker}>{row.ticker || row.entity} · {row.period || "Reporting period not specified"}</span>
              <h3>{row.entity} · {row.metric || "Outlook"}</h3>
              <p><strong>Current:</strong> {row.current_view || "Not available"}</p>
              {row.prior_view ? <p className={styles.meta}>Prior: {row.prior_view}</p> : null}
              {row.market_interpretation ? <p>{row.market_interpretation}</p> : null}
              {row.source_url ? <a className={styles.link} href={row.source_url} target="_blank" rel="noreferrer">Issuer source ↗</a> : null}
            </article>)}
            {!guidance.length ? <DataState title="Guidance ingestion pending" detail="No verified issuer guidance records are currently stored. Figures are not inferred from earnings dates." /> : null}
          </div>
        </Panel>
        <Panel title="How to read upcoming releases" description="Apply the current Dossier Regime to each result, rather than predicting the price response from a headline alone.">
          <p><strong>Above consensus:</strong> Check the relevant subcomponents, then whether US 2Y/10Y yields, the dollar, gold and equity breadth confirm the regime transmission.</p>
          <p><strong>Below consensus:</strong> Ask whether weaker inflation or growth changes the policy path, and whether the market reaction agrees.</p>
          <p><strong>In line:</strong> Check revisions and positioning. An expected release may still move markets.</p>
          <p><strong>Earnings:</strong> Compare revenue, margins, cash flow, guidance and investment quality with expectations. An EPS beat is not a bullish conclusion by itself.</p>
          <Link className={styles.link} href="/regimes">Review current Regimes →</Link>
        </Panel>
      </div>
    </LiveDeskShell>
  );
}
