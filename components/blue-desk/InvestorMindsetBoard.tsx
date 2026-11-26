import Link from "next/link";
import type {InvestorMindsetSnapshot,InvestorMindsetRow} from "@/lib/bluebelly-investor-mindset";
import type {InvestorAssessmentRead,InvestorLensReview} from "@/lib/bluebelly-investor-assessment";
import type {InvestorReviewReceipt} from "@/lib/bluebelly-investor-review-receipt";
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
function Row({row,host,review}:{row:InvestorMindsetRow;host:string|null;review?:InvestorLensReview}){
 const assessment=review?.status==="RESEARCHED"?review.interpretation:null;
 return <tr className={s.row} data-mindset-tone={row.tone} data-mindset-topic={row.id} data-lens-review={review?.status??"UNRESOLVED"}>
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
   {assessment?<><span className={s.assessmentLabel}>DOSSIER RESEARCH · INFERRED MOTIVE</span>
    <p className={s.assessmentText}>{assessment}</p><small className={s.behaviourQuestion}>Investor question: {row.question}</small>
    {review?.previousInterpretation&&<details><summary>Prior interpretation</summary><p>{review.previousInterpretation}</p></details>}</>:
    <><span className={s.assessmentLabel}>{review?.status==="STALE"?"QUESTION · PRIOR REVIEW STALE":"QUESTION · EVIDENCE NOT YET SUFFICIENT"}</span><p>{row.question}</p>
    {review?.status==="STALE"&&review.interpretation&&<details><summary>Historical inference (not current)</summary><p>{review.interpretation}</p></details>}</>}
   {review&&<small className={s.behaviourQuestion}>Assessment {readableDate(review.asOf)} · Evidence through {review.sourceThrough?readableDate(review.sourceThrough):"unverified"}</small>}
  </td>
  <td className={s.testCell} data-column="Next evidence">
   <p>{review?.status==="RESEARCHED"&&review.nextTest?review.nextTest:row.nextTest}</p>
   {row.sources.length?<div className={s.sources}>
    {row.sources.map((item,index)=><a key={item.url+"-"+index} href={item.url}
      target="_blank" rel="noopener noreferrer">{item.name} <span aria-hidden="true">↗</span></a>)}
   </div>:<span className={s.noSource}>Source gap — no substitute inferred</span>}
  </td>
 </tr>;
}

/** Public display of existing data and conditional questions, not a new prediction engine. */
export default function InvestorMindsetBoard({snapshot,assessment,host,themes=[],receipt=null}:{snapshot:InvestorMindsetSnapshot;assessment:InvestorAssessmentRead;host:string|null;themes?:readonly InvestorMindsetRow[];receipt?:InvestorReviewReceipt|null}){
 return <section className={s.board} data-home-investor-mindset="source-dated-v1"
   aria-labelledby="investor-mindset-title">
  <header className={s.heading}>
   <div className={s.headCopy}>
    <p className={s.kicker}><span className={s.diamond} aria-hidden="true"/> BLUEBELLY / INVESTOR GAME THEORY</p>
    <h2 id="investor-mindset-title">What is the money <em>thinking?</em></h2>
    <p className={s.subtitle}>Read the market, question the incentive, then identify what would change the view.</p>
    <div className={s.assessmentStatus} data-fundamental-status={assessment.status}>
     <strong>{assessment.status==="RESEARCHED"?"FUNDAMENTAL REVIEWED":assessment.status==="PARTIAL"?"FUNDAMENTAL PARTIALLY REVIEWED":assessment.status==="STALE"?"FUNDAMENTAL REVIEW STALE":assessment.status==="DEGRADED"?"FUNDAMENTAL REVIEW DEGRADED":"FUNDAMENTAL REVIEW UNAVAILABLE"}</strong>
     <span>{assessment.asOf?"Dossier research as of "+readableDate(assessment.asOf):"No qualified current research edition"} · {Object.keys(assessment.rows).length} independently qualified lenses · Market source timestamps shown per row</span>
     {assessment.statusDetail&&<span data-fundamental-reason>{assessment.statusDetail}</span>}
     {receipt&&<span data-investor-review-outcome={receipt.outcome}>Pipeline checked {new Date(receipt.checkedAt).toISOString().slice(0,16).replace("T"," ")} UTC · {receipt.outcome==="NO_CHANGE"?"No new synthesis; prior assessment date retained":receipt.outcome==="PERSISTED"?"Research edition persisted":"Existing edition already covered run"}</span>}
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
    <tbody>{snapshot.rows.map(row=><Row key={row.id} row={row} host={host} review={assessment.lensReviews[row.id]}/>)}</tbody>
   </table>
  </div>
  {themes.length>0&&<details className={s.tableWrap} data-investor-research-themes="bluebelly-source-only"><summary>Additional live research themes · AI cash conversion, China, food, cyber, power and reversal</summary>
   <table className={s.table}><caption className={s.srOnly}>Source-qualified research context and deciding tests</caption><thead><tr><th scope="col">MARKET LENS</th><th scope="col">WHAT WE CAN OBSERVE</th><th scope="col">WHAT INVESTORS MAY BE DECIDING</th><th scope="col">NEXT PROOF / INVALIDATION</th></tr></thead>
   <tbody>{themes.map(row=><Row key={row.id} row={row} host={host} review={assessment.lensReviews[row.id]}/>)}</tbody></table>
  </details>}
  <footer className={s.footer}>
   <p><strong>Read correctly:</strong> Signals are dated observations, not proof of institutional flows or investor intent. Dossier reasoning is an attributed research inference; stale/degraded research is not presented as current. No unverified probabilities are generated.{assessment.status==="RESEARCHED"&&assessment.whatWouldChangeMind?<><br className={s.desktopGap}/><strong> Main desk falsifier:</strong> {assessment.whatWouldChangeMind}</>:null}</p>
   <div className={s.links}>
    <Link href={blueDeskPublicHref("/blue-desk/regime-watch",host)}>Regime War Rooms <span aria-hidden="true">↗</span></Link>
    <Link href={blueDeskPublicHref("/blue-desk/crash-opportunity",host)}>Crash vs Opportunity <span aria-hidden="true">↗</span></Link>
   </div>
  </footer>
 </section>;
}
