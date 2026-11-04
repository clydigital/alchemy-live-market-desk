import "server-only";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getLatestEditorialSlate} from "@/lib/editorial-slate-server";
import {inspectWritingBrainHandoff} from "@/lib/editorial-slate-core";
import {reconcileOwnerIdeaHandoff} from "@/lib/bluebelly-my-desk-handoff";
import {getOwnerDailyIntelligenceIndex} from "@/lib/bluebelly-owner-daily-intelligence";
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
 const [slate,briefs,reportIndex]=await Promise.all([
  getLatestEditorialSlate().catch(()=>({slate:null,status:"storage_unavailable" as const})),
  getOwnerDeliveredResearchBriefs(6).catch(()=>[]),
  getOwnerDailyIntelligenceIndex().catch(()=>null),
 ]);
 const now=new Date();
 const today=dayInMyt(now);
 const lastSlate=slate.slate;
 const current=!!lastSlate&&lastSlate.dayMyt===today;
 const handoff=inspectWritingBrainHandoff(lastSlate,now);
 const activeParent=reportIndex?.editions[0]||null;
 const linked=activeParent?reconcileOwnerIdeaHandoff(activeParent,lastSlate,now):null;
 const handoffState=slate.status==="storage_unavailable"?"SLATE STORAGE UNAVAILABLE":
  current&&!activeParent?"SLATE SAVED — NO ELIGIBLE PARENT REPORT":
  current&&linked?.source!=="WRITING_BRAIN"?
   "SLATE SAVED — NOT LINKED TO ACTIVE REPORT":{

  CURRENT_PERSISTED:"CURRENT PRIVATE HANDOFF",
  CURRENT_PARTIAL:"CURRENT — EVIDENCE GAPS",
  MANUAL_RECOVERY:"MANUALLY RECOVERED — NOT A SCHEDULED PASS",
  NOT_DUE:"AWAITING 09:30 MYT RUN",
  MISSING:"MISSED — NO SLATE AFTER 10:00 MYT",
  NOT_SCHEDULED:"NOT SCHEDULED ON SUNDAY",
  UNKNOWN:"HANDOFF CLOCK UNAVAILABLE",
 }[handoff.state];
 const slateDetail= current&&lastSlate
  ?`Saved ${lastSlate.dayMyt} MYT at ${lastSlate.producedAt}. Three private ideas; ${handoff.linkedIdeaCount}/3 carry source URLs; distinct IDs: ${handoff.hasThreeDistinctIds?"3/3":"NOT VERIFIED"}. Verification: ${lastSlate.verificationStatus}. Exact parent handoff: ${linked?.state||"NO ELIGIBLE PARENT"}; parent session: ${activeParent?.reportDay||"UNKNOWN"} ET. ${linked?.reason||"No eligible report to reconcile."} This is database readback only, NOT proof the scheduled task ran or that all sources were independently checked.`
  :handoff.state==="NOT_DUE"
   ?"The 09:30 MYT Monday–Saturday scheduled slate has not reached its 10:00 MYT delivery check. Do not report a missed run yet."
   :handoff.state==="NOT_SCHEDULED"
    ?"Writing Brain is scheduled Monday–Saturday; an earlier saved slate remains historical."
    :`No current-day three-idea slate in the private store (${slate.status}). Last persisted day: ${lastSlate?.dayMyt||"none"}. This is an observable handoff gap, NOT proof why the automation failed.`;
 const latestMacro=briefs[0];
 const lastMacro=isoSafe(latestMacro?.source_retrieved_at);
 const macroTime=Date.parse(lastMacro);
 const macroRecent=briefs.length>0&&Number.isFinite(macroTime)
  &&macroTime<=now.getTime()+120_000&&now.getTime()-macroTime<24*3600_000;
 const entries=[
  {name:"OB / COTD Writing Brain",state:handoffState,detail:slateDetail},
  {name:"MacroPulse research",state:briefs.length
   ?macroRecent?"RECENT SOURCE-ATTRIBUTED BRIEF":"OLDER PRIVATE BRIEFS ONLY"
   :"NO BRIEF READBACK",
   detail:briefs.length?
    `${briefs.length} source-attributed private briefs available. Latest retrieval: ${lastMacro}. Recency is not proof of the expected two-hour MacroPulse Post and Log, PDF consumption or successful plugin execution; check original Notion Post and Log receipts separately.`
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
