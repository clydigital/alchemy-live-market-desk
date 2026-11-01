import "server-only";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {uniquePrivateDailyIntelligence,type PrivateDailyIntelligenceEdition} from "./bluebelly-private-edition-dedupe";

export type PrivateDailyIntelligenceIndex={
 editions:PrivateDailyIntelligenceEdition[];
 state:"available"|"empty"|"partial"|"unavailable"|"unauthorised";
 duplicatesHidden:number;
};
type RawRow={
 id:string;report_day:string;title:string;created_at:string;
 html_sha256:string;review_status:string;delivery_type?:string;
};
function record(row:RawRow,delivery:"WORK"|"MY_DESK"):PrivateDailyIntelligenceEdition|null{
 if(!/^[a-f0-9-]{36}$/i.test(row.id)||!/^20\d{2}-\d{2}-\d{2}$/.test(row.report_day)||
    typeof row.title!=="string"||row.title.length<8||
    !/^[a-f0-9]{64}$/i.test(row.html_sha256)||
    !["PRIVATE_DRAFT","OWNER_REVIEWED"].includes(row.review_status)||
    !Number.isFinite(Date.parse(row.created_at)))return null;
 return {id:row.id,reportDay:row.report_day,title:row.title,createdAt:row.created_at,
  htmlSha256:row.html_sha256,reviewStatus:row.review_status as PrivateDailyIntelligenceEdition["reviewStatus"],
  delivery:delivery==="WORK"&&row.delivery_type==="SCHEDULED_RESEARCH"?"AUTOMATED":delivery};
}
/** One editorial edition per exact HTML SHA, even if both Work and My Desk
 * stored identical static reader bytes. Never collapse distinct revisions. */
export async function getOwnerDailyIntelligenceIndex(limit=30):Promise<PrivateDailyIntelligenceIndex>{
 const session=await createSupabaseServerClient().catch(()=>null);
 if(!session)return {editions:[],state:"unavailable",duplicatesHidden:0};
 const {data:{user},error}=await session.auth.getUser();
 if(error||!user?.id||!user.email)return {editions:[],state:"unauthorised",duplicatesHidden:0};
 const {data:allow,error:allowError}=await session.from("app_access_allowlist")
  .select("email").eq("email",user.email.toLowerCase().trim()).eq("active",true).maybeSingle();
 if(allowError||!allow)return {editions:[],state:"unauthorised",duplicatesHidden:0};
 const admin=createSupabaseAdminClient();
 const size=Math.max(1,Math.min(40,limit));
 const [work,owner]=await Promise.all([
  admin.from("blue_desk_work_html_editions")
   .select("id,report_day,title,created_at,html_sha256,review_status,delivery_type")
   .eq("owner_user_id",user.id).order("created_at",{ascending:false}).limit(size),
  admin.from("blue_desk_private_html_editions")
   .select("id,report_day,title,created_at,html_sha256,review_status")
   .eq("owner_user_id",user.id).order("created_at",{ascending:false}).limit(size),
 ]);
 const rows=[
  ...(work.error?[]:((work.data||[]) as RawRow[]).flatMap(r=>record(r,"WORK")||[])),
  ...(owner.error?[]:((owner.data||[]) as RawRow[]).flatMap(r=>record(r,"MY_DESK")||[])),
 ];
 const unique=uniquePrivateDailyIntelligence(rows);
 return {...unique,state:work.error&&owner.error?"unavailable":
  work.error||owner.error?"partial":unique.editions.length?"available":"empty"};
}
