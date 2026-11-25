import "server-only";
import Link from "next/link";
import type {PublicEquityCoverageRow} from "@/lib/bluebelly-equity-coverage";
import type {IssuerReviewResult} from "@/lib/power-stack-issuer-valuation";
import type {EmaObservation} from "@/lib/bluebelly-equity-ema";
import styles from "@/app/power-stack/private-power-stack.module.css";

const pct=(v:number)=> (v>=0?"+":"")+v.toFixed(1)+"%";
function statements(o:EmaObservation){
 const out:string[]=[];
 for(const w of ["1","3","5"] as const){const s=o.windows[w];if(!s)continue;
  if((s.approach==="down_to"||s.approach==="up_to")&&Math.abs(o.distancePct)<=3)out.push(w+"D "+(s.approach==="down_to"?"falling toward":"rising toward"));
  if(s.emaCross!=="none")out.push(w+"D crossed "+(s.emaCross==="up"?"above":"below")+" EMA");
  if(s.upperCross!=="none")out.push(w+"D crossed "+(s.upperCross==="up"?"above":"below")+" upper SD");
  if(s.lowerCross!=="none")out.push(w+"D crossed "+(s.lowerCross==="up"?"above":"below")+" lower SD");
 }
 return out;
}
const baskets=[
 ["Cash-generating healthcare","CI CVS JNJ ABBV","Demand less tied to AI capital spending; reimbursement and policy risks.","AI spending slowdown / cyclical weakness","Good","Good","Mixed","Mixed","Mixed"],
 ["AI and memory","NVDA AVGO MU DELL ADI SNDK AMD HPE","Paid demand, funded backlog and sustainable margins.","Not a hedge against AI concentration","Excellent","Poor","Poor","Mixed","Good"],
 ["Grid, water and power","ETN POWL PWR GEV MWA XYL NVT BWXT","Funded utility and industrial projects; diversified demand matters.","Relative hedge to purely AI-funded compute","Good","Mixed","Mixed","Good","Good"],
 ["Property and housing","O MAA TOL PHM INVH ESS CPT PLD GRBK","AFFO, rents, affordability and refinancing; separate builders and REITs.","Disinflation / lower yields, not recession insurance","Good","Mixed","Poor","Poor","Excellent"],
 ["Oil, freight and shipbuilding","XOM CVX LNG DHT FRO INSW CMBT","Existing capacity, contracted revenue and cash; distinguish freight from crude.","Physical supply disruption, conditional","Mixed","Mixed","Poor","Excellent","Mixed"],
 ["Independent software and consumer","TTWO WDAY ADBE CRM","Retention, recurring cash generation and unit economics; check SBC.","Diversifies hardware demand, not equity beta","Good","Mixed","Poor","Mixed","Good"],
 ["Malaysia infrastructure","0245.KL 0310.KL 0296.KL 5398.KL 5347.KL","Cash collection, funded backlog and grid demand.","Local demand / currency diversification; AI overlap remains","Good","Mixed","Poor","Mixed","Good"],
] as const;
export default function PowerStackBBMarketSweep({rows,reviews,asOf}:{rows:readonly PublicEquityCoverageRow[];reviews:readonly IssuerReviewResult[];asOf:string}){
 const reviewByTicker=new Map(reviews.map(r=>[r.ticker,r]));
 const eligible=rows.filter(r=>r.status==="SOURCE_DATED"&&r.price!==null&&r.asOf&&Date.parse(asOf+"T00:00:00Z")-Date.parse(r.asOf+"T00:00:00Z")<=5*86400000);
 const signals=eligible.map(r=>({row:r,levels:r.emaScan?.observations.map(o=>({o,statements:statements(o)})).filter(x=>x.statements.length)??[],review:reviewByTicker.get(r.ticker)}));
 const flagged=signals.filter(x=>x.levels.length||x.review&&x.review.currency===x.row.currency&&x.row.price!<=x.review.valuationLow*1.05).sort((a,b)=>(a.row.changePct??0)-(b.row.changePct??0));
 return <section className={styles.section} data-power-stack-bb-sweep="canonical-market-read">
  <h2>BB market sweep · {asOf}</h2>
  <p>{eligible.length}/{rows.length} recent source-dated equity observations. Research alerts only; a falling price or EMA crossing is not proof of value. <Link href="/markets">Full BB market universe</Link>.</p>
  <p>Approach alert: within 3% of EMA with a narrowing signed distance and matching price direction over 1, 3 or 5 completed daily sessions. Crosses compare endpoint states; a breach and recovery inside a window may not appear. W/M anchors use completed periods only. Missing history stays unavailable.</p>
  {!flagged.length?<p>No verified proximity or crossing alerts from available observations. Check source coverage.</p>:null}
  <div className={styles.watchGrid}>{flagged.slice(0,12).map(({row,levels,review})=><details className={styles.assetDetails} key={row.ticker}>
   <summary><strong>{row.ticker}</strong> · {row.currency} {row.price?.toFixed(2)} · {row.asOf} · 1D {row.changePct==null?"—":pct(row.changePct)} / 3D {row.change3dPct==null?"—":pct(row.change3dPct)} / 5D {row.change5dPct==null?"—":pct(row.change5dPct)}</summary>
   {review&&review.currency===row.currency?<p>Reviewed value range {review.valuationLow}–{review.valuationHigh} {review.currency}, reviewed {review.reviewedAt.slice(0,10)}; current discount to low end {pct((1-row.price!/review.valuationLow)*100)}. Model assumptions, not an order.</p>:null}
   {levels.map(({o,statements:s})=><p key={o.frame+o.period}><strong>{o.frame} EMA{o.period}</strong> {o.ema.toFixed(2)} · price {o.side} ({pct(o.distancePct)}) · {o.band.replaceAll("_"," ")} {o.multiplier} SD envelope · {s.join("; ")}.</p>)}
   <p>Unavailable anchors: {row.emaScan?.unavailable.join(", ")||"none reported"}</p>
  </details>)}</div>
  {flagged.length>12?<details className={styles.assetDetails}><summary>More flagged symbols ({flagged.length-12})</summary><ul>{flagged.slice(12).map(({row,levels})=><li key={row.ticker}>{row.ticker}: {levels.map(({o,statements:s})=>o.frame+" EMA"+o.period+" "+s.join(", ")).join("; ")||"reviewed value proximity"}</li>)}</ul></details>:null}
  <h3>Scenario baskets · research hypotheses</h3><p>Directional tendencies, not measured hedge ratios or forecasts. Shared exposures can still decline together. Evaluate the actual issuer, valuation, leverage and funding before investing.</p>
  <div className={styles.tableScroll}><table className={styles.holdingsTable}><thead><tr><th>Basket / thesis</th><th>Potential diversification</th><th>AI boom</th><th>AI bust</th><th>Recession</th><th>Supply shock / sticky inflation</th><th>Soft landing / cuts</th></tr></thead><tbody>
   {baskets.map(([name,tickers,logic,hedge,...states])=><tr key={name}><td><strong>{name}</strong><br/>{tickers}<br/>{logic}</td><td>{hedge}</td>{states.map((state,i)=><td key={i}>{state}</td>)}</tr>)}
  </tbody></table></div>
  <p>Manual committee review: read BB macro and credit regime, then verified issuer filings and BB fundamentals; normalise cash earnings, compare valuation with internal entry ranges and stress downside, funding and portfolio overlap. Mark research now, wait, de-risk or no change only with evidence.</p>
 </section>;
}
