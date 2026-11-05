import "server-only";
import {NextResponse,type NextRequest} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {mcpEnabled} from "@/lib/bluebelly-mcp-auth";
import {
 mcpConsentAuthorizationId,mcpChatgptCallbackAllowed,mcpConsentDetailsApproved,
 type OAuthConsentDetails,
} from "@/lib/bluebelly-mcp-consent";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const HEADERS={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const fail=(status:number,error:string)=>NextResponse.json({error},{status,headers:HEADERS});
export async function POST(req:NextRequest){
 if(!mcpEnabled()||(req.headers.get("host")||req.nextUrl.hostname).toLowerCase()!=="bluebelly-desk.vercel.app")
  return new NextResponse(null,{status:404,headers:HEADERS});
 // Browser cookies can authorise approvals; exact Origin is mandatory to
 // prevent CSRF. Never accept a client_id, callback URL or email from form.
 if(req.headers.get("origin")!=="https://bluebelly-desk.vercel.app")
  return fail(403,"Same-origin consent required");
 if(!(req.headers.get("content-type")||"").startsWith("application/x-www-form-urlencoded"))
  return fail(415,"Form submission required");
 const length=Number(req.headers.get("content-length")||0);
 if(!Number.isFinite(length)||length<0||length>2000)return fail(413,"Consent request too large");
 let raw:string;
 try{raw=await req.text();if(raw.length>2000)return fail(413,"Consent request too large")}
 catch{return fail(400,"Invalid consent request")}
 const form=new URLSearchParams(raw);
 const id=form.get("authorization_id");
 const decision=form.get("decision");
 if(!mcpConsentAuthorizationId(id)||!["approve","deny"].includes(decision||"")||
    [...form.keys()].some(k=>!["authorization_id","decision"].includes(k)))
  return fail(400,"Invalid consent selection");
 let supabase:Awaited<ReturnType<typeof createSupabaseServerClient>>;
 try{supabase=await createSupabaseServerClient()}catch{return fail(503,"Owner login unavailable")}
 const {data:{user},error:identityError}=await supabase.auth.getUser();
 if(identityError||!user?.id||!user.email)return fail(401,"Owner sign-in required");
 const email=user.email.toLowerCase().trim();
 const {data:allowed,error:accessError}=await supabase.from("app_access_allowlist")
  .select("email").eq("email",email).eq("active",true).maybeSingle();
 if(accessError)return fail(503,"Authorisation unavailable");
 if(!allowed)return fail(403,"Owner not authorised");
 const {data:detailsRaw,error:detailsError}=await supabase.auth.oauth.getAuthorizationDetails(id);
 const details=detailsRaw as OAuthConsentDetails|null;
 if(detailsError||!mcpConsentDetailsApproved(details,process.env.BLUEBELLY_MCP_ALLOWED_CLIENT_IDS))
  return fail(403,"OAuth client not approved");
 try{
  const out=decision==="approve"
   ?await supabase.auth.oauth.approveAuthorization(id)
   :await supabase.auth.oauth.denyAuthorization(id);
  if(out.error||!out.data||!mcpChatgptCallbackAllowed(out.data.redirect_url))
   return fail(502,"Consent provider response unavailable");
  return NextResponse.redirect(out.data.redirect_url,{status:303,headers:HEADERS});
 }catch{return fail(503,"Consent provider unavailable")}
}
