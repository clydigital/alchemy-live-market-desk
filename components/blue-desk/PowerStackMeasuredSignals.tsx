import Link from "next/link";
import SignalTags from "./SignalTags";
import type {MeasuredMarketSignal} from "@/lib/bluebelly-measured-market-signals";
import s from "./PowerStackMeasuredSignals.module.css";

/** Called only after the auth+owner allowlist check.
 * Public tape + owner-selected theme relevance remain inside /power-stack.
 * Never serialize owner holdings to public /regime-watch or Markets.
 */
export default function PowerStackMeasuredSignals({signals,trackedTickers,topics}:{
 signals:readonly MeasuredMarketSignal[];trackedTickers:readonly string[];topics:readonly string[];
}){
 const relevant=new Set(topics);
 const theme=(id:string)=>id==="semis-vs-nasdaq"||id==="software-vs-chips"?"ai":
  id==="energy-vs-consumer"?"hormuz":"breadth";
 const candidates=signals.filter(signal=>relevant.has(theme(signal.id))).slice(0,3);
 const tracked=new Set(trackedTickers.map(s=>s.toUpperCase()));
 return <section id="power-stack-measured-signals" className={s.wrap}
  data-private-measured-signals="source-dated-tape-not-security-valuation">
  <header><span>PRIVATE POWER STACK / CROSS-ASSET RESEARCH</span>
   <h2>Which market relationships warrant a closer look?</h2>
   <p>Only same-session, source-linked ETF return comparisons relevant to tracked research themes.
     These identify sector or market participation—not company-specific fair value or a trade entry.</p></header>
  {candidates.length?<div className={s.grid}>{candidates.map(item=>{
   const direct=tracked.has(item.left)||tracked.has(item.right);
   return <article key={item.id} className={s.card} data-ps-pair-id={item.id}>
    <div className={s.meta}><span>{direct?"WATCHED ETF PAIR":"THEME CONTEXT ONLY"}</span>
     <span>{item.window} · {item.sourceSession} US source session</span></div>
    <SignalTags tags={[item.tag]}/>
    <h3>{item.title}</h3>
    <p><strong>{item.left}</strong> {item.leftChange>0?"+":""}{item.leftChange.toFixed(2)}%
     {" · "}<strong>{item.right}</strong> {item.rightChange>0?"+":""}{item.rightChange.toFixed(2)}%
     {" · gap "}{item.gapPp>0?"+":""}{item.gapPp.toFixed(2)} pp</p>
    <p><strong>Deciding test:</strong> {item.nextTest}</p>
    <div className={s.links}>
     <Link href="/markets?mode=watch&window=1D#divergence-watch">Open measured market comparisons →</Link>
     <a href={item.leftSourceUrl} target="_blank" rel="noopener noreferrer">{item.left} data ↗</a>
     <a href={item.rightSourceUrl} target="_blank" rel="noopener noreferrer">{item.right} data ↗</a>
    </div>
   </article>;
  })}</div>:<p className={s.empty}>No currently qualifying matched-session tape divergences in the tracked research themes. Missing data and closed sessions are not assumed normal.</p>}
  <p className={s.foot}>No position/holding is inferred from a shared theme. PEG, earnings, valuation, entry and invalidation must be evaluated separately. No owner information is added to public Regime Watch.</p>
 </section>;
}
