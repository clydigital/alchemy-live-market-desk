import "server-only";
import {createSupabaseAdminClient} from "./supabase/admin.ts";

type Db=ReturnType<typeof createSupabaseAdminClient>;
export type XWireResearchRow={post_id:string;handle:string;original_url:string;published_at:string;
 retrieved_at:string;body:string;media_urls:string[];quote_url:string|null;intake_status:string};
/** Separate bounded ledger reads prevent a busy squawk from crowding out other sources.
 * No retrieval, cursor mutation, public publishing or claim verification here. */
export async function readXWireResearchPool(db:Db,now:Date,mode:"discovery"|"deferred"="discovery"){
 const cutoff=(hours:number)=>new Date(now.getTime()-hours*3600000).toISOString();
 const base=(hours:number)=>db.from("x_wire_posts")
  .select("post_id,handle,original_url,published_at,retrieved_at,body,media_urls,quote_url,intake_status")
  .eq("intake_status",mode).gte("published_at",cutoff(hours)).lte("published_at",now.toISOString());
 const results=await Promise.all([
  base(mode==="deferred"?168:48).not("handle","in",'(FirstSquawk,zerohedge,GordianKnotDev)')
   .order("published_at",{ascending:false}).limit(250),
  base(24).eq("handle","FirstSquawk").order("published_at",{ascending:false}).limit(100),
  base(48).eq("handle","zerohedge").order("published_at",{ascending:false}).limit(100),
 ]);
 if(results.some(r=>r.error))throw Error("X Wire source pool unavailable");
 return results.flatMap(r=>(r.data||[]) as XWireResearchRow[]);
}
