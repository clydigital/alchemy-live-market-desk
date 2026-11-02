import styles from "./MarketTakeaway.module.css";

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
 return <aside className={styles.takeaway} data-market-takeaway={researched?"reviewed":"not-yet-assessed"}
   data-compact={compact?"true":"false"} aria-label="Market takeaway">
  <strong className={styles.heading}>Market takeaway</strong>
  {researched?<>
   <p><b>Why markets care:</b> {why}</p>
   <p><b>What would clarify this:</b> {nextTest}</p>
   <small>The economic interpretation is conditional. A market-price cause or a “priced in” verdict needs separate event-window and expectation evidence.</small>
  </>:<>
   <p><b>Impact not yet assessed.</b> {mode==="archived"?
    "Open the dated source-reviewed report for its full interpretation; this card has no independently matched market reaction.":
    "The original announcement is verified, but its business effect and specific uncertainty still need research."}</p>
   <p><b>Next check:</b> Match the previous baseline, pre-event expectations and a named asset's dated response before drawing a market conclusion.</p>
  </>}
 </aside>;
}
