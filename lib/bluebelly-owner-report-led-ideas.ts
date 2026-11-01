import "server-only";
import {createSupabaseServerClient} from "./supabase/server";
import {createSupabaseAdminClient} from "./supabase/admin";
import {HTML_BUCKET,HTML_TABLE,archivePath,digest} from "./bluebelly-private-html-archive-contract";
import {getOwnerDailyIntelligenceIndex} from "./bluebelly-owner-daily-intelligence";
import {getCurrentVerifiedMarketMotion} from "./market-motion";
import {selectVerifiedNewsBriefs} from "./market-brief-news";
import {projectReportLedTopicIdeas,type DailyTopicIdea} from "./bluebelly-my-desk-suggestions";

export type ReportLedIdeaRead={
 editionId:string|null;reportDay:string|null;editionTitle:string|null;
 state:"available"|"no_report"|"report_unavailable"|"unauthorised";
 ideas:DailyTopicIdea[];
};
const missing=(state:ReportLedIdeaRead["state"]):ReportLedIdeaRead=>({
 editionId:null,reportDay:null,editionTitle:null,state,ideas:[],
});
/** Never return private HTML to a public API or expose it as JSX.
 * Re-check owner identity, row ownership and exact SHA before extracting text. */
export async function getOwnerReportLedIdeas():Promise<ReportLedIdeaRead>{
 const index=await getOwnerDailyIntelligenceIndex();
 if(index.state==="unauthorised")return missing("unauthorised");
 const latest=index.editions[0];
 if(!latest)return missing(index.state==="unavailable"?"report_unavailable":"no_report");
 try{
  const session=await createSupabaseServerClient();
  const {data:{user},error}=await session.auth.getUser();
  if(error||!user?.id||!user.email)return missing("unauthorised");
  const {data:allow,error:allowError}=await session.from("app_access_allowlist")
   .select("email").eq("email",user.email.toLowerCase().trim()).eq("active",true).maybeSingle();
  if(allowError||!allow)return missing("unauthorised");
  const db=createSupabaseAdminClient();
  let html:string|null=null;
  if(latest.delivery==="WORK"||latest.delivery==="AUTOMATED"){
   const {data,error:readError}=await db.from("blue_desk_work_html_editions")
    .select("html_content,html_sha256,report_day")
    .eq("owner_user_id",user.id).eq("id",latest.id).maybeSingle();
   if(!readError&&data&&typeof data.html_content==="string"&&
      data.report_day===latest.reportDay&&data.html_sha256===latest.htmlSha256&&
      Buffer.byteLength(data.html_content,"utf8")<=950000&&
      digest(data.html_content)===latest.htmlSha256)
    html=data.html_content;
  }else{
   const {data,error:readError}=await db.from(HTML_TABLE)
    .select("html_path,html_sha256,report_day")
    .eq("owner_user_id",user.id).eq("id",latest.id).maybeSingle();
   if(!readError&&data&&data.report_day===latest.reportDay&&data.html_sha256===latest.htmlSha256){
    const expected=archivePath(user.id,latest.reportDay,latest.id);
    if(data.html_path===expected){
     const {data:blob,error:blobError}=await db.storage.from(HTML_BUCKET).download(expected);
     if(!blobError&&blob&&blob.size<=1048576){
      const bytes=new Uint8Array(await blob.arrayBuffer());
      if(digest(bytes)===latest.htmlSha256)html=new TextDecoder().decode(bytes);
     }
    }
   }
  }
  if(!html||html.length<1000||!/<html\b/i.test(html))return {
   editionId:latest.id,reportDay:latest.reportDay,editionTitle:latest.title,
   state:"report_unavailable",ideas:[],
  };
  const motion=await getCurrentVerifiedMarketMotion({limit:30}).catch(()=>[]);
  const verified=selectVerifiedNewsBriefs(motion,new Date(),12);
  const ideas=projectReportLedTopicIdeas(html,verified,3);
  return {editionId:latest.id,reportDay:latest.reportDay,editionTitle:latest.title,
   state:"available",ideas};
 }catch{
  return {editionId:latest.id,reportDay:latest.reportDay,editionTitle:latest.title,
   state:"report_unavailable",ideas:[]};
 }
}
