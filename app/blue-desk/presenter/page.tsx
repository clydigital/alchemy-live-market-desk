import Link from "next/link";
import { notFound } from "next/navigation";

import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import PresenterTechnicalChecks from "@/components/live-desk/PresenterTechnicalChecks";
import desk from "../blue-desk.module.css";
import ui from "./presenter.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Presenter Studio | Blue Desk",
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
  const fullPrepHref = editionPinnedPrepHref(query);

  return (
    <main className={desk.page} data-blue-desk-presenter="private-owner">
      <BlueDeskHeader activePath="/blue-desk/presenter" />
      <div className={desk.content}>
        <header className={ui.hero}>
          <p className={desk.kicker}>PRIVATE PRESENTER WORKSPACE</p>
          <h1>Presenter Studio</h1>
          <p>Reconcile your charts with the market story before going live.
            Technical readings are presenter-owned notes, not canonical market evidence.</p>
          <div className={ui.links}>
            <Link className={ui.action} href={"/blue-desk/presenter/editorial" + (query.edition && typeof query.edition === "string" ? "?edition=" + encodeURIComponent(query.edition) : "")}>COTD / OB editorial checks →</Link>
            <Link className={ui.action} href={fullPrepHref}>Open full edition-pinned prep →</Link>
            <Link href="/blue-desk/changes">Open Change Ledger →</Link>
          </div>
        </header>

        <section className={ui.panel} aria-labelledby="technical-checklist-heading">
          <p className={desk.kicker}>01 / TECHNICAL × FUNDAMENTALS</p>
          <h2 id="technical-checklist-heading">Technical checklist</h2>
          <p>Fourteen existing monitors, including DXY 4H/1D EMA bands, JXY,
            the 2Y–30Y spread, SPX rollover and oil. Check observation dates and sources
            before treating a reading as current. Unsaved defaults are examples.</p>
          <PresenterTechnicalChecks compact />
        </section>

        <section className={ui.panel} aria-labelledby="edition-heading">
          <p className={desk.kicker}>02 / FROZEN SOURCE BRIEFING</p>
          <h2 id="edition-heading">Prepare the running order</h2>
          <p>The existing full prep keeps the exact immutable edition, frozen Dossier,
            source checks, editorial readiness and on-air notes together.
            Invalid edition references do not fall back to today.</p>
          <Link className={ui.action} href={fullPrepHref}>
            {query.edition ? "Continue with selected edition →" : "Open current edition prep →"}
          </Link>
        </section>

        <section className={ui.panel} aria-labelledby="editorial-heading">
          <p className={desk.kicker}>03 / COTD + OPENING BELL</p>
          <h2 id="editorial-heading">Read the article evidence before writing</h2>
          <p>Review source-admitted excerpts, frozen causal interpretation, chart and length gaps, and separate COTD / OB publication checks. Full articles still require fresh price confirmation and your approval.</p>
          <Link className={ui.action} href={"/blue-desk/presenter/editorial" + (query.edition && typeof query.edition === "string" ? "?edition=" + encodeURIComponent(query.edition) : "")}>Open COTD / OB editorial preview →</Link>
        </section>

        <footer className={ui.footer}>
          Owner-only preparation. No technical checklist entry changes a Story, Regime,
          Evidence UUID or published edition.
        </footer>
      </div>
    </main>
  );
}
