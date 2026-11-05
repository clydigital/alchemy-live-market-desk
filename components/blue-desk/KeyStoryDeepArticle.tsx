import Link from "next/link";
import StorySummaryBoxes from "./StorySummaryBoxes";
import EditorialStoryArt from "./EditorialStoryArt";
import DualTimestamp from "./DualTimestamp";
import type {NewsBriefV1} from "@/lib/market-brief-news";
import type {PublicStoryDepth} from "@/lib/bluebelly-key-story-depth";
import styles from "./KeyStoryDeepArticle.module.css";

export default function KeyStoryDeepArticle({
  receipt, depth, backHref, relatedHref,
}:{
  receipt?:NewsBriefV1; depth:PublicStoryDepth; backHref:string; relatedHref:string;
}){
 return <article className={styles.article} data-key-story-depth="source-verified-analysis" data-version="key-story-evidence-v1">
   <header className={styles.hero}>
     <div className={styles.heroCopy}>
       <h1>{depth.title}</h1>
       <p className={styles.kicker}>QUICK MARKET BRIEF</p>
       <p className={styles.lead} data-quick-market-brief="source-reviewed">{depth.hook}</p>
       <p>{depth.lead}</p>
     </div>
     <aside className={styles.art} aria-label="Story details and navigation">
       <EditorialStoryArt headline={receipt?.headline||depth.title} summary={depth.hook}/>
       <div className={styles.storyMeta} data-key-story-meta="under-illustration">
         <p className={styles.kicker}>KEY STORY / {depth.topic.toUpperCase()}</p>
         <div className={styles.eventDetails}>
           <span className={styles.eventLabel}>Original event</span>
           <DualTimestamp className={styles.eventTime} value={receipt?.occurredAt||depth.eventAt}/>
           <p className={styles.edition}>Editorial {depth.edition}</p>
         </div>
         <Link className={styles.backButton} href={backHref}>← Return to Key Stories</Link>
       </div>
     </aside>
   </header>
   <StorySummaryBoxes items={[
    {label:"What changed",text:depth.whatChanged[0]||depth.hook},
    {label:"How it spreads",text:depth.explanation[0]||depth.lead},
    {label:"Market check",text:depth.marketTape[0]||"No matched event-window price reaction is available in this edition."},
    {label:"What comes next",text:depth.nextTests[0]||depth.theQuestion},
   ]} sourceNote="A source-reviewed snapshot, not a newly inferred market verdict. Full chronology, comparisons and original documents are below."/>
   <h2 className={styles.fullStoryTitle}>The full story</h2>
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
         <h2>What was known before the announcement?</h2>
         {depth.chronology.map((line,i)=><p key={i}>{line}</p>)}
       </section>
       <section id="receipts" className={styles.section}>
         <p className={styles.kicker}>THE RECEIPTS / BEFORE · EXPECTED · ACTUAL</p>
         <h2>What changed between the baseline, expectations and actual result?</h2>
         <p>The comparison must keep matching metric, reference period and measurement basis. An externally published forecast recovered retrospectively is not a forecast captured by this desk before release; a reported daily yield move is not a source-isolated intraday reaction.</p>
         <div className={styles.tableScroll} role="region" tabIndex={0} aria-label="Previous, expected and actual source evidence">
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
         <h2>What changed beyond the headline?</h2>
         {depth.whatChanged.map((p,i)=><p key={i}>{p}</p>)}
         <p className={styles.primary}><strong>Original release:</strong> <a target="_blank" rel="noopener noreferrer" href={receipt?.sourceUrl||depth.sources[0].url}>{receipt?.sourceName||depth.sources[0].label} · original release ↗</a></p>
       </section>
       <section id="transmission" className={styles.section}>
         <p className={styles.kicker}>FOLLOW THE MONEY / MARKET TRANSMISSION</p>
         <h2>How could this development affect markets?</h2>
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
         <p><Link href={relatedHref}>Explore related source-qualified Key Stories →</Link></p>
       </section>
       <footer className={styles.sources}>
         <h2>Evidence and source provenance</h2>
         <p>This is a dated editorial expansion of an existing source-qualified public receipt, not a new canonical Story verdict or an automatic rewrite of private Notion research. Original-source facts are separated from reported expectations and conditional interpretations.</p>
         {depth.sources.map(s=><a href={s.url} key={s.url} target="_blank" rel="noopener noreferrer"><strong>{s.label}</strong><span>{s.role} ↗</span></a>)}
       </footer>
     </div>
     <aside className={styles.rail} aria-label="Presenter's evidence guide">
       <div className={styles.railBox}><p className={styles.kicker}>SAY THIS FIRST</p>
         <h3>{depth.theQuestion}</h3><p>{depth.whatChanged[0]||depth.hook}</p></div>
       <div className={styles.railBox}><p className={styles.kicker}>THREE USEFUL MEASUREMENTS</p>
         {depth.numbers.slice(0,3).map(m=><p key={m.label}><strong>{m.observed}</strong> {m.label}</p>)}
         <small>{depth.numbers[0]?.basis||"Check each measurement's reference period and source vintage."}</small>
       </div>
       <div className={styles.railBox}><p className={styles.kicker}>EVIDENCE STATUS</p>
         <p>Original event: {receipt?.sourceName||depth.sources[0]?.label||"Source reviewed"}</p>
         <p>Expectations and market observations: see separately attributed sources</p>
         {depth.missing[0]?<p>Still unresolved: {depth.missing[0]}</p>:null}
       </div>
     </aside>
   </div>
 </article>;
}
