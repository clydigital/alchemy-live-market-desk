import {getRegimeManualChallenge} from "@/lib/bluebelly-regime-manual-challenges";
import type {EditorialRegimeId} from "@/lib/bluebelly-editorial-architecture";

/** Dated challenger evidence only. Never changes the accepted 30 Oct lens meter. */
export default function RegimeManualChallenge({lens}:{lens:EditorialRegimeId}){
 const update=getRegimeManualChallenge(lens);
 if(!update)return null;
 return <section data-regime-manual-challenge={update.lens}
  data-regime-research-status={update.status} data-regime-challenge-asof={update.asOf}
  aria-label="New research challenging this reviewed lens"
  style={{margin:"16px 0 20px",padding:"18px clamp(16px,3vw,28px)",background:"var(--bb-surface)",
    border:"1px solid var(--bb-card-border)",borderRadius:10,lineHeight:1.65}}>
  <span style={{display:"block",textTransform:"uppercase",fontSize:11,fontWeight:800,
    letterSpacing:".09em",color:"var(--bb-accent)",marginBottom:7}}>
    11 NOV 2026 / SOURCE-DATED CHALLENGE · NOT AN UPDATED REGIME VERDICT
  </span>
  <h2 style={{fontSize:"clamp(20px,2.3vw,28px)",margin:"6px 0 10px"}}>{update.headline}</h2>
  <p><strong>What changed:</strong> {update.whatChanged}</p>
  <p><strong>Strongest objection:</strong> {update.objection}</p>
  <p><strong>Deciding test:</strong> {update.nextTest}</p>
  <div style={{fontSize:12,paddingTop:8,borderTop:"1px solid var(--bb-card-border)"}}>
    <strong>Sources:</strong> {update.sourceLinks.map((source,index)=>
      <span key={source.url}>{index?", ":" "}
        <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a>
      </span>)}
  </div>
  <p style={{fontSize:12,opacity:.8,marginTop:8}}>Research-only challenger to the older editorial assessment.
    Sources and observations do not automatically revise the lens meter,
    immutable canonical Story version, or persisted Regime shadow snapshot.
  </p>
 </section>;
}
