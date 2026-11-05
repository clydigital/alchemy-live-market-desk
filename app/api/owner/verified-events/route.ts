import "server-only";
import {NextResponse,type NextRequest} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {blueDeskHostAccess} from "@/lib/blue-desk-host";
import {getBluebellyVerifiedEvents} from "@/lib/bluebelly-verified-event-server";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=25;

const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie",
  "X-Content-Type-Options":"nosniff"};
const failure=(code:number,message:string)=>
  NextResponse.json({error:message},{status:code,headers:HEADERS});

/** A staged owner-only reader. A later MCP bridge must use its own
 * dedicated machine credential; it must NOT reuse browser cookies or open
 * this route to anonymous clients. */
export async function GET(req:NextRequest){
  const host=req.headers.get("host")||req.nextUrl.hostname;
  if(blueDeskHostAccess("/api/owner/verified-events",host)!=="private")
    return failure(404,"Not found");
  const session=await createSupabaseServerClient().catch(()=>null);
  if(!session)return failure(503,"Owner authentication unavailable");
  const {data:{user},error:identityError}=await session.auth.getUser();
  if(identityError||!user?.email)return failure(401,"Owner sign-in required");
  const {data:allow,error:allowError}=await session.from("app_access_allowlist")
    .select("email").eq("email",user.email.toLowerCase().trim())
    .eq("active",true).maybeSingle();
  if(allowError||!allow)return failure(403,"Owner account not authorised");

  const rawLimit=req.nextUrl.searchParams.get("limit");
  if(rawLimit!==null&&!/^(?:[1-9]|1[0-8])$/.test(rawLimit))
    return failure(400,"Limit must be 1–18");
  const since=req.nextUrl.searchParams.get("since");
  if(since!==null&&!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(since))
    return failure(400,"Since must be an ISO UTC timestamp");
  try{
    const result=await getBluebellyVerifiedEvents(new Date(),{
      since:since??undefined,limit:rawLimit?Number(rawLimit):12,
    });
    return NextResponse.json(result,{status:result.status==="UNAVAILABLE"?503:200,headers:HEADERS});
  }catch(error){
    if(error instanceof Error&&error.message.includes("cursor outside"))
      return failure(400,"Since must be within the past seven days");
    return failure(503,"Verified event read unavailable");
  }
}
