import type {PilotLensAssessment} from "@/lib/bluebelly-regime-assessment-pilot";
import DualTimestamp from "./DualTimestamp";

/** Identical current interpretation on overview and detail; historical
 * directional assessment remains in the existing editorial archive. */
export default function RegimeCurrentAssessment({assessment,compact=false,historical=false}:{assessment:PilotLensAssessment|null;compact?:boolean;historical?:boolean}){
 if(!assessment)return null;
 const current=assessment.state==="CURRENT";
 return <div data-regime-assessment-pilot={assessment.lens} data-regime-assessment-state={assessment.state}
  style={{border:"1px solid var(--bb-card-border)",borderRadius:8,padding:compact?"10px":"16px 18px",margin:compact?"10px 0":"16px 0",background:"var(--bb-surface)",color:"var(--bb-text)",overflowWrap:"anywhere"}}>
  <div style={{display:"flex",alignItems:"baseline",gap:8,justifyContent:"space-between",flexWrap:"wrap"}}>
   <strong style={{fontSize:compact?13:17}}>{historical?"Dossier context · dated interpretation":current?"Current research interpretation":"Research interpretation pending"}</strong>
   <small style={{color:"var(--bb-muted)"}}>{assessment.scope}</small>
  </div>
  {current?<><p style={{fontSize:compact?13:15,lineHeight:1.5,margin:"8px 0"}}>{assessment.interpretation}</p>
   {assessment.nextTest?<p style={{fontSize:compact?12:14,margin:"8px 0"}}><strong>Next test:</strong> {assessment.nextTest}</p>:null}
   <small style={{color:"var(--bb-muted)"}}>Dossier inference · Reviewed {assessment.reviewAt?<DualTimestamp value={assessment.reviewAt}/>: "unavailable"} · Evidence through {assessment.sourceThrough?<DualTimestamp value={assessment.sourceThrough}/>: "unavailable"}.</small>
  </>:<p style={{fontSize:compact?12:14,lineHeight:1.5,margin:"8px 0"}}>{assessment.state==="STALE"?"The last eligible Dossier review is stale.":"No current source-qualified Dossier review for this lens."} Live observations remain available; the dated editorial baseline is preserved in the lens archive.</p>}
  <p style={{fontSize:12,color:"var(--bb-muted)",margin:"8px 0 0"}}>{historical?"Historical Dossier context; compare with current evidence above. ":""}Interpretation, not a directional rating or evidence of actual investor flows.</p>
 </div>;
}
