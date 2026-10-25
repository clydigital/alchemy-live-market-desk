import Link from "next/link";
import { notFound } from "next/navigation";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import PresenterPrepSession from "@/components/live-desk/PresenterPrepSession";
import { getDeskData } from "@/lib/data";
import {
  getHybridPresenterEditionCandidates,
  getHybridExactDailyBriefEdition,
  getHybridDirectDailyBriefSuperseders,
} from "@/lib/hybrid-publication";
import { resolvePresenterPrepExactSelection } from "@/lib/presenter-prep-exact-edition";
import { buildPresenterPrepEditionIndex } from "@/lib/presenter-prep-edition-index";
import { parseBluebellyExactPrepQuery, type BluebellyExactPrepQuery } from "@/lib/bluebelly-exact-prep-query";
import { presenterDossierEditionContextFromPayload } from "@/lib/presenter-dossier-edition-context";
import { getDossierV2PresentationSelectionById } from "@/lib/dossier-v2/presentation-reader";
import { buildPresenterPrepSourceProjection } from "@/lib/presenter-prep-source-projection";
import { buildPresenterPrepEditorialReadiness } from "@/lib/presenter-prep-editorial-readiness";
import desk from "../../blue-desk.module.css";
import ui from "../presenter.module.css";
import styles from "./full-prep.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "Exact Edition | Bluebelly Presenter",
  description: "Private frozen research, proof and running order for one published edition.",
};


/**
 * The exact historical edition is selected before frozen Dossier or editorial.
 * Never substitute the latest publication, live Story thesis or new price data.
 * The middleware protects this route with the existing active owner allowlist.
 */
export default async function BluebellyExactEdition({
  searchParams,
}: { searchParams: Promise<BluebellyExactPrepQuery> }) {
  const parsed = parseBluebellyExactPrepQuery(await searchParams);
  if (parsed.state === "invalid") notFound();

  if (parsed.state === "picker") {
    // A bare URL is an explicit choice list, NOT a current-edition fallback.
    const [available, pickerDesk] = await Promise.all([
      getHybridPresenterEditionCandidates({ fresh: true }).catch(() => []),
      getDeskData().catch(() => null),
    ]);
    const editions = buildPresenterPrepEditionIndex(
      available, pickerDesk?.researchRuns ?? [],
    ).slice(0, 24);
    return <main className={desk.page} data-bluebelly-exact-edition="owner-picker">
      <BlueDeskHeader activePath="/blue-desk/presenter" />
      <div className={desk.content}>
        <header className={ui.hero}>
          <p className={desk.kicker}>PRIVATE PRESENTER / HISTORICAL RESEARCH</p>
          <h1>Choose an edition.</h1>
          <p>Select an immutable publication before opening its Story, Motion,
            Regime or Event context. The newest edition is not selected automatically.</p>
          <div className={ui.links}>
            <Link className={ui.action} href="/blue-desk/presenter">Return to today's talk →</Link>
          </div>
        </header>
        <section className={ui.panel} aria-label="Available immutable editions">
          <h2>Recent published editions</h2>
          {editions.length ? <ol>
            {editions.map(row => <li key={row.snapshotId}>
              <Link href={"/blue-desk/presenter/full-prep?edition=" + encodeURIComponent(row.snapshotId)}>
                Published <time dateTime={row.publishedAt}>{row.publishedAt}</time>
                {" · "} Edition {row.snapshotId}
              </Link>
            </li>)}
          </ol> : <p role="status">No source-verified edition index is available.
            An exact historical UUID link may still be used when the archive is accessible.</p>}
          <p>Showing up to 24 recent terminal editions. A valid older edition is
            accessible through its exact UUID, subject to the existing superseder
            and frozen Dossier checks.</p>
        </section>
      </div>
    </main>;
  }

  const requested = parsed.editionId;
  const focus = parsed.focus;
  const [recent, deskData] = await Promise.all([
    getHybridPresenterEditionCandidates({ fresh: true }).catch(() => []),
    getDeskData().catch(() => null),
  ]);
  const [exact, superseders] = requested
    ? await Promise.all([
      getHybridExactDailyBriefEdition(requested).catch(() => null),
      getHybridDirectDailyBriefSuperseders(requested).catch(() => null),
    ])
    : [null, null];
  const selection = resolvePresenterPrepExactSelection({
    recent, requestedEditionId: requested, exactEdition: exact,
    directSuperseders: superseders, researchRuns: deskData?.researchRuns,
  });
  const snapshot = selection.selectedSnapshot;
  const frozen = presenterDossierEditionContextFromPayload(snapshot?.payload);
  const dossierRead = frozen?.dossierId
    ? await getDossierV2PresentationSelectionById(frozen.dossierId).catch(() => null)
    : null;
  const exactDossier = dossierRead?.status === "historical_exact"
    && dossierRead.presentation
    && dossierRead.selectedDossierId
    && dossierRead.selectedAsOf
    && dossierRead.selectedDossierId === frozen?.dossierId
    && dossierRead.selectedAsOf === frozen?.dossierAsOf
    ? { id: dossierRead.selectedDossierId, asOf: dossierRead.selectedAsOf }
    : null;
  const projection = buildPresenterPrepSourceProjection({
    requestedEditionId: requested,
    selectedEditionId: selection.selected?.snapshotId ?? null,
    currentEditionId: selection.current?.snapshotId ?? null,
    editionSelectionStatus: selection.status,
    selectedEdition: snapshot
      ? { id: snapshot.id, publishedAt: snapshot.published_at, payload: snapshot.payload }
      : null,
    exactDossier, focus,
  });
  const editorial = buildPresenterPrepEditorialReadiness({
    presenterStatus: projection.status,
    pinned: projection.pinned ? {
      editionId: projection.pinned.editionId, publishedAt: projection.pinned.publishedAt,
    } : null,
    selectedEdition: snapshot ? {
      id: snapshot.id, publishedAt: snapshot.published_at,
      supersedesSnapshotId: snapshot.supersedes_snapshot_id,
      payload: snapshot.payload,
    } : null,
  });
  const pinned = projection.pinned;

  return <main className={desk.page} data-bluebelly-exact-edition="owner-only">
    <BlueDeskHeader activePath="/blue-desk/presenter" />
    <div className={desk.content}>
      <header className={ui.hero}>
        <p className={desk.kicker}>PRIVATE PRESENTER / IMMUTABLE RESEARCH</p>
        <h1>Edition-locked preparation.</h1>
        <p>Review what the market desk actually knew when this edition was published.
          Original source references, frozen Story identities and missing evidence
          remain separate from today's analysis and your own talk notes.</p>
        <div className={ui.links}>
          <Link className={ui.action} href="/blue-desk/presenter">Return to today's talk →</Link>
          <a href="#session">Running-order notes ↓</a>
        </div>
      </header>

      {!pinned || projection.status !== "READY" ? (
        <section className={ui.panel} role="status" data-exact-edition="unavailable">
          <p className={desk.kicker}>FAIL CLOSED · NO SUBSTITUTE EDITION</p>
          <h2>Historical source unavailable</h2>
          <p>The requested edition or its exact frozen Dossier cannot be validated.
            This page has not loaded current research as a replacement.</p>
          <p><strong>Reason:</strong> {projection.reason || "Exact source identity unavailable"}</p>
          <Link href="/blue-desk/presenter">Open current Presenter Prep →</Link>
        </section>
      ) : <>
        <section className={ui.panel} data-exact-edition="pinned">
          <p className={desk.kicker}>{projection.scope} · ORIGINAL PUBLICATION</p>
          <h2>Source identity</h2>
          <div className={styles.identity}>
            <span>Published <strong>{pinned.publishedAt}</strong></span>
            <span>Edition <code>{pinned.editionId}</code></span>
            <span>Frozen Dossier <code>{pinned.dossierId}</code></span>
            <span>Dossier time <strong>{pinned.dossierAsOf}</strong></span>
          </div>
          <p>Selected focus: {Object.entries(projection.focus).length
            ? Object.entries(projection.focus).map(([key, value]) => key + ": " + value).join(" · ")
            : "Entire edition"}</p>
        </section>
        <div className={styles.columns}>
          <div>
            <section className={ui.panel}>
              <p className={desk.kicker}>01 / FROZEN STORY RECORDS</p>
              <h2>What was the thesis?</h2>
              {projection.stories.length ? projection.stories.map(story =>
                <article className={styles.record} key={story.storyId}>
                  <h3>{story.headline}</h3>
                  <p>{story.sourceKind === "CANONICAL_REASONING"
                    ? "Immutable canonical reasoning in this publication"
                    : "Frozen Story state; independent reasoning not included"}</p>
                  <small>Story {story.storyId} · Version {story.thesisVersionId}</small>
                </article>) : <p>No canonical Story identities admitted in this edition.
                  This does not invalidate other known Stories.</p>}
            </section>
            <section className={ui.panel}>
              <p className={desk.kicker}>02 / SOURCE-ATTACHED DEVELOPMENTS</p>
              <h2>What evidence was available?</h2>
              {projection.motions.length ? projection.motions.map(motion =>
                <article className={styles.record} key={motion.motionId}>
                  <h3>{motion.headline}</h3>
                  <p>{motion.verificationState} · {motion.regimeSlug || "Regime unspecified"}</p>
                  <a href={motion.sourceUrl} rel="noopener noreferrer" target="_blank">
                    {motion.sourceName} · original publisher ↗
                  </a>
                </article>) : <p>No promoted source-linked Motion records are
                  available in this exact edition.</p>}
            </section>
            <section className={ui.panel} id="session">
              <p className={desk.kicker}>03 / YOUR ON-AIR RUNNING ORDER</p>
              <h2>Present from the frozen source</h2>
              <p>Presenter notes are stored locally under the exact edition and
                Dossier IDs. They are not evidence and do not publish or alter a Story.</p>
              <PresenterPrepSession editionId={pinned.editionId} dossierId={pinned.dossierId}
                sourceCounts={{
                  stories: projection.stories.length,
                  motions: projection.motions.length,
                  events: projection.events.length,
                  researchGaps: projection.researchGaps.length,
                }} />
            </section>
          </div>
          <aside>
            <section className={ui.panel}>
              <p className={desk.kicker}>ARTICLE SOURCE READINESS</p>
              <h2>COTD / OB</h2>
              <p>{editorial.status === "HAS_EDITORIAL"
                ? editorial.items.length + " frozen source-admitted editorial record(s)"
                : "No source-admitted editorial article available in this edition."}</p>
              <p>Draft generation and publication are separate owner decisions.
                Missing figures or reactions must remain missing.</p>
            </section>
            <section className={ui.panel}>
              <p className={desk.kicker}>DATED EVENT REFERENCES</p>
              <h2>Events</h2>
              {projection.events.length ? projection.events.slice(0,10).map(event =>
                <p key={event.eventId} className={styles.record}>{event.title}</p>)
                : <p>No frozen event references in this edition.</p>}
            </section>
            <section className={ui.panel}>
              <p className={desk.kicker}>RESEARCH GAPS</p>
              <h2>What remained uncertain?</h2>
              {projection.researchGaps.length ? projection.researchGaps.slice(0,10).map(gap =>
                <div className={styles.record} key={gap.gapKey}>
                  <strong>{gap.gapKey}</strong>
                  <p>{gap.lifecycleStatus} · Measurement not independently established</p>
                </div>) : <p>No attached gap records; this is not proof of complete coverage.</p>}
            </section>
          </aside>
        </div>
      </>}
      <footer className={ui.footer}>Owner-only source review. No new research
        engine, unverified price claim or change to the canonical publication.</footer>
    </div>
  </main>;
}
