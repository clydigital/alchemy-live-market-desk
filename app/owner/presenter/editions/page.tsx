import Link from "next/link";
import {notFound} from "next/navigation";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import {getDeskData} from "@/lib/data";
import {
 getHybridPresenterEditionCandidates,getHybridExactDailyBriefEdition,
} from "@/lib/hybrid-publication";
import {getPresenterDirectDailyBriefSuperseders} from "@/lib/presenter-prep-direct-superseders";
import {buildPresenterPrepEditionIndex} from "@/lib/presenter-prep-edition-index";
import {resolvePresenterPrepExactSelection} from "@/lib/presenter-prep-exact-edition";
import {parseBluebellyExactPrepQuery,type BluebellyExactPrepQuery} from "@/lib/bluebelly-exact-prep-query";
import {presenterDossierEditionContextFromPayload} from "@/lib/presenter-dossier-edition-context";
import {getDossierV2PresentationSelectionById} from "@/lib/dossier-v2/presentation-reader";
import {buildPresenterPrepSourceProjection} from "@/lib/presenter-prep-source-projection";
import {buildPresenterPrepEditorialReadiness} from "@/lib/presenter-prep-editorial-readiness";
import desk from "@/app/blue-desk/blue-desk.module.css";
import ui from "./editions.module.css";

export const dynamic="force-dynamic";
export const revalidate=0;
export const metadata={
 title:"Historical Editions | My Desk",
 description:"Private exact frozen historical editions with matching Dossier evidence and original sources.",
 robots:{index:false,follow:false},
};

type Props={searchParams:Promise<BluebellyExactPrepQuery>};

/**
 * Exactly one published edition, if supplied. The bare route is a picker;
 * malformed, unknown, unbound or superseded editions never become "today".
 * Only owner-approved sessions may reach this server-rendered route.
 */
export default async function PresenterExactEditions({searchParams}:Props){
 const requested=parseBluebellyExactPrepQuery(await searchParams);
 if(requested.state==="invalid")notFound();

 const [recent,deskData]=await Promise.all([
   getHybridPresenterEditionCandidates({fresh:true}).catch(()=>[]),
   getDeskData().catch(()=>null),
 ]);
 if(requested.state==="picker"){
   const editions=buildPresenterPrepEditionIndex(recent,deskData?.researchRuns ?? []).slice(0,24);
   return <main className={desk.page} data-presenter-editions="private-picker">
    <BlueDeskHeader activePath="/my-reports"/>
    <div className={desk.content}>
     <header className={ui.hero}>
      <p className={desk.kicker}>PRIVATE MY DESK / IMMUTABLE HISTORY</p>
      <h1>Choose a historical edition.</h1>
      <p>Each edition is a dated publication. Opening one does not replace its
        original Story, Motion, catalyst or Dossier sources with current analysis.</p>
      <Link href="/my-reports">Return to My Desk</Link>
     </header>
     <section className={ui.panel} aria-label="Available immutable editions">
      <h2>Recent available editions</h2>
      {editions.length?<ol className={ui.editionList}>{editions.map(e=><li key={e.snapshotId}>
       <Link href={"/owner/presenter/editions?edition="+encodeURIComponent(e.snapshotId)}>
        <time dateTime={e.publishedAt}>{e.publishedAt}</time>
        <small>{e.snapshotId}</small>
       </Link>
      </li>)}</ol>:<p role="status">Recent edition list unavailable. An exact older
        UUID can still be opened via the address bar when its archive exists.</p>}
      <p className={ui.notice}>This picker displays up to 24 recent terminal editions.
        Older editions are accessible by their exact UUID, never substituted with a newer snapshot.</p>
     </section>
    </div>
   </main>;
 }

 const [exact,superseders]=await Promise.all([
   getHybridExactDailyBriefEdition(requested.editionId).catch(()=>null),
   getPresenterDirectDailyBriefSuperseders(requested.editionId).catch(()=>null),
 ]);
 const selection=resolvePresenterPrepExactSelection({
  recent,requestedEditionId:requested.editionId,exactEdition:exact,
  directSuperseders:superseders,researchRuns:deskData?.researchRuns,
 });
 const snapshot=selection.selectedSnapshot;
 const frozen=presenterDossierEditionContextFromPayload(snapshot?.payload);
 const dossier=frozen?.dossierId
  ? await getDossierV2PresentationSelectionById(frozen.dossierId).catch(()=>null)
  : null;
 const exactDossier=dossier?.status==="historical_exact" &&
   dossier.presentation && dossier.selectedDossierId && dossier.selectedAsOf &&
   dossier.selectedDossierId===frozen?.dossierId &&
   dossier.selectedAsOf===frozen?.dossierAsOf
   ? {id:dossier.selectedDossierId,asOf:dossier.selectedAsOf}:null;
 const source=buildPresenterPrepSourceProjection({
  requestedEditionId:requested.editionId,
  selectedEditionId:selection.selected?.snapshotId ?? null,
  currentEditionId:selection.current?.snapshotId ?? null,
  editionSelectionStatus:selection.status,
  selectedEdition:snapshot?{id:snapshot.id,publishedAt:snapshot.published_at,payload:snapshot.payload}:null,
  exactDossier,
  focus:requested.focus,
 });
 const readiness=buildPresenterPrepEditorialReadiness({
  presenterStatus:source.status,
  pinned:source.pinned?{editionId:source.pinned.editionId,publishedAt:source.pinned.publishedAt}:null,
  selectedEdition:snapshot?{
   id:snapshot.id,publishedAt:snapshot.published_at,
   supersedesSnapshotId:snapshot.supersedes_snapshot_id,payload:snapshot.payload,
  }:null,
 });
 const pinned=source.pinned;

 return <main className={desk.page} data-presenter-editions="private-exact">
  <BlueDeskHeader activePath="/my-reports"/>
  <div className={desk.content}>
   <header className={ui.hero}>
    <p className={desk.kicker}>PRIVATE / SOURCE-LOCKED HISTORICAL RESEARCH</p>
    <h1>Edition-locked briefing.</h1>
    <p>What was known when this edition was published, what remained uncertain,
      and which questions remained unresolved. Today's prices are deliberately not mixed into this archive.</p>
    <nav className={ui.links}>
      <Link href="/owner/presenter/editions">All editions</Link>
      <Link href="/my-reports">My Desk</Link>
    </nav>
   </header>
   {!pinned || source.status!=="READY"?<section className={ui.panel} role="status"
     data-edition-validation="unavailable">
      <p className={desk.kicker}>NO SUBSTITUTE PUBLICATION</p>
      <h2>Exact historical source unavailable</h2>
      <p>The selected publication or its frozen Dossier could not be verified.
         No current market content has been substituted.</p>
      <p>Reason: {source.reason||"Exact identity unavailable"}</p>
    </section>:<>
      <section className={ui.panel} data-edition-validation="pinned">
       <p className={desk.kicker}>SOURCE PROVENANCE · {source.scope}</p>
       <h2>Frozen publication identity</h2>
       <dl className={ui.identity}>
        <dt>Published</dt><dd>{pinned.publishedAt}</dd>
        <dt>Edition UUID</dt><dd><code>{pinned.editionId}</code></dd>
        <dt>Dossier UUID</dt><dd><code>{pinned.dossierId}</code></dd>
        <dt>Dossier as of</dt><dd>{pinned.dossierAsOf}</dd>
       </dl>
       <p>Selected focus: {Object.entries(source.focus).length
        ?Object.entries(source.focus).map(([key,value])=>key+": "+value).join(" · ")
        :"Whole edition"}</p>
      </section>
      <div className={ui.columns}>
       <div>
        <section className={ui.panel}>
         <p className={desk.kicker}>01 / STORY RECORDS</p><h2>What was the thesis?</h2>
         {source.stories.length?source.stories.map(s=><article className={ui.record} key={s.storyId}>
          <h3>{s.headline}</h3>
          <p>{s.sourceKind==="CANONICAL_REASONING"
            ?"Canonical reasoning frozen into this edition"
            :"Historical Story state only; no independent reasoning attached"}</p>
          <small>Story {s.storyId} · Version {s.thesisVersionId}</small>
         </article>):<p>No source-admitted frozen Story identities.</p>}
        </section>
        <section className={ui.panel}>
         <p className={desk.kicker}>02 / MOTION & ORIGINAL SOURCES</p><h2>What changed then?</h2>
         {source.motions.length?source.motions.map(m=><article className={ui.record} key={m.motionId}>
          <h3>{m.headline}</h3>
          <p>{m.verificationState} · {m.regimeSlug||"No regime assigned"}</p>
          <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer">{m.sourceName} · original source</a>
         </article>):<p>No verified Motion sources are present in this publication.</p>}
        </section>
       </div>
       <aside>
        <section className={ui.panel}>
         <p className={desk.kicker}>ARTICLE PROVENANCE</p><h2>COTD / OB</h2>
         <p>{readiness.status==="HAS_EDITORIAL"
          ?readiness.items.length+" source-admitted frozen editorial item(s)"
          :"No source-admitted article is available in this edition."}</p>
         <p>Live drafting is separate from the frozen editorial archive.</p>
        </section>
        <section className={ui.panel}>
         <p className={desk.kicker}>DATED CATALYSTS</p><h2>Events</h2>
         {source.events.length?source.events.slice(0,10).map(e=>
          <p className={ui.record} key={e.eventId}>{e.title}</p>
         ):<p>No frozen events were included.</p>}
        </section>
        <section className={ui.panel}>
         <p className={desk.kicker}>RESEARCH GAPS</p><h2>Unresolved questions</h2>
         {source.researchGaps.length?source.researchGaps.map(g=>
          <p className={ui.record} key={g.gapKey}>
           {g.gapKey} · {g.lifecycleStatus} · Measurement {g.measurementVerification}
          </p>
         ):<p>Nothing source-qualified in this edition's exact Dossier gap projection.</p>}
        </section>
       </aside>
      </div>
    </>}
  </div>
 </main>;
}
