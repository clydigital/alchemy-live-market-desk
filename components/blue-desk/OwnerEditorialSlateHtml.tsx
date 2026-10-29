import type {EditorialSlate} from "@/lib/editorial-slate-core";
import s from "@/app/my-reports/my-desk.module.css";

type SlateReadStatus="available"|"empty"|"storage_unavailable";

/** Render only the already-saved owner editorial slate, as HTML.
 * This is not a new writer, a source verifier or permission to publish. */
export default function OwnerEditorialSlateHtml({slate,status}:{
 slate:EditorialSlate|null;status:SlateReadStatus;
}){
 return <section className={s.htmlSlate} data-owner-editorial-slate-html="private-read-only"
  aria-label="Latest Writing Brain article angles">
  <div className={s.htmlSlateHeader}>
   <div>
    <small className={s.editionType}>WRITING BRAIN · PRIVATE HTML · CURRENT SLATE</small>
    <h2>Latest saved article angles</h2>
   </div>
   <span className={s.htmlSlateState}>{slate
    ?slate.verificationStatus==="source_checked"?"SOURCE CHECKED":"PARTIAL VERIFICATION"
    :status==="storage_unavailable"?"SOURCE UNAVAILABLE":"NO SAVED SLATE"}</span>
  </div>
  <p className={s.htmlSlateIntro}>The scheduled Writing Brain's latest three saved ideas, shown directly
   as HTML without waiting for a PDF, model retry or Drive upload. These are research proposals,
   not independently approved OB/COTD articles. Original linked sources require claim-level checks.</p>
  {slate?<div>
   <p className={s.htmlSlateNote}><strong>{slate.ageLabel}</strong> · Produced {slate.producedAt}
    · {slate.ideas.length} ideas · {slate.verificationStatus.replaceAll("_"," ")}.
    Times belong to the original saved research packet, not the current market session.</p>
   <div className={s.htmlSlateGrid}>
    {slate.ideas.map(idea=><article key={idea.rank} className={s.htmlSlateIdea}>
     <small>#{idea.rank} / {idea.format} · PROPOSED</small>
     <h3>{idea.title}</h3>
     <p>{idea.hook}</p>
     <p><strong>How it works:</strong> {idea.mechanism||"Mechanism not supported by this slate."}</p>
     <p><strong>Against the thesis:</strong> {idea.countercase||"Countercase needs research."}</p>
     <details>
      <summary>Read chronology, market response and next test</summary>
      <p><strong>Event chronology:</strong> {idea.catalystTimeline||"Not recorded."}</p>
      <p><strong>Prior expectations:</strong> {idea.expectation||"UNKNOWN"}</p>
      <p><strong>Price reaction:</strong> {idea.priceReaction||"UNKNOWN — no matched market observation."}</p>
      <p><strong>Next test:</strong> {idea.nextTrigger||"Requires source and date confirmation."}</p>
     </details>
     <details>
      <summary>Chart and technical checks</summary>
      {idea.chartGuidance.length?<ul>{idea.chartGuidance.map((item,i)=><li key={i}>{item}</li>)}</ul>
       :<p>No source-dated chart check recorded.</p>}
     </details>
     <p><strong>Proof still needed:</strong> {idea.missingProof||"Claim-level confirmation outstanding."}</p>
     <div className={s.htmlSlateSources} aria-label="Original links">
      {idea.sourceUrls.length?idea.sourceUrls.map((url,i)=><a href={url} key={url}
       target="_blank" rel="noopener noreferrer">Source {i+1}</a>)
       :<span>No original links recorded for this angle.</span>}
     </div>
    </article>)}
   </div>
   {slate.notes?<details className={s.htmlSlateNote}><summary>Writing Brain notes</summary>
    <p>{slate.notes}</p></details>:null}
  </div>:<p className={s.htmlSlateNote}>{status==="storage_unavailable"
   ?"Latest slate could not be read. No current research edition is claimed."
   :"No eligible three-idea slate has been saved yet. The dated HTML archive remains available below."}</p>}
 </section>;
}
