import Link from "next/link";
import {getOwnerReportLedIdeas} from "@/lib/bluebelly-owner-report-led-ideas";
import s from "@/app/my-reports/my-desk.module.css";

/** No PDF, download, independent slate, article archive or model retry.
 * Exactly the latest saved Daily Intelligence edition drives the cards. */
export default async function OwnerDailyTopicIdeas(){
 const read=await getOwnerReportLedIdeas();
 return <section className={s.htmlSlate} data-my-desk-current-three-ideas="daily-report-linked"
  aria-label="Three COTD and Opening Bell topic suggestions">
  <div className={s.htmlSlateHeader}>
   <div>
    <small className={s.editionType}>02 / DAILY REPORT → ARTICLE RESEARCH</small>
    <h2>Three COTD / Opening Bell suggestions</h2>
   </div>
   <span className={s.htmlSlateState}>{read.state==="available"?"LIVE REPORT-LED IDEAS":
    read.state==="no_report"?"AWAITING DAILY REPORT":
    read.state==="unauthorised"?"OWNER ACCESS REQUIRED":"REPORT READ UNAVAILABLE"}</span>
  </div>
  <p className={s.htmlSlateIntro}>These are research directions, not commissioned articles.
   They refresh from the latest saved Daily Intelligence, not an independent dated Writing Brain slate.
   When the report lacks breadth, only source-verified <Link href="/blue-desk/newsroom">Newsroom</Link> updates
   may supplement it; gaps stay visible.</p>
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
    <p className={s.ideaOrigin}>{idea.provenance==="DAILY_REPORT"?"FROM CURRENT DAILY REPORT":
     idea.provenance==="NEWSROOM_SUPPLEMENT"?"SOURCE-VERIFIED NEWSROOM SUPPLEMENT":
     "RESEARCH GAP — NOT AN APPROVED IDEA"}</p>
    <p><strong>Thesis / evidence:</strong> {idea.thesis}</p>
    <p><strong>Antithesis:</strong> {idea.antithesis}</p>
    <p><strong>What to look for:</strong> {idea.nextCheck}</p>
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
  <p className={s.htmlSlateNote}>The report changes the suggestions as soon as a new saved edition
   becomes the lead. There is no separate COTD/OB archive or claim of automatic publication.
   Historical source records remain intact for provenance.</p>
 </section>;
}
