import type {getOwnerThesisRevisionPackets} from "@/lib/bluebelly-thesis-revision-server";
export default function ThesisRevisionPanel({read}:{read:Awaited<ReturnType<typeof getOwnerThesisRevisionPackets>>}){
 return <section data-private-thesis-revisions={read.status} style={{maxWidth:1120,margin:"16px auto",padding:"18px 22px",border:"1px solid var(--bb-card-border)",borderRadius:14}}>
  <h2>Thesis maintenance · review inbox</h2>
  <p>Historical hypotheses are tested against newer conditions. Stored private packets are not canonical revisions or public approvals.</p>
  <p><small>{read.status} · {read.groups.length} distinct hypothesis/event groups · {read.invalid} invalid packets{read.truncated?" · bounded history":""}</small></p>
  {read.groups.length===0?<p>No readable review packets in the bounded inbox.</p>:read.groups.map(g=>{const p=g.latest.packet;return <details key={g.hypothesisId+"|"+g.eventKey} style={{margin:"12px 0",padding:"10px 0",borderTop:"1px solid var(--bb-card-border)"}}><summary><strong>{p.assessment} · {p.hypothesisId}</strong> · {p.sourceThrough.slice(0,10)} · {p.materiality}</summary>
   <p><strong>Previously:</strong> {p.priorThesis}</p><p><strong>Now:</strong> {p.currentCondition}</p><p><strong>Mechanism:</strong> {p.mechanism}</p><p><strong>Countercase:</strong> {p.countercase}</p><p><strong>Next test:</strong> {p.nextTest}</p>
   <p><small>Reviewed {p.reviewedAt} · market session {p.marketSession??"unavailable"} · {p.producer} · {p.coverage} · {p.lenses.join(", ")}</small></p>
   {g.latest.referenceStates.map((r,i)=><p key={i} style={{fontSize:13}}>{r.reference.role} · {r.reference.qualification} · {r.state} · {r.reference.kind==="WORK_EDITION"?"Receipt saved ":"Source "}{r.reference.sourceAt.slice(0,10)} — {r.reference.claim}</p>)}
   <p><small>{g.revisions.length} stored revision(s){g.conflicting?" · differing assessments require reconciliation":""}. Identity match proves record presence, not claim validity. Public readback: NOT ADMITTED.</small></p>
  </details>})}
 </section>
}
