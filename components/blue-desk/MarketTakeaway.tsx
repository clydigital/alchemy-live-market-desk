import styles from "./MarketTakeaway.module.css";
import {takeawayExcerpt} from "@/lib/bluebelly-market-takeaway-excerpt";

/**
 * One compact, human-readable explanation. Inputs are already source-reviewed
 * editorial fields or an explicit not-yet-assessed state; this component makes
 * no headline-sentiment, consensus, probability, uncertainty-change or
 * event-to-price causality inference.
 */
export default function MarketTakeaway({why,nextTest,mode="reviewed",compact=false}:{
 why?:string|null;nextTest?:string|null;
 mode?:"reviewed"|"source-only"|"archived";compact?:boolean;
}){
 const researched=mode==="reviewed"&&Boolean(why?.trim())&&Boolean(nextTest?.trim());
 const reason=takeawayExcerpt(why||"");
 const check=takeawayExcerpt(nextTest||"",180);
 return <aside className={styles.takeaway} data-market-takeaway={researched?"reviewed":mode==="archived"?"see-archived-story":"not-yet-assessed"}
   data-compact={compact?"true":"false"} aria-label="Market takeaway">
  <strong className={styles.heading}>Market takeaway</strong>
  {researched?<>
   <p><b>Why markets care:</b> {reason.preview}</p>
   <p><b>What would clarify this:</b> {check.preview}</p>
   {reason.expanded||check.expanded?<details className={styles.more}>
     <summary>Full reviewed reasoning and next test</summary>
     <p><b>Why markets care:</b> {why}</p>
     <p><b>What would clarify this:</b> {nextTest}</p>
   </details>:null}
   <small>The economic interpretation is conditional. A market-price cause or a “priced in” verdict needs separate event-window and expectation evidence.</small>
  </>:<>
   <p><b>{mode==="archived"?"Full interpretation in report.":"Impact not yet assessed."}</b> {mode==="archived"?
    "Open the dated source-reviewed report for its full interpretation; this card has no independently matched market reaction.":
    "The original announcement is verified, but its business effect and specific uncertainty still need research."}</p>
   <p><b>Next check:</b> Match the previous baseline, pre-event expectations and a named asset's dated response before drawing a market conclusion.</p>
  </>}
 </aside>;
}
