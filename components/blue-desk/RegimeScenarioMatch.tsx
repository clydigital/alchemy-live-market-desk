import type {LensReconciliation} from "@/lib/bluebelly-regime-reconciliation";
const LABELS={INSUFFICIENT_REVIEW:"New source review required",NEW_EVIDENCE_TO_REVIEW:"Newer evidence needs reassessment",PARTIAL_MATCH:"Dated review · incomplete current match",DATED_REVIEW_AND_MARKET_TEST:"Dated review + market test"} as const;
export default function RegimeScenarioMatch({read,compact=false}:{read:LensReconciliation;compact?:boolean}){
 const review=read.assessed[0];
 return <div data-regime-scenario-match={read.state} style={{border:"1px solid var(--bb-card-border)",background:"var(--bb-surface)",borderRadius:9,padding:compact?10:"16px 18px",margin:"12px 0",color:"var(--bb-text)",overflowWrap:"anywhere"}}>
  <small style={{color:"var(--bb-muted)",fontWeight:600}}>CONTEXT → CURRENT CONDITIONS → SCENARIO TEST</small>
  <h3 style={{fontSize:compact?14:19,margin:"8px 0"}}>{LABELS[read.state]}</h3>
  <p style={{fontSize:13,margin:"5px 0"}}><strong>Market test:</strong> {read.marketState}</p>
  {read.marketLines.map((line,i)=><p key={i} style={{fontSize:12,margin:"4px 0"}}>{line}</p>)}
  <p style={{fontSize:13,margin:"8px 0"}}><strong>Hypothesis:</strong> {read.scenarios.question}</p>
  <p style={{fontSize:13,margin:"5px 0"}}><strong>Competing case:</strong> {read.scenarios.alternative}</p>
  {review?<p style={{fontSize:13,margin:"8px 0"}}><strong>Latest source-reviewed finding ({review.sourceThrough}):</strong> {review.condition}</p>:<p style={{fontSize:13}}>No eligible current reviewed finding; historical theses are not a substitute.</p>}
  {read.newer.length||read.newerBriefs.length||read.sameDay?<p style={{fontSize:12,color:"var(--bb-muted)"}}>{read.newer.length} newer qualified observation(s); {read.newerBriefs.length} new/same-date unadjudicated brief(s); {read.sameDay} same-date observation(s) not proven reconciled. Input arrival is not a thesis revision.</p>:null}
  {!compact?<><p style={{fontSize:14}}><strong>Deciding test:</strong> {read.scenarios.test}</p>
   {read.newer.map(x=><p key={x.id} style={{fontSize:13}}>{x.at.slice(0,10)} · <a href={x.url}>{x.title}</a></p>)}
   <div style={{borderTop:"1px solid var(--bb-card-border)",paddingTop:10}}>
    <strong style={{fontSize:13}}>Prior research / Dossier context only</strong>
    {read.dossier?<p style={{fontSize:12}}>Dossier vintage {read.dossier.asOf} · {read.dossier.status}{read.dossier.fallback?" · fallback":""}. Never a current market verdict.</p>:<p style={{fontSize:12}}>Dossier context unavailable.</p>}
    {read.prior?<p style={{fontSize:13}}><strong>{read.prior.title} ({read.prior.updatedAt.slice(0,10)})</strong> — {read.prior.thesis}</p>:<p style={{fontSize:12}}>No associated public historical Story.</p>}
   </div></>:<small style={{color:"var(--bb-muted)"}}>Prior Dossier: {read.dossier?.asOf.slice(0,10)??"unavailable"} · context only. Open lens for deciding tests.</small>}
  <p style={{fontSize:12,color:"var(--bb-muted)",margin:"6px 0 0"}}>Conditional comparison, not a new canonical assessment. {read.partial?"Source coverage partial.":""}</p>
 </div>;
}
