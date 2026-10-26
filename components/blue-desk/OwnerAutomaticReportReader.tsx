import "server-only";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getOwnerAutomaticDailyReports,getOwnerLatestDailyPdfAttempt} from "@/lib/blue-desk-automated-report-reader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import styles from "@/app/blue-desk/daily-report/daily-report.module.css";

/** Owner-only generated editions. The private page and each file request both
 * authenticate independently; a public Blue Desk reader never imports this. */
export default async function OwnerAutomaticReportReader(){
 const session=await createSupabaseServerClient().catch(()=>null);
 if(!session)return null;
 const {data:{user},error}=await session.auth.getUser();
 if(error||!user?.email)return null;
 const {data:access,error:accessError}=await session.from("app_access_allowlist")
  .select("email").eq("email",user.email.trim().toLowerCase()).eq("active",true).maybeSingle();
 if(accessError||!access)return null;
 const [reports,attempt]=await Promise.all([
  getOwnerAutomaticDailyReports(12).catch(()=>[]),
  getOwnerLatestDailyPdfAttempt().catch(()=>null),
 ]);
 const current=reports[0];
 const showAttempt=attempt&&attempt.status!=="ready"&&
  (!current||Date.parse(attempt.created_at)>Date.parse(current.ready_at));
 const explanation=showAttempt ? attempt.status==="blocked"
  ? "The source-verification gate withheld this edition; no PDF was created."
  : attempt.status==="failed"
   ? "PDF generation or storage failed. The existing private edition, if any, remains available."
   : "The scheduled source-qualified edition is being assembled." : null;
 return <section className={styles.automaticPdf} aria-labelledby="owner-automatic-pdf-title"
     data-owner-automatic-pdf="session-verified-private">
   <div className={styles.heading}>
    <p className={styles.eyebrow}>PRIVATE INTELLIGENCE / AUTOMATIC PDF</p>
    <h2 id="owner-automatic-pdf-title">My daily market intelligence report</h2>
    <p>Generated automatically from source-qualified research. This report is for your private viewing,
      never public publication. AI interpretation is distinct from its dated original sources.</p>
   </div>
   {showAttempt?<p className={styles.pdfCoverage} data-owner-automatic-pdf-attempt="private">
    <strong>Latest scheduled attempt:</strong> {attempt.report_day} · {attempt.slot} · {attempt.status.toUpperCase()}
    {" · "}{attempt.source_count} dated factual sources. {explanation}
   </p>:null}
   {current?<div>
    <div className={styles.pdfMeta}>
     <div><strong>{current.title}</strong>
      <p>{current.deck}</p>
      <small>{current.slot.toUpperCase()} · {current.report_day}
       {" · "}{current.source_count} qualified sources
       {" · "}Ready <DualTimestamp value={current.ready_at}/></small>
     </div>
     <div className={styles.pdfActions}>
      <a href={"/api/owner/automated-report-pdf?edition="+current.id} target="_blank" rel="noreferrer">Open private PDF</a>
      <a href={"/api/owner/automated-report-pdf?edition="+current.id+"&download=1"}>Save a copy</a>
     </div>
    </div>
    <div className={styles.pdfFrameWrap}>
     <iframe className={styles.pdfFrame}
      title={"My private "+current.slot+" Daily Market Intelligence PDF"}
      src={"/api/owner/automated-report-pdf?edition="+current.id+"#view=FitH"}
      loading="lazy"/>
    </div>
    <p className={styles.pdfCoverage}>{current.coverage_note}</p>
    <details className={styles.pdfArchive}>
     <summary>Previous private PDF editions ({reports.length})</summary>
     <ul>{reports.map(edition=><li key={edition.id}>
      <span>{edition.report_day} · {edition.slot} · {edition.title}</span>
      <a href={"/api/owner/automated-report-pdf?edition="+edition.id} target="_blank" rel="noreferrer">Read</a>
      <a href={"/api/owner/automated-report-pdf?edition="+edition.id+"&download=1"}>Save</a>
     </li>)}</ul>
    </details>
   </div>:<p className={styles.empty}>No private PDF is ready yet. The scheduled generator will only
    complete an edition when its source and evidence checks pass. Missing verification will
    not be replaced with guesses.</p>}
  </section>;
}
