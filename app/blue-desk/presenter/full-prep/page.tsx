import Link from "next/link";
import { notFound } from "next/navigation";

import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import PresenterPrepSession from "@/components/live-desk/PresenterPrepSession";
import { parseBluebellyExactPresenterQuery, type PresenterExactQuery } from "@/lib/bluebelly-exact-presenter-query";
import { getDeskData } from "@/lib/data";
import { getDossierV2PresentationSelectionById } from "@/lib/dossier-v2/presentation-reader";
import { getHybridExactDailyBriefEdition, getHybridPresenterEditionCandidates } from "@/lib/hybrid-publication";
import { buildPresenterPrepEditionIndex } from "@/lib/presenter-prep-edition-index";
import { presenterDossierEditionContextFromPayload } from "@/lib/presenter-dossier-edition-context";
import { buildPresenterPrepSourceProjection } from "@/lib/presenter-prep-source-projection";
import { buildPresenterPrepEditorialReadiness } from "@/lib/presenter-prep-editorial-readiness";
import desk from "../../blue-desk.module.css";
import ui from "./full-prep.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "Exact Edition | Bluebelly Presenter",
  description: "Private immutable historical publication and presenter session, with no fallback to current research.",
};
type Props={searchParams:Promise<PresenterExactQuery>};

/**
 * Exact archival access is deliberately separate from current-day P1a Writer:
 * this route never primes Gemini with a later source packet or live market data.
 * The existing Google/allowlist middleware gates the entire route.
 */
export default async function BluebellyExactPresenter({searchParams}:Props) {
  const input=parseBluebellyExactPresenterQuery(await searchParams);
  if(input.state==="invalid")notFound();

  if(input.state==="picker"){
    const editions=await getHybridPresenterEditionCandidates({fresh:true}).catch(()=>[]);
    return <main className={desk.page} data-bluebelly-prep-picker="private-owner">
      <BlueDeskHeader activePath="/blue-desk/presenter"/>
      <div className={desk.content}>
        <Link href="/presenter" className={ui.back}>← Today's Presenter Prep</Link>
        <header className={ui.lede}><span className={ui.kicker}>OWNER / HISTORICAL SOURCE LIBRARY</span>
          <h1>Open an exact edition.</h1>
          <p>Choose a published briefing for its as-published Story, Motion and Dossier context.
            This list shows at most 24 recent source identities. Older editions are also
            supported with a direct UUID link; they are never replaced by the latest briefing.</p>
        </header>
        {editions.length?<div className={ui.picker}>
          {editions.filter(row=>row.snapshot_type==="daily_brief").slice(0,24).map(row=>
            <Link href={"/presenter/full-prep?edition="+encodeURIComponent(row.id)}
              className={ui.choice} key={row.id}>
              <span className={ui.kicker}>IMMUTABLE DAILY BRIEF</span>
              <strong>Published <time dateTime={row.published_at}>{row.published_at}</time></strong>
              <code>{row.id}</code>
            </Link>)}
        </div>:<section className={ui.block} role="status" style={{marginTop:18}}>
          <h2>No edition index available</h2><p>The source store is empty or temporarily unavailable.
            No archived edition has been substituted by a recent Dossier.</p>
        </section>}
      </div>
    </main>;
  }

  // Only the exact archive lookup may supply selected source content. There
  // is no 24-edition filter, current Story enrichment or latest fallback.
  const requestedId=input.editionId;
  const [selected,recent,deskData]=await Promise.all([
    getHybridExactDailyBriefEdition(requestedId).catch(()=>null),
    getHybridPresenterEditionCandidates({fresh:true}).catch(()=>[]),
    getDeskData().catch(()=>null),
  ]);
  const currentIndex=buildPresenterPrepEditionIndex(recent,deskData?.researchRuns||[]);
  const currentEditionId=currentIndex[0]?.snapshotId??null;
  const frozen=presenterDossierEditionContextFromPayload(selected?.payload);
  const dossierSelection=frozen?.dossierId
    ? await getDossierV2PresentationSelectionById(frozen.dossierId).catch(()=>null)
    :null;
  const exactDossier=dossierSelection?.status==="historical_exact"
    && dossierSelection.presentation
    && dossierSelection.selectedDossierId===frozen?.dossierId
    && dossierSelection.selectedAsOf===frozen?.dossierAsOf
    ?{id:dossierSelection.selectedDossierId,asOf:dossierSelection.selectedAsOf}:null;

  const projection=buildPresenterPrepSourceProjection({
    requestedEditionId:requestedId,
    selectedEditionId:selected?.id??null,
    currentEditionId,
    editionSelectionStatus:selected?.id===currentEditionId?"current":"historical",
    selectedEdition:selected?{id:selected.id,publishedAt:selected.published_at,payload:selected.payload}:null,
    exactDossier,
    focus:input.focus,
  });
  const editorial=buildPresenterPrepEditorialReadiness({
    presenterStatus:projection.status,
    pinned:projection.pinned?{editionId:projection.pinned.editionId,publishedAt:projection.pinned.publishedAt}:null,
    selectedEdition:selected?{id:selected.id,publishedAt:selected.published_at,
      supersedesSnapshotId:selected.supersedes_snapshot_id,payload:selected.payload}:null,
  });

  return <main className={desk.page} data-bluebelly-exact-prep="private-owner">
    <BlueDeskHeader activePath="/blue-desk/presenter"/>
    <div className={desk.content}>
      <Link href="/presenter/full-prep" className={ui.back}>← Edition selector</Link>
      <header className={ui.lede}>
        <span className={ui.kicker}>OWNER / SOURCE-LOCKED AS-PUBLISHED ARCHIVE</span>
        <h1>Presenter edition briefing.</h1>
        <p>Exact edition <code>{requestedId}</code>. This page never blends a historical
          record with newer Dossier or market-price evidence. Local speaker notes are
          independent of the canonical Story ledger.</p>
      </header>
      {projection.status!=="READY"||!projection.pinned?
        <section className={ui.block} role="status" style={{marginTop:18}}>
          <span className={ui.kicker}>SOURCE UNAVAILABLE / NO FALLBACK</span>
          <h2>Cannot validate this exact edition</h2>
          <p>{projection.reason||"The immutable edition or matching frozen Dossier could not be established."}</p>
          <p>No new source, newest Story version or today's Writer packet was substituted.</p>
          <Link href="/presenter/full-prep" className={ui.link}>Choose another edition →</Link>
        </section>:
        <>
          <section className={ui.block} style={{marginTop:18}} aria-label="Frozen identity">
            <span className={ui.kicker}>{projection.scope} / EXACT FROZEN IDENTITY</span>
            <h2>What was known when this edition was published</h2>
            <div className={ui.row}>
              <span>Published <time dateTime={projection.pinned.publishedAt}>{projection.pinned.publishedAt}</time></span>
              <span>{projection.stories.length} Story versions</span>
              <span>{projection.motions.length} frozen promoted Motions</span>
              <span>{projection.events.length} dated event references</span>
            </div>
            <p className={ui.muted}>Edition: <code>{projection.pinned.editionId}</code>
              {" · "}Frozen Dossier: <code>{projection.pinned.dossierId}</code>
              {" · "}As of <time dateTime={projection.pinned.dossierAsOf}>{projection.pinned.dossierAsOf}</time></p>
            {Object.keys(projection.focus).length?
              <p className={ui.warning}>Focus checked against this edition:{" "}
                {Object.entries(projection.focus).map(([key,value])=>key+" "+value).join(" · ")}</p>:null}
          </section>
          <div className={ui.grid}>
            <div>
              <section className={ui.block} aria-labelledby="exact-stories">
                <span className={ui.kicker}>IMMUTABLE STORY CONTEXT</span>
                <h2 id="exact-stories">The Story threads</h2>
                {projection.stories.length?projection.stories.map(story=>
                  <article key={story.storyId} className={ui.record}>
                    <h3>{story.headline}</h3>
                    <p>{story.sourceKind==="CANONICAL_REASONING"
                      ?"Frozen canonical reasoning identity, not a fresh market interpretation."
                      :"As-published Story state; no separate reasoning claim admitted."}</p>
                    <small>Story <code>{story.storyId}</code> · Thesis <code>{story.thesisVersionId}</code></small>
                  </article>):<p>No canonical Story manifest was admitted for this edition.
                    That does not establish that markets were quiet.</p>}
              </section>
              <section className={ui.block} aria-labelledby="exact-motions">
                <span className={ui.kicker}>PROMOTED SOURCE ATTACHMENTS</span>
                <h2 id="exact-motions">Source-linked developments</h2>
                {projection.motions.length?projection.motions.map(motion=>
                  <article key={motion.motionId} className={ui.record}>
                    <h3>{motion.headline}</h3><p>Stored verification state: {motion.verificationState}.
                      Motion context is not independent proof of a Story thesis change.</p>
                    <small>Motion <code>{motion.motionId}</code></small>
                    {motion.sourceUrl.startsWith("https://")?
                      <p><a href={motion.sourceUrl} className={ui.link} target="_blank"
                        rel="noopener noreferrer">{motion.sourceName} · Original link ↗</a></p>:null}
                  </article>):<p>No promoted source-linked Motion in this frozen edition.</p>}
              </section>
            </div>
            <aside>
              <section className={ui.block} aria-labelledby="exact-editorial">
                <span className={ui.kicker}>AS-PUBLISHED EDITORIAL</span>
                <h2 id="exact-editorial">Source readiness</h2>
                <p>{editorial.status==="HAS_EDITORIAL"
                  ?editorial.items.length+" editorial source records in this edition."
                  :"No source-admitted editorial packet in this edition."}</p>
                {editorial.items.slice(0,6).map(article=>
                  <article className={ui.record} key={article.storyId}>
                    <h3>{article.headline}</h3>
                    <p>{article.kind} · Reaction {article.marketReaction.replaceAll("_"," ").toLowerCase()}</p>
                    {article.reporting.slice(0,3).map((report,i)=>
                      <p key={i}>{report.text}{" "}
                        <a className={ui.link} href={report.sourceUrl} target="_blank"
                          rel="noopener noreferrer">Original source ↗</a></p>)}
                  </article>)}
                <p className={ui.warning}>These are historical facts and source packets,
                  not proof of present-day prices or authorisation to publish.</p>
              </section>
              <section className={ui.block} aria-labelledby="exact-events">
                <span className={ui.kicker}>DATED FROZEN CONTEXT</span>
                <h2 id="exact-events">Events and research limitations</h2>
                {projection.events.length?<ul className={ui.list}>
                  {projection.events.slice(0,10).map(event=><li key={event.eventId}>{event.title}</li>)}
                </ul>:<p>No individually admissible event references.</p>}
                <p className={ui.muted}>Missing research-gap records do not prove that
                  source coverage was complete. Event-window price reactions are not
                  inferred from daily market closes.</p>
              </section>
            </aside>
          </div>
          <div className={ui.session}>
            <PresenterPrepSession editionId={projection.pinned.editionId}
              dossierId={projection.pinned.dossierId}
              sourceCounts={{stories:projection.stories.length,motions:projection.motions.length,
                events:projection.events.length,researchGaps:projection.researchGaps.length}}/>
          </div>
        </>}
      <p className={ui.muted} style={{marginTop:22}}>Owner-only historical research.
        The current OB/COTD Writing Brain remains at <Link href="/presenter" className={ui.link}>
          Today's Presenter Prep</Link>; it is never automatically fed these older claims.</p>
    </div>
  </main>;
}
