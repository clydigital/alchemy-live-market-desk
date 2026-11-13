import type {ReleaseImpactBrief,DisruptionExposure} from "@/lib/bluebelly-release-impact-brief";
import styles from "./ReleaseComparisonDisruption.module.css";

const TIER_ORDER=["WATCH","MODERATE","ELEVATED"] as const;
function readableDirection(item:DisruptionExposure):string{
 return item.direction==="MIXED"?"Two-sided economics":
   item.direction==="POTENTIAL_HEADWIND"?"Possible headwind":"Possible tailwind";
}
export default function ReleaseComparisonDisruption({brief}:{brief:ReleaseImpactBrief}){
 return <div className={styles.root} data-news-release-comparison={brief.id}>
  <section className={styles.setup}>
   <p className={styles.eyebrow}>THE ACTUAL STORY · NOT JUST THE HEADLINE</p>
   <h2>What changed versus last month?</h2>
   <p className={styles.intro}>{brief.lead}</p>
   <div className={styles.contrasts}>
    {brief.contrasts.map(m=><div key={m.id} className={styles.metric} data-metric={m.id}>
      <h3>{m.metric}</h3>
      <div className={styles.triad}>
       <div><small>PREVIOUS</small><strong>{m.previous}</strong><span>{m.previousVintage}</span></div>
       <div><small>ACTUAL</small><strong>{m.actual}</strong><span>{m.period}</span></div>
       <div><small>EXPECTED</small><strong>{m.expectation?.split(" · ")[0]??"Not verified"}</strong><span>{m.expectation?.split(" · ").slice(1).join(" · ")||"No comparable pre-release consensus"}</span></div>
      </div>
      <p className={styles.delta}><strong>Change:</strong> {m.deltaVsPrevious}{m.deltaVsExpectation?" · Surprise: "+m.deltaVsExpectation:""}</p>
      <p className={styles.measure}>{m.basis} · {m.explanation}</p>
     </div>)}
   </div>
   <p className={styles.components}>{brief.components}</p>
  </section>
  <section className={styles.impact}>
   <div className={styles.impactHead}>
    <div><p className={styles.eyebrow}>ASSET DISRUPTION MAP</p><h2>Where could the pressure land?</h2></div>
    <span className={styles.estimate}>SCENARIO EXPOSURE · NOT MEASURED RETURNS</span>
   </div>
   <p className={styles.legend}>The bars show qualitative <strong>exposure to this news</strong>, not a statistical impact estimate, price target, trading signal or probability. The asset price may react in either direction.</p>
   <div className={styles.grid}>
    {brief.exposures.map(item=><article className={styles.card} key={item.asset} data-asset-disruption={item.asset} data-exposure-tier={item.tier}>
     <div className={styles.cardHeading}>
      <div><strong className={styles.ticker}>{item.asset}</strong><h3>{item.name}</h3></div>
      <span className={styles.direction}>{readableDirection(item)}</span>
     </div>
     <div className={styles.tierLine}>
      <span>Exposure</span><strong>{item.tier==="ELEVATED"?"Elevated":item.tier==="MODERATE"?"Moderate":"Watch"}</strong>
     </div>
     <div className={styles.rail} role="img" aria-label={item.asset+": "+item.tier.toLowerCase()+" qualitative exposure, not an observed market move"}>
      {TIER_ORDER.map((tier,i)=><span key={tier} data-active={i<=TIER_ORDER.indexOf(item.tier)}/>)}
     </div>
     <p className={styles.mechanism}>{item.mechanism}</p>
     <details className={styles.cardDetails}><summary>What could offset this?</summary>
      <p>{item.counterforce}</p><p><strong>Next check:</strong> {item.decidingTest}</p>
     </details>
    </article>)}
   </div>
   <p className={styles.notMeasured} data-event-market-reaction="NOT_MEASURED"><strong>What did prices do?</strong> {brief.reactionNote}</p>
  </section>
  <details className={styles.sources}>
   <summary>Numbers, vintages and original links ({brief.sourceLedger.length})</summary>
   <ul>{brief.sourceLedger.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a><p>{source.role}</p></li>)}</ul>
  </details>
 </div>;
}
