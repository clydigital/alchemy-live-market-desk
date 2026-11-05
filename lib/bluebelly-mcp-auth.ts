import "server-only";
import {createClient} from "@supabase/supabase-js";
import {createRemoteJWKSet,jwtVerify} from "jose";
import {getSupabasePublicConfig} from "./supabase/config";
import {BLUEBELLY_MCP_METADATA,BLUEBELLY_MCP_RESOURCE} from "./bluebelly-mcp-contract";

/**
 * Distinct resource-server OAuth validation. The existing owner cookie is NOT
 * accepted; the existing owner API is NOT proxied. A bearer must be minted
 * specifically for the Bluebelly MCP resource by Supabase OAuth 2.1.
 *
 * Requires an OAuth access token hook that binds 'aud' to MCP_RESOURCE and
 * an explicitly approved OAuth client ID. Ordinary 'authenticated'-audience
 * Supabase sessions and anonymous keys fail closed.
 */
export type McpIdentity={userId:string;email:string;clientId:string};
export type McpIdentityCheck={ok:true;identity:McpIdentity}|{ok:false;reason:"AUTH_REQUIRED"|"AUTH_UNAVAILABLE"};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLIENT_ID_MAX=350;
export const mcpEnabled=()=>process.env.BLUEBELLY_MCP_ENABLED==="true";
export function allowedMcpClientId(value:unknown,approved:string|undefined):boolean{
 if(typeof value!=="string"||value.length<6||value.length>CLIENT_ID_MAX)return false;
 const allow=(approved||"").split(",").map(id=>id.trim()).filter(Boolean);
 return allow.length>0&&allow.length<=12&&allow.includes(value);
}
export function mcpAudienceAndClientClaimsValid(
 claims:Record<string,unknown>,approved:string|undefined,
):boolean{
 const audience=claims.aud;
 const aud=typeof audience==="string"?[audience]:Array.isArray(audience)?audience:[];
 if(!aud.includes(BLUEBELLY_MCP_RESOURCE)||aud.includes("authenticated"))return false;
 const scope=typeof claims.scope==="string"?claims.scope.split(/\s+/):[];
 if(!scope.includes("email"))return false;
 if(typeof claims.exp!=="number"||typeof claims.iat!=="number"||
   typeof claims.sub!=="string"||!UUID.test(claims.sub))return false;
 return allowedMcpClientId(claims.client_id,approved);
}
export const mcpAuthenticateHeader=
  `Bearer resource_metadata="${BLUEBELLY_MCP_METADATA}", scope="email"`;
export async function validateBluebellyMcpBearer(req:Request):Promise<McpIdentityCheck>{
 if(!mcpEnabled())return {ok:false,reason:"AUTH_REQUIRED"};
 const line=req.headers.get("authorization")||"";
 if(!/^Bearer [A-Za-z0-9._~+/-]{40,7000}={0,2}$/.test(line))
  return {ok:false,reason:"AUTH_REQUIRED"};
 const token=line.slice(7);
 const allow=process.env.BLUEBELLY_MCP_ALLOWED_CLIENT_IDS;
 if(!allow?.trim())return {ok:false,reason:"AUTH_UNAVAILABLE"};
 let config:{url:string;key:string};
 try{config=getSupabasePublicConfig()}catch{return {ok:false,reason:"AUTH_UNAVAILABLE"}}
 const issuer=config.url.replace(/\/$/,"")+"/auth/v1";
 try{
  const jwks=createRemoteJWKSet(new URL(issuer+"/.well-known/jwks.json"));
  const {payload}=await jwtVerify(token,jwks,{
   issuer,audience:BLUEBELLY_MCP_RESOURCE,algorithms:["RS256","ES256"],
   clockTolerance:"30s",
  });
  if(!mcpAudienceAndClientClaimsValid(payload as Record<string,unknown>,allow))
   return {ok:false,reason:"AUTH_REQUIRED"};
  const supabase=createClient(config.url,config.key,{
   global:{headers:{Authorization:"Bearer "+token}},
   auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  });
  const {data:{user},error:userError}=await supabase.auth.getUser(token);
  if(userError||!user||user.id!==payload.sub||
    !user.email||!user.email_confirmed_at)
    return {ok:false,reason:"AUTH_REQUIRED"};
  const email=user.email.trim().toLowerCase();
  const {data:permission,error:accessError}=await supabase.from("app_access_allowlist")
   .select("email").eq("email",email).eq("active",true).maybeSingle();
  if(accessError)return {ok:false,reason:"AUTH_UNAVAILABLE"};
  if(!permission||permission.email?.trim().toLowerCase()!==email)
   return {ok:false,reason:"AUTH_REQUIRED"};
  return {ok:true,identity:{userId:user.id,email,clientId:String(payload.client_id)}};
 }catch{return {ok:false,reason:"AUTH_REQUIRED"}}
}
