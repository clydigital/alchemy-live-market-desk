import "server-only";
import {NextResponse,type NextRequest} from "next/server";
import {BLUEBELLY_MCP_RESOURCE} from "@/lib/bluebelly-mcp-contract";
import {mcpEnabled} from "@/lib/bluebelly-mcp-auth";
import {getSupabasePublicConfig} from "@/lib/supabase/config";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const NO_STORE={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
export async function GET(request:NextRequest){
 const host=(request.headers.get("host")||request.nextUrl.hostname).toLowerCase();
 if(host!=="bluebelly-desk.vercel.app"||!mcpEnabled())
  return new NextResponse(null,{status:404,headers:NO_STORE});
 try{
  const config=getSupabasePublicConfig();
  const issuer=config.url.replace(/\/$/,"")+"/auth/v1";
  return NextResponse.json({
   resource:BLUEBELLY_MCP_RESOURCE,
   authorization_servers:[issuer],
   scopes_supported:["email"],
   resource_documentation:"https://bluebelly-desk.vercel.app/research",
  },{headers:NO_STORE});
 }catch{return new NextResponse(null,{status:503,headers:NO_STORE})}
}
