import Link from "next/link";
import type {IssuerReviewResult} from "@/lib/power-stack-issuer-valuation";
import type {PegResearchEvaluation} from "@/lib/power-stack-peg-research";
import s from "./PowerStackValuationWorkbench.module.css";
export type ValuationResearchAsset=Readonly<{
 ticker:string;name:string;
 scope:"archived_holding"|"archived_watchlist"|"bond_watch";
 peg:(PegResearchEvaluation & {analystsFirst:number|null;analystsSecond:number|null;source:string})|null;
 quote:{price:number;currency:string;observed_on:string;source_url:string;timestamp_basis:string}|null;
}>;
const money=(x:number,currency:string)=>currency+" "+x.toLocaleString("en-GB",{maximumFractionDigits:2});
/** Owner-only research workbench, never public portfolio or a price feed.
 * A reviewed valuation is an authored model, not an independent intrinsic value.
 */
export default function PowerStackValuationWorkbench({assets,reviews,storeError}:{
 assets:readonly ValuationResearchAsset[];reviews:readonly IssuerReviewResult[];storeError:boolean;
}){
 const byTicker=new Map(reviews.map(r=>[r.ticker,r]));
 const rows=[...assets].sort((a,b)=>{
  const ra=byTicker.get(a.ticker),rb=byTicker.get(b.ticker);
  const score=(r:IssuerReviewResult|undefined)=>r?.verdict==="BELOW_REVIEWED_RANGE"?0:r?.verdict==="ABOVE_REVIEWED_RANGE"?1:r?2:3;
  return score(ra)-score(rb)||(a.scope==="archived_holding"?-1:0)-(b.scope==="archived_holding"?-1:0)||a.ticker.localeCompare(b.ticker);
 }).slice(0,15);
 const below=reviews.filter(r=>r.verdict==="BELOW_REVIEWED_RANGE").length;
 const above=reviews.filter(r=>r.verdict==="ABOVE_REVIEWED_RANGE").length;
 return <section id="power-stack-issuer-valuations" className={s.root}
  data-power-stack-issuer-underwriting="owner-only-source-reviewed-not-trade-signals">
  <header className={s.header}>
   <div><span>POWER STACK / ISSUER VALUATION WORKBENCH</span>
    <h2>Potential mispricing: where is the actual evidence?</h2>
    <p>Compare dated quotes with independently sourced earnings, operating cash flow, capex and a reviewed valuation model.
      PEG alone is not a bargain; absent or stale inputs remain research gaps.</p></div>
   <div className={s.totals}><strong>{reviews.length}</strong><small>VALID REVIEWED MODELS</small><span>{below} below reviewed range · {above} above</span></div>
  </header>
  {storeError?<p className={s.warning} data-valuation-store="unavailable">Owner valuation review store unavailable or migration not applied. Existing PEG and quote research remains usable; no model verdict is inferred.</p>:null}
  {!assets.length?<p className={s.empty}>No owner-authorised issuer records in the migrated snapshot. No valuation candidates are inferred.</p>:null}
  <div className={s.grid}>{rows.map(asset=>{
   const r=byTicker.get(asset.ticker);
   const badge=r?.verdict==="BELOW_REVIEWED_RANGE"?"BELOW REVIEWED RANGE":
    r?.verdict==="ABOVE_REVIEWED_RANGE"?"ABOVE REVIEWED RANGE":
    r?"WITHIN REVIEWED RANGE":"VALUATION EVIDENCE MISSING";
   return <article key={asset.ticker} className={s.card} data-valuation-ticker={asset.ticker}
    data-valuation-status={r?.verdict||"NO_REVIEW"}>
    <div className={s.meta}><strong>{asset.ticker}</strong><span>{asset.scope.replaceAll("_"," ").toUpperCase()}</span></div>
    <h3>{asset.name}</h3>
    <p className={s.state}>{r?(r.verdict==="WITHIN_REVIEWED_RANGE"?"UNDERWRITING · REVIEWED MODEL":"POTENTIAL MISPRICING · REVIEWED MODEL CANDIDATE"):"RESEARCH GAP · NOT A MISPRICING CANDIDATE"}</p>
    <p className={s.badge}>{badge}</p>
    {r?<div data-reviewed-valuation={r.ticker}>
      <p><b>Observed price:</b> {money(r.marketPrice,r.currency)} · {r.priceObservedOn}</p>
      <p><b>Reviewed model range:</b> {money(r.valuationLow,r.currency)}–{money(r.valuationHigh,r.currency)} ({r.valuationMethod.replaceAll("_"," ")})</p>
      <p><b>Distance to low case:</b> {r.distanceToLowPct>0?"+":""}{r.distanceToLowPct}% · not a forecast return</p>
      <p><b>Reported FCF proxy:</b> {money(r.freeCashFlow,r.currency)} {r.financialsUnit} (operating cash flow minus capex) · period ended {r.financialPeriodEnd}</p>
      <p><b>Net income:</b> {r.netIncome===null?"Not supplied":money(r.netIncome,r.currency)+" "+r.financialsUnit}</p>
      {r.riskFlags.length?<p className={s.warning}><b>Quality flags:</b> {r.riskFlags.join("; ")}</p>:null}
      <details><summary>Model assumptions, downside and invalidation</summary>
       <p><b>Method:</b> {r.methodExplanation}</p>
       <p><b>Downside case:</b> {r.downsideCase}</p>
       <p><b>Invalidation:</b> {r.invalidationTest}</p>
       <p><b>Reviewer:</b> {r.reviewerNote}</p>
       <p>Reviewed {r.reviewedAt.slice(0,10)}. Modelled valuations are subjective, even with verified input receipts.</p>
      </details>
      <div className={s.links}>
       <a href={r.priceSourceUrl} target="_blank" rel="noopener noreferrer">Price source ↗</a>
       <a href={r.fundamentalSourceUrl} target="_blank" rel="noopener noreferrer">Issuer financials ↗</a>
       <a href={r.valuationSourceUrl} target="_blank" rel="noopener noreferrer">Valuation evidence ↗</a>
      </div>
    </div>:<div data-valuation-gap={asset.ticker}>
      <p><b>Dated quote:</b> {asset.quote&&asset.quote.timestamp_basis==="source_observation"?
         money(asset.quote.price,asset.quote.currency)+" · "+asset.quote.observed_on:
         "Not independently dated to a market session"}</p>
      <p><b>Forward PEG:</b> {asset.peg?.forwardPEG===null||asset.peg?.forwardPEG===undefined?"Unavailable":
        asset.peg.forwardPEG.toFixed(2)+" ("+asset.peg.quality+"; "+asset.peg.forecastPeriod+")"}</p>
      <p><b>Missing before calling mispricing:</b> issuer-reported operating cash flow/capex, earnings quality, dilution and net debt,
       a credible independently linked valuation range, downside assumptions and a current exchange-dated quote.</p>
      <p className={s.warning}>A low PEG or a recent price drop is not evidence of undervaluation.</p>
      {asset.quote?.source_url?.startsWith("https://")?<a href={asset.quote.source_url} target="_blank" rel="noopener noreferrer">Existing quote receipt ↗</a>:null}
    </div>}
   </article>;
  })}</div>
  <p className={s.footer}>Read-only owner research. Reviewed ranges are analyst scenarios, not executable bid/ask prices or validated fair value. “Below range” and “above range” require a minimum 10% buffer and fresh source receipts; the buffer is not statistical significance. No trading, watchlist reranking or public portfolio disclosure. <Link href="/regime-watch#signal-radar">Compare macro research signals →</Link></p>
 </section>;
}
