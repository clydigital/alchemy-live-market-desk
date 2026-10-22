import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import { isBlueDeskPublicReaderHost } from "@/lib/blue-desk-host";
import { getDeskData } from "@/lib/data";
import {
  getHybridPresenterEditionCandidates,
  getHybridExactDailyBriefEdition,
  getHybridDirectDailyBriefSuperseders,
} from "@/lib/hybrid-publication";
import { resolvePresenterPrepExactSelection } from "@/lib/presenter-prep-exact-edition";
import { presenterDossierEditionContextFromPayload } from "@/lib/presenter-dossier-edition-context";
import { getDossierV2PresentationSelectionById } from "@/lib/dossier-v2/presentation-reader";
import { buildPresenterPrepSourceProjection } from "@/lib/presenter-prep-source-projection";
import { buildPresenterPrepEditorialReadiness } from "@/lib/presenter-prep-editorial-readiness";
import { buildPresenterEditorialLanes } from "@/lib/presenter-cotd-ob-lanes";
import PresenterEditorialDraftEditor from "@/components/blue-desk/PresenterEditorialDraftEditor";
import desk from "../../blue-desk.module.css";
import ui from "../presenter.module.css";
export const dynamic="force-dynamic";
export const revalidate=0;
export const metadata={
  title:"COTD / OB Editorial | Blueberry Presenter",
  description:"Exact edition source packs and pre-publication checks, private owner only",
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function BlueberryPresenterEditorial({
 searchParams,
}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const host=(await headers()).get("host");
  if(isBlueDeskPublicReaderHost(host))notFound();
  const query=await searchParams;
  const raw=query.edition;
  const requested=raw===undefined?null:(typeof raw==="string"&&UUID.test(raw)?raw:"__invalid_edition__");
  const [editions,deskData]=await Promise.all([
    getHybridPresenterEditionCandidates().catch(()=>[]),
    getDeskData().catch(()=>null),
  ]);
  const exact=requested&&UUID.test(requested)
    ? await Promise.all([
      getHybridExactDailyBriefEdition(requested).catch(()=>null),
      getHybridDirectDailyBriefSuperseders(requested).catch(()=>null),
    ]) : [null,null] as const;
  const selection=resolvePresenterPrepExactSelection({
    recent:editions, requestedEditionId:requested,
    exactEdition:exact[0],directSuperseders:exact[1],
    researchRuns:deskData?.researchRuns,
  });
  const selected=selection.selectedSnapshot;
  const frozen=presenterDossierEditionContextFromPayload(selected?.payload);
  const dossierSelection=frozen?.dossierId
    ?await getDossierV2PresentationSelectionById(frozen.dossierId).catch(()=>null):null;
  const dossier=dossierSelection?.status==="historical_exact"
    && dossierSelection.selectedDossierId===frozen?.dossierId
    && dossierSelection.selectedAsOf===frozen?.dossierAsOf
      ? dossierSelection.presentation : null;
  const currentId=selection.current?.snapshotId??null;
  const selectedId=selection.selected?.snapshotId??null;
  const mode=selection.status==="invalid_fallback_current"
    ? "invalid_fallback_current" as const
    :selectedId&&selectedId!==currentId?"historical" as const:"current" as const;
  const projection=buildPresenterPrepSourceProjection({
    requestedEditionId:requested, selectedEditionId:selectedId,
    currentEditionId:currentId, editionSelectionStatus:mode,
    selectedEdition:selected
      ? {id:selected.id,publishedAt:selected.published_at,payload:selected.payload}:null,
    exactDossier:dossier?{id:dossier.dossierId,asOf:dossier.asOf}:null,
  });
  const editorial=buildPresenterPrepEditorialReadiness({
    presenterStatus:projection.status,
    pinned:projection.pinned
      ?{editionId:projection.pinned.editionId,publishedAt:projection.pinned.publishedAt}:null,
    selectedEdition:selected?{id:selected.id,publishedAt:selected.published_at,
      supersedesSnapshotId:selected.supersedes_snapshot_id,payload:selected.payload}:null,
  });
  const lanes=buildPresenterEditorialLanes({
    editorial,dossier,
    exactDossierId:projection.pinned?.dossierId??null,
    pinnedEditionId:projection.pinned?.editionId??null,
  });
  const back="/blue-desk/presenter"+(requested&&UUID.test(requested)?"?edition="+requested:"");
  return <main className={desk.page} data-presenter-editorial="private-readonly">
    <BlueDeskHeader activePath="/blue-desk/presenter"/>
    <div className={desk.content}>
      <header className={ui.hero}>
        <p className={desk.kicker}>OWNER-ONLY EDITORIAL WORKBENCH · EXACT SOURCES</p>
        <h1>COTD / Opening Bell</h1>
        <p>Evaluate whether the saved research is good enough for an LY-style article. These source packs are visible and inspectable, but are never auto-approved articles.</p>
        <div className={ui.links}>
          <Link className={ui.action} href={back}>Presenter technical checks →</Link>
          {projection.pinned?<Link href={"/blue-desk/dossier?id="+projection.pinned.dossierId}>Exact frozen Dossier →</Link>:null}
          {projection.pinned?<Link href={"/hybrid-output/prepare?edition="+projection.pinned.editionId}>Source-locked full prep →</Link>:null}
        </div>
      </header>
      <section className={ui.panel} aria-label="Edition proof">
        <p className={desk.kicker}>{projection.status==="READY"?"SOURCE ED﻿ITION PINNED":"SOURCE ED﻿ITION UNAVAILABLE"}</p>
        <h2>{projection.status==="READY"?"Research provenance":"Cannot prepare editorial safely"}</h2>
        {projection.pinned?<p>Edition: <code>{projection.pinned.editionId}</code>
          {" · "}Dossier: <code>{projection.pinned.dossierId}</code>
          {" · "}Frozen source time: <time dateTime={projection.pinned.dossierAsOf}>{projection.pinned.dossierAsOf}</time>.</p>
          :<p>Missing or inconsistent exact edition and Dossier records. No current market assertions have been substituted.</p>}
      </section>
      <div className={ui.editorialGrid}>
      {lanes.lanes.map(lane=><section key={lane.kind} className={ui.editorialLane} aria-label={lane.kind+" editorial assessment"}>
        <div className={ui.laneTop}>
          <div>
            <p className={desk.kicker}>{lane.kind==="COTD"?"CHART OF THE DAY · 600–800 WORDS":"OPENING BELL · MULTI-ANGLE OUTLOOK"}</p>
            <h2>{lane.kind==="COTD"?"One catalyst, one market question":"The broader market argument"}</h2>
          </div>
          <span className={ui.laneState}>{lane.state==="SOURCE_PACK_AVAILABLE"?"SOURCE PACK AVAILABLE":"RESEARCH REQUIRED"}</span>
        </div>
        <h3>{lane.headline||"No vetted article headline for this edition"}</h3>
        <p>Source date: {lane.sourceAsOf||"unavailable"}</p>
        <section className={ui.sampleRead} aria-label={lane.kind+" evidence-backed read-aloud passages"}>
          <p className={desk.kicker}>PREVIEW OF ADMITTED SOURCE MATERIAL · NOT FINAL COPY</p>
          {lane.snippets.length?lane.snippets.map((section,index)=><article key={index}>
            <h4>{section.label}</h4>
            <p>{section.text}</p>
            <small>{section.sourceUrl
              ? <a href={section.sourceUrl} target="_blank" rel="noreferrer">{section.sourceName} · Original report ↗</a>
              :section.basis+" · Frozen context only"}</small>
          </article>):<p>No evidence-backed excerpt can be admitted from this selected edition.</p>}
        </section>
        <h4>LY writing and evidence QC</h4>
        <ul className={ui.checkList}>{lane.checks.map(c=><li key={c.name}>
          <span className={c.pass?ui.passed:ui.missing}>{c.pass?"PASS":"NEEDS WORK"}</span>
          <div><strong>{c.name}</strong><small>{c.reason}</small></div>
        </li>)}</ul>
        <details className={ui.editorialGaps}>
          <summary>Remaining work before an editor can approve {lane.kind}</summary>
          <ul>{lane.unresolved.map((item,i)=><li key={i}>{item}</li>)}</ul>
        </details>
        <PresenterEditorialDraftEditor kind={lane.kind}/>
        <p className={ui.noPublish}>NOT CLEARED FOR PUBLICATION · No article has been sent, saved or marked approved.</p>
      </section>)}
      </div>
    </div>
  </main>;
}
