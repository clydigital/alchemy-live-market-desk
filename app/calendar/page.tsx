import Link from "next/link";
import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, Panel } from "@/components/live-desk/LiveDeskUi";
import { getEconomicCalendar, type EconomicCalendarEvent } from "@/lib/calendar";
import { getForwardEarningsEvents } from "@/lib/forward-earnings-sources";
import { getIsmSchedule } from "@/lib/ism-forward-schedule";
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
function readableTime(iso: string | null, label: string | null) {
  if (iso && iso.includes("T") && Number.isFinite(Date.parse(iso))) {
    const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
    return (label || "Exact schedule") + " · " + time + " MYT";
  }
  return label || "Time awaiting confirmation";
}
type Entry = { kind: "Macro" | "Earnings"; id: string; day: string; title: string; at: string; why: string; assets: string[]; sourceName: string; sourceUrl: string; state: string; details: string };
function fromMacro(row: EconomicCalendarEvent): Entry {
  return {
    kind: "Macro", id: row.id, day: row.date, title: row.event,
    at: row.timeLabel, why: row.decidingQuestion,
    assets: row.affectedAssets, sourceName: row.sourceName, sourceUrl: row.sourceUrl,
    state: row.status === "Released" ? "Reported" : row.sourceKind === "official-live" ? "Official live schedule" : row.sourceKind === "desk-record" ? "Desk record" : "Official dated schedule",
    details: "Consensus " + (row.consensus || "unavailable") + " · Previous " + (row.revisedPrevious || row.previous || "unavailable") + (row.actual ? " · Actual " + row.actual : ""),
  };
}
function fromEarnings(row: MarketEventV1): Entry {
  return {
    kind: "Earnings", id: row.id, day: mytDay(row.startAt || ""), title: row.title,
    at: readableTime(row.startAt, row.timeLabel), why: row.decisiveVariable,
    assets: row.affectedAssets, sourceName: row.sourceName, sourceUrl: row.sourceUrl,
    state: row.verificationState === "official" ? "Issuer confirmed" : "Provider date · unconfirmed",
    details: (row.expectedStage || "Earnings") + (row.expectation ? " · " + row.expectation : ""),
  };
}

export default async function LiveMarketCalendar({ searchParams }: { searchParams: Promise<{ window?: string }> }) {
  const params = await searchParams;
  const days = params.window === "7" ? 7 : params.window === "90" ? 90 : 30;
  const [macro, earnings, ism] = await Promise.all([getEconomicCalendar(), getForwardEarningsEvents(), getIsmSchedule()]);
  const today = mytDay(new Date().toISOString());
  const cutoff = new Date(Date.parse(today + "T00:00:00Z") + days * 86_400_000).toISOString().slice(0, 10);
  const entries: Entry[] = [...macro.map(fromMacro), ...earnings.events.map(fromEarnings)]
    .filter(entry => entry.day >= today && entry.day <= cutoff)
    .sort((a, b) => a.day.localeCompare(b.day) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
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
