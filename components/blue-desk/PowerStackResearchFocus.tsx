import type {ValuationResearchAsset} from "./PowerStackValuationWorkbench";
import {privateResearchFocus} from "@/lib/power-stack-investor-research-focus";
import s from "./PowerStackResearchFocus.module.css";
/** Private research priorities, not buy rankings, model-valued targets or live quotes. */
export default function PowerStackResearchFocus({assets,now}:{assets:readonly ValuationResearchAsset[];now:Date}){
 const focus=privateResearchFocus(assets.map(asset=>asset.ticker),now);
 const byTicker=new Map(assets.map(asset=>[asset.ticker,asset]));
 return <section id="power-stack-research-focus" className={s.root}
  data-power-stack-focus="owner-only-hypotheses-not-approved-investments">
  <header><span>POWER STACK / CURATED INVESTOR RESEARCH</span>
   <h2>Which apparent discounts deserve investigation?</h2>
   <p>Priority is for diligence, not purchasing. An updated share price does not refresh the analyst earnings estimate vintage. Modelled fair values remain unapproved until the three-source review is complete.</p></header>
  {!focus.length?<p>No current priority notes overlap the owner-verified issuer universe.</p>:<div className={s.grid}>
   {focus.map(item=>{
    const asset=byTicker.get(item.ticker)!;
    const peg=asset.peg,quote=asset.quote;
    return <article key={item.ticker} className={s.card} data-research-ticker={item.ticker}>
     <div className={s.meta}><b>{item.ticker}</b><span>{item.expired?"SOURCE REVIEW EXPIRED":item.priority+" RESEARCH / NOT A BUY SIGNAL"}</span></div>
     <h3>{asset.name}</h3>
     <p className={s.contrast}>{item.contrast}</p>
     <div className={s.numbers}>
      <div><b>Owner price receipt</b><span>{quote&&quote.timestamp_basis==="source_observation"?quote.currency+" "+quote.price.toFixed(2)+" · "+quote.observed_on:"Not verified"}</span></div>
      <div><b>Indicative forward PEG</b><span>{peg?.forwardPEG!==null&&peg?.forwardPEG!==undefined?peg.forwardPEG.toFixed(2)+" · "+peg.quality:"Not meaningful"}</span></div>
      <div><b>Source-review date</b><span>{item.reviewedOn}{item.expired?" · expired":""}</span></div>
     </div>
     <p><strong>What changed:</strong> {item.whyNow}</p>
     <p><strong>First rejection:</strong> {item.firstRejection}</p>
     <p><strong>Deciding test:</strong> {item.nextTest}</p>
     <div className={s.sources}>{item.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.name} ↗</a>)}</div>
     <small>{item.expired?"Do not carry this research view forward without checking newer evidence.":"Original sources support reported facts only; the valuation question is still open."}</small>
    </article>;
   })}
  </div>}
 </section>;
}
