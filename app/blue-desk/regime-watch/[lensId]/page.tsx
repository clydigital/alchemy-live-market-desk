import Link from "next/link";
import {headers} from "next/headers";
import {notFound} from "next/navigation";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import EditorialStoryArt from "@/components/blue-desk/EditorialStoryArt";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import {getPublicThesisLedger} from "@/lib/blue-desk-thesis-ledger-server";
import {EDITORIAL_REGIME_LENSES,groupPublicResearch} from "@/lib/bluebelly-editorial-architecture";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import type {EditorialMotif} from "@/lib/bluebelly-editorial-visuals";
import desk from "../../blue-desk.module.css";
import styles from "./lens.module.css";

type Props={params:Promise<{lensId:string}>};
export const dynamic="force-dynamic";

export function generateStaticParams(){
 return EDITORIAL_REGIME_LENSES.map(lens=>({lensId:lens.id}));
}
export async function generateMetadata({params}:Props){
 const {lensId}=await params;
 const lens=EDITORIAL_REGIME_LENSES.find(item=>item.id===lensId);
 return {title:lens?lens.name+" | Regime Watch | Bluebelly":"Research Lens | Bluebelly",
  description:lens?.question||"Bluebelly's public thematic research lenses."};
}

export default async function ResearchLensPage({params}:Props){
 const {lensId}=await params;
 const definition=EDITORIAL_REGIME_LENSES.find(item=>item.id===lensId);
 if(!definition)notFound();
 const now=new Date(),host=(await headers()).get("host");
 const publicTheses=await getPublicThesisLedger(now,38).catch(()=>null);
 const lens=groupPublicResearch(publicTheses||[]).find(item=>item.id===lensId)!;
 const base=blueDeskPublicHref("/blue-desk/regime-watch",host);
 return <main className={desk.page} data-public-research-lens={lens.id} data-evidence-scope="public-historical-story-snapshots">
  <BlueDeskHeader activePath="/blue-desk/regime-watch"/>
  <div className={desk.content}>
   <nav className={styles.breadcrumb} aria-label="Research breadcrumb">
    <Link href={base}>Regime Watch</Link><span aria-hidden="true">/</span><span>{lens.name}</span>
   </nav>
   <header className={styles.hero}>
    <div className={styles.heroText}>
     <span className={styles.kicker}>{lens.code} · DEDICATED RESEARCH LENS</span>
     <h1>{lens.name}</h1>
     <p className={styles.question}>{lens.question}</p>
     <p className={styles.scope}>A persistent investigation, not a daily headline or a current directional call. Trace the stored argument, its countercase and the observations that could settle it.</p>
     <div className={styles.meta}>
      <span>{publicTheses===null?"Story read unavailable":lens.stories.length+" associated public Story snapshot"+(lens.stories.length===1?"":"s")}</span>
      <span>Viewed <DualTimestamp value={now.toISOString()}/></span>
     </div>
    </div>
    <div className={styles.heroArt}><EditorialStoryArt headline={lens.name} motif={lens.motif as EditorialMotif}/></div>
   </header>
   <div className={styles.layout}>
    <div className={styles.primary}>
     <section className={styles.section} aria-labelledby="lens-investigation">
      <span className={styles.kicker}>01 / THE INVESTIGATION</span>
      <h2 id="lens-investigation">What would settle this question?</h2>
      <p>We need observations that can distinguish the competing explanations, rather than another headline that merely repeats the theme.</p>
      <div className={styles.decision}><strong>Deciding evidence to seek</strong><p>{lens.nextTest}</p></div>
      <p className={styles.caveat}>This is a research checklist. A listed observation is not necessarily available, current or admitted as canonical evidence.</p>
     </section>
     <section className={styles.section} id="story-history" aria-labelledby="lens-story-history">
      <span className={styles.kicker}>02 / STORED RESEARCH</span>
      <h2 id="lens-story-history">The Story history behind this lens</h2>
      <p>These are up to six public Story snapshots associated by topic. Their recorded views and dates are preserved here so a newer headline does not silently rewrite an earlier argument.</p>
      {publicTheses===null?
       <div className={styles.empty}><strong>Public Story history could not be loaded.</strong><p>The research question remains available. No market conclusion is implied by this retrieval failure.</p></div>
      :lens.stories.length===0?
       <div className={styles.empty}><strong>No matching public Story snapshots yet.</strong><p>That does not mean the theme is inactive. The next evidence test remains open.</p></div>
      :<div className={styles.stories}>{lens.stories.map((story,index)=>
       <article className={styles.story} key={story.id} id={"story-"+story.slug}>
        <header className={styles.storyHead}>
         <span className={styles.kicker}>STORY {String(index+1).padStart(2,"0")} · RECORDED {story.status.toUpperCase()}</span>
         <h3>{story.title}</h3>
         <p className={styles.recorded}>Stored Story updated <DualTimestamp value={story.updatedAt}/></p>
        </header>
        <div className={styles.thesis}><strong>Recorded thesis</strong><p>{story.thesis}</p></div>
        <div className={styles.evidenceGrid}>
         <div><h4>What the snapshot cited in support</h4>
          <p>{story.support||"No supporting statement is present in the available public snapshot."}</p>
         </div>
         <div><h4>What could challenge the argument</h4>
          <p>{story.contradiction||"No competing statement is present in the available public snapshot."}</p>
         </div>
        </div>
        {story.pricedAssessment?<p className={styles.pricing}><strong>Recorded market-pricing interpretation:</strong> {story.pricedAssessment}</p>:null}
        <div className={styles.tests}>
         <h4>What to watch before changing the interpretation</h4>
         {story.confirmation?<p><strong>Would strengthen:</strong> {story.confirmation}</p>:null}
         {story.invalidation?<p><strong>Would weaken:</strong> {story.invalidation}</p>:null}
         {story.nextTest?<p><strong>Next recorded catalyst or test:</strong> {story.nextTest}</p>:null}
         {!story.confirmation&&!story.invalidation&&!story.nextTest?<p>Specific confirmation and invalidation tests are not in this public snapshot.</p>:null}
        </div>
       </article>)}</div>}
     </section>
    </div>
    <aside className={styles.sidebar} aria-label="Research navigation and limitations">
     <section className={styles.railCard}>
      <span className={styles.kicker}>HOW TO USE THIS PAGE</span>
      <h2>Read the argument, then test it.</h2>
      <p>Start with what the research claims. Compare the supporting and opposing cases. Then check the next measurable catalyst.</p>
      <Link href={blueDeskPublicHref("/blue-desk/key-stories",host)}>Browse the wider public Story library →</Link>
     </section>
     {lens.stories.length>0?<nav className={styles.railCard} aria-label="Stories in this research lens">
      <span className={styles.kicker}>JUMP TO A RECORDED STORY</span>
      {lens.stories.map(story=><a key={story.id} href={"#story-"+story.slug}>{story.title}</a>)}
     </nav>:null}
     <section className={styles.railCard}>
      <span className={styles.kicker}>EVIDENCE BOUNDARY</span>
      <h2>What this page cannot claim</h2>
      <p>Keyword-based Story associations are navigational only. Public snapshot text is not a fresh price observation, an original-source receipt or a new System 2 Regime verdict.</p>
      <p>Exact evidence admission, private technical readings and changes to the canonical thesis remain with their existing authorised systems.</p>
     </section>
    </aside>
   </div>
   <section className={styles.otherLenses} aria-labelledby="explore-related">
    <div className={styles.otherHead}><h2 id="explore-related">Explore another research lens</h2><Link href={base}>View all eight →</Link></div>
    <div className={styles.otherGrid}>{EDITORIAL_REGIME_LENSES.filter(item=>item.id!==lens.id).map(item=>
      <Link key={item.id} href={blueDeskPublicHref("/blue-desk/regime-watch/"+item.id,host)}>
       <span>{item.code}</span><strong>{item.name}</strong><span aria-hidden="true">→</span>
      </Link>)}</div>
   </section>
  </div>
 </main>;
}
