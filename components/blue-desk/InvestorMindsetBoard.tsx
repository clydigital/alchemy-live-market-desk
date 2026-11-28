import Link from "next/link";
import type {InvestorMindsetSnapshot,InvestorMindsetRow} from "@/lib/bluebelly-investor-mindset";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import s from "./InvestorMindsetBoard.module.css";

const TAPE_TEXT={
 RISK_ON:"EQUITY RISK-ON",
 RISK_OFF:"EQUITY RISK-OFF",
 MIXED:"MIXED EQUITY TAPE",
 UNMEASURED:"TAPE UNMEASURED",
} as const;
function readableDate(raw:string|null):string{
 return raw?raw.slice(0,10):"No fresh observation";
}
function Row({row,host}:{row:InvestorMindsetRow;host:string|null}){
 return <tr className={s.row} data-mindset-tone={row.tone} data-mindset-topic={row.id}>
  <th scope="row" className={s.lens}>
   <span className={s.lensText}>{row.label}</span>
   <Link href={blueDeskPublicHref(row.href,host)} className={s.rowLink}>Open detail <span aria-hidden="true">↗</span></Link>
  </th>
  <td className={s.signalCell} data-column="Signal">
   <strong className={s.signal}>{row.signal}</strong>
   <span className={s.measurement} title={row.measurement}>{row.measurement}</span>
   <span className={s.asOf}>{row.asOf?"Source "+readableDate(row.asOf):"Dated data unavailable"}</span>
  </td>
  <td className={s.questionCell} data-column="Investor question">
   <span className={s.assessmentLabel}>HYPOTHESIS TO TEST</span><p>{row.question}</p>
  </td>
  <td className={s.testCell} data-column="Next evidence">
   <p>{row.nextTest}</p>
   {row.sources.length?<div className={s.sources}>
    {row.sources.map((item,index)=><a key={item.url+"-"+index} href={item.url}
      target="_blank" rel="noopener noreferrer">{item.name} <span aria-hidden="true">↗</span></a>)}
   </div>:<span className={s.noSource}>Source gap — no substitute inferred</span>}
  </td>
 </tr>;
}

/** Public display of existing data and conditional questions, not a new prediction engine. */
export default function InvestorMindsetBoard({snapshot,host,themes=[]}:{snapshot:InvestorMindsetSnapshot;host:string|null;themes?:readonly InvestorMindsetRow[]}){
 return <section className={s.board} data-home-investor-mindset="source-dated-v1"
   aria-labelledby="investor-mindset-title">
  <header className={s.heading}>
   <div className={s.headCopy}>
    <p className={s.kicker}><span className={s.diamond} aria-hidden="true"/> BLUEBELLY / INVESTOR GAME THEORY</p>
    <h2 id="investor-mindset-title">What is the money <em>thinking?</em></h2>
    <p className={s.subtitle}>Read the market, question the incentive, then identify what would change the view.</p>
    <div className={s.assessmentStatus} data-research-mode="source-dated">
     <strong>MARKET OBSERVATIONS &amp; RESEARCH QUESTIONS</strong>
     <span>{snapshot.rows.filter(row=>row.asOf&&row.sources.length>0&&row.tone!=="unmeasured").length}/{snapshot.rows.length} core lenses with dated evidence · {themes.filter(row=>row.asOf&&row.sources.length>0&&row.tone!=="unmeasured").length} additional qualified research themes</span>
     <span>Investor motives are hypotheses, not confirmed flows. Private research is reviewed on request.</span>
    </div>
   </div>
   <div className={s.tape} data-investor-tape={snapshot.tape}>
    <span>OBSERVED EQUITY TAPE</span>
    <strong>{TAPE_TEXT[snapshot.tape]}</strong>
    <small>{snapshot.tapeSession?"Matched US session "+snapshot.tapeSession:"Matched session not established"}</small>
   </div>
  </header>
  <div className={s.tableWrap}>
   <table className={s.table}>
    <caption className={s.srOnly}>Five source-dated market signals, investor questions and deciding tests</caption>
    <thead><tr>
     <th scope="col">MARKET LENS</th>
     <th scope="col">WHAT WE CAN OBSERVE</th>
     <th scope="col">WHAT INVESTORS MAY BE DECIDING</th>
     <th scope="col">NEXT PROOF / INVALIDATION</th>
    </tr></thead>
    <tbody>{snapshot.rows.map(row=><Row key={row.id} row={row} host={host}/>)}</tbody>
   </table>
  </div>
  {themes.length>0&&<details className={s.tableWrap} data-investor-research-themes="bluebelly-source-only"><summary>Additional live research themes · AI cash conversion, China, food, cyber, power and reversal</summary>
   <table className={s.table}><caption className={s.srOnly}>Source-qualified research context and deciding tests</caption><thead><tr><th scope="col">MARKET LENS</th><th scope="col">WHAT WE CAN OBSERVE</th><th scope="col">WHAT INVESTORS MAY BE DECIDING</th><th scope="col">NEXT PROOF / INVALIDATION</th></tr></thead>
   <tbody>{themes.map(row=><Row key={row.id} row={row} host={host}/>)}</tbody></table>
  </details>}
  <footer className={s.footer}>
   <p><strong>Read correctly:</strong> Signals are dated observations, not proof of institutional flows or investor intent. Research questions are conditional; missing evidence remains visible. No unverified probabilities are generated.</p>
   <div className={s.links}>
    <Link href={blueDeskPublicHref("/blue-desk/regime-watch",host)}>Regime War Rooms <span aria-hidden="true">↗</span></Link>
    <Link href={blueDeskPublicHref("/blue-desk/crash-opportunity",host)}>Crash vs Opportunity <span aria-hidden="true">↗</span></Link>
   </div>
  </footer>
 </section>;
}
