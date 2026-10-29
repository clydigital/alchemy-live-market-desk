import Link from "next/link";
import EditorialStoryArt from "./EditorialStoryArt";
import DualTimestamp from "./DualTimestamp";
import type {NewsBriefV1} from "@/lib/market-brief-news";
import type {PublicStoryDepth} from "@/lib/bluebelly-key-story-depth";
import styles from "./KeyStoryDeepArticle.module.css";

export default function KeyStoryDeepArticle({
  receipt, depth, backHref, relatedHref,
}:{
  receipt:NewsBriefV1; depth:PublicStoryDepth; backHref:string; relatedHref:string;
}){
 return <article className={styles.article} data-key-story-depth="source-verified-analysis" data-version="key-story-evidence-v1">
   <nav className={styles.back}><Link href={backHref}>← Return to Key Stories</Link></nav>
   <header className={styles.hero}>
     <div>
       <p className={styles.kicker}>KEY STORY / {depth.topic.toUpperCase()}</p>
       <p className={styles.edition}>Original event <DualTimestamp value={receipt.occurredAt}/> · Editorial {depth.edition}</p>
       <h1>{depth.title}</h1>
       <p className={styles.lead}>{depth.hook}</p>
       <p>{depth.lead}</p>
     </div>
     <div className={styles.art}><EditorialStoryArt headline={receipt.headline} summary={depth.hook}/></div>
   </header>
   <nav className={styles.toc} aria-label="Article chapters">
     <a href="#context">The setup</a>
     <a href="#receipts">Numbers</a>
     <a href="#change">What changed</a>
     <a href="#transmission">Why it matters</a>
     <a href="#risk">The objection</a>
     <a href="#ahead">What next</a>
   </nav>
   <div className={styles.columns}>
     <div className={styles.reader}>
       <section id="context" className={styles.section}>
         <p className={styles.kicker}>THE SETUP / REWIND BEFORE THE HEADLINE</p>
         <h2>What was the market expecting before the Fed spoke?</h2>
         {depth.chronology.map((line,i)=><p key={i}>{line}</p>)}
       </section>
       <section id="receipts" className={styles.section}>
         <p className={styles.kicker}>THE RECEIPTS / BEFORE · EXPECTED · ACTUAL</p>
         <h2>Six measurements tell a different story from “the Fed held”.</h2>
         <p>Comparison bases are not interchangeable. The policy expectation is a reported probability; the yield figures are dated end-of-day observations, not an isolated reaction to the statement.</p>
         <div className={styles.tableScroll} role="region" tabIndex={0} aria-label="Previous, expected and actual FOMC evidence">
          <table className={styles.table}><thead><tr>
            <th scope="col">Metric</th><th scope="col">Previous</th>
            <th scope="col">Expectation / baseline</th><th scope="col">Actual</th><th scope="col">The difference</th>
          </tr></thead><tbody>
            {depth.numbers.map(m=><tr key={m.label}>
              <th scope="row">{m.label}</th><td>{m.baseline}</td><td>{m.expected}</td>
              <td><strong>{m.observed}</strong></td><td>{m.change}<small>{m.basis}</small>
              <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer">{m.sourceName} ↗</a></td>
            </tr>)}
          </tbody></table>
         </div>
       </section>
       <section id="change" className={styles.section}>
         <p className={styles.kicker}>WHAT REALLY HAPPENED</p>
         <h2>The vote reveals more than the unchanged rate.</h2>
         {depth.whatChanged.map((p,i)=><p key={i}>{p}</p>)}
         <p className={styles.primary}><strong>Original release:</strong> <a target="_blank" rel="noopener noreferrer" href={receipt.sourceUrl}>{receipt.sourceName} · original statement ↗</a></p>
       </section>
       <section id="transmission" className={styles.section}>
         <p className={styles.kicker}>FOLLOW THE MONEY / MARKET TRANSMISSION</p>
         <h2>Why might the yield curve steepen after a hold?</h2>
         {depth.explanation.map((p,i)=><p key={i}>{p}</p>)}
         <h3>What the market tape actually shows</h3>
         {depth.marketTape.map((p,i)=><p key={i}>{p}</p>)}
       </section>
       <section id="risk" className={styles.section}>
         <p className={styles.kicker}>THE SCEPTICAL INVESTOR</p>
         <h2>What else could explain the moves?</h2>
         {depth.countercase.map((p,i)=><p key={i}>{p}</p>)}
       </section>
       <section id="ahead" className={styles.section}>
         <p className={styles.kicker}>WHAT WOULD CHANGE THE ASSESSMENT?</p>
         <h2>{depth.theQuestion}</h2>
         {depth.nextTests.map((p,i)=><p key={i}><strong>{i+1}. </strong>{p}</p>)}
         <div className={styles.gaps}>
          <h3>Measurements Bluebelly still lacks</h3>
          {depth.missing.map((p,i)=><p key={i}>{p}</p>)}
         </div>
         <p><Link href={relatedHref}>Read the related full-length FOMC narrative →</Link></p>
       </section>
       <footer className={styles.sources}>
         <h2>Evidence and source provenance</h2>
         <p>This is a dated editorial expansion of an existing source-qualified public receipt, not a new canonical Story verdict or an automatic rewrite of private Notion research. Original-source facts are separated from reported expectations and conditional interpretations.</p>
         {depth.sources.map(s=><a href={s.url} key={s.url} target="_blank" rel="noopener noreferrer"><strong>{s.label}</strong><span>{s.role} ↗</span></a>)}
       </footer>
     </div>
     <aside className={styles.rail} aria-label="Presenter's evidence guide">
       <div className={styles.railBox}><p className={styles.kicker}>SAY THIS FIRST</p>
         <h3>Hold ≠ no change</h3><p>The rate was unchanged. The dissent and growth wording made the implications different.</p></div>
       <div className={styles.railBox}><p className={styles.kicker}>THE THREE NUMBERS</p>
         <p><strong>3.75–4.00%</strong> Federal funds range</p>
         <p><strong>10–2</strong> FOMC vote</p>
         <p><strong>+6bp</strong> 10Y daily Treasury move</p>
         <small>Different data types and observation windows; none alone measures the surprise.</small>
       </div>
       <div className={styles.railBox}><p className={styles.kicker}>EVIDENCE STATUS</p>
         <p>Official Fed action: source confirmed</p><p>Pre-release pricing: Reuters-reported</p>
         <p>Daily yields: original Treasury</p><p>Event-window causality: unverified</p></div>
     </aside>
   </div>
 </article>;
}
