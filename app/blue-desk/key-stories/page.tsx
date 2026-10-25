import Link from "next/link";
import { headers } from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { getCurrentVerifiedMarketMotion } from "@/lib/market-motion";
import { selectVerifiedNewsBriefs } from "@/lib/market-brief-news";
import { getOriginalPressNews } from "@/lib/blue-desk-original-press-news-server";
import { combineQualifiedNews } from "@/lib/blue-desk-qualified-news";
import { projectLivingMarketTopics } from "@/lib/blue-desk-living-topics";
import { getPublicThesisLedger } from "@/lib/blue-desk-thesis-ledger-server";
import {storyMarketTransmission} from "@/lib/blue-desk-thesis-ledger";
import { getPublicSourceObservations } from "@/lib/blue-desk-source-observations";
import { getLatestPublishedDailyReport, listPublishedReports } from "@/lib/editorial-publications-server";
import { approvedEditorialLead } from "@/lib/blue-desk-editorial-preview";
import desk from "../blue-desk.module.css";
import ui from "./key-stories.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Daily Analysis and Key Market Stories | Bluebelly",
  description: "Latest approved Daily Report, COTD and Opening Bell analysis, with dated market stories and sources.",
};

export default async function KeyStories(){
  const now = new Date();
  const host = (await headers()).get("host");
  const [raw, theses, observations, originalPress, publishedDaily, editorials] = await Promise.all([
    getCurrentVerifiedMarketMotion({ limit: 36 }).catch(() => []),
    getPublicThesisLedger(now,24).catch(() => []),
    getPublicSourceObservations(now,8).catch(() => []),
    getOriginalPressNews(now,18).catch(() => []),
    getLatestPublishedDailyReport().catch(() => null),
    listPublishedReports(4).catch(() => []),
  ]);
  const motionNews = selectVerifiedNewsBriefs(raw, now, 18);
  const news = combineQualifiedNews(motionNews,originalPress,18);
  const topics = projectLivingMarketTopics(news);
  return <main className={desk.page} data-bluebelly-stories="editorial-first"
    data-living-topics="dossier-independent">
    <BlueDeskHeader activePath="/blue-desk/key-stories" />
    <div className={desk.content}>
      <header className={ui.intro}>
        <p className={desk.kicker}>EDITORIAL DESK / MARKET CONTEXT</p>
        <h1>Read the analysis. Then investigate the story.</h1>
        <p>Start with the approved Daily Report and the latest Chart of the Day or Opening Bell angle.
          The ongoing Stories below provide context, not a replacement for a dated, explained market view.</p>
        <p>Editorial editions remain fixed at publication. Ongoing Story hypotheses and verified market
          observations retain their own dates and should not be mistaken for new trading calls.</p>
        <Link className={ui.returnLink}
          href={blueDeskPublicHref("/blue-desk/daily-report",host)}>
          Open the full Daily Report
        </Link>
      </header>
      <div className={ui.summary}>
        <span>{theses.length} ongoing market stories</span>
        <span>{topics.length} fresh news themes</span>
        <span>{news.length} source-verified development{news.length === 1 ? "" : "s"}</span>
        <span>As of <DualTimestamp value={now.toISOString()} /></span>
      </div>
      <section className={ui.section} aria-labelledby="editorial-priority" data-editorial-priority="published-only">
        <h2 id="editorial-priority">Start with the finished market analysis</h2>
        <p>Only separately approved articles appear here. Headlines, explanations and publication dates
          come from their frozen editorial editions, not from automatic Story expansion.</p>
        <div className={ui.editorialGrid}>
          <article className={ui.editorialFeature}>
            <span className={ui.kicker}>DAILY REPORT / EDITOR-APPROVED</span>
            {publishedDaily ? <>
              <h3>{publishedDaily.title}</h3>
              <p className={ui.editorialMeta}>Published <DualTimestamp value={publishedDaily.published_at}/></p>
              <p className={ui.editorialLead}>{approvedEditorialLead(publishedDaily.body)}</p>
              <div className={ui.editorialActions}>
                <Link href={blueDeskPublicHref("/blue-desk/daily-report",host)}>Read the full Daily Report</Link>
                <Link href={blueDeskPublicHref("/blue-desk/reports/"+publishedDaily.id+"/pdf",host)}
                  target="_blank" rel="noopener noreferrer">Open approved PDF</Link>
              </div>
            </>:<>
              <h3>No reviewed Daily Report published yet</h3>
              <p>The rolling source-based Daily Report remains available below the publication layer,
                but it is not represented as an approved edition.</p>
              <Link href={blueDeskPublicHref("/blue-desk/daily-report",host)}>Read rolling desk context</Link>
            </>}
          </article>
          <div className={ui.editorialSide}>
            <h3>Latest COTD / Opening Bell angles</h3>
            {editorials.length ? editorials.map(report=>
              <article className={ui.editorialAngle} key={report.id}>
                <p className={ui.kicker}>{report.kind==="OB"?"OPENING BELL":"CHART OF THE DAY"} · APPROVED EDITION</p>
                <h4>{report.title}</h4>
                <p className={ui.editorialMeta}>Published <DualTimestamp value={report.published_at}/></p>
                <p>{approvedEditorialLead(report.body,400)}</p>
                <div className={ui.editorialActions}>
                  <Link href={blueDeskPublicHref("/blue-desk/reports/"+report.id,host)}>Read the explanation</Link>
                  <Link href={blueDeskPublicHref("/blue-desk/reports/"+report.id+"/pdf",host)}
                    target="_blank" rel="noopener noreferrer">PDF</Link>
                </div>
              </article>
            ) : <p className={ui.empty}>No approved COTD or Opening Bell articles yet.
              Unreviewed angle ideas stay in the private writing studio.</p>}
            <Link className={ui.returnLink} href={blueDeskPublicHref("/blue-desk/reports",host)}>
              Browse approved COTD / OB reports
            </Link>
          </div>
        </div>
      </section>
      <section className={ui.section} aria-labelledby="persistent-theses" data-persistent-thesis-ledger="source-identity">
        <h2 id="persistent-theses">Story context, not another article</h2>
        <p>The shorter Story cards preserve earlier theses and contradictions. For an actionable
          interpretation, use the dated Daily Report and COTD / OB articles above.</p>
        {theses.length ? <div className={ui.cards}>{theses.map(thesis=>
          <article className={ui.card} id={"thesis-"+thesis.slug} key={thesis.id} data-stored-story={thesis.status}>
            <p className={ui.kicker}>{thesis.status==="develop"?"STILL BEING INVESTIGATED":"ONGOING MARKET STORY"}
              {" · "}Last updated <DualTimestamp value={thesis.updatedAt}/></p>
            <h3>{thesis.title}</h3>
            <p className={ui.storyIntro}><strong>Here's the issue.</strong> {thesis.thesis}</p>
            <p className={ui.storyExplanation}><strong>Why it could move markets.</strong> {storyMarketTransmission(thesis)}</p>
            {thesis.support ? <p className={ui.storyContext}><strong>What supports this view:</strong> {thesis.support}</p> : null}
            {thesis.contradiction ? <p className={ui.storyContext}><strong>The catch:</strong> {thesis.contradiction}</p> : null}
            {(thesis.confirmation||thesis.invalidation||thesis.nextTest)?<div className={ui.storyTests}>
              {thesis.confirmation?<p><strong>Confirmation:</strong> {thesis.confirmation}</p>:null}
              {thesis.invalidation?<p><strong>What would disprove it:</strong> {thesis.invalidation}</p>:null}
              {thesis.nextTest?<p><strong>Next thing to check:</strong> {thesis.nextTest}</p>:null}
            </div>:null}
            <p className={ui.timeNote}>Historical research snapshot, not an independently confirmed price reaction.
              {" "}The latest market observations are shown separately below.</p>
          </article>
        )}</div>:<p className={ui.empty}>We couldn't load the stored market stories.
          That is a coverage problem, not evidence that there is nothing happening.</p>}
      </section>
      <section className={ui.section} aria-labelledby="recent-originals">
        <h2 id="recent-originals">Latest original-source market observations</h2>
        <p>Exact dated measurements or official releases only. A market close does not explain its own cause,
          and an old observation does not become new because it was retrieved again.</p>
        {observations.length?<div className={ui.cards}>{observations.map(item=>
          <article className={ui.card} key={item.id}>
            <p className={ui.kicker}>{item.kind==="MARKET_OBSERVATION"?"LAST COMPLETED MARKET OBSERVATION":"ORIGINAL RELEASE"}</p>
            <p>{item.description}</p>
            <small>Event time <DualTimestamp value={item.eventAt}/></small>
            <a href={item.sourceUrl} rel="noopener noreferrer" target="_blank">{item.sourceName} · original source</a>
          </article>
        )}</div>:<p className={ui.empty}>No qualifying recent original-source measurements. This is not evidence of an inactive market.</p>}
      </section>
      <section className={ui.section} aria-labelledby="live-topics">
        <h2 id="live-topics">Topics from current verified News</h2>
        <p>Topics are grouped from verified news text for navigation only.
          That classification does not establish market impact, a trading signal
          or agreement with an older thesis. No stale Story is presented as new.</p>
        {topics.length ? <div className={ui.cards}>{topics.map(topic =>
          <article className={ui.card} id={topic.id} key={topic.id}>
            <p className={ui.kicker}>CURRENT TOPIC · {topic.updates.length} UPDATE{topic.updates.length===1?"":"S"}</p>
            <h3>{topic.title}</h3>
            <p><strong>Question to investigate:</strong> {topic.guidingQuestion}</p>
            <small>Latest event: <DualTimestamp value={topic.latestObservedAt} /></small>
            <div className={ui.test}>
              <strong>What has been verified?</strong>
              {topic.updates.map(item => <div key={item.id}>
                <p>{item.headline}</p>
                <p>{item.summary}</p>
                <small>Event: <DualTimestamp value={item.occurredAt} /></small>
                <a href={item.sourceUrl} rel="noopener noreferrer" target="_blank">
                  {item.sourceName} · original report
                </a>
              </div>)}
            </div>
            <div className={ui.test}>
              <strong>What still needs testing?</strong>
              <p>Find dated market observations, the expected response,
                each causal transmission step, the best opposing explanation
                and the next economic or issuer release that distinguishes them.</p>
            </div>
          </article>)}</div> :
          <p className={ui.empty}>No source-verified topics were admitted during
            the last 48 hours. This is a research-coverage state, not evidence
            that the market is inactive.</p>}
      </section>
    </div>
  </main>;
}
