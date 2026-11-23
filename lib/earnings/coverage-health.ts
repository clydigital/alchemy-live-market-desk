/** Public-safe counts from the private issuer processing ledger.
 * Never expose raw issuer URLs, private notes or service-role credentials.
 */
import "server-only";
import {createSupabaseAdminClient} from "../supabase/admin.ts";
export type EarningsCoverageHealth={
 state:"ok"|"unavailable";scheduled:number;due:number;detected:number;
 partial:number;reviewRequired:number;lastAttemptAt:string|null;secConfigured:boolean;
};
export async function getIssuerEarningsCoverageHealth(
 now=new Date(),
):Promise<EarningsCoverageHealth>{
 const empty:EarningsCoverageHealth={state:"unavailable",scheduled:0,due:0,detected:0,
  partial:0,reviewRequired:0,lastAttemptAt:null,secConfigured:Boolean(process.env.SEC_USER_AGENT)};
 try{
  const db=createSupabaseAdminClient();
  const from=new Date(now.getTime()-14*86400000).toISOString();
  const to=new Date(now.getTime()+45*86400000).toISOString();
  const {data,error}=await db.from("issuer_earnings_ingestion_state")
   .select("state,last_attempt_at,event_at")
   .gte("event_at",from).lt("event_at",to).limit(200);
  if(error)throw new Error(error.code);
  const rows=data||[];
  const n=(status:string)=>rows.filter(r=>r.state===status).length;
  const last=rows.map(r=>r.last_attempt_at).filter((v):v is string=>Boolean(v))
   .sort().at(-1)||null;
  return {state:"ok",scheduled:n("scheduled"),due:n("due")+n("retry"),
   detected:n("source_detected"),partial:n("partial")+n("verified")+n("published"),
   reviewRequired:n("review_required"),lastAttemptAt:last,secConfigured:Boolean(process.env.SEC_USER_AGENT)};
 }catch{
  return empty;
 }
}
