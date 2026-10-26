import "server-only";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getLatestEditorialSlate} from "@/lib/editorial-slate-server";
import {getOwnerDeliveredResearchBriefs} from "@/lib/blue-desk-delivered-research-server";
import styles from "@/app/blue-desk/blue-desk.module.css";

const dayInMyt=(now:Date)=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Kuala_Lumpur",
 year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
const isoSafe=(s:string|undefined)=>s&&Number.isFinite(Date.parse(s))?s:"unavailable";

/** Readback is evidence of database delivery, NEVER proof that a particular
 * plugin call occurred. Only authorised owners see private handoff health. */
export default async function OwnerPrivatePdfInputHealth(){
 const session=await createSupabaseServerClient().catch(()=>null);
 if(!session)return null;
 const {data:{user},error}=await session.auth.getUser();
 if(error||!user?.email)return null;
 const {data:access,error:accessError}=await session.from("app_access_allowlist")
  .select("email").eq("email",user.email.toLowerCase().trim()).eq("active",true).maybeSingle();
 if(accessError||!access)return null;
 const [slate,briefs]=await Promise.all([
  getLatestEditorialSlate().catch(()=>({slate:null,status:"storage_unavailable" as const})),
  getOwnerDeliveredResearchBriefs(6).catch(()=>[]),
 ]);
 const today=dayInMyt(new Date());
 const lastSlate=slate.slate;
 const current=!!lastSlate&&lastSlate.dayMyt===today;
 const latestMacro=briefs[0];
 const lastMacro=isoSafe(latestMacro?.source_retrieved_at);
 const entries=[
  {name:"OB / COTD Writing Brain",state:current?"CURRENT HANDOFF":"NOT CURRENT",
   detail:lastSlate?(`Last persisted: ${lastSlate.dayMyt} MYT at ${lastSlate.producedAt}. Three ideas; upstream verification: ${lastSlate.verificationStatus}. ${current?"Eligible for PDF source checks.":"An old slate cannot be used for today's PDF."}`)
    :`No valid persisted slate readback (${slate.status}).`},
  {name:"MacroPulse research",state:briefs.length?"RESEARCH DELIVERED":"NO BRIEF READBACK",
   detail:briefs.length?
    `${briefs.length} source-attributed private briefs available. Latest retrieval: ${lastMacro}. These are non-canonical editorial inputs, not evidence that the PDF generator consumed them or that plugins ran.`
    :"No privately delivered MacroPulse briefs were found in the seven-day lookback."},
  {name:"Research Gap / AI Bubble / Creator",state:"NO AUTOMATIC PDF HANDOFF",
   detail:"Their scheduled research and Notion outputs are not yet accepted inputs to an automated specialist PDF compiler. Do not infer ingestion from task availability."},
  {name:"Connected research plugins",state:"INVOCATIONS NOT AUDITABLE",
   detail:"No per-task FMP, Quartr, FactIQ, Notion or other plugin-call receipt is persisted for these PDFs. Availability is not evidence of a successful retrieval."},
 ];
 return <div className={styles.content}>
  <section className={styles.section} aria-labelledby="private-report-handoff-health"
   data-private-report-handoff-health="readback-only">
   <div className={styles.sectionHead}><div>
    <p className={styles.kicker}>PRIVATE / REAL DELIVERY EVIDENCE</p>
    <h2 id="private-report-handoff-health">Scheduled research handoffs</h2>
    <p>Actual stored inputs, not task settings or assumed plugin use. Shown only after Google sign-in.</p>
   </div></div>
   <div className={styles.calendarStack}>
    {entries.map(e=><article className={styles.secondaryPanel} key={e.name}>
     <h3>{e.name}</h3>
     <p className={styles.kicker}>{e.state}</p>
     <p className={styles.muted}>{e.detail}</p>
    </article>)}
   </div>
  </section>
 </div>;
}
