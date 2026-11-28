import "server-only";
import Link from "next/link";
import {projectPowerStackBandReviews,bandReviewLabel,type AssetReview,type PeriodReview} from "@/lib/power-stack-band-review";
import {matchesScannerGroup,type ScanAsset} from "@/lib/technical-market-scanner";
import type {FourHRead} from "@/lib/bluebelly-4h-levels";
import styles from "@/app/power-stack/private-power-stack.module.css";
const frames=["D","W","M"] as const;
const price=(n:number)=>n.toLocaleString("en-GB",{maximumFractionDigits:4});
function FrameReading({r,f}:{r:PeriodReview;f:typeof frames[number]}){
 const c=r.frames[f],o=r.levels[f];
 if(!c||!o)return <span>Unavailable</span>;
 return <><strong>{bandReviewLabel(c)}</strong><br/><small>{c.quality} · {c.date}<br/>SD {price(o.lower)}–{price(o.upper)} · EMA {price(o.ema)}<br/>{c.side} EMA{c.lastExit?" · last exit "+c.lastExit.asOf:""}</small></>;
}
function AssetDetails({r}:{r:AssetReview}){
 return <details className={styles.assetDetails}><summary><strong>{r.asset.ticker} · {r.state}</strong> · {r.asset.memberships.join(" / ")||r.asset.theme} · {r.asset.price===null?"No matching price":price(r.asset.price)+" "+(r.asset.currency??"")+" · "+r.asset.asOf}{r.focus?" · EMA"+r.focus.period:""}</summary>
 {r.focus?<><p><strong>{r.focus.alignment}</strong> — {r.focus.reason}</p><div className={styles.tableScroll}><table className={styles.holdingsTable}><thead><tr><th>EMA</th>{frames.map(f=><th key={f}>{f}</th>)}<th>4H timing only</th><th>Review</th></tr></thead><tbody>{r.periods.map(p=><tr key={p.period}><th scope="row">{p.period}</th>{frames.map(f=><td key={f}><FrameReading r={p} f={f}/></td>)}<td>{p.execution?<>{bandReviewLabel(p.execution)}<br/><small>{p.execution.quality} · {p.execution.date}</small></>:"Not checked / unavailable"}</td><td>{p.state}<br/><small>{p.alignment} · {p.reason}</small></td></tr>)}</tbody></table></div></>:<p>Property remains valuation-led; do not use EMA to rank the investment.</p>}
 <p>{r.asset.sourceUrl?<a href={r.asset.sourceUrl}>{r.asset.sourceName??"Market source"}</a>:r.asset.quality} · {r.asset.detail?<Link href={"/market-tools?technical="+encodeURIComponent(r.asset.ticker)}>Full Technical Watch</Link>:<Link href="/market-tools?view=technical-scan&scope=ps">EMA Scanner</Link>}</p></details>;
}
export default function PowerStackBandReview({assets,reads,sourceDate,privateStatus}:{assets:ScanAsset[];reads:FourHRead[];sourceDate:string|null;privateStatus:string}){
 const reviews=projectPowerStackBandReviews(assets,reads);
 const tracked=reviews.filter(r=>matchesScannerGroup(r.asset,"PowerStack"));
 const market=reviews.filter(r=>matchesScannerGroup(r.asset,"All Markets"));
 const alerts=market.filter(r=>!r.asset.memberships.length&&["Review downside","Review recovery","Watch boundary"].includes(r.state));
 const rank=(r:AssetReview)=>r.asset.memberships.includes("Holding")?0:r.asset.memberships.includes("Saved idea")?1:2;
 const ordered=[...tracked].sort((a,b)=>rank(a)-rank(b));
 const counts=(rows:AssetReview[])=>["Review downside","Review recovery","Watch boundary","Monitor / retest","Context only","Unassessed","Valuation only"].map(state=>state+": "+rows.filter(r=>r.state===state).length).join(" · ");
 return <div id="power-stack-band-review" data-power-stack-band-review="shared-scanner-cells">
 <h3>Band-state decision queue</h3><p>Same classifications and source dates as the EMA Scanner. Monthly structural context, weekly bias, daily setup; 4H is indicative timing only and never changes investment-review priority. Review each EMA separately. Conflicting periods remain visible.</p>
 <p><strong>Recorded portfolio / ideas:</strong> {tracked.length} instruments · {counts(tracked)}. {privateStatus} Markets cache: {sourceDate??"unavailable"}.</p>
 <p><strong>Decision gate:</strong> Review downside first (risk and invalidation), then recovery (hold/retest and value), then approaching edges (prepare levels). Inside arrows preserve history, not a new signal. Check current BB macro, credit, rotation, creator evidence and issuer filings before a Buy/Add/Hold/Trim/Exit decision; no automatic trade instruction.</p>
 {ordered.slice(0,8).map(r=><AssetDetails key={r.asset.ticker} r={r}/>)}
 {ordered.length>8?<details className={styles.assetDetails}><summary>Remaining tracked instruments ({ordered.length-8})</summary>{ordered.slice(8).map(r=><AssetDetails key={r.asset.ticker} r={r}/>)}</details>:null}
 <details className={styles.assetDetails}><summary>Broader BB opportunity / risk radar · {alerts.length} qualifying non-tracked candidates</summary><p>{market.length} market instruments. {counts(market)}. Counts describe coverage and review priorities, not market breadth or a directional vote.</p>{alerts.slice(0,12).map(r=><AssetDetails key={r.asset.ticker} r={r}/>)}{alerts.length>12?<p>Remaining {alerts.length-12}: {alerts.slice(12).map(r=>r.asset.ticker+" ("+r.state+")").join(", ")}.</p>:null}<p><Link href="/market-tools?view=technical-scan">All Markets scanner →</Link></p></details>
 <p>W/M readings are daily closes against prior completed higher-timeframe anchors, not native weekly/monthly candle confirmations. Unverified local calendars, short warm-up, stale/missing history and unknown last exits are not qualifying signals. <Link href="/market-tools?view=technical-scan&scope=ps">PowerStack scanner →</Link></p>
 </div>;
}
