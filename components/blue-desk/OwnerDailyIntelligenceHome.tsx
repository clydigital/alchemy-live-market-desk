import Link from "next/link";
import {getOwnerDailyIntelligenceIndex} from "@/lib/bluebelly-owner-daily-intelligence";
import {postCutoverDailyArchive,MY_DESK_ARCHIVE_CUTOVER} from "@/lib/bluebelly-my-desk-suggestions";
import OwnerPrivateHtmlInlineReader from "./OwnerPrivateHtmlInlineReader";
import styles from "@/app/my-reports/my-desk.module.css";

function dateDay(value:string){
 return new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(value+"T12:00:00Z"));
}
function savedTime(value:string){
 return new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",
  timeZone:"Asia/Kuala_Lumpur",hour12:false}).format(new Date(value))+" MYT";
}
/** Latest HTML is always the live lead; only newly saved Daily Intelligence
 * editions qualify for this version's visible archive. Never delete DB rows. */
export default async function OwnerDailyIntelligenceHome(){
 const result=await getOwnerDailyIntelligenceIndex();
 const [latest,...previous]=result.editions;
 const older=postCutoverDailyArchive(previous);
 const todayMYT=new Date(Date.now()+8*3600_000).toISOString().slice(0,10);
 return <section id="daily-intelligence" className={styles.dailyFocus}
  data-my-desk-primary="private-daily-intelligence">
  <div className={styles.dailyHeader}>
   <div><p className={styles.dailyEyebrow}>01 / DAILY INTELLIGENCE · PRIVATE</p>
    <h2>Your Daily Intelligence</h2>
    <p>The current complete report is the parent of the three article suggestions below.
     Its exact archived HTML remains accessible here, with full evidence and source links.</p>
   </div>
   <Link href="/owner/daily-report" className={styles.dailyStudio}>Daily Report Studio</Link>
  </div>
  {latest?<div className={styles.dailyIssue}>
   <div className={styles.dailyIssueTop}>
    <div>
     <p className={styles.dailyStamp}>Current report · {dateDay(latest.reportDay)}
      {latest.reportDay!==todayMYT?" · Previous market session":""}</p>
     <h3>{latest.title}</h3>
     <p>Saved {savedTime(latest.createdAt)} · {latest.delivery==="WORK"?"Delivered from Work":"Generated in My Desk"}
      {" · "}Private draft, not publicly published</p>
    </div>
    <span className={styles.dailyPrivate}>PRIVATE_DRAFT</span>
   </div>
   <div className={styles.dailyActions}>
    <a href={"/api/owner/html-editions?edition="+latest.id} target="_blank" rel="noopener noreferrer">Open private report</a>
    <a href={"/api/owner/html-editions?edition="+latest.id+"&download=1"}>Download HTML</a>
   </div>
   <OwnerPrivateHtmlInlineReader editionId={latest.id} title={latest.title}/>
   <p className={styles.dailyNote}>This is a saved editorial report, not proof that every original
    hyperlink or market interpretation was independently fact-checked. Earlier research
    records remain immutable but are not part of the new visible archive.</p>
  </div>:
   <div className={styles.dailyEmpty} role="status">
    <h3>{result.state==="unauthorised"?"Private owner access required":
     result.state==="unavailable"?"Daily Intelligence history temporarily unavailable":"No saved Daily Intelligence edition yet"}</h3>
    <p>{result.state==="unauthorised"?"Sign in with the approved owner account.":
     "Completed HTML-only reports are saved here automatically. Partial chapters and unpublished drafts are not presented as finished editions."}</p>
    <Link href="/owner/daily-report">Open private report studio</Link>
   </div>}
  {result.state==="partial"?<p className={styles.dailyNote}>
   Some private report collections could not be read. Visible editions do not prove full ingestion.</p>:null}
  {older.length>0?<details className={styles.dailyHistory}
   data-my-desk-archive="post-cutover-daily-reports-only">
   <summary>Daily Report archive ({older.length} new editions)</summary>
   <div className={styles.dailyHistoryItems}>
    {older.slice(0,15).map(e=><article key={e.id}>
     <span>{dateDay(e.reportDay)} · {e.reviewStatus.replaceAll("_"," ")}</span>
     <strong>{e.title}</strong>
     <a href={"/api/owner/html-editions?edition="+e.id} target="_blank" rel="noopener noreferrer">Read private HTML</a>
    </article>)}
   </div>
  </details>:null}
  <p className={styles.dailyArchivePolicy}>The new archive starts with editions saved after
   {" "}{savedTime(MY_DESK_ARCHIVE_CUTOVER)}. Pre-cutover versions are excluded from this list,
   not erased from secure research storage. COTD/OB suggestions are never archived here.</p>
  {result.duplicatesHidden>0?<p className={styles.dailyArchivePolicy}>
   {result.duplicatesHidden} duplicate storage {result.duplicatesHidden===1?"receipt":"receipts"} excluded from this view.</p>:null}
 </section>;
}
