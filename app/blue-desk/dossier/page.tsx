import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { BLUEBELLY_PRESENTATION_HOST, isBlueDeskPublicReaderHost } from "@/lib/blue-desk-host";
import { isValidUuid } from "@/lib/dossier-v2/validation";
import {
  getDossierV2HistoryIndex,
  getDossierV2PresentationSelection,
  getDossierV2PresentationSelectionById,
} from "@/lib/dossier-v2/presentation-reader";
import { withinTimeout } from "@/lib/async-timeout";
import styles from "../blue-desk.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "Dossier Archive | Blueberry Desk",
  description: "Owner-only canonical Dossier history and evidence review.",
};
const READ_TIMEOUT_MS = 6500;

/**
 * One immutable canonical archive, not a new writer or database copy.
 * Exact UUID never silently falls back to the latest edition.
 */
export default async function BlueDeskDossierPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const host = (await headers()).get("host");
  // Defence in depth alongside private host middleware.
  const bluebelly = host?.trim().toLowerCase().replace(/:443$/, "") === BLUEBELLY_PRESENTATION_HOST;
  if (isBlueDeskPublicReaderHost(host) && !bluebelly) notFound();

  const dossierHref=bluebelly?"/presenter/dossier":"/blue-desk/dossier";
  const query = await searchParams;
  const id = typeof query.id === "string" ? query.id.trim() : null;
  const valid = id === null || isValidUuid(id);
  const [selection, history] = await Promise.all([
    valid ? withinTimeout(
      "Blueberry Dossier exact read",
      () => id ? getDossierV2PresentationSelectionById(id) : getDossierV2PresentationSelection(),
      READ_TIMEOUT_MS,
    ).catch(() => null) : Promise.resolve(null),
    withinTimeout(
      "Blueberry Dossier history",
      () => getDossierV2HistoryIndex(18),
      READ_TIMEOUT_MS,
    ).catch(() => null),
  ]);
  const dossier = selection?.presentation ?? null;
  const material = dossier?.health.researchGaps.filter(gap => gap.severity === "MATERIAL") ?? [];
  return (
    <main className={styles.page} data-blue-desk-dossier="canonical-exact-owner">
      <BlueDeskHeader activePath="/blue-desk/dossier" />
      <div className={styles.content}>
        <header className={styles.dossierHeader}>
          <div>
            <p className={styles.kicker}>PRIVATE CANONICAL RESEARCH · DOSSIER V2</p>
            <h1>Dossier and saved editions</h1>
            <p>The Dossier is an evidence-backed market interpretation. Blueberry reads the existing immutable archive, never a separate copy.</p>
          </div>
          <Link className={styles.primaryAction} href={bluebelly?"/":"/blue-desk"}>Market summary →</Link>
        </header>
        <div className={styles.dossierLayout}>
          <div className={styles.dossierMain}>
            {!dossier ? (
              <section className={styles.secondaryPanel} role="status">
                <h2>{id ? "Exact Dossier unavailable" : "Current Dossier unavailable"}</h2>
                <p>{!valid ? "Invalid canonical Dossier UUID." : selection?.notice.detail || "The read failed or no valid persisted edition was returned."}</p>
                <p>No other Dossier has been substituted. Check the ID or owner source connection.</p>
                <Link href={dossierHref} className={styles.textLink}>Current Dossier →</Link>
              </section>
            ) : (
              <>
                <section className={styles.dossierReadHero}>
                  <div className={styles.dossierTags}>
                    <span>{id ? "EXACT IMMUTABLE EDITION" : "LATEST CANONICAL EDITION"}</span>
                    <span>{dossier.health.degraded ? "DEGRADED · GAPS VISIBLE" : "EVIDENCE HEALTHY"}</span>
                  </div>
                  <h2>{dossier.header.headline}</h2>
                  <p>{dossier.header.answer}</p>
                  <div className={styles.dossierIdentity}>
                    <span>Edition ID: <code>{dossier.dossierId}</code></span>
                    <DualTimestamp value={dossier.asOf} sourceDate={dossier.asOf} />
                  </div>
                  <p><strong>Regime implication:</strong> {dossier.header.regimeImplication}</p>
                  <p><strong>What changes the view:</strong> {dossier.header.whatWouldChangeMind}</p>
                </section>
                <section className={styles.secondaryPanel}>
                  <h2>Source quality and unresolved evidence</h2>
                  <p>{dossier.health.analyticalRateCoverage.detail || "Rate coverage not assessed."}</p>
                  <p>{material.length} material gap{material.length === 1 ? "" : "s"} · {dossier.health.researchGaps.length} recorded research questions.</p>
                  {material.map(gap => (
                    <article key={gap.id} className={styles.dossierGap}>
                      <strong>{gap.category} · {gap.severity}</strong>
                      <p>{gap.description}</p>
                    </article>
                  ))}
                  <details>
                    <summary>All research gaps</summary>
                    <ul>{dossier.health.researchGaps.map(gap => <li key={gap.id}>{gap.severity} · {gap.description}</li>)}</ul>
                  </details>
                </section>
                <section className={styles.secondaryPanel}>
                  <h2>Regime lenses</h2>
                  <div className={styles.dossierLensGrid}>
                    {dossier.regimeStrip.map(lens => (
                      <article className={styles.dossierLens} key={lens.key}>
                        <strong>{lens.label}</strong>
                        <small>{lens.observed ? "OBSERVED" : "UNRESOLVED"} · {lens.evidenceRefs.length} evidence references</small>
                        <p>{lens.interpretation}</p>
                        {lens.reaction ? <small>{lens.reaction}</small> : null}
                      </article>
                    ))}
                  </div>
                </section>
                <section className={styles.secondaryPanel}>
                  <h2>Frozen market stories</h2>
                  {dossier.whatMattersNow.stories.length ? dossier.whatMattersNow.stories.map(story => (
                    <article key={story.id} className={styles.dossierGap}>
                      <h3>{story.title}</h3>
                      <p>{story.whatChanged}</p>
                      <p>{story.whyItMatters}</p>
                      <p><strong>Reversal test:</strong> {story.whatWouldChangeMind}</p>
                      <small>{story.epistemicLabel} · {story.evidenceRefs.length} evidence references</small>
                    </article>
                  )) : <p>No evidence-admitted Story in this vintage.</p>}
                </section>
                <section className={styles.secondaryPanel}>
                  <h2>Expectations versus market reactions</h2>
                  {dossier.watchNext.length ? dossier.watchNext.slice(0, 12).map(item => (
                    <article key={item.id} className={styles.dossierGap}>
                      <h3>{item.question}</h3>
                      <p><strong>Expected:</strong> {item.expectedReaction || "No recorded pre-event expectation."}</p>
                      <p><strong>Observed:</strong> {item.observedReaction || "No verified comparable reaction."}</p>
                      <p><strong>State:</strong> {item.divergence}</p>
                      <p><strong>Next check:</strong> {item.researchNext}</p>
                    </article>
                  )) : <p>No measured reaction comparisons in this edition.</p>}
                </section>
                <p className={styles.dossierNote}>This edition's timestamps, sources and conclusions remain as published. Later information belongs to a new edition.</p>
              </>
            )}
          </div>
          <aside className={styles.dossierArchive} aria-labelledby="blueberry-dossier-archive-title">
            <h2 id="blueberry-dossier-archive-title">Dossier archive</h2>
            <p>Recent editions appear below. Any older edition can be opened by exact UUID.</p>
            <Link href={dossierHref}>Latest Dossier →</Link>
            <form action={dossierHref} method="get" className={styles.dossierLookup}>
              <label htmlFor="blueberry-dossier-id">Exact canonical Dossier UUID</label>
              <input name="id" id="blueberry-dossier-id" defaultValue={id || ""} placeholder="Original Dossier UUID" />
              <button type="submit">Open edition</button>
            </form>
            {history?.items.length ? history.items.map(item => (
              <Link key={item.id} className={styles.dossierArchiveRow}
                href={dossierHref+"?id=" + encodeURIComponent(item.id)}
                aria-current={item.id === dossier?.dossierId ? "page" : undefined}>
                <strong>{item.headline}</strong>
                <DualTimestamp value={item.asOf} sourceDate={item.asOf} />
                <small>{item.health === "degraded" ? "Degraded" : "Healthy"} · {item.divergentInvestigationCount} divergent investigations</small>
              </Link>
            )) : <p>No archive index available. Exact ID lookup remains separate.</p>}
          </aside>
        </div>
      </div>
    </main>
  );
}
