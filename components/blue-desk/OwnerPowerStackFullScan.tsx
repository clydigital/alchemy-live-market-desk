import "server-only";
import {readOwnerPowerStackQuoteScan} from "@/lib/bluebelly-owner-power-stack-quote-scan";
import styles from "./OwnerPortfolioHome.module.css";

type Row=Record<string,unknown>;
const text=(v:unknown,max=520)=>typeof v==="string"?v.trim().slice(0,max):"";
const number=(v:unknown):number|null=>typeof v==="number"&&Number.isFinite(v)?v:null;
const code=(v:unknown)=>{const x=text(v,20).toUpperCase();return /^[A-Z0-9][A-Z0-9.\-]{0,17}$/.test(x)?x:null;};
const asRows=(v:unknown,cap=200):Row[]=>Array.isArray(v)?v.slice(0,cap).filter((r):r is Row=>Boolean(r)&&typeof r==="object"&&!Array.isArray(r)):[];
const pct=(v:number|null)=>v===null?"—":`${v>0?"+":""}${v.toFixed(2)}%`;
function Delta({value}:{value:number|null}){
 return <td data-direction={value===null?"unknown":value>0?"up":value<0?"down":"flat"}>{pct(value)}</td>;
}
export default function OwnerPowerStackFullScan({snapshot,ownerSnapshotAsOf}:{
 snapshot:unknown;ownerSnapshotAsOf:string|null;
}){
 const record=snapshot&&typeof snapshot==="object"&&!Array.isArray(snapshot)?snapshot as Record<string,unknown>:{};
 const holdings=asRows(record.holdings,100),watchlist=asRows(record.watchlist,200);
 const scan=readOwnerPowerStackQuoteScan(snapshot);
 return <div data-power-stack-full-private-scan={scan?"source-dated":"missing"}>
  <div className={styles.scanHealth}>
   <div><strong>Source-dated market scan</strong>
    <span>{scan?.asOf?new Date(scan.asOf).toISOString().slice(0,16).replace("T"," ")+" UTC":"Awaiting private scan"}</span></div>
   <p>{scan?.holdingPriced??0}/{holdings.length} holdings and
    {" "}{scan?.watchPriced??0}/{watchlist.length} watchlist instruments have eligible completed-session prices.
    Your underlying investment ratings are archived separately, as of {ownerSnapshotAsOf||"an unknown date"}.</p>
   {scan&&(scan.unresolvedHolding.length+scan.unresolvedWatch.length>0)?
    <details><summary>{scan.unresolvedHolding.length+scan.unresolvedWatch.length} unresolved symbols</summary>
     <p>{[...scan.unresolvedHolding,...scan.unresolvedWatch].map(r=>r.ticker+": "+r.reason).join(" · ")}</p>
    </details>:null}
  </div>
  <h3 className={styles.scanTitle}>Recorded holdings · {holdings.length}</h3>
  <div className={styles.tableWrap}><table className={styles.table}>
   <thead><tr><th>Asset</th><th>Recorded quantity</th><th>Recorded price</th><th>Market close</th>
    <th>1D</th><th>3D</th><th>5D</th><th>Research / session</th></tr></thead>
   <tbody>{holdings.map((r,i)=>{
    const ticker=code(r.ticker)||"UNKNOWN-"+i;
    const pos=r.position&&typeof r.position==="object"&&!Array.isArray(r.position)?r.position as Row:{};
    const quote=scan?.holdingRows.get(ticker);
    const recorded=number(pos.latestPrice);
    return <tr key={ticker}>
     <th scope="row">{ticker}<span>{text(r.name,100)}</span></th>
     <td>{number(pos.quantity)??"—"}<small>{text(pos.quantityAsOf,40)||"Quantity unverified"}</small></td>
     <td>{recorded===null?"—":text(pos.currency,10)+" "+recorded.toLocaleString("en-GB")}</td>
     <td>{quote?.last?.toLocaleString("en-GB",{maximumFractionDigits:3})??"—"}</td>
     <Delta value={quote?.change??null}/><Delta value={quote?.change3d??null}/>
     <Delta value={quote?.change5d??null}/>
     <td>{quote?.asOf||"Unavailable"}<small>{text(r.action,150)||"Research pending"}</small>
      <details className={styles.rowDetails}><summary>Full holding assessment</summary>
       {number(r.score)!==null?<p><strong>Archived score:</strong> {number(r.score)}</p>:null}
       {text(r.verdict)?<p><strong>Verdict:</strong> {text(r.verdict)}</p>:null}
       {text(r.strength)?<p><strong>Strength:</strong> {text(r.strength)}</p>:null}
       {text(r.weakness)?<p><strong>Risk:</strong> {text(r.weakness)}</p>:null}
      </details>
     </td>
    </tr>;
   })}</tbody>
  </table></div>
  <details className={styles.watchlist} open data-full-watchlist={watchlist.length}>
   <summary>All {watchlist.length} watchlist candidates · ranked research</summary>
   <p className={styles.vintage}>All symbols are included—even those without verified prices.
    Ratings, entry tests and invalidation were recorded on the older investment-research date.</p>
   <div className={styles.tableWrap}><table className={styles.table}>
    <thead><tr><th>Candidate</th><th>Archived action / score</th><th>Close</th>
     <th>1D</th><th>3D</th><th>5D</th><th>Research / source date</th></tr></thead>
    <tbody>{watchlist.map((r,i)=>{
      const ticker=code(r.ticker)||"UNKNOWN-"+i;
      const quote=scan?.watchRows.get(ticker);
      return <tr key={ticker}>
       <th scope="row">#{number(r.rank)??"—"} · {ticker}<span>{text(r.name,100)}</span></th>
       <td>{text(r.action,110)||"Research pending"}<small>{number(r.score)===null?"Unscored":"Score "+number(r.score)}</small></td>
       <td>{quote?.last?.toLocaleString("en-GB",{maximumFractionDigits:3})??"—"}</td>
       <Delta value={quote?.change??null}/><Delta value={quote?.change3d??null}/>
       <Delta value={quote?.change5d??null}/>
       <td>{quote?.asOf||"Unavailable"}<small>{text(r.theme,120)}</small>
        <details className={styles.rowDetails}><summary>Thesis and decision gates</summary>
         {text(r.latestDecision)?<p><strong>Decision:</strong> {text(r.latestDecision)}</p>:null}
         {text(r.thesis)?<p><strong>Thesis:</strong> {text(r.thesis)}</p>:null}
         {text(r.confirmation)?<p><strong>Confirm:</strong> {text(r.confirmation)}</p>:null}
         <p><strong>Entry:</strong> {text(r.entry)||"Unspecified"}</p>
         <p><strong>Invalidation:</strong> {text(r.invalidation)||"Unspecified"}</p>
        </details>
       </td>
      </tr>;
    })}</tbody>
   </table></div>
  </details>
  <p className={styles.vintage}>Market returns use independently collected completed sessions, not portfolio
   total returns. This display does not verify broker positions, cash, capital allocation or live execution.
   Ineligible or stale quotes display —, not made-up current values.</p>
 </div>;
}
