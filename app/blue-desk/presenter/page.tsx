import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { BLUEBELLY_PRESENTATION_HOST } from "@/lib/blue-desk-host";
import { getCurrentVerifiedMarketMotion } from "@/lib/market-motion";
import { selectVerifiedNewsBriefs } from "@/lib/market-brief-news";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { publicMarketObservations } from "@/lib/blue-desk-public-markets";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";

import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import PresenterTechnicalChecks from "@/components/live-desk/PresenterTechnicalChecks";
import desk from "../blue-desk.module.css";
import ui from "./presenter.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Presenter Prep | Bluebelly",
  description: "Owner-only technical checklist and exact-edition presenter preparation.",
};

type Search = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<Search> };

const FOCUS_KEYS = ["edition", "story", "motion", "regime", "event"] as const;
const EXACT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Forward only bounded, explicit source identities to the existing exact reader. */
function editionPinnedPrepHref(query: Search): string {
  const params = new URLSearchParams();
  for (const key of FOCUS_KEYS) {
    const value = query[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || !value.trim() || value.length > 180
      || /[\x00-\x1f\x7f]/.test(value)) notFound();
    if (key === "edition" && !EXACT_UUID.test(value)) notFound();
    params.set(key, value);
  }
  const suffix = params.toString();
  return "/hybrid-output/prepare" + (suffix ? "?" + suffix : "");
}

export default async function BlueDeskPresenterStudio({ searchParams }: Props) {
  const query = await searchParams;
  const host = (await headers()).get("host")?.trim().toLowerCase().replace(/:443$/, "");
  const bluebelly = host === BLUEBELLY_PRESENTATION_HOST;
  const fullPrepHref = bluebelly
    ? editionPinnedPrepHref(query).replace("/hybrid-output/prepare","/presenter/full-prep")
    : editionPinnedPrepHref(query);
  const editorialHref = (bluebelly?"/presenter/editorial":"/blue-desk/presenter/editorial")
    + (query.edition && typeof query.edition === "string" ? "?edition=" + encodeURIComponent(query.edition) : "");
  const [rawMotions, monitor] = await Promise.all([
    getCurrentVerifiedMarketMotion({limit:18}).catch(()=>[]),
    getMarketMonitor().catch(()=>null),
  ]);
  const news = selectVerifiedNewsBriefs(rawMotions,new Date(),8);
  const readings = publicMarketObservations(monitor?.rows||[],"all")
    .filter(row=>["us2y","us10y-fred","brent","wti","spx","dxy","gold-proxy","smh"].includes(row.id))
    .slice(0,8);

  return (
    <main className={desk.page} data-blue-desk-presenter="private-owner">
      <BlueDeskHeader activePath="/blue-desk/presenter" />
      <div className={desk.content}>
        <header className={ui.hero}>
          <p className={desk.kicker}>PRIVATE PRESENTER WORKSPACE</p>
          <h1>Presenter Prep</h1>
          <p>Today’s Talk and Technical × Fundamentals, in the Bluebelly workspace. Reconcile your charts with the market story before going live.
            Technical readings are presenter-owned notes, not canonical market evidence.</p>
          <div className={ui.links}>
            <Link className={ui.action} href={editorialHref}>COTD / OB editorial checks →</Link>
            <Link className={ui.action} href={fullPrepHref}>Open full edition-pinned prep →</Link>
            <Link href={bluebelly?"/presenter/changes":"/blue-desk/changes"}>Open Change Ledger →</Link>
          </div>
        </header>

        <section className={ui.panel} aria-labelledby="presenter-running-order-title" data-presenter-fast-path="source-first">
          <p className={desk.kicker}>TODAY’S TALK · VERIFIED CATALYSTS AND YOUR CHARTS</p>
          <h2 id="presenter-running-order-title">Today’s Talk</h2>
          <p>Scan fresh verified events, cross-check observed markets, then write a source-backed COTD or multi-angle OB.
            Data dates are source dates, not automatically updated trading-session reactions.</p>
          <div className={ui.quickDeckGrid}>
            <div>
              <h3>Verified developments</h3>
              {news.length?news.slice(0,6).map(item=><article key={item.id} className={ui.quickDeckItem}>
                <strong>{item.headline}</strong>
                <p>{item.summary}</p>
                <div><DualTimestamp value={item.occurredAt} sourceDate={item.occurredAt} />
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceName} ↗</a></div>
              </article>):<p>No verified reporting within the event freshness gate; this does not prove a quiet market.</p>}
            </div>
            <div>
              <h3>Observed market checks</h3>
              {readings.length?readings.map(row=><article key={row.id} className={ui.quickDeckMarket}>
                <strong>{row.label}</strong>
                <span>{row.last===null?"No sourced value":row.last.toLocaleString("en-GB",{maximumFractionDigits:3})+(row.type==="Rates"?"%":"")}</span>
                <DualTimestamp value={row.asOf} sourceDate={row.asOf}/>
              </article>):<p>No dated source-qualified market readings available.</p>}
              <p>These are observed levels, not proof of a catalyst's causal effect.</p>
            </div>
          </div>
          <div className={ui.links}>
            <Link className={ui.action} href={editorialHref}>Turn research into COTD / OB →</Link>
            <Link href={bluebelly?"/presenter/dossier":"/blue-desk/dossier"}>Canonical Dossier history →</Link>
            <Link href={bluebelly?"/presenter/changes":"/blue-desk/changes"}>What changed in our view →</Link>
          </div>
        </section>

        <section className={ui.panel} aria-labelledby="technical-checklist-heading">
          <p className={desk.kicker}>02 / TECHNICAL × FUNDAMENTALS</p>
          <h2 id="technical-checklist-heading">Technical checklist</h2>
          <p>Fourteen existing monitors, including DXY 4H/1D EMA bands, JXY,
            the 2Y–30Y spread, SPX rollover and oil. Check observation dates and sources
            before treating a reading as current. Unsaved defaults are examples.</p>
          <PresenterTechnicalChecks compact />
        </section>

        <section className={ui.panel} aria-labelledby="edition-heading">
          <p className={desk.kicker}>03 / SOURCE & ACCESS</p>
          <h2 id="edition-heading">Prepare the running order</h2>
          <p>The existing full prep keeps the exact immutable edition, frozen Dossier,
            source checks, editorial readiness and on-air notes together.
            Invalid edition references do not fall back to today.</p>
          <Link className={ui.action} href={fullPrepHref}>
            {query.edition ? "Continue with selected edition →" : "Open current edition prep →"}
          </Link>
        </section>

        <section className={ui.panel} aria-labelledby="editorial-heading">
          <p className={desk.kicker}>04 / COTD + OPENING BELL</p>
          <h2 id="editorial-heading">Read the article evidence before writing</h2>
          <p>Review source-admitted excerpts, frozen causal interpretation, chart and length gaps, and separate COTD / OB publication checks. Full articles still require fresh price confirmation and your approval.</p>
          <Link className={ui.action} href={editorialHref}>Open COTD / OB editorial preview →</Link>
        </section>

        <footer className={ui.footer}>
          Owner-only preparation. No technical checklist entry changes a Story, Regime,
          Evidence UUID or published edition.
        </footer>
      </div>
    </main>
  );
}
