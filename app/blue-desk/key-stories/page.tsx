import Link from "next/link";
import { headers } from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { getCurrentVerifiedMarketMotion } from "@/lib/market-motion";
import { selectVerifiedNewsBriefs } from "@/lib/market-brief-news";
import { projectLivingMarketTopics } from "@/lib/blue-desk-living-topics";
import { listPublishedReports } from "@/lib/editorial-publications-server";
import desk from "../blue-desk.module.css";
import ui from "./key-stories.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Current Market Themes | Bluebelly",
  description: "Rolling source-verified market developments grouped into live research topics.",
};

export default async function KeyStories(){
  const now = new Date();
  const host = (await headers()).get("host");
  const [raw, reviewed] = await Promise.all([
    getCurrentVerifiedMarketMotion({ limit: 36 }).catch(() => []),
    listPublishedReports(6).catch(() => []),
  ]);
  const news = selectVerifiedNewsBriefs(raw, now, 18);
  const topics = projectLivingMarketTopics(news);
  return <main className={desk.page} data-bluebelly-stories="expanded"
    data-living-topics="dossier-independent">
    <BlueDeskHeader activePath="/blue-desk/key-stories" />
    <div className={desk.content}>
      <header className={ui.intro}>
        <p className={desk.kicker}>STORY DESK / ROLLING MARKET TOPICS</p>
        <h1>What is changing in the markets?</h1>
        <p>These research topics follow newly verified developments.
          They do not need a canonical Story update or Dossier snapshot
          before appearing. Each item links to its original reported fact,
          while the bigger explanation remains a question until assessed.</p>
        <p>Window: the latest 48 hours, not an all-time historical Story ledger.</p>
        <Link className={ui.returnLink}
          href={blueDeskPublicHref("/blue-desk/daily-report",host)}>
          Read the Daily Report
        </Link>
      </header>
      <div className={ui.summary}>
        <span>{topics.length} currently active topic{topics.length === 1 ? "" : "s"}</span>
        <span>{news.length} source-verified development{news.length === 1 ? "" : "s"}</span>
        <span>As of <DualTimestamp value={now.toISOString()} /></span>
      </div>
      <section className={ui.section} aria-labelledby="live-topics">
        <h2 id="live-topics">Live research topics</h2>
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
