import Link from "next/link";
import {getOwnerReportLedIdeas} from "@/lib/bluebelly-owner-report-led-ideas";
import s from "@/app/my-reports/my-desk.module.css";

/** Owner-only research directions from the exact Daily Intelligence report.
 * Writing Brain's three persisted ideas lead only after matching its immutable
 * parent receipt; otherwise disclose the report-derived fallback. */
export default async function OwnerDailyTopicIdeas(){
 const read=await getOwnerReportLedIdeas();
 const older=read.handoff?.freshness==="OLDER_US_SESSION";
 const scheduled=read.handoff?.source==="WRITING_BRAIN";
 const provenanceLabel=scheduled?"SAVED WRITING BRAIN SLATE":"REPORT-DERIVED FALLBACK";
 const freshnessLabel=older?"OLDER US SESSION":
  read.handoff?.freshness==="CURRENT_US_SESSION"?"CURRENT US SESSION":"SESSION UNKNOWN";
 return <section className={s.htmlSlate} data-my-desk-current-three-ideas="daily-report-linked"
  aria-label="Three COTD and Opening Bell topic suggestions">
  <div className={s.htmlSlateHeader}>
   <div>
    <small className={s.editionType}>02 / DAILY REPORT → ARTICLE RESEARCH</small>
    <h2>Three COTD / Opening Bell suggestions</h2>
   </div>
   <span className={s.htmlSlateState}>{read.state==="available"
    ?provenanceLabel+" · "+freshnessLabel
    :read.state==="no_report"?"AWAITING DAILY REPORT":
    read.state==="unauthorised"?"OWNER ACCESS REQUIRED":"REPORT READ UNAVAILABLE"}</span>
  </div>
  <p className={s.htmlSlateIntro}>These are private research directions, not commissioned articles.
   A saved Writing Brain slate leads only when its three source-linked ideas match the exact parent
   Daily Intelligence ID, SHA and completed US session. Otherwise, directions are explicitly derived
   from the saved report and source-verified <Link href="/blue-desk/newsroom">Newsroom</Link> material,
   with research gaps left visible.</p>
  {read.handoff?<p className={s.htmlSlateNote} role="status"
   data-my-desk-idea-receipt={read.handoff.state}>
   <strong>{read.handoff.freshness==="CURRENT_US_SESSION"?"CURRENT REPORT SESSION":
    read.handoff.freshness==="OLDER_US_SESSION"?"REPORT HANDOFF BEHIND":
    "REPORT SESSION UNCONFIRMED"}</strong>
   {" · "}Parent session {read.handoff.reportSessionET} ET.
   {read.handoff.expectedSessionET
    ?" Expected latest completed US session: "+read.handoff.expectedSessionET+" ET.":""}
   {" "}{read.handoff.reason}
  </p>:null}
  {read.editionId?<p className={s.htmlSlateNote}>
   Parent report: <strong>{read.editionTitle}</strong> · {read.reportDay} ·
   {" "}<a href={"/api/owner/html-editions?edition="+read.editionId} target="_blank"
    rel="noopener noreferrer">Open exact private edition</a>
  </p>:null}
  {read.state!=="available"?<p className={s.htmlSlateNote} role="status">
   {read.state==="no_report"?"Save a complete Daily Intelligence edition to generate its topic shortlist.":
    read.state==="unauthorised"?"Sign in using the approved owner account.":
    "The latest edition could not be read and integrity-checked. No fallback slate is being represented as current."}
  </p>:<div className={s.htmlSlateGrid}>
   {read.ideas.map(idea=><article key={idea.rank} className={s.htmlSlateIdea}>
    <small>#{idea.rank} · {idea.format} · {idea.theme}</small>
    <h3>{idea.title}</h3>
    <p className={s.ideaOrigin}>{idea.provenance==="WRITING_BRAIN"
     ?"FROM EXACT SAVED WRITING BRAIN SLATE":
     idea.provenance==="DAILY_REPORT"?"FROM SAVED DAILY REPORT":
     idea.provenance==="NEWSROOM_SUPPLEMENT"?"SOURCE-VERIFIED NEWSROOM SUPPLEMENT":
     "RESEARCH GAP — NOT AN APPROVED IDEA"}</p>
    {idea.ideaId?<p>Idea receipt: <code>{idea.ideaId}</code></p>:null}
    <p><strong>Thesis / evidence:</strong> {idea.thesis}</p>
    <p><strong>Antithesis:</strong> {idea.antithesis}</p>
    <p><strong>What to look for:</strong> {idea.nextCheck}</p>
    {idea.evidenceGap?<p><strong>Missing proof:</strong> {idea.evidenceGap}</p>:null}
    <details><summary>Technical checks and original sources</summary>
     <p><strong>Chart / market test:</strong> {idea.technicalCheck}</p>
     <div className={s.htmlSlateSources} aria-label="Topic evidence links">
      {read.editionId?<a href={"/api/owner/html-editions?edition="+read.editionId+
       (idea.reportSection?"#"+idea.reportSection:"")} target="_blank"
       rel="noopener noreferrer">Parent Daily Report</a>:null}
      <Link href="/blue-desk/newsroom">Newsroom</Link>
      {idea.sourceUrls.slice(0,5).map((url,i)=><a key={url} href={url}
       target="_blank" rel="noopener noreferrer">Original source {i+1}</a>)}
     </div>
     {idea.sourceUrls.length===0?<p>No original source URL was extracted for this direction;
      verify before developing it.</p>:null}
    </details>
   </article>)}
  </div>}
  <p className={s.htmlSlateNote}>The latest eligible saved report remains the parent. Persisted
   slate ideas are reused only with an exact parent receipt; fallback ideas are identified above.
   Neither database readback nor upstream source status proves scheduled execution, independent
   provider verification or public publication. Historical records remain intact.</p>
 </section>;
}
