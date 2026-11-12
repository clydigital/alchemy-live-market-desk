import AcceleratorDial from "./AcceleratorDial";
import type {QuestionAssessment} from "@/lib/bluebelly-question-assessment";
import {QUESTION_VERDICT_LABELS} from "@/lib/bluebelly-question-assessment";
import s from "./QuestionVerdictCard.module.css";

export default function QuestionVerdictCard({read,compact=false}:{read:QuestionAssessment;compact?:boolean}){
 const direction=read.verdict==="improving"?1:read.verdict==="deteriorating"?-1:
  read.verdict==="mixed"||read.verdict==="unchanged"?0:null;
 const middle=read.verdict==="mixed"?"MIXED":"SAME";
 return <article className={s.card} data-question-id={read.id} data-question-verdict={read.verdict}
  data-question-freshness={read.freshness} data-question-authority={read.authority}>
  <div className={s.meta}><span>QUESTION INTELLIGENCE / {read.scope}</span>
   <span>SOURCES THROUGH {read.sourceThrough||"UNKNOWN"} {read.freshness==="stale"?"· STALE":""}</span></div>
  <div className={s.grid}>
   <div className={s.explainer}>
    <h3>{read.question}</h3>
    <div className={s.answer} aria-label={"Current answer: "+QUESTION_VERDICT_LABELS[read.verdict]}>{QUESTION_VERDICT_LABELS[read.verdict]}</div>
    <p className={s.condition}><strong>Current condition:</strong> {read.condition}</p>
    <p><strong>Why:</strong> {read.freshness==="current"?read.why:"This source review is no longer fresh. Last recorded view: "+QUESTION_VERDICT_LABELS[read.recordedVerdict]+". "+read.why}</p>
   </div>
   <div className={s.gauge}>
    <AcceleratorDial compact={compact} label={read.question} direction={direction}
      leftLabel="Deteriorating" rightLabel="Improving" middleLabel={middle}/>
    <small>{read.comparison} · {read.horizon}</small>
   </div>
  </div>
  <div className={s.history} data-question-history={read.previousReviewedOn?"comparison":"initial"}>
   <span>PREVIOUS {read.previousReviewedOn||"—"}: {read.previousVerdict?QUESTION_VERDICT_LABELS[read.previousVerdict]:"Not recorded"}</span>
   <strong>{read.freshness==="current"?read.changeSummary:"Verdict withdrawn pending fresh review"}</strong>
  </div>
  <details className={s.detail}>
   <summary>Why this answer? Evidence, countercase and next test <span>EXPAND ↗</span></summary>
   <p><strong>Countercase:</strong> {read.countercase}</p>
   <p><strong>What changes it:</strong> {read.nextTest}</p>
   <ul>{read.sources.map(source=><li key={source.url+"-"+source.publishedOn}>
    <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name} ↗</a>
    <small>{source.publishedOn}{source.note?" · "+source.note:""}</small>
   </li>)}</ul>
   <p className={s.disclaimer}>Provisional source-reviewed editorial assessment. Not a probability, canonical Regime change or trading signal. Source publication and editorial review differ from page-view time. No automatic source-to-verdict promotion.</p>
  </details>
 </article>;
}
