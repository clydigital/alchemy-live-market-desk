import Link from "next/link";
import { headers } from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { getLiveDeskHomepageDailyBrief } from "@/lib/hybrid-publication";
import { projectFrozenTrackedStories } from "@/lib/blue-desk-tracked-stories";
import { getTrackedOriginalSources } from "@/lib/blue-desk-tracked-evidence";
import { projectMarketBriefArticles } from "@/lib/market-brief-articles";
import { loadEditorialMarketBrief } from "@/lib/market-brief-editorial-data";
import desk from "../blue-desk.module.css";
import ui from "./key-stories.module.css";

export const dynamic="force-dynamic";
export const metadata={
  title:"Key Stories and Tracked Themes | Bluebelly",
  description:"Published market analysis and historical Story threads with their dated next tests.",
};
export default async function KeyStories(){
  const host=(await headers()).get("host");
  const edition=await getLiveDeskHomepageDailyBrief({fresh:true}).catch(()=>null);
  const tracker=projectFrozenTrackedStories(edition);
  const originalSources=await getTrackedOriginalSources(tracker);
  const brief=await loadEditorialMarketBrief(projectMarketBriefArticles(edition));
  const published=brief.articles.filter(a=>a.editorial.readiness!=="RESEARCH_ONLY").slice(0,8);
  const articleHref=(id:string,ed:string)=>blueDeskPublicHref(
    "/blue-desk/stories/"+encodeURIComponent(id)+"?edition="+encodeURIComponent(ed),host,
  );
  return <main className={desk.page} data-bluebelly-stories="expanded">
    <BlueDeskHeader activePath="/key-stories"/>
    <div className={desk.content}>
      <header className={ui.intro}>
        <p className={desk.kicker}>STORY DESK / PUBLISHED AND MONITORED</p>
        <h1>Market stories worth following</h1>
        <p>New publications and ongoing market questions are different things.
          The first section contains evidence-admitted analysis. The second
          preserves dated Story threads from the frozen Dossier, even when
          no new change has passed research review. A carried-forward thesis is
          not breaking news, an updated verdict, or a measured market move.</p>
        <Link className={ui.returnLink} href={blueDeskPublicHref("/blue-desk",host)}>← Live Market</Link>
      </header>
      <div className={ui.summary}>
        <span>{published.length} available analyses</span>
        <span>{tracker?.tracks.length||0} carried-forward Story threads</span>
        <span>{tracker?.currentAcceptedStoryCount??0} new accepted Story record(s) in this edition</span>
        <span>Edition published: {tracker?.publishedAt||"Unavailable"}</span>
        <span>Dossier context as of: {tracker?.dossierAsOf||"Unavailable"}</span>
      </div>
      <section className={ui.section} aria-labelledby="published-head">
        <h2 id="published-head">Published analysis</h2>
        <p>These readings passed the existing article and source-admission checks
          for this exact edition. Source facts do not prove their entire proposed mechanism.</p>
        {published.length?<div className={ui.cards}>{published.map(a=>
          <article className={ui.card} key={a.articleId}>
            <p className={ui.kicker}>{a.category} · {a.editorial.readiness}</p>
            <h3>{a.title}</h3><p>{a.deck}</p>
            <small>Publication ID: {a.editionId}</small>
            <Link href={articleHref(a.articleId,a.editionId)}>Read the pinned analysis →</Link>
          </article>)}</div>:<p className={ui.empty}>No edition-verified article currently qualifies.
          The carried-forward questions below remain visible as historical monitoring context.</p>}
      </section>
      <section className={ui.section} id="ongoing-stories" aria-labelledby="tracked-head">
        <h2 id="tracked-head">Ongoing Story watch</h2>
        <p>These questions already existed in the frozen Dossier and have preserved
          Story/version IDs. Each is explicitly marked as having <strong>no accepted material change</strong>
          in this edition. Its next test is a research target, not an observation that has occurred.
          Source-reference counts are metadata and do not establish fresh verification.</p>
        {tracker?.tracks.length?<div className={ui.cards}>{tracker.tracks.map((t,i)=>
          <article className={ui.card} id={"story-"+t.storyId} key={t.storyId}>
            <p className={ui.kicker}>THREAD {String(i+1).padStart(2,"0")} · FROZEN STORY CONTEXT</p>
            <h3>{t.question}</h3>
            <p>No new accepted Story change. Do not interpret this question as a verified
              present-day market condition.</p>
            <div className={ui.test}>
              <strong>What we would check next</strong>
              <p>{t.nextTest||"No explicit next test recorded in the source edition."}</p>
            </div>
            <small>Last attention assessment: {t.assessedAt||"Date unavailable"}</small>
            <div className={ui.test}>
              <strong>Original sources available by the frozen Dossier date</strong>
              {originalSources.get(t.storyId)?.length ?
                originalSources.get(t.storyId)!.map(source=>
                  <div key={source.evidenceId}>
                    <a href={source.sourceUrl} rel="noopener noreferrer" target="_blank">
                      {source.sourceName} · original primary source ↗
                    </a>
                    <small>Evidence available: {source.availableAt}</small>
                  </div>) :
                <p>No first-tier original-source facts qualified for this thread
                  under the publication-time checks. Its question is historical context,
                  not a fresh factual market report.</p>}
            </div>
            <small>{t.evidenceReferenceCount} canonical Evidence reference(s) in original Dossier;
              only dated, source-qualified links are displayed above</small>
            <small>Frozen Story ID: {t.storyId}</small>
            <small>Thesis version: {t.thesisVersionId}</small>
          </article>)}</div>:<p className={ui.empty}>No admissible carried-forward
          Story threads in this exact publication. This is a coverage gap, not proof that
          major market themes have disappeared.</p>}
      </section>
    </div>
  </main>;
}
