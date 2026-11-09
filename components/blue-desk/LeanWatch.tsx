import Link from "next/link";
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
function researchState(status:string):string {
  if(status==="publish")return "Published thesis";
  if(status==="monitor")return "Monitoring";
  return "Developing";
}

/** A compact projection of existing public Story memory.
 * Never creates a thesis, updates canonical evidence or claims a live signal.
 * The full, source-limited Story reader remains available through exact deep links.
 */
export default async function LeanWatch({stories,host}:{
  stories:readonly MotionOrderedStory[];host:string|null;
}) {
  const root=blueDeskPublicHref("/blue-desk/key-stories",host);
  return <main className={desk.page} data-bluebelly-watch="lean-readonly-v1">
    <BlueDeskHeader activePath="/blue-desk/key-stories"/>
    <div className={desk.content}>
      <header className={ui.hero} data-v7-watch-graphic="decorative-research-radar">
        <div className={ui.heroContent}>
          <p className={ui.eyebrow}>BLUEBELLY / RESEARCH WATCH · SOURCE-DATED</p>
        <h1>What is developing?</h1>
        <p>Selected market theses, the arguments for and against them, and the next event that could change the picture. These are dated research snapshots, not live trading signals.</p>
        <nav className={ui.shortcuts} aria-label="Related market tools">
          <Link href={blueDeskPublicHref("/blue-desk/markets",host)}>Check market moves</Link>
          <Link href={blueDeskPublicHref("/blue-desk/calendar",host)}>Upcoming catalysts</Link>
        </nav>
        </div>
        <div className={ui.heroRadar} aria-hidden="true">
          <span className={ui.radarRing}><span className={ui.radarCore}>B<span>B</span></span></span>
          <span className={ui.radarCaption}>THESIS / EVIDENCE / NEXT TEST</span>
        </div>
      </header>

      <section aria-labelledby="tracked-theses" className={ui.section}>
        <div className={ui.sectionHeading}>
          <div>
            <p className={ui.eyebrow}>TRACKED QUESTIONS / EXISTING STORY MEMORY</p>
            <h2 id="tracked-theses">Market narratives</h2>
          </div>
          <span className={ui.count}>{stories.length} shown</span>
        </div>
        {stories.length?<div className={ui.grid}>
          {stories.map(story=><article className={ui.card} key={story.id} data-watch-story={story.slug}>
            <div className={ui.cardMeta}>
              <span>{researchState(story.status)}</span>
              <span>Assessed <time dateTime={story.updatedAt}>{dateUTC(story.updatedAt)}</time></span>
            </div>
            <h3><Link href={root+"?story="+encodeURIComponent(story.slug)}>{story.title}</Link></h3>
            <p className={ui.question}>{excerpt(story.question,175)}</p>
            <p className={ui.view}><strong>Working view</strong>{excerpt(story.thesis,235)}</p>
            <p className={ui.next}><strong>Next test</strong>{story.nextTest?excerpt(story.nextTest,170):"No dated catalyst recorded"}</p>
            <details className={ui.details}>
              <summary>Evidence and counterargument</summary>
              <div>
                <p><strong>Supports</strong>{story.support||"No supporting evidence recorded in this snapshot."}</p>
                <p><strong>Challenges</strong>{story.contradiction||"No counter-evidence recorded in this snapshot."}</p>
                {story.confirmation?<p><strong>Confirmation</strong>{story.confirmation}</p>:null}
                {story.invalidation?<p><strong>Invalidation</strong>{story.invalidation}</p>:null}
              </div>
            </details>
            <div className={ui.cardFoot}>
              <small>{story.latestMotionAt?
                <>Linked {story.latestMotionVerification==="VERIFIED"?"verified event":"research lead"} · <time dateTime={story.latestMotionAt}>{dateUTC(story.latestMotionAt)}</time>. A linked event is not a thesis verdict.</>
                :"No new linked event displayed; this is a historical assessment."}</small>
              <Link href={root+"?story="+encodeURIComponent(story.slug)}>Read full thesis and source context</Link>
            </div>
          </article>)}
        </div>:<p className={ui.empty}>No approved public thesis snapshot is available. This is a coverage gap, not evidence that the market is quiet.</p>}
        <div className={ui.archiveLinks}>
          <Link href={root+"?category=All#persistent-theses"}>Browse complete historical Story library</Link>
          <Link href={blueDeskPublicHref("/blue-desk/research",host)}>Research archive</Link>
        </div>
      </section>
    </div>
  </main>;
}
