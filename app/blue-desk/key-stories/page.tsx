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
import { getPublicSourceObservations } from "@/lib/blue-desk-source-observations";
import { listPublishedReports } from "@/lib/editorial-publications-server";
import desk from "../blue-desk.module.css";
import ui from "./key-stories.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Persistent Market Theses | Bluebelly",
  description: "Dated long-lived market theses with recorded support, contradictions and next tests, separate from recent news.",
};

export default async function KeyStories(){
  const now = new Date();
  const host = (await headers()).get("host");
  const [raw, reviewed, theses, observations, originalPress] = await Promise.all([
    getCurrentVerifiedMarketMotion({ limit: 36 }).catch(() => []),
    listPublishedReports(6).catch(() => []),
    getPublicThesisLedger(now,9).catch(() => []),
    getPublicSourceObservations(now,8).catch(() => []),
    getOriginalPressNews(now,18).catch(() => []),
  ]);
  const motionNews = selectVerifiedNewsBriefs(raw, now, 18);
  const news = combineQualifiedNews(motionNews,originalPress,18);
  const topics = projectLivingMarketTopics(news);
  return <main className={desk.page} data-bluebelly-stories="expanded"
    data-living-topics="dossier-independent">
    <BlueDeskHeader activePath="/blue-desk/key-stories" />
    <div className={desk.content}>
      <header className={ui.intro}>
        <p className={desk.kicker}>STORY DESK / PERSISTENT THESIS LEDGER</p>
        <h1>What does the desk believe, and what would change its mind?</h1>
        <p>These are dated, continuing market theses read from the existing Story record.
          Their last amendment is not today's market verdict. New factual reports and source
          observations remain separate, and no new Dossier reasoning is performed here.</p>
        <p>Historical thesis updates are kept distinct from events observed in the latest 48 hours.</p>
        <Link className={ui.returnLink}
          href={blueDeskPublicHref("/blue-desk/daily-report",host)}>
          Read the Daily Report
        </Link>
      </header>
      <div className={ui.summary}>
        <span>{theses.length} persistent tracked theses</span>
        <span>{topics.length} current news topics</span>
        <span>{news.length} source-verified development{news.length === 1 ? "" : "s"}</span>
        <span>As of <DualTimestamp value={now.toISOString()} /></span>
      </div>
      <section className={ui.section} aria-labelledby="persistent-theses" data-persistent-thesis-ledger="source-identity">
        <h2 id="persistent-theses">Persistent market theses</h2>
        <p>Stored hypotheses and observations below were recorded on the dates shown.
          They are neither automatically reaffirmed today nor treated as new market news.
          The only valid Story IDs are the existing database identities.</p>
        {theses.length ? <div className={ui.cards}>{theses.map(thesis=>
          <article className={ui.card} id={"thesis-"+thesis.slug} key={thesis.id}>
            <p className={ui.kicker}>RECORDED {thesis.status.toUpperCase()} THESIS · LAST AMENDED <DualTimestamp value={thesis.updatedAt}/></p>
            <h3>{thesis.title}</h3>
            <p><strong>Market question:</strong> {thesis.question}</p>
            <p><strong>Recorded thesis:</strong> {thesis.thesis}</p>
            {thesis.pricedAssessment?<p><strong>Market assessment at last amendment:</strong> {thesis.pricedAssessment}</p>:null}
            <div className={ui.test}>
              <strong>Supporting evidence recorded in the thesis</strong>
              <p>{thesis.support||"No supporting summary was recorded."}</p>
              <strong>Strongest countercase recorded</strong>
              <p>{thesis.contradiction||"No countercase was recorded."}</p>
            </div>
            <div className={ui.test}>
              <strong>What would confirm the interpretation?</strong>
              <p>{thesis.confirmation||"Confirmation condition not recorded."}</p>
              <strong>What would invalidate it?</strong>
              <p>{thesis.invalidation||"Invalidation condition not recorded."}</p>
              <strong>Next test as recorded</strong>
              <p>{thesis.nextTest||"No next catalyst recorded."}</p>
            </div>
            <small>Thesis history only · Last amended <DualTimestamp value={thesis.updatedAt}/>. These stored statements are not reverified by this page.</small>
          </article>
        )}</div>:<p className={ui.empty}>No qualified ranked thesis identities were available.</p>}
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
      <section className={ui.section} aria-labelledby="research-history">
        <h2 id="research-history">Research history — approved articles</h2>
        <p>Reviewed articles are preserved by publication date.
          They can provide the prior explanation without becoming a fake
          fresh Story update.</p>
        {reviewed.length ? <div className={ui.cards}>{reviewed.map(report =>
          <article className={ui.card} key={report.id}>
            <p className={ui.kicker}>{report.kind === "OB" ? "OPENING BELL" : "CHART OF THE DAY"}</p>
            <h3>{report.title}</h3>
            <p>{report.excerpt}</p>
            <small>Published <DualTimestamp value={report.published_at} /></small>
            <Link href={blueDeskPublicHref("/blue-desk/reports/"+report.id,host)}>
              Read the approved analysis
            </Link>
          </article>)}</div> : <p className={ui.empty}>
            No owner-reviewed reports have been published yet.</p>}
        <p><Link href={blueDeskPublicHref("/blue-desk/reports",host)}>
          All COTD and Opening Bell reports
        </Link></p>
      </section>
    </div>
  </main>;
}
