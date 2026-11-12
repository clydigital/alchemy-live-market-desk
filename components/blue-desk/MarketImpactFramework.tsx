import type {PublicStoryDepth} from "@/lib/bluebelly-key-story-depth";
import {reviewedImpactForDepth,UNASSESSED_MARKET_FRAME} from "@/lib/bluebelly-editorial-market-framework";
import css from "./MarketImpactFramework.module.css";

/** Reused by every exact-receipt deep reader, never produces a market verdict
 * for a source-only or incomplete canonical Story. */
export default function MarketImpactFramework({depth}:{depth:PublicStoryDepth}){
 const impact=reviewedImpactForDepth(depth);
 return <section className={css.shell} data-bluebelly-interpretation={impact?"source-reviewed-conditional":"not-adjudicated"}
  aria-labelledby="market-impact-title">
  <header className={css.head}>
   <div><span className={css.eyebrow}>MARKET IMPACT / WHAT THIS DECISION MEANS</span>
    <h2 id="market-impact-title">Is this actually good news for the market?</h2></div>
   <span className={css.status}>{impact?impact.assetValence.replaceAll("_"," "):"NOT ASSESSED"}</span>
  </header>
  {impact?<div className={css.body}>
   <p className={css.scope}>Source-reviewed conditional interpretation · {impact.asOf}. It does not establish a live price reaction or change the canonical Regime.</p>
   <div className={css.top}>
    <div><small>WHAT THE DECISION SIGNALS</small><p>{impact.decisionSignal}</p></div>
    <div><small>UNCERTAINTY / {impact.uncertaintyDirection}</small><p>{impact.uncertaintyWhy}</p></div>
   </div>
   <div className={css.exposure}>
    <div><small>POTENTIAL BENEFICIARIES</small><p>{impact.beneficiaries}</p></div>
    <div><small>POTENTIALLY PRESSURED</small><p>{impact.pressured}</p></div>
   </div>
   <details className={css.detail} open>
    <summary>Supply, demand and financing transmission</summary>
    <p><strong>Supply:</strong> {impact.supplyEffect}</p>
    <p><strong>Demand:</strong> {impact.demandEffect}</p>
    <p><strong>Financing and valuation:</strong> {impact.financingEffect}</p>
   </details>
   <div className={css.tape} data-market-tape-status={impact.tapeStatus}>
    <h3>Expected reaction versus the tape</h3>
    <p><strong>Textbook expectation:</strong> {impact.expectedReaction}</p>
    <p><strong>Observed:</strong> {impact.observedReaction}</p>
    <p className={css.caution}><strong>Divergence: {impact.divergence.replaceAll("_"," ")}.</strong> A price move does not establish the cause. {impact.alternative}</p>
   </div>
   <p className={css.test}><strong>What would change the assessment:</strong> {impact.nextTest} <a href={impact.sourceUrl} target="_blank" rel="noopener noreferrer">Original reviewed source ↗</a></p>
  </div>:<p className={css.scope}>{UNASSESSED_MARKET_FRAME.text} Review the original evidence and the open measurement gaps below.</p>}
 </section>;
}
