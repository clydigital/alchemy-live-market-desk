import Link from "next/link";
import {getOwnerDailyIntelligenceIndex} from "@/lib/bluebelly-owner-daily-intelligence";
import OwnerPrivateHtmlInlineReader from "./OwnerPrivateHtmlInlineReader";
import styles from "@/app/my-reports/my-desk.module.css";

function dateDay(value:string){
 return new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(value+"T12:00:00Z"));
}
function savedTime(value:string){
 return new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",
  timeZone:"Asia/Kuala_Lumpur",hour12:false}).format(new Date(value))+" MYT";
}
/** Source of truth for My Desk home: private Supabase editions, not a Drive
 * receipt catalogue or a stale editorial slate. */
export default async function OwnerDailyIntelligenceHome(){
 const result=await getOwnerDailyIntelligenceIndex();
 const [latest,...older]=result.editions;
 const todayMYT=new Date(Date.now()+8*3600_000).toISOString().slice(0,10);
 return <section id="daily-intelligence" className={styles.dailyFocus}
  data-my-desk-primary="private-daily-intelligence">
  <div className={styles.dailyHeader}>
   <div><p className={styles.dailyEyebrow}>01 / DAILY INTELLIGENCE · PRIVATE</p>
    <h2>Your Daily Intelligence</h2>
    <p>One complete market story first. Read the explanation and decision points,
     then use it to direct your COTD/Opening Bell research.</p>
   </div>
   <Link href="/owner/daily-report" className={styles.dailyStudio}>Daily Report Studio</Link>
  </div>
  {latest?<div className={styles.dailyIssue}>
   <div className={styles.dailyIssueTop}>
    <div>
     <p className={styles.dailyStamp}>Latest saved · {dateDay(latest.reportDay)}
      {latest.reportDay!==todayMYT?" · Historical edition":""}</p>
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
   <p className={styles.dailyNote}>This is an archived editorial report, not a claim that all its market explanations
    or original hyperlinks have passed independent fact-checking. New reports replace the lead display
    without deleting earlier editions.</p>
  </div>:
   <div className={styles.dailyEmpty} role="status">
    <h3>{result.state==="unauthorised"?"Private owner access required":
     result.state==="unavailable"?"Daily Intelligence history temporarily unavailable":"No saved Daily Intelligence edition yet"}</h3>
    <p>{result.state==="unauthorised"?"Sign in with the approved owner account.":
     "Completed HTML-only reports are saved here automatically. Partial chapters and unpublished drafts are not presented as finished editions."}</p>
    <Link href="/owner/daily-report">Open private report studio</Link>
   </div>}
  {result.state==="partial"?<p className={styles.dailyNote}>
   Some private report collections could not be read. Visible editions are not proof of complete history.</p>:null}
  {older.length>0?<details className={styles.dailyHistory}>
   <summary>Previous Daily Intelligence editions ({older.length})</summary>
   <div className={styles.dailyHistoryItems}>
    {older.slice(0,15).map(e=><article key={e.id}>
     <span>{dateDay(e.reportDay)} · {e.reviewStatus.replaceAll("_"," ")}</span>
     <strong>{e.title}</strong>
     <a href={"/api/owner/html-editions?edition="+e.id} target="_blank" rel="noopener noreferrer">Read private HTML</a>
    </article>)}
   </div>
  </details>:null}
  {result.duplicatesHidden>0?<p className={styles.dailyNote}>
   {result.duplicatesHidden} identical storage {result.duplicatesHidden===1?"copy":"copies"} hidden from the reading list; underlying immutable records preserved.</p>:null}
 </section>;
}
