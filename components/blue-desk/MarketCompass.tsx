import Link from "next/link";
import type {MarketCompassSummary} from "@/lib/bluebelly-market-compass";
import type {RegimeMeterReading} from "@/lib/bluebelly-regime-market-meter";
import type {RegimeDirectionId} from "@/lib/bluebelly-regime-direction-reads";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import {lensCardSignal} from "@/lib/bluebelly-regime-lens-card-signal";
import styles from "./MarketCompass.module.css";

const NAMES:Readonly<Record<RegimeDirectionId,string>>={
 ai:"AI chips",fed:"US 2Y",bonds:"US 10/30Y",breadth:"Breadth",energy:"Crude oil"
};
const ORDER:readonly RegimeDirectionId[]=["ai","fed","bonds","breadth","energy"];
const POSITION:Readonly<Record<MarketCompassSummary["state"],number>>={
 RISK_OFF:0,MIXED:1,RISK_ON:2,UNMEASURED:-1
};
export default function MarketCompass({
 summary,readings,host
}:{
 summary:MarketCompassSummary;
 readings:Record<RegimeDirectionId,RegimeMeterReading>;
 host:string|null;
}){
 const selected=POSITION[summary.state];
 return <section id="direction-overview" className={styles.wrap} data-market-compass="source-dated-1d" data-compass-state={summary.state}>
  <div className={styles.top}>
   <span className={styles.kicker}>BLUEBELLY / MARKET COMPASS</span>
   <span className={styles.disclaimer}>READ-ONLY · MARKET TAPE, NOT A TRADE SIGNAL</span>
  </div>
  <div className={styles.main}>
   <div className={styles.verdict}>
    <div className={styles.horizon}>US EQUITY RISK APPETITE · COMPLETED 1D SESSION</div>
    <h1>{summary.title}</h1>
    <p>{summary.explanation}</p>
    <div className={styles.session} aria-live="polite">
     {summary.sourceSession?
      <><span className={styles.sessionDot}/> Matched source session <time dateTime={summary.sourceSession}>{summary.sourceSession}</time> · {summary.evidenceCount} ETF returns</>
      :<>No complete four-ETF session · evidence incomplete</>}
    </div>
   </div>
   <div className={styles.risk} role="group" aria-label="Qualitative one-day US equity direction, not a probability">
    <div className={styles.riskTop}>OBSERVED DIRECTION <span>1D / ORDINAL</span></div>
    <div className={styles.riskRail}>
     {(["RISK-OFF","MIXED","RISK-ON"] as const).map((label,index)=>
       <div key={label} className={styles.riskCell} data-selected={index===selected}>{label}</div>
     )}
    </div>
    <p>{selected===-1?"Insufficient matched evidence": "Observed ETF direction only. The wider macro regime remains independently assessed."}</p>
   </div>
  </div>
  <div className={styles.decision}>
   <div className={styles.decisionBlock}>
    <span>THE CONTRADICTION / WHAT DOESN&apos;T FIT</span>
    <strong>{summary.contradiction}</strong>
   </div>
   <div className={styles.decisionBlock}>
    <span>THE NEXT DECIDING TEST</span>
    <strong>{summary.nextTest}</strong>
   </div>
  </div>
  <div className={styles.assetHeader}><h2>Five independent market checks</h2>
   <span>Coloured by the pressure or strength of each named proxy—not a regime or trade call.</span></div>
  <div className={styles.legend} aria-label="Market Compass colour key">
   <span data-legend-tone="improving"><i aria-hidden="true"/> Easing pressure / strengthening</span>
   <span data-legend-tone="pressure"><i aria-hidden="true"/> Rising pressure / weakening</span>
   <span data-legend-tone="mixed"><i aria-hidden="true"/> Mixed / flat</span>
   <span data-legend-tone="unknown"><i aria-hidden="true"/> Unmeasured / stale</span>
  </div>
  <div className={styles.assets}>
   {ORDER.map(id=>{
    const item=readings[id];
    const signal=lensCardSignal(id,readings);
    const observed=signal.tone!=="unknown";
    return <Link key={id} className={styles.asset} data-asset-id={id} data-status={item.state}
      data-signal-tone={signal.tone}
      href={blueDeskPublicHref("/blue-desk/regime-watch/"+id,host)+(id==="bonds"?"#bond-pressure":"#quick-direction")}
      aria-label={NAMES[id]+": "+signal.label+". "+signal.readout+". "+(signal.sourceDate||"Source date unavailable")}>
      <div className={styles.assetTop}><span>{NAMES[id]}</span><b aria-hidden="true">{!observed?"—":item.direction===1?"↑":item.direction===-1?"↓":"→"}</b></div>
      <strong>{signal.label}</strong>
      <small className={styles.assetDelta}>{observed?(item.direction===1?"Rising":item.direction===-1?"Falling":"Flat")+" · ":""}{signal.readout}</small>
      <small className={styles.assetScope}>{signal.scope}</small>
      <small className={styles.assetClock}>{item.observedAt||"No verified source date"}{item.state==="last_reported"?" · LAST REPORTED":""}</small>
     </Link>;
   })}
  </div>
  <details className={styles.details} id="market-compass-evidence">
   <summary>Inspect underlying market observations and limitations <span aria-hidden="true">⌄</span></summary>
   <div className={styles.detailsBody}>
    <p>{summary.note} Price behaviour must not automatically revise the canonical Dossier, Story or Regime.</p>
    <div className={styles.tableWrap}>
     <table><thead><tr><th scope="col">Market check</th><th scope="col">1D</th><th scope="col">3D</th><th scope="col">5D</th><th scope="col">Source session</th></tr></thead>
      <tbody>{ORDER.map(id=>{const item=readings[id];return <tr key={id}>
       <th scope="row">{NAMES[id]}<small>{item.scope}</small></th>
       {(["1D","3D","5D"] as const).map(window=>{
        const sample=item.windows.find(w=>w.label===window);
        return <td key={window}>{item.state!=="unavailable"?(sample?.readout||"NOT SUPPLIED"):"NOT SUPPLIED"}</td>;
       })}
       <td>{item.observedAt||"Unavailable"}{item.sourceUrl?<a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Source ↗</a>:null}</td>
      </tr>})}</tbody>
     </table>
    </div>
    <p>Crude is not a physical-shipping reading; semiconductor prices are not AI cash flow; front-end yields are not FedWatch odds. Some readings use different source sessions or a 5D breadth series. Do not combine them into a numerical score.</p>
   </div>
  </details>
  <div className={styles.footer}>
   <span>To investigate causes, open Regime evidence and the divergence radar below.</span>
   <Link href={blueDeskPublicHref("/blue-desk/crash-opportunity",host)}>Crash versus opportunity ↗</Link>
  </div>
 </section>;
}
