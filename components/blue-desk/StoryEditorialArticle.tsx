import Link from "next/link";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { storyMarketTransmission, type PublicThesis } from "@/lib/blue-desk-thesis-ledger";
import { classifyPublicStory } from "@/lib/blue-desk-story-categories";
import ui from "./StoryEditorialArticle.module.css";

type Props={story:PublicThesis;backHref:string};

/**
 * Existing public-thesis fields permit an explanatory reader, NOT a verified
 * chronological news reconstruction. No source IDs, events or price observations
 * are invented to fill that gap. Event chronology is a separate evidence contract.
 */
export default function StoryEditorialArticle({story,backHref}:Props){
 const category=classifyPublicStory(story);
 return <article className={ui.reader} data-story-article="research-context" data-story-id={story.id}>
   <nav className={ui.back} aria-label="Story breadcrumbs">
     <Link href={backHref}>Key Stories</Link><span aria-hidden="true">/</span><span>{category}</span>
   </nav>
   <header className={ui.header}>
     <p className={ui.eyebrow}>{category} · RECORDED MARKET THESIS</p>
     <h1>{story.title}</h1>
     <p className={ui.deck}>{story.question}</p>
     <div className={ui.meta}>
       <span>Last researched <DualTimestamp value={story.updatedAt}/></span>
       <span>Research status: {story.status}</span>
     </div>
     <p className={ui.disclosure}>This is a dated analysis of an ongoing market question, not a verified report of new events, current prices or an automatically accepted Story revision.</p>
   </header>
   <div className={ui.layout}>
     <div className={ui.body}>
       <section aria-labelledby="story-setup" className={ui.chapter}>
         <p className={ui.eyebrow}>01 · THE SETUP</p>
         <h2 id="story-setup">What investors were trying to understand</h2>
         <p>{story.question}</p>
         <p className={ui.note}>The available public Story record does not carry an independently sourced event-by-event chronology. An exact sequence cannot be reconstructed from its latest thesis text alone.</p>
       </section>
       <section aria-labelledby="story-thesis" className={ui.chapter}>
         <p className={ui.eyebrow}>02 · THE ARGUMENT</p>
         <h2 id="story-thesis">Why this became a market question</h2>
         <p>{story.thesis}</p>
         {story.support?<p><strong>What the recorded research cited:</strong> {story.support}</p>:null}
       </section>
       <section aria-labelledby="story-mechanism" className={ui.chapter}>
         <p className={ui.eyebrow}>03 · FOLLOW THE MONEY</p>
         <h2 id="story-mechanism">How the mechanism could work</h2>
         <p>{storyMarketTransmission(story)}</p>
         <p className={ui.note}>This is a conditional explanation of market transmission. A matched, source-dated price reaction would need separate evidence.</p>
         {story.pricedAssessment?<p><strong>Researcher's recorded pricing assessment:</strong> {story.pricedAssessment}</p>:null}
       </section>
       <section aria-labelledby="story-catch" className={ui.chapter}>
         <p className={ui.eyebrow}>04 · THE CATCH</p>
         <h2 id="story-catch">What could undermine the argument</h2>
         {story.contradiction?<p>{story.contradiction}</p>:<p className={ui.note}>No recorded counter-evidence was included in this public snapshot. That does not mean the argument is uncontested.</p>}
       </section>
       <section aria-labelledby="story-decision" className={ui.chapter}>
         <p className={ui.eyebrow}>05 · THE DECIDING TEST</p>
         <h2 id="story-decision">What we would need to see next</h2>
         {story.nextTest?<p>{story.nextTest}</p>:<p>The next independent observation is not specified in this Story record.</p>}
         <div className={ui.tests}>
           <div><h3>Would strengthen the case</h3><p>{story.confirmation||"No source-defined confirmation trigger has been recorded."}</p></div>
           <div><h3>Would challenge the case</h3><p>{story.invalidation||"No source-defined invalidation trigger has been recorded."}</p></div>
         </div>
       </section>
       <footer className={ui.foot}>
         <h2>Evidence and historical limits</h2>
         <p>This public research projection contains the Story identity, latest thesis, assessments and tests but no independent per-claim original-source ledger or immutable timeline. It must not be presented as a complete history, current market reaction, or published news article.</p>
         <Link href={backHref}>Back to categorised Stories</Link>
       </footer>
     </div>
     <aside className={ui.side}>
       <h2>At a glance</h2>
       <p><strong>Market question</strong>{story.question}</p>
       <p><strong>Last recorded</strong><DualTimestamp value={story.updatedAt}/></p>
       <p><strong>Publication status</strong>Research interpretation; not independently verified live event</p>
     </aside>
   </div>
 </article>;
}
