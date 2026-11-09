import type {PublicMarketObservation} from "@/lib/blue-desk-public-markets";
import {buildMarketDivergenceWatch} from "@/lib/bluebelly-market-divergence-watch";
import type {MarketChangeWindow} from "@/lib/blue-desk-market-filters";
import css from "./MarketDivergenceWatch.module.css";

const number=(value:number|null,unit:string)=>value===null?"—":`${value>0?"+":""}${value.toFixed(2)} ${unit}`;
const direction=(n:number|null)=>n===null?"unknown":n>0?"up":n<0?"down":"flat";
export default function MarketDivergenceWatch({
  observations,window,windowHrefs,
}:{
  observations:PublicMarketObservation[];
  window:MarketChangeWindow;
  windowHrefs:Record<MarketChangeWindow,string>;
}){
  const reads=buildMarketDivergenceWatch(observations,window);
  const measured=reads.filter(r=>r.status!=="NOT_COMPARABLE");
  const missing=reads.filter(r=>r.status==="NOT_COMPARABLE");
  return <section id="divergence-watch" data-market-divergence-watch="read-only" aria-labelledby="divergence-watch-heading">
    <p className={css.intro}>Compare observed market relationships before assigning a cause. Opposite moves appear first; a return gap by itself does not prove that a historical relationship has broken.</p>
    <nav className={css.windows} aria-label="Divergence comparison window">
      <span className={css.tag}>Source sessions</span>
      {(["1D","3D","5D"] as const).map(w=><a key={w} href={windowHrefs[w]}
        aria-current={window===w?"page":undefined}>{w}</a>)}
    </nav>
    <p className={css.intro}>{measured.length} of {reads.length} comparisons have matched, recorded {window} percentage-return data. No inferred source sessions or price series.</p>
    {measured.length?<div className={css.grid}>
      {measured.map(read=><article key={read.id} className={css.card} data-status={read.status}>
        <span className={css.tag}>{read.status==="OPPOSITE_MOVE"?"Opposite directions":read.status==="RELATIVE_MOVE"?"Relative performance":"Data unavailable"}</span>
        <h3>{read.title}</h3>
        <p>{read.question}</p>
        <div className={css.readings}>
          <div><small>{read.left} · {window}</small><strong data-direction={direction(read.leftChange)}>{number(read.leftChange,"%")}</strong></div>
          <div><small>{read.right} · {window}</small><strong data-direction={direction(read.rightChange)}>{number(read.rightChange,"%")}</strong></div>
          <div><small>{read.left} − {read.right}</small><strong>{number(read.gapPp,"pp")}</strong></div>
        </div>
        <p>{read.reason??`Both observations end ${read.sourceSession}. This is a measured price-return difference, not a verified causal explanation.`}</p>
        <details>
          <summary>What should we check next?</summary>
          <p>{read.nextTest}</p>
          <div className={css.sources}>
            {read.leftSourceUrl?<a href={read.leftSourceUrl} target="_blank" rel="noreferrer">{read.left} original data</a>:null}
            {read.rightSourceUrl?<a href={read.rightSourceUrl} target="_blank" rel="noreferrer">{read.right} original data</a>:null}
          </div>
        </details>
      </article>)}
    </div>:<div className={css.empty} role="status">
      <strong>No matched comparisons available for {window}.</strong>
      <p>The monitored assets do not currently provide enough same-session percentage-return observations for these pairs. That is a coverage gap, not evidence that market relationships are normal.</p>
    </div>}
    {missing.length?<details className={css.missingDisclosure}>
      <summary>Unavailable comparisons ({missing.length}) · inspect data gaps</summary>
      <ul>{missing.map(read=><li key={read.id}><strong>{read.title}</strong> — {read.reason}</li>)}</ul>
    </details>:null}
    <p className={css.foot}>Research watch only. Same-session ETF price returns are not adjusted total returns. No automatic Regime/Dossier changes, statistical significance claim, or trading signal. Event-driven divergences require separately frozen expectations and matched reaction windows.</p>
  </section>;
}
