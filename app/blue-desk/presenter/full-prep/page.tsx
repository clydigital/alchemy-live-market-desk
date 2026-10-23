import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import PresenterPrepSession from "@/components/live-desk/PresenterPrepSession";
import { isBluebellyReaderHost, isBlueDeskPublicReaderHost } from "@/lib/blue-desk-host";
import { getDeskData } from "@/lib/data";
import { getHybridPresenterEditionCandidates, getHybridExactDailyBriefEdition, getHybridDirectDailyBriefSuperseders } from "@/lib/hybrid-publication";
import { resolvePresenterPrepExactSelection } from "@/lib/presenter-prep-exact-edition";
import { presenterDossierEditionContextFromPayload } from "@/lib/presenter-dossier-edition-context";
import { getDossierV2PresentationSelectionById } from "@/lib/dossier-v2/presentation-reader";
import { buildPresenterPrepSourceProjection } from "@/lib/presenter-prep-source-projection";
import { buildPresenterPrepEditorialReadiness } from "@/lib/presenter-prep-editorial-readiness";
import desk from "../../blue-desk.module.css";
import ui from "../v6-studio.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "Edition Prep | Bluebelly",
  description: "Private, source-locked edition and Dossier reading for the Bluebelly presenter.",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FOCUS = ["story", "motion", "regime", "event"] as const;
type Query = Record<string,string|string[]|undefined>;

function validated(query:Query,key:string):string|null {
  const value=query[key];
  if(value===undefined)return null;
  if(typeof value!=="string"||!value.trim()||value.length>180||/[\x00-\x1f\x7f]/.test(value))notFound();
  return value;
}

export default async function BluebellyFullPresenterPrep({searchParams}:{searchParams:Promise<Query>}) {
  const host=(await headers()).get("host");
  const bluebelly=isBluebellyReaderHost(host);
  if(isBlueDeskPublicReaderHost(host)&&!bluebelly)notFound();
  const query=await searchParams;
  const requested=validated(query,"edition");
  if(requested&&!UUID.test(requested))notFound();
  const focus=Object.fromEntries(FOCUS.map(k=>[k,validated(query,k)]).filter(([,v])=>v!==null)) as {
    story?:string;motion?:string;regime?:string;event?:string;
  };
  const [recent,deskData]=await Promise.all([
    getHybridPresenterEditionCandidates().catch(()=>[]),
    getDeskData().catch(()=>null),
  ]);
  const [exact,superseders]=requested
    ?await Promise.all([getHybridExactDailyBriefEdition(requested).catch(()=>null),
      getHybridDirectDailyBriefSuperseders(requested).catch(()=>null)])
    :[null,null];
  const selection=resolvePresenterPrepExactSelection({
    recent,requestedEditionId:requested,exactEdition:exact,directSuperseders:superseders,
    researchRuns:deskData?.researchRuns,
  });
  const selected=selection.selectedSnapshot;
  const frozen=presenterDossierEditionContextFromPayload(selected?.payload);
  const dossierSelection=frozen?.dossierId
    ?await getDossierV2PresentationSelectionById(frozen.dossierId).catch(()=>null)
    :null;
  const exactDossier=dossierSelection?.status==="historical_exact"
    && dossierSelection.presentation
    && dossierSelection.selectedDossierId===frozen?.dossierId
    && dossierSelection.selectedAsOf===frozen?.dossierAsOf
    ?{id:dossierSelection.selectedDossierId,asOf:dossierSelection.selectedAsOf}:null;
  const selectedId=selection.selected?.snapshotId??null;
  const currentId=selection.current?.snapshotId??null;
  const projection=buildPresenterPrepSourceProjection({
    requestedEditionId:requested,selectedEditionId:selectedId,currentEditionId:currentId,
    editionSelectionStatus:selection.status,
    selectedEdition:selected?{id:selected.id,publishedAt:selected.published_at,payload:selected.payload}:null,
    exactDossier,focus,
  });
  const editorial=buildPresenterPrepEditorialReadiness({
    presenterStatus:projection.status,
    pinned:projection.pinned?{editionId:projection.pinned.editionId,publishedAt:projection.pinned.publishedAt}:null,
    selectedEdition:selected?{id:selected.id,publishedAt:selected.published_at,
      supersedesSnapshotId:selected.supersedes_snapshot_id,payload:selected.payload}:null,
  });
  const back=bluebelly?"/presenter":"/blue-desk/presenter";
  const editorialHref=(bluebelly?"/presenter/editorial":"/blue-desk/presenter/editorial")
    +(projection.pinned?"?edition="+encodeURIComponent(projection.pinned.editionId):"");
  return <main className={desk.page} data-bluebelly-exact-prep="owner-only">
    <BlueDeskHeader activePath="/blue-desk/presenter"/>
    <div className={ui.content}>
      <div className={ui.privateStrip}><strong>BLUEBELLY · OWNER / IMMUTABLE EDITION</strong><Link href={back}>← Presenter Prep</Link></div>
      <header className={ui.studioHeader}><div className={ui.headerCopy}>
        <span className={ui.kicker}>SOURCE-LOCKED RESEARCH / NO LIVE FALLBACK</span>
        <h1>Edition briefing.</h1>
        <p>This is the exact source material available in the selected published edition. It never borrows later headlines, chart data or Dossier analysis for an older session.</p>
      </div><div className={ui.headerActions}><Link href={back} className={ui.press}>Back to Today's Talk</Link><Link href={editorialHref} className={ui.pressStrong}>COTD / OB source check →</Link></div></header>
      {projection.status!=="READY"||!projection.pinned?<section className={ui.box} role="status" style={{marginTop:20}}>
        <span className={ui.kicker}>SOURCE UNAVAILABLE · FAIL CLOSED</span>
        <h2>Cannot validate this edition.</h2>
        <p>{projection.reason||"No exact frozen source bundle could be established."} No current edition or unsourced interpretation has been substituted.</p>
        <Link href={back}>Return to Presenter Prep →</Link>
      </section>:<>
        <section className={ui.briefIntro} style={{marginTop:18}}>
          <span className={ui.kicker}>{projection.scope} / VERIFIED IMMUTABLE IDENTITY</span>
          <h2>Frozen research, on one screen.</h2>
          <div className={ui.factStrip}><span>Published {projection.pinned.publishedAt}</span><span>{projection.stories.length} Story records</span><span>{projection.motions.length} promoted Motions</span><span>{projection.events.length} event references</span><span>{projection.researchGaps.length} research gaps</span></div>
          <p>Edition <code>{projection.pinned.editionId}</code> · Exact Dossier <code>{projection.pinned.dossierId}</code> · Dossier as-of {projection.pinned.dossierAsOf}</p>
        </section>
        <div className={ui.briefLayout}>
          <div className={ui.talkStack}>
            <section className={ui.box}><span className={ui.kicker}>STORIES / IMMUTABLE SNAPSHOT</span>
              <h2>What the research said</h2>
              {projection.stories.length?projection.stories.map(s=><article className={ui.boundary} key={s.storyId}>
                <h3>{s.headline}</h3><p>{s.sourceKind==="CANONICAL_REASONING"?"Frozen canonical Story reasoning":"Older frozen Story state; reasoning not independently available"}</p>
                <p><small>Story {s.storyId} · Thesis version {s.thesisVersionId}</small></p>
              </article>):<p>No canonical Story records were admitted from this edition.</p>}
            </section>
            <section className={ui.box}><span className={ui.kicker}>VERIFIED SOURCE ATTACHMENTS</span>
              <h2>What happened in that edition</h2>
              {projection.motions.length?projection.motions.map(m=><article key={m.motionId} className={ui.boundary}>
                <h3>{m.headline}</h3><p>{m.verificationState} · {m.regimeSlug||"No regime attached"}</p>
                <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer">{m.sourceName} · original report ↗</a>
              </article>):<p>No promoted Motion sources are in the selected frozen edition.</p>}
            </section>
            <section className={ui.box}><span className={ui.kicker}>ON-AIR RUNNING ORDER · PRESENTER NOTES ONLY</span>
              <h2>Build your session</h2>
              <p>Drafts are stored under this exact edition and Dossier, separately from market evidence. They do not publish or mutate research.</p>
              <PresenterPrepSession editionId={projection.pinned.editionId} dossierId={projection.pinned.dossierId}
                sourceCounts={{stories:projection.stories.length,motions:projection.motions.length,events:projection.events.length,researchGaps:projection.researchGaps.length}}/>
            </section>
          </div>
          <aside className={ui.sideBox}>
            <section className={ui.box}><span className={ui.kicker}>ARTICLE READINESS</span>
              <h2>Source check</h2><p>{editorial.status==="HAS_EDITORIAL"?editorial.items.length+" article source pack(s) in this edition":"No source-admitted editorial in this edition."}</p>
              <p>Source material does not mean publication approval. Confirm chart timing and outstanding research gaps.</p>
              <Link className={ui.pressStrong} href={editorialHref}>Open COTD / OB checks →</Link>
            </section>
            <section className={ui.box}><span className={ui.kicker}>EVENTS IN THIS EDITION</span>
              {projection.events.length?projection.events.slice(0,10).map(e=><div key={e.eventId} className={ui.boundary}><strong>{e.title}</strong></div>):<p>No frozen events available.</p>}
            </section>
            <section className={ui.box}><span className={ui.kicker}>RESEARCH DEBT</span>
              {projection.researchGaps.length?projection.researchGaps.slice(0,10).map(g=><div key={g.gapKey} className={ui.boundary}>
                <strong>{g.gapKey}</strong><p>{g.lifecycleStatus} · Measurement not proven by this projection</p>
              </div>):<p>No admitted gap records for this exact selection; this is not proof that coverage was complete.</p>}
            </section>
          </aside>
        </div>
      </>}
      <footer className={ui.footer}>Bluebelly Presenter Prep · exact edition, non-canonical presenter notes and existing authenticated source readers. No public publication action.</footer>
    </div>
  </main>;
}
