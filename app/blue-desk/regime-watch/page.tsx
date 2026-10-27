import Link from "next/link";
import {headers} from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import EditorialStoryArt from "@/components/blue-desk/EditorialStoryArt";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import {getPublicThesisLedger} from "@/lib/blue-desk-thesis-ledger-server";
import {groupPublicResearch} from "@/lib/bluebelly-editorial-architecture";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import type {EditorialMotif} from "@/lib/bluebelly-editorial-visuals";
import desk from "../blue-desk.module.css";
import styles from "./regime-watch.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Regime Watch | Bluebelly",description:"Eight market-research lenses linked to historical public Story snapshots."};
export default async function RegimeWatchPage(){
 const now=new Date(),host=(await headers()).get("host");
 const theses=await getPublicThesisLedger(now,38).catch(()=>[]);
 const lenses=groupPublicResearch(theses);
 return <main className={desk.page} data-public-regime-watch="historical-story-research-no-verdict">
  <BlueDeskHeader activePath="/blue-desk/regime-watch"/>
  <div className={desk.content}>
   <header className={styles.intro}><span>ONGOING RESEARCH / NOT DAILY REPORTS</span>
    <h1>The market&apos;s bigger stories.</h1>
    <p>Eight persistent research questions. Public Story snapshots are historical working views; they are not today's regime-engine verdicts or automatic evidence upgrades.</p>
   </header>
   <div className={styles.heading}><h2>Regime board</h2><span>{theses.length} public Story snapshots · as of <DualTimestamp value={now.toISOString()}/></span></div>
   <div className={styles.cards}>{lenses.map(lens=><article id={lens.id} className={styles.card} key={lens.id}>
     <div className={styles.art}><EditorialStoryArt headline={lens.name} motif={lens.motif as EditorialMotif} compact/></div>
     <div className={styles.content}><span className={styles.kicker}>{lens.code} · RESEARCH LENS</span>
      <h3>{lens.name}</h3><p>{lens.question}</p>
      <div className={styles.coverage}>{lens.stories.length} associated public Story snapshot{lens.stories.length===1?"":"s"}</div>
      <details><summary>Open the working evidence and deciding tests</summary>
        <div className={styles.details}>
          <strong>What would settle the question?</strong><p>{lens.nextTest}</p>
          {lens.stories.length?<><strong>Existing public Story history</strong>
           {lens.stories.map(story=><div className={styles.related} key={story.id}>
              <Link href={blueDeskPublicHref("/blue-desk/key-stories",host)+"#thesis-"+story.slug}>{story.title}</Link>
              <small>Updated <DualTimestamp value={story.updatedAt}/></small>
              <p><strong>Recorded view:</strong> {story.thesis}</p>
              {story.contradiction?<p><strong>Countercase:</strong> {story.contradiction}</p>:null}
              {story.invalidation?<p><strong>Would challenge this:</strong> {story.invalidation}</p>:null}
            </div>)}
           </>:<p>No public Stories currently match this lens. This is not proof the regime is inactive.</p>}
          <p className={styles.boundary}>Working thematic association only. Canonical Regime changes still require admitted source evidence and the existing decision path.</p>
        </div>
      </details>
     </div>
   </article>)}</div>
   <section className={styles.transmission}><h2>Cross-regime transmission</h2>
    <p>Questions can overlap without sharing an automatic verdict. Follow the mechanism, then check dated observations.</p>
    <div className={styles.pathGrid}>{[
     ["FED → DURATION → CREDIT","Lower policy rates do not necessarily mean cheaper long-term borrowing."],
     ["AI ADOPTION → FINANCING","Growing model usage does not automatically create sufficient free cash flow."],
     ["ENERGY → PRICES → RATES","Crude prices cannot stand in for delivered diesel, LNG or transport costs."],
     ["JAPAN → FUNDING → EQUITIES","Yen funding repricing could transmit across borders; evidence is still needed."]
    ].map(([label,copy])=><div className={styles.path} key={label}><span>{label}</span><strong>{copy}</strong></div>)}</div>
   </section>
  </div>
 </main>;
}
