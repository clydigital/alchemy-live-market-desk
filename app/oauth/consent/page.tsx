import "server-only";
import {notFound,redirect} from "next/navigation";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {mcpEnabled} from "@/lib/bluebelly-mcp-auth";
import {
 mcpConsentAuthorizationId,mcpConsentDetailsApproved,type OAuthConsentDetails,
} from "@/lib/bluebelly-mcp-consent";

export const dynamic="force-dynamic";
export const metadata={title:"Approve Bluebelly for ChatGPT"};

export default async function BluebellyMcpConsent({searchParams}:{
 searchParams:Promise<{authorization_id?:string|string[]}>
}){
 if(!mcpEnabled())notFound();
 const query=await searchParams;
 const id=query.authorization_id;
 if(!mcpConsentAuthorizationId(id))notFound();
 const supabase=await createSupabaseServerClient();
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user?.id||!user.email){
  redirect("/auth/google?next="+encodeURIComponent("/oauth/consent?authorization_id="+id));
 }
 const email=user.email.toLowerCase().trim();
 const {data:allowed,error:allowError}=await supabase.from("app_access_allowlist")
  .select("email").eq("email",email).eq("active",true).maybeSingle();
 if(allowError||!allowed)notFound();
 const {data,error:detailError}=await supabase.auth.oauth.getAuthorizationDetails(id);
 const details=data as OAuthConsentDetails|null;
 if(detailError||!mcpConsentDetailsApproved(details,process.env.BLUEBELLY_MCP_ALLOWED_CLIENT_IDS))
  notFound();
 return <main style={{maxWidth:560,margin:"64px auto",padding:"24px",fontFamily:"system-ui"}}>
   <h1>Connect Bluebelly to ChatGPT?</h1>
   <p>You are approving a private, read-only connection to your source-dated Bluebelly market observations and verified news events.</p>
   <dl>
    <dt>Application</dt><dd>{details?.client?.name||"Approved ChatGPT connector"}</dd>
    <dt>Requested permissions</dt><dd>{details?.scope||"email"}</dd>
    <dt>Callback</dt><dd style={{overflowWrap:"anywhere"}}>{details?.redirect_uri}</dd>
   </dl>
   <p>No trading, portfolio changes, publishing, research task edits or account writes are permitted through this MCP connection.</p>
   <form action="/api/oauth/decision" method="post">
    <input type="hidden" name="authorization_id" value={id}/>
    <button type="submit" name="decision" value="approve" style={{padding:"12px 18px",marginRight:12}}>
     Approve read-only access
    </button>
    <button type="submit" name="decision" value="deny" style={{padding:"12px 18px"}}>Deny</button>
   </form>
 </main>;
}
