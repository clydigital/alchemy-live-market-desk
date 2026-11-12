import Link from "next/link";
import {NVIDIA_EARNINGS_WATCH as watch,nvidiaEventState} from "@/lib/bluebelly-nvidia-earnings-watch";
import styles from "./NvidiaEarningsDecisionWatch.module.css";

type OwnerContext={
 recordedScope:"ARCHIVED_HOLDING"|"ARCHIVED_WATCHLIST"|"NOT_IN_RECORDED_PORTFOLIO";
 quote?:{price:number;currency:string;observedOn:string;sourceName:string;sourceUrl:string;timestampBasis:string}|null;
};
export default function NvidiaEarningsDecisionWatch({
 mode,now,owner,
}:{
 mode:"regime"|"power-stack";now:Date;owner?:OwnerContext;
}){
 const state=nvidiaEventState(now);
 const privateMode=mode==="power-stack";
 const quote=privateMode?owner?.quote:null;
 return <section className={styles.root} id="nvidia-earnings-decision"
   data-nvda-decision-watch={mode}
   data-nvda-earnings-state={state}
   aria-labelledby="nvidia-decision-title">
   <div className={styles.top}>
    <div>
     <p className={styles.kicker}>NVIDIA / SOURCE-REVIEWED EVENT WATCH · {watch.reviewedOn}</p>
     <h2 id="nvidia-decision-title">A strong AI business — but is the leadership shock a lasting problem?</h2>
     <p className={styles.deck}>NVIDIA's founder is out; its Q3 results are still ahead. Separate near-term valuation uncertainty from actual chip shipments, paid AI demand and the company's next earnings outlook.</p>
    </div>
    <div className={styles.outlook}>
     <span>LONG-TERM CASE</span><strong>CONDITIONAL</strong>
     <small>NOT A BUY/SELL SIGNAL</small>
     <span>Q3 EVENT</span><strong>{state==="UPCOMING"?"UPCOMING":state==="RESULTS_DUE_CHECK_ISSUER"?"CHECK ORIGINAL RESULTS":"SOURCE CONFIRMED"}</strong>
    </div>
   </div>
   {privateMode?<div className={styles.owner} data-ps-nvidia-scope={owner?.recordedScope||"NOT_IN_RECORDED_PORTFOLIO"}>
    <strong>POWER STACK / INVESTMENT CANDIDATE</strong>
    <span>Portfolio classification: {owner?.recordedScope==="ARCHIVED_HOLDING"?"historical holding record (not current brokerage proof)":owner?.recordedScope==="ARCHIVED_WATCHLIST"?"archived research watchlist":"not in recorded holdings/watchlist — research only"}.</span>
    <span>{quote&&Number.isFinite(quote.price)?
      <>Private ledger: {quote.currency} {quote.price.toFixed(2)} · {quote.observedOn} · {quote.timestampBasis==="upstream_batch"?"provider batch, not trade timestamp":"dated market observation"} · <a href={quote.sourceUrl} target="_blank" rel="noopener noreferrer">{quote.sourceName} ↗</a></>:
      "No matched owner-ledger NVIDIA quote: prices and entry conditions require an updated independent chart. No live price inferred."}</span>
   </div>:null}
   <div className={styles.metricGrid} aria-label="Original NVIDIA financial reference points">
    <div><small>Q2 FY27 · ACTUAL REVENUE</small><strong>$96.221B</strong><span>Issuer-reported</span></div>
    <div><small>Q2 FY27 · DATA CENTRE</small><strong>$89.0B</strong><span>Issuer-reported</span></div>
    <div><small>Q3 FY27 · GUIDANCE</small><strong>$108B ±2%</strong><span>Forecast, not result</span></div>
    <div><small>Q3 FY27 · MARGIN GUIDE</small><strong>74% ±0.5pp</strong><span>GAAP and adjusted</span></div>
   </div>
   <div className={styles.notice}>
    <strong>Next catalyst: {watch.calendar.results}</strong>
    <span> Earnings call {watch.calendar.call}. {state!=="UPCOMING"?"The expected release time has passed; this frozen research still does not include a verified Q3 result.":"No Q3 earnings result has been published in this editorial edition."}</span>
   </div>
   <div className={styles.handoff}>
    <div><small>DECISION SIGNAL</small><p>{watch.signal.decision}</p></div>
    <div><small>UNCERTAINTY / MIXED</small><p>{watch.signal.uncertainty}</p></div>
    <div><small>SUPPLY, DEMAND & FINANCING</small><p>{watch.signal.supply} {watch.signal.demand} {watch.signal.financing}</p></div>
    <div><small>MARKET REACTION / CAUSE UNPROVEN</small><p>{watch.signal.market}</p></div>
   </div>
   <h3 className={styles.subhead}>Three investment paths — what would make each credible?</h3>
   <div className={styles.cases}>{watch.scenarios.map((caseItem,i)=>
    <article key={caseItem.id} className={styles.case} data-nvda-scenario={caseItem.id}>
     <span className={styles.caseIndex}>0{i+1} · {caseItem.stance.replaceAll("_"," ")}</span>
     <h4>{caseItem.label}</h4>
     <p><strong>Requires:</strong> {caseItem.needs}</p>
     <p><strong>Market implication:</strong> {caseItem.marketRead}</p>
     <p><strong>Invalidated by:</strong> {caseItem.invalidation}</p>
    </article>)}</div>
   {privateMode?<div className={styles.trades} data-power-stack-nvda-entries="conditional-not-orders">
    <h3 className={styles.subhead}>Entry playbook: avoid confusing a bounce with a new trend</h3>
    <div className={styles.tradeGrid}>{watch.technical.map((p,i)=><article key={p.id}>
     <small>OPTION {i+1}</small><h4>{p.title}</h4><p>{p.test}</p><p className={styles.caution}><strong>Risk:</strong> {p.risk}</p>
    </article>)}</div>
    <p className={styles.caution}>Your TradingView screenshot from 12 Nov showed unusually high turnover and a sharp sell-off; this is a user-supplied intraday chart, not an official close or evidence of net institutional buying. Any support, EMA-band or entry zone must be refreshed from a dated market quote.</p>
   </div>:null}
   <details className={styles.evidence} data-nvda-source-and-tests="issuer-first" open>
    <summary>Original sources, the gaps that matter, and next tests</summary>
    <p><strong>Potential beneficiaries:</strong> {watch.signal.beneficiaries}</p>
    <p><strong>Potentially pressured:</strong> {watch.signal.pressure}</p>
    <p><strong>Relative-market test:</strong> {watch.signal.competitor}</p>
    <ul>{watch.nextChecks.map(item=><li key={item}>{item}</li>)}</ul>
    <nav className={styles.sources} aria-label="Nvidia issuer reference sources">
     <a href={watch.transition.originalUrl} target="_blank" rel="noopener noreferrer">NVIDIA · CEO-transition release ↗</a>
     <a href={watch.previousQuarter.originalUrl} target="_blank" rel="noopener noreferrer">NVIDIA · Q2 FY27 results and Q3 outlook ↗</a>
     <a href={watch.calendar.originalUrl} target="_blank" rel="noopener noreferrer">NVIDIA · earnings date and webcast ↗</a>
     <Link href="/newsroom#newsroom-jensen-watch">Newsroom governance developments</Link>
     <Link href="/regime-watch/ai">AI Regime research</Link>
    </nav>
   </details>
   <p className={styles.caveat}>Source-checked historical facts + conditional analysis. No invented analyst consensus, final share-price reaction, numerical price target, quarterly result, portfolio order or canonical Regime revision. This event note remains frozen until a newly checked issuer edition supersedes it.</p>
 </section>;
}
