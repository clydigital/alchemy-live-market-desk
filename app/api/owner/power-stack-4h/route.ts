import {createClient} from "@supabase/supabase-js";
import {getSupabasePublicConfig} from "@/lib/supabase/config";
import {authorizeVerifiedEventOwner} from "@/lib/bluebelly-verified-event-owner-auth";
import {readFourH,TECHNICAL_UNIVERSE} from "@/lib/providers/twelve-data-ema-history";
export const dynamic="force-dynamic";
const origin="https://clydigital.github.io";
const headers={"Cache-Control":"private, no-store","Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Authorization","Vary":"Origin","X-Content-Type-Options":"nosniff"};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
export function OPTIONS(req:Request){return new Response(null,{status:req.headers.get("origin")===origin?204:403,headers});}
export async function GET(req:Request){
 if(req.headers.get("origin")!==origin)return reply({error:"Origin not allowed"},403);
 const token=req.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
 if(!token||token.length>8192)return reply({error:"Owner sign-in required"},401);
 const ticker=new URL(req.url).searchParams.get("ticker")||"";
 if(!TECHNICAL_UNIVERSE.some(x=>x.ticker===ticker))return reply({error:"Instrument unsupported"},400);
 try{
  const config=getSupabasePublicConfig(),db=createClient(config.url,config.key,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const access=await authorizeVerifiedEventOwner({getUser:async()=>{const x=await db.auth.getUser(token);return x.data.user?.app_metadata?.provider==="google"?x:{data:{user:null},error:"Invalid provider"};},readActiveAllowlist:email=>db.from("app_access_allowlist").select("email").eq("email",email).eq("active",true).maybeSingle()});
  if(!access.ok)return reply({error:access.error},access.status);
  const observation=await readFourH(ticker);
  return reply({contract:"bluebelly-owner-4h/1",provider:"Twelve Data",observation});
 }catch{return reply({error:"Owner technical read unavailable"},503);}
}
