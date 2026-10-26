import "server-only";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getOwnerEditorialSlatePdfs,getOwnerLatestSlatePdfAttempt} from "@/lib/blue-desk-automated-report-reader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import styles from "@/app/blue-desk/daily-report/daily-report.module.css";

/** Owner-only research-slate PDFs. No public route imports this component. */
export default async function OwnerEditorialSlatePdfReader(){
 const session=await createSupabaseServerClient().catch(()=>null);
 if(!session)return null;
 const {data:{user},error}=await session.auth.getUser();
 if(error||!user?.email)return null;
 const {data:allowed,error:accessError}=await session.from("app_access_allowlist")
  .select("email").eq("email",user.email.trim().toLowerCase()).eq("active",true).maybeSingle();
 if(accessError||!allowed)return null;
 const [reports,attempt]=await Promise.all([
  getOwnerEditorialSlatePdfs(10).catch(()=>[]),
  getOwnerLatestSlatePdfAttempt().catch(()=>null),
 ]);
 const latest=reports[0];
 const attempted=!!attempt&&attempt.status!=="ready"&&
  (!latest||Date.parse(attempt.created_at)>Date.parse(latest.ready_at));
 const status=attempt?.status==="blocked"
  ?"No fresh, source-linked three-idea slate qualified. No research PDF was created."
  :attempt?.status==="failed"?"Private research PDF generation failed. Any earlier file remains intact."
  :"Research-slate PDF generation has started but is not complete.";
 const receipt=Array.isArray(latest?.source_receipts)?latest.source_receipts[0]:null;
 const upstream=receipt&&typeof receipt==="object"&&!Array.isArray(receipt)
  &&"upstreamStatus" in receipt && typeof receipt.upstreamStatus==="string"
   ?receipt.upstreamStatus:null;
 return <section className={styles.automaticPdf} aria-labelledby="private-editorial-slate-title"
   data-private-report-kind="COTD_OB_RESEARCH">
   <div className={styles.heading}>
    <p className={styles.eyebrow}>PRIVATE RESEARCH PACK / WRITING BRAIN</p>
    <h2 id="private-editorial-slate-title">OB / COTD research slate</h2>
    <p>Three proposed story angles, original links, chart questions and missing proof
      from the scheduled Writing Brain. A research pack, not an independently verified
      article, a technical trade signal or a public publication.</p>
   </div>
   {attempted?<p className={styles.pdfCoverage} data-editorial-slate-attempt="private">
    <strong>Last attempt:</strong> {attempt.report_day} · {attempt.status.toUpperCase()}
    {" · "}{attempt.source_count} attributed original links. {status}
   </p>:null}
   {latest?<div>
    <div className={styles.pdfMeta}>
     <div><strong>{latest.title}</strong><p>{latest.deck}</p>
      <small>{latest.report_day} · {latest.source_count} original links
       {" · "}Ready <DualTimestamp value={latest.ready_at}/>
       {" · "}Upstream source status: {upstream||"NOT VERIFIED IN RECEIPT"}
      </small>
     </div>
     <div className={styles.pdfActions}>
      <a href={"/api/owner/automated-report-pdf?edition="+latest.id} target="_blank" rel="noreferrer">Read research PDF</a>
      <a href={"/api/owner/automated-report-pdf?edition="+latest.id+"&download=1"}>Save a copy</a>
     </div>
    </div>
    <div className={styles.pdfFrameWrap}>
     <iframe className={styles.pdfFrame} loading="lazy"
      title="Private OB and COTD Writing Brain research slate PDF"
      src={"/api/owner/automated-report-pdf?edition="+latest.id+"#view=FitH"}/>
    </div>
    <p className={styles.pdfCoverage}>{latest.coverage_note}</p>
    <details className={styles.pdfArchive}><summary>Earlier research slate PDFs ({reports.length})</summary>
     <ul>{reports.map(r=><li key={r.id}><span>{r.report_day} · {r.title}</span>
      <a href={"/api/owner/automated-report-pdf?edition="+r.id} target="_blank" rel="noreferrer">Read</a>
      <a href={"/api/owner/automated-report-pdf?edition="+r.id+"&download=1"}>Save</a>
     </li>)}</ul>
    </details>
   </div>:<p className={styles.empty}>No research-slate PDF has been generated yet.
    The existing morning Dossier and late handoff will check for a fresh,
    source-linked Writing Brain slate. Missing upstream research is labelled
    as blocked rather than replaced with invented content.</p>}
 </section>;
}
