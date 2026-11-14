import Link from "next/link";
import StoryStatusStrip from "./StoryStatusStrip";
import {Nov14ResearchTeaser} from "./Nov14MarketInvestigation";
import CurrentKeyStoriesShelf from "./CurrentKeyStoriesShelf";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import type {MotionOrderedStory} from "@/lib/blue-desk-thesis-ledger";
import desk from "@/app/blue-desk/blue-desk.module.css";
import ui from "./lean-watch.module.css";

function excerpt(value:string,max=220):string {
  if(value.length<=max)return value;
  const cut=value.slice(0,max).replace(/\s+\S*$/,"").trimEnd();
  return (cut||value.slice(0,max)).trimEnd()+"…";
}
function dateUTC(iso:string):string {
  const at=new Date(iso);
  return Number.isNaN(at.getTime())?"Date unavailable":at.toISOString().slice(0,10)+" UTC";
}
/** A compact projection of existing public Story memory.
 * Never creates a thesis, updates canonical evidence or claims a live signal.
 * The full, source-limited Story reader remains available through exact deep links.
 */
export default async function LeanWatch({stories,host,now}:{
  stories:readonly MotionOrderedStory[];host:string|null;now:Date;
}) {
  const root=blueDeskPublicHref("/blue-desk/key-stories",host);
  const cards=stories.map(story=><article className={ui.card} key={story.id} data-watch-story={story.slug}>
            <StoryStatusStrip status={story.status} slug={story.slug} updatedAt={story.updatedAt}/>
            <h3><Link href={root+"?story="+encodeURIComponent(story.slug)}>{story.title}</Link></h3>
            <p className={ui.next}><strong>Next test</strong><span>{story.nextTest?excerpt(story.nextTest,155):"No dated catalyst recorded"}</span></p>
            <div className={ui.cardFoot}>
              <Link href={root+"?story="+encodeURIComponent(story.slug)}>Read full thesis and source context</Link>
            </div>
            <details className={ui.details}>
              <summary>Evidence and counterargument · Original research</summary>
              <div>
                <p className={ui.question}>{excerpt(story.question,175)}</p>
                <p className={ui.view}><strong>Working view</strong>{excerpt(story.thesis,235)}</p>
                <p><strong>Supports</strong>{story.support||"No supporting evidence recorded in this snapshot."}</p>
                <p><strong>Challenges</strong>{story.contradiction||"No counter-evidence recorded in this snapshot."}</p>
                {story.confirmation?<p><strong>Confirmation</strong>{story.confirmation}</p>:null}
                {story.invalidation?<p><strong>Invalidation</strong>{story.invalidation}</p>:null}
              </div>
            </details>
            <div className={ui.receipt}>
              <small>{story.latestMotionAt?
                <>Linked {story.latestMotionVerification==="VERIFIED"?"verified event":"research lead"} · <time dateTime={story.latestMotionAt}>{dateUTC(story.latestMotionAt)}</time>. A linked event is not a thesis verdict.</>
                :"No new linked event displayed; this is a historical assessment."}</small>
            </div>
          </article>);
  return <main className={desk.page} data-bluebelly-watch="lean-readonly-v1">
    <BlueDeskHeader activePath="/blue-desk/key-stories"/>
    <div className={desk.content}>
      <header className={ui.hero} data-v7-watch-graphic="decorative-research-radar">
        <div className={ui.heroContent}>
          <p className={ui.eyebrow}>BLUEBELLY / RESEARCH WATCH · SOURCE-DATED</p>
        <h1>What is moving the market?</h1>
        <p>Start with current source-reviewed developments and their economic consequences. Historical theses remain below. These are dated research snapshots, not live trading signals.</p>
        <nav className={ui.shortcuts} aria-label="Related market tools">
          <Link href={blueDeskPublicHref("/blue-desk/markets",host)}>Check market moves</Link>
          <Link href={blueDeskPublicHref("/blue-desk/calendar",host)}>Upcoming catalysts</Link>
          <a href="#key-stories-current">Current Key Stories ↓</a>
        </nav>
        </div>
        <div className={ui.heroRadar} aria-hidden="true">
          <span className={ui.radarRing}><span className={ui.radarSweep} aria-hidden="true"/><span className={ui.radarCore}>B<span>B</span></span></span>
          <span className={ui.radarCaption}>THESIS / EVIDENCE / NEXT TEST</span>
        </div>
      </header>

      <Nov14ResearchTeaser host={host}/>
      <CurrentKeyStoriesShelf now={now} host={host}/>
      <section aria-labelledby="tracked-theses" className={ui.section}>
        <div className={ui.sectionHeading}>
          <div>
            <p className={ui.eyebrow}>HISTORICAL RESEARCH / EXISTING STORY MEMORY</p>
            <h2 id="tracked-theses">Market narratives</h2>
            <p className={ui.sectionNote}>Source-dated positions, not live verdicts. Open a question for its countercase and supporting evidence.</p>
          </div>
          <span className={ui.count}>{stories.length} shown</span>
        </div>
        {stories.length?<div data-key-stories-reading="three-leading-then-expand">
          <div className={ui.grid} data-key-stories-leading="recorded-research-not-news">
            {cards.slice(0,3)}
          </div>
          {cards.length>3?<details className={ui.moreStories} data-key-stories-more="collapsed-by-default">
            <summary>
              <span>MORE TRACKED QUESTIONS</span>
              <strong>{cards.length-3} additional Story{cards.length-3===1?"":"s"}</strong>
              <small>Same dated research records · Expand the list</small>
            </summary>
            <div className={ui.grid}>{cards.slice(3)}</div>
          </details>:null}
        </div>:<p className={ui.empty}>No approved public thesis snapshot is available. This is a coverage gap, not evidence that the market is quiet.</p>}
        <div className={ui.archiveLinks}>
          <Link href={root+"?category=All#persistent-theses"}>Browse complete historical Story library</Link>
          <Link href={blueDeskPublicHref("/blue-desk/research",host)}>Research archive</Link>
        </div>
      </section>
    </div>
  </main>;
}
