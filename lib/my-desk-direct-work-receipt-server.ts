import "server-only";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {getOwnerWorkReceiptLanes} from "./my-desk-work-receipt-server";
import {WORK_KEYS} from "./my-desk-operational-receipt";
import {DIRECT_WORK_TITLES,pickDirectWorkReceipt,projectDirectWorkReceipt,type DirectWorkReceipt,type DirectWorkRow} from "./my-desk-direct-work-receipt";
type Lanes=Awaited<ReturnType<typeof getOwnerWorkReceiptLanes>>;
export async function getOwnerPreferredWorkReceiptLanes(now=new Date()):Promise<Lanes>{
 let ownerId:string|null=null;
 try{
  const session=await createSupabaseServerClient();const {data:{user},error}=await session.auth.getUser();
  if(!error&&user?.id&&user.email){const {data:access,error:accessError}=await session.from("app_access_allowlist").select("email").eq("email",user.email.toLowerCase().trim()).eq("active",true).maybeSingle();if(!accessError&&access)ownerId=user.id;}
 }catch{/* Legacy reader retains the same owner gate. */}
 if(!ownerId)return getOwnerWorkReceiptLanes(now);
 const direct:Partial<Record<typeof WORK_KEYS[number],DirectWorkReceipt>>={};
 try{
  const db=createSupabaseAdminClient();
  await Promise.all(WORK_KEYS.map(async key=>{
   try{const {data,error}=await db.from("blue_desk_work_html_editions").select("title,report_day,created_at,html_content,html_sha256")
     .eq("owner_user_id",ownerId).eq("title",DIRECT_WORK_TITLES[key]).eq("delivery_type","CHATGPT_WORK").eq("review_status","PRIVATE_DRAFT").order("created_at",{ascending:false}).limit(4);
    if(!error){const best=pickDirectWorkReceipt((data??[]) as DirectWorkRow[],key,now);if(best)direct[key]=best;}
   }catch{/* Missing lane falls back independently. */}
  }));
 }catch{/* Existing legacy reader remains available during migration. */}
 const keys=["macropulse","ai16","material","investigation"] as const;
 const labels=["MacroPulse","AI16","Material Events","Research Investigation"] as const;
 if(WORK_KEYS.every(k=>direct[k])){
  return {"MacroPulse":projectDirectWorkReceipt("MacroPulse",direct.macropulse!,now),AI16:projectDirectWorkReceipt("AI16",direct.ai16!,now),"Material Events":projectDirectWorkReceipt("Material Events",direct.material!,now),"Research Investigation":projectDirectWorkReceipt("Research Investigation",direct.investigation!,now),creatorReceipt:direct.creator!.receipt};
 }
 const legacy=await getOwnerWorkReceiptLanes(now);
 keys.forEach((key,i)=>{const r=direct[key];if(r&&(!legacy[labels[i]].attempt||Date.parse(r.receipt.attemptAt)>=Date.parse(legacy[labels[i]].attempt!)))legacy[labels[i]]=projectDirectWorkReceipt(labels[i],r,now);});
 if(direct.creator&&(!legacy.creatorReceipt||Date.parse(direct.creator.receipt.attemptAt)>=Date.parse(legacy.creatorReceipt.attemptAt)))legacy.creatorReceipt=direct.creator.receipt;
 return legacy;
}
