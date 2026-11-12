import Link from "next/link";
import {JENSEN_GOVERNANCE_WATCH as watch} from "@/lib/bluebelly-jensen-governance-watch";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import styles from "@/app/blue-desk/newsroom/newsroom.module.css";
export default function JensenGovernanceWatch({host}:{host:string|null}){
 return <section className={styles.jensenWatch} id="newsroom-jensen-watch"
   data-governance-watch="source-dated-not-live-board-status" aria-labelledby="jensen-watch-title">
  <header className={styles.jensenHead}>
   <span className={styles.manualEyebrow}>WATCHED STORY / NVIDIA LEADERSHIP · SOURCE REVIEW {watch.reviewedOn}</span>
   <span className={styles.jensenStatus}>{watch.status}</span>
  </header>
  <h2 id="jensen-watch-title">Jensen Huang resigns: what changes for NVIDIA and the AI ecosystem?</h2>
  <p><strong>What is confirmed:</strong> {watch.official.map(item=>item.text).join(" ")}</p>
  <p><strong>External reporting and unresolved risks:</strong> {watch.reported.text}</p>
  <details className={styles.jensenDetails}>
   <summary>Uncertainty, market implications and deciding tests</summary>
   <p><strong>Decision signal:</strong> {watch.market.signal}</p>
   <p><strong>Uncertainty direction:</strong> {watch.market.uncertainty}</p>
   <p><strong>Supply and demand:</strong> {watch.market.supplyDemand}</p>
   <p><strong>Expected versus observed market:</strong> {watch.market.price}</p>
   <p><strong>Next verification:</strong> {watch.market.next}</p>
  </details>
  <nav className={styles.jensenLinks} aria-label="Governance watch source records">
   {watch.official.map(item=><a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer">{item.label} ↗</a>)}
   <a href={watch.reported.url} target="_blank" rel="noopener noreferrer">{watch.reported.label} ↗</a>
   <Link href={blueDeskPublicHref("/blue-desk/regime-watch/ai",host)}>AI Regime context →</Link>
  </nav>
  <p className={styles.manualNote}>This is a dated watch, not live board-status monitoring. Huang's resignation and Kress's interim appointment are confirmed; reported personal allegations and any security compromise remain unproven here. No decline in physical GPU demand is inferred from the share-price move.</p>
 </section>;
}
