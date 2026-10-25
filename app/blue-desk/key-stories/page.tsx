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
  const [raw, theses, observations, originalPress] = await Promise.all([
    getCurrentVerifiedMarketMotion({ limit: 36 }).catch(() => []),
    getPublicThesisLedger(now,24).catch(() => []),
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
        <h1>What is driving the markets, and what happens next?</h1>
        <p>Oil supply, expensive borrowing, the AI spending boom and weaker consumer demand
          all feed into markets in different ways. Follow each ongoing story here:
          what has happened, how it could affect prices, and what evidence would make us rethink it.</p>
        <p>These are continuing research stories. New events and verified price observations
          keep their own dates, so older analysis never masquerades as today's news.</p>
        <Link className={ui.returnLink}
          href={blueDeskPublicHref("/blue-desk/daily-report",host)}>
          Read the Daily Report
        </Link>
      </header>
      <div className={ui.summary}>
        <span>{theses.length} ongoing market stories</span>
        <span>{topics.length} fresh news themes</span>
        <span>{news.length} source-verified development{news.length === 1 ? "" : "s"}</span>
        <span>As of <DualTimestamp value={now.toISOString()} /></span>
      </div>
      <section className={ui.section} aria-labelledby="persistent-theses" data-persistent-thesis-ledger="source-identity">
        <h2 id="persistent-theses">The stories behind the market</h2>
        <p>Today's price action makes more sense when you know the longer-running issues.
          These stories keep that context in one place, even on days without a new verified headline.
          Each explanation is based on its last recorded assessment, not a fresh call on prices.</p>
        {theses.length ? <div className={ui.cards}>{theses.map(thesis=>
          <article className={ui.card} id={"thesis-"+thesis.slug} key={thesis.id} data-stored-story={thesis.status}>
            <p className={ui.kicker}>{thesis.status==="develop"?"STILL BEING INVESTIGATED":"ONGOING MARKET STORY"}
              {" · "}Last updated <DualTimestamp value={thesis.updatedAt}/></p>
            <h3>{thesis.title}</h3>
            <p className={ui.storyIntro}><strong>Here's the issue.</strong> {thesis.thesis}</p>
            <p className={ui.storyExplanation}><strong>Why it could move markets.</strong> {storyMarketTransmission(thesis)}</p>
            {thesis.support ? <p className={ui.storyContext}><strong>What supports this view:</strong> {thesis.support}</p> : null}
            {thesis.contradiction ? <p className={ui.storyContext}><strong>The catch:</strong> {thesis.contradiction}</p> : null}
            {(thesis.confirmation||thesis.invalidation||thesis.nextTest)?<details className={ui.more}>
              <summary>What would change the story?</summary>
              {thesis.confirmation?<p><strong>Confirmation:</strong> {thesis.confirmation}</p>:null}
              {thesis.invalidation?<p><strong>Invalidation:</strong> {thesis.invalidation}</p>:null}
              {thesis.nextTest?<p><strong>Next catalyst:</strong> {thesis.nextTest}</p>:null}
            </details>:null}
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
