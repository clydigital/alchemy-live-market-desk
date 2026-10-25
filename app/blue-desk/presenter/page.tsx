import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import EditorialWorkbench from "@/components/blue-desk/EditorialWorkbench";
import PresenterTechnicalChecks from "@/components/live-desk/PresenterTechnicalChecks";
import { getCurrentVerifiedMarketMotion } from "@/lib/market-motion";
import { selectVerifiedNewsBriefs } from "@/lib/market-brief-news";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { publicMarketObservations } from "@/lib/blue-desk-public-markets";
import { getLatestEditorialSlate } from "@/lib/editorial-slate-server";
import { projectEditorialPriceCards } from "@/lib/editorial-price-context";
import desk from "../blue-desk.module.css";
import ui from "./presenter.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "Presenter Prep | Bluebelly",
  description: "Private source-led market talk, 14 technical checks, and the existing OB/COTD Writing Brain.",
};

type Search = Record<string, string | string[] | undefined>;
/**
 * P1a is the unpinned current-day owner workspace.
 * Exact edition links MUST NOT quietly show today's research. A later bounded
 * native full-prep partition supplies the historical edition reader.
 */
export default async function BluebellyPresenterPrep({
  searchParams,
}: { searchParams: Promise<Search> }) {
  const query = await searchParams;
  // An exact edition or Story/Motion/Regime focus must open the pinned
  // immutable projection, never current-day data under a historic URL.
  const params = new URLSearchParams();
  for (const key of ["edition", "story", "motion", "regime", "event"] as const) {
    const v = query[key];
    if (v === undefined) continue;
    if (typeof v !== "string" || !v.trim() || v.length > 180
      || /[\\x00-\\x1f\\x7f]/.test(v)) notFound();
    if (key === "edition" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) notFound();
    params.set(key, v.trim());
  }
  if (params.size) redirect("/blue-desk/presenter/full-prep?" + params.toString());

  const [raw, monitor, slate] = await Promise.all([
    getCurrentVerifiedMarketMotion({ limit: 18 }).catch(() => []),
    getMarketMonitor().catch(() => null),
    getLatestEditorialSlate(),
  ]);
  const now = new Date();
  const news = selectVerifiedNewsBriefs(raw, now, 8);
  const readings = publicMarketObservations(monitor?.rows || [], "all")
    .filter(row => ["us2y", "us10y-fred", "us30y-fred", "brent", "wti",
      "spx", "dxy", "gold-proxy", "smh"].includes(row.id)).slice(0, 9);
  const priceCards = projectEditorialPriceCards(monitor?.rows || [], now.toISOString());

  return <main className={desk.page} data-bluebelly-presenter="private-owner">
    <BlueDeskHeader activePath="/blue-desk/presenter" />
    <div className={desk.content}>
      <header className={ui.hero}>
        <p className={desk.kicker}>PRIVATE / PRESENTER PREP</p>
        <h1>Today’s talk, charts and writing.</h1>
        <p>Start with verified developments, check the dated market observations and
          compare them with your charts. Then prepare the stream or draft an OB/COTD.
          Unverified leads are not market facts.</p>
        <div className={ui.links}>
          <a className={ui.action} href="#writing">Open Writing Brain ↓</a>
          <a className={ui.action} href="#technical">Review 14 technical checks ↓</a>
          <Link href="/blue-desk/calendar">Upcoming economic events →</Link>
          <Link href="/blue-desk/presenter/full-prep">Open edition-locked prep →</Link>
        </div>
      </header>

      <section className={ui.panel} aria-labelledby="talk-title">
        <p className={desk.kicker}>01 / MARKET BRIEF</p>
        <h2 id="talk-title">What has actually changed?</h2>
        <p>Original sources are separated from measured prices.
          Neither a headline nor an old market level proves a causal reaction.</p>
        <div className={ui.quickDeckGrid}>
          <div>
            <h3>Source-verified developments</h3>
            {news.length ? news.slice(0, 6).map(item => <article className={ui.quickDeckItem} key={item.id}>
              <strong>{item.headline}</strong><p>{item.summary}</p>
              <div><DualTimestamp value={item.occurredAt} sourceDate={item.occurredAt} />
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceName} ↗</a></div>
            </article>) : <p>No currently eligible source-verified news. This is a coverage gap,
              not proof of a quiet market.</p>}
          </div>
          <div>
            <h3>Dated market checks</h3>
            {readings.length ? readings.map(row => <article className={ui.quickDeckMarket} key={row.id}>
              <strong>{row.label}</strong>
              <span>{row.last === null ? "Not available" :
                row.last.toLocaleString("en-GB", {maximumFractionDigits: 3})
                  + (row.type === "Rates" ? "%" : "")}</span>
              <small><DualTimestamp value={row.asOf} sourceDate={row.asOf} /></small>
            </article>) : <p>No source-qualified market observations available.</p>}
            <p>These levels are not live candles or verified event-window reactions.</p>
          </div>
        </div>
      </section>

      <section className={ui.panel} id="writing" aria-labelledby="writing-title">
        <p className={desk.kicker}>02 / RESEARCH TO ARTICLE</p>
        <h2 id="writing-title">OB / COTD Writing Brain</h2>
        <p>Use the existing scheduled three-idea slate, dated 1/3/5-session context and
          authenticated Gemini draft/revision. Generated text is an unverified draft until
          its claims, sources and charts are checked.</p>
        <EditorialWorkbench priceCards={priceCards} mode="presenter"
          readError={!monitor} slate={slate.slate} slateStatus={slate.status} />
      </section>

      <section className={ui.panel} id="technical" aria-labelledby="technical-title">
        <p className={desk.kicker}>03 / TECHNICAL × FUNDAMENTALS</p>
        <h2 id="technical-title">Your 14 technical monitors</h2>
        <p>Check DXY 4H and daily EMA bands, JXY, 2Y–30Y, SPX and oil.
          Your saved checklist is private presenter context, not canonical Evidence.</p>
        <PresenterTechnicalChecks compact />
      </section>
      <footer className={ui.footer}>Owner-only. Nothing here updates a Story,
        Regime, original Evidence or published edition. Use the native Bluebelly
        edition-locked prep to review a specific historical snapshot.</footer>
    </div>
  </main>;
}
