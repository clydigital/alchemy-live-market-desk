import {BLUEBELLY_MCP_RESOURCE} from "./bluebelly-mcp-contract.ts";
/**
 * Pure, fail-closed secondary checks applied after JWT signature / issuer /
 * audience validation. A regular Supabase dashboard session must not grant
 * access to Bluebelly MCP; the claim must come from an approved OAuth client.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLIENT_ID_MAX=350;
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
