import "server-only";
import Link from "next/link";
import type {PublicEquityCoverageRow} from "@/lib/bluebelly-equity-coverage";
import type {IssuerReviewResult} from "@/lib/power-stack-issuer-valuation";
import type {LongEquityRead} from "@/lib/bluebelly-equity-long-history";
import type {FundamentalRow} from "@/lib/bluebelly-fundamental-comparison";
import type {EmaObservation} from "@/lib/bluebelly-equity-ema";
import styles from "@/app/power-stack/private-power-stack.module.css";

const pct=(v:number)=> (v>=0?"+":"")+v.toFixed(1)+"%";
function bandRespectText(o:EmaObservation):string|null{
 const r=o.bandRespect;if(!r)return null;
 const t=r.lastRetest;
 if(r.status==="RESPECTED"&&t)return "Last respected "+t.boundary+" SD · "+t.direction+" · "+t.session;
 if(r.status==="BREAK_PENDING"&&t)return "Respected "+t.boundary+" SD at risk · "+r.outsideCloses+" outside close(s) · retest "+t.session;
 if(r.status==="RESET"&&t)return "Respected "+t.boundary+" SD invalidated · "+(r.resetOn??"date unavailable")+" · prior retest "+t.session;
 return "Retest replay: "+r.status.toLowerCase().replaceAll("_"," ");
}
function statements(o:EmaObservation){
 const out:string[]=[],seen=new Set<string>();
 for(const w of ["1","3","5"] as const){const s=o.windows[w];if(!s)continue;
  for(const a of s.boundaryApproaches??[]){const key="approach|"+a.boundary+"|"+a.direction;if(seen.has(key))continue;seen.add(key);out.push(w+"D "+(a.direction==="up"?"rising toward":"falling toward")+" "+(a.boundary==="ema"?"EMA":a.boundary+" SD")+" "+a.level.toFixed(2)+" ("+pct(a.distancePct)+")");}
  if(!s.boundaryApproaches&&(s.approach==="down_to"||s.approach==="up_to")&&Math.abs(o.distancePct)<=3)out.push(w+"D "+(s.approach==="down_to"?"falling toward":"rising toward")+" EMA");
  for(const e of s.events??[]){const key=e.session+"|"+e.boundary+"|"+e.direction;if(seen.has(key))continue;seen.add(key);
   out.push(w+"D crossed "+(e.direction==="up"?"above":"below")+" "+(e.boundary==="ema"?"EMA":e.boundary+" SD")+" · "+e.session);}
 }
 for(const h of o.closeHolds??[])out.push((h.status==="HOLD_CONFIRMED"?"Close hold confirmed":"Break; hold pending")+" · "+h.consecutiveCloses+" closes "+(h.direction==="up"?"above ":"below ")+(h.boundary==="ema"?"EMA":h.boundary+" SD"));
 const r=o.bandRespect;
 // A standing respected band is context; only a recent retest, pending break
 // or recent reset earns a Technical Watch event. Never promote missing data.
 if(r&&r.lastRetest&&o.warmup==="READY"){
  const eventDate=r.status==="RESET"?r.resetOn:r.lastRetest.session;
  const recent=eventDate!==null&&eventDate!==undefined&&Date.parse(o.asOf)-Date.parse(eventDate)<=7*86400000&&Date.parse(o.asOf)>=Date.parse(eventDate);
  if(r.status==="BREAK_PENDING"||recent&&(r.status==="RESPECTED"||r.status==="RESET")){const label=bandRespectText(o);if(label)out.push(label);}
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
 ["Market infrastructure and exchanges","ICE CME CBOE BLK","Trading and clearing fees, recurring data, assets under management; separate transaction revenue from equity beta.","Conditional hedge to volatility, not guaranteed downside protection","Good","Mixed","Mixed","Good","Good"],
 ["Security and defence","LDOS PANW CHKP CRWD","Funded public-sector contracts, renewals, cash conversion and backlog; valuations still matter.","Diversifies compute capex exposure","Good","Mixed","Mixed","Good","Good"],
 ["Materials and agricultural inputs","CF MOS FCX SCCO NTR","Cost curve, commodity prices, inventories, replacement demand and balance sheet.","Conditional supply/inflation hedge; vulnerable to demand contraction","Good","Poor","Poor","Good","Mixed"],
 ["Malaysia infrastructure","0245.KL 0310.KL 0296.KL 5398.KL 5347.KL","Cash collection, funded backlog and grid demand.","Local demand / currency diversification; AI overlap remains","Good","Mixed","Poor","Mixed","Good"],
] as const;
type PrivateLevel={ticker:string;currency:string;low:number|null;high:number|null;note:string;updatedAt:string};
export default function PowerStackBBMarketSweep({rows,reviews,asOf,levels,fundamentals,longHistory}:{rows:readonly PublicEquityCoverageRow[];reviews:readonly IssuerReviewResult[];asOf:string;levels:readonly PrivateLevel[];fundamentals:readonly FundamentalRow[];longHistory:LongEquityRead|null}){
 const levelByTicker=new Map<string,PrivateLevel>();
 const conflicted=new Set<string>();
 for(const level of levels){const prior=levelByTicker.get(level.ticker);if(prior&&(prior.currency!==level.currency||prior.low!==level.low||prior.high!==level.high))conflicted.add(level.ticker);else if(!prior)levelByTicker.set(level.ticker,level);}
 for(const ticker of conflicted)levelByTicker.delete(ticker);
 const factsByTicker=new Map(fundamentals.map(x=>[x.ticker,x]));
 const reviewByTicker=new Map(reviews.map(r=>[r.ticker,r]));
 const eligible=rows.filter(r=>r.status==="SOURCE_DATED"&&r.price!==null&&r.asOf&&r.asOf<=asOf&&Date.parse(asOf+"T00:00:00Z")-Date.parse(r.asOf+"T00:00:00Z")<=5*86400000);
 const signals=eligible.filter(r=>r.theme!=="REAL_ESTATE"&&(r.region!=="US"||r.sessionFreshness==="LATEST_COMPLETED_US_SESSION")).map(r=>({row:r,levels:(r.region==="US"&&r.emaScan?.recentSessionQuality?.status!=="VERIFIED"?[]:r.emaScan?.observations??[]).filter(o=>o.warmup==="READY").map(o=>({o,statements:statements(o)})).filter(x=>x.statements.length)??[],review:reviewByTicker.get(r.ticker),entry:levelByTicker.get(r.ticker),fundamental:factsByTicker.get(r.ticker)}));
 const nearEntry=(x:typeof signals[number])=>!!x.entry&&x.entry.currency===x.row.currency&&x.row.price!<=(x.entry.high??x.entry.low??0)*1.03;
 const flagged=signals.filter(x=>nearEntry(x)||x.levels.length||x.review&&x.review.currency===x.row.currency&&x.row.price!<=x.review.valuationLow*1.05).sort((a,b)=>Number(nearEntry(b))-Number(nearEntry(a))||(a.row.changePct??0)-(b.row.changePct??0));
 return <section id="bb-market-sweep" className={styles.section} data-power-stack-bb-sweep="canonical-market-read">
  <h2>04 / Technical Watch · {asOf}</h2>
  <p>Real estate is valuation-only; short-warm-up bands are reference context, not qualifying technical alerts. {conflicted.size?`Conflicting private marks require reconciliation: ${[...conflicted].join(", ")}.`:""}</p>
  <p>{eligible.length}/{rows.length} recent source-dated equity observations; {eligible.filter(r=>r.sessionFreshness==="BEHIND_US_SESSION").length} US rows lag the expected completed session and are excluded from technical alerts. US technical events also require verified recent session continuity. Local session dates require venue checks. Research alerts only; a falling price or EMA crossing is not proof of value. <Link href="/markets">Full BB market universe</Link>.</p>
  <p>Approach alert: within 3% of the EMA or either SD edge with a narrowing signed distance and matching price direction over 1, 3 or 5 completed daily sessions. Crosses use completed daily closes within each window; intraday-only breaches are not inferred. A US close hold requires the crossing close plus two subsequent closes on the same side, with six contiguous scheduled sessions and ready warm-up. A separate daily wick-retest replay requires 20 contiguous verified sessions, valid OHLC and ready warm-up. It uses prior-close bands; three outside closes invalidate the respected edge. This is bounded reconstructed context, not a trade signal or durable trend ledger. W/M anchors use completed periods only. The common BB kernel uses a first-close EMA seed and population SD. Short warm-up (less than 5× period) is indicative only; missing history stays unavailable.</p>
  <form action="/power-stack#bb-market-sweep" method="get"><label>Manual long-history deep dive: <select name="technical" defaultValue={longHistory?.ticker??""}><option value="">Select equity</option>{rows.filter(r=>r.theme!=="REAL_ESTATE").map(r=><option key={r.ticker} value={r.ticker}>{r.ticker} · {r.company}</option>)}</select></label> <button type="submit">Check D/W/M EMA</button></form>
  {longHistory?<details open className={styles.assetDetails}><summary><strong>{longHistory.ticker} · Long-history check · {longHistory.status}</strong></summary><p>{longHistory.reason} · <a href={longHistory.sourceUrl}>History source</a>{longHistory.asOf?" · "+longHistory.historyStart+" to "+longHistory.asOf+" · "+longHistory.bars+" daily bars":""}</p>
  {longHistory.scan?.observations.map(o=><p key={o.frame+o.period}>{o.frame} EMA{o.period}: {o.ema.toFixed(2)} · price {o.side} ({pct(o.distancePct)}) · {o.band.replaceAll("_"," ")} {o.multiplier} SD · {statements(o).join("; ")||bandRespectText(o)||"No recent boundary event"} · anchor {o.anchorDay} · {o.warmup==="READY"?"warm-up ready":"short warm-up; indicative"}</p>)}
  {longHistory.scan?.unavailable.length?<p>Insufficient history: {longHistory.scan.unavailable.join(", ")}</p>:null}</details>:null}
  {!flagged.length?<p>No verified proximity or crossing alerts from available observations. Check source coverage.</p>:null}
  <div className={styles.watchGrid}>{flagged.slice(0,12).map(({row,levels,review,entry,fundamental})=><details className={styles.assetDetails} key={row.ticker}>
   <summary><strong>{row.ticker}</strong> · {row.currency} {row.price?.toFixed(2)} · {row.asOf} · 1D {row.changePct==null?"—":pct(row.changePct)} / 3D {row.change3dPct==null?"—":pct(row.change3dPct)} / 5D {row.change5dPct==null?"—":pct(row.change5dPct)}</summary>
   {entry&&entry.currency===row.currency?<p><strong>Private marked level:</strong> {entry.low??"—"}–{entry.high??"—"} {entry.currency} · {row.price!>(entry.high??entry.low??0)?"above":row.price!<(entry.low??entry.high??0)?"below":"inside"} · {pct((row.price!/(entry.high??entry.low??1)-1)*100)} vs upper mark. {entry.note}</p>:null}
   {fundamental&&fundamental.facts.length?<details><summary>BB issuer facts · {fundamental.status} · {fundamental.period}</summary>{fundamental.facts.map(f=><p key={f.key}>{f.label}: {f.value.toLocaleString()} {f.unit} · <a href={f.sourceUrl}>{f.filingDay}</a></p>)}</details>:<p>BB issuer fundamentals unavailable; manual filing review required.</p>}
   {review&&review.currency===row.currency?<p>Reviewed value range {review.valuationLow}–{review.valuationHigh} {review.currency}, reviewed {review.reviewedAt.slice(0,10)}; current discount to low end {pct((1-row.price!/review.valuationLow)*100)}. Model assumptions, not an order.</p>:null}
   {levels.map(({o,statements:s})=><p key={o.frame+o.period}><strong>{o.frame} EMA{o.period}</strong> {o.ema.toFixed(2)} · price {o.side} ({pct(o.distancePct)}) · {o.band.replaceAll("_"," ")} {o.multiplier} SD envelope · {s.join("; ")} · {o.warmup==="READY"?"warm-up ready":"short warm-up; indicative"}.</p>)}
   <details><summary>All available EMA states</summary>{row.emaScan?.observations.map(o=><p key={o.frame+o.period}>{o.frame} EMA{o.period} · price {o.side} ({pct(o.distancePct)}) · {o.band.replaceAll("_"," ")} · {o.warmup==="READY"?"warm-up ready":"short warm-up; indicative"}{bandRespectText(o)?" · "+bandRespectText(o):""}</p>)}</details>
   <p>Unavailable anchors: {row.emaScan?row.emaScan.unavailable.join(", ")||"none":"entire EMA scan unavailable"}</p>
  </details>)}</div>
  {flagged.length>12?<details className={styles.assetDetails}><summary>More flagged symbols ({flagged.length-12})</summary><ul>{flagged.slice(12).map(({row,levels})=><li key={row.ticker}>{row.ticker}: {levels.map(({o,statements:s})=>o.frame+" EMA"+o.period+" "+s.join(", ")).join("; ")||"reviewed value proximity"}</li>)}</ul></details>:null}
  <details className={styles.assetDetails}><summary>All private marked equity levels ({levels.length})</summary><ul>{levels.map(entry=>{const row=eligible.find(r=>r.ticker===entry.ticker&&r.currency===entry.currency);return <li key={entry.ticker}>{entry.ticker} · {entry.currency} {entry.low??"—"}–{entry.high??"—"} · {row?row.price?.toFixed(2)+" on "+row.asOf:"No matching recent BB equity quote"}</li>})}</ul></details>
  <p><Link href="/market-tools?view=technical#ema-sd-levels">Owner Technical Watch · 4H / D / W / M</Link> — independent vendor cross-check using the same numerical kernel; no automatic second-provider requests.</p>
  <details className={styles.assetDetails}><summary>Scenario baskets · research hypotheses</summary><p>Directional tendencies, not measured hedge ratios or forecasts. Shared exposures can still decline together. Evaluate the actual issuer, valuation, leverage and funding before investing.</p>
  <div className={styles.tableScroll}><table className={styles.holdingsTable}><thead><tr><th>Basket / thesis</th><th>Potential diversification</th><th>AI boom</th><th>AI bust</th><th>Recession</th><th>Supply shock / sticky inflation</th><th>Soft landing / cuts</th></tr></thead><tbody>
   {baskets.map(([name,tickers,logic,hedge,...states])=><tr key={name}><td><strong>{name}</strong><br/>{tickers}<br/>{logic}</td><td>{hedge}</td>{states.map((state,i)=><td key={i}>{state}</td>)}</tr>)}
  </tbody></table></div>
  </details>
  <p>Manual committee review: read BB macro and credit regime, then verified issuer filings and BB fundamentals; normalise cash earnings, compare valuation with internal entry ranges and stress downside, funding and portfolio overlap. Mark research now, wait, de-risk or no change only with evidence.</p>
 </section>;
}
