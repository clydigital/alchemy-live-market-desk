import "server-only";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";

export type PrivateCreatorReview={
 publisher:string;videoId:string;title:string;url:string;
 publishedAt:string;summary:string;logic:string;
 claimChecks:Array<{kind:string;claim:string;verificationTarget:string|null}>;
};
/** Read-only, owner-only existing transcript reviews. No raw transcript output
 * and no creator claim is promoted to canonical evidence. */
export async function getPrivateReviewedCreatorArguments(now:Date):Promise<PrivateCreatorReview[]>{
 const db=createSupabaseAdminClient();
 const cutoff=new Date(now.getTime()-12*86400_000).toISOString();
 const {data,error}=await db.from("research_intake_items")
  .select("publisher,external_id,title,url,published_at,summary,creator_logic,claim_checks")
  .eq("item_type","video").eq("transcript_status","ready")
  .eq("video_review_status","reviewed")
  .gte("published_at",cutoff).lte("published_at",now.toISOString())
  .order("published_at",{ascending:false}).limit(25);
 if(error)throw new Error("Creator review receipts unavailable");
 const reviews:PrivateCreatorReview[]=[];
 const used=new Map<string,number>();
 for(const item of data||[]){
  if(typeof item.external_id!=="string"||!/^[\w-]{11}$/.test(item.external_id)||
     typeof item.publisher!=="string"||!item.publisher.trim()||
     typeof item.published_at!=="string")continue;
  const publisher=item.publisher.trim();
  if((used.get(publisher)||0)>=2)continue;
  let url:string;
  try{
   const u=new URL(String(item.url));
   if(!["www.youtube.com","youtube.com","youtu.be","m.youtube.com"].includes(u.hostname)||
    u.protocol!=="https:")continue;
   url=u.toString();
  }catch{continue;}
  const claims=Array.isArray(item.claim_checks)?item.claim_checks.slice(0,3).flatMap((c:unknown)=>{
   if(!c||typeof c!=="object"||Array.isArray(c))return [];
   const d=c as Record<string,unknown>;
   if(typeof d.claim!=="string"||!d.claim.trim())return [];
   return [{kind:typeof d.kind==="string"?d.kind.slice(0,32):"creator_claim",
    claim:d.claim.slice(0,330),
    verificationTarget:typeof d.verificationTarget==="string"?d.verificationTarget.slice(0,270):null}];
  }):[];
  const logic=typeof item.creator_logic==="string"?item.creator_logic.slice(0,900):"";
  const summary=typeof item.summary==="string"?item.summary.slice(0,520):"";
  if(!logic&&!summary)continue;
  reviews.push({
   publisher,videoId:item.external_id,title:String(item.title||"Video").slice(0,150),
   publishedAt:item.published_at,url,summary,logic,claimChecks:claims,
  });
  used.set(publisher,(used.get(publisher)||0)+1);
  if(reviews.length>=8)break;
 }
 return reviews;
}
