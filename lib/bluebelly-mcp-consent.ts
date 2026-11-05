import {allowedMcpClientId} from "./bluebelly-mcp-claims.ts";

/** Reject all unrelated OAuth clients and callback origins. Data originates
 * from Supabase Auth getAuthorizationDetails, never an untrusted form field. */
export type OAuthConsentDetails={
 authorization_id?:string;
 client?:{id?:string;client_id?:string;name?:string};
 scope?:string;
 redirect_uri?:string;
 redirect_url?:string;
};
export function mcpConsentAuthorizationId(value:unknown):value is string{
 return typeof value==="string"&&value.length>=12&&value.length<=160&&
  /^[A-Za-z0-9_-]+$/.test(value);
}
export function mcpChatgptCallbackAllowed(raw:unknown):boolean{
 if(typeof raw!=="string"||raw.length>1600)return false;
 try{
  const url=new URL(raw);
  return url.origin==="https://chatgpt.com"&&!url.username&&!url.password&&
   (url.pathname==="/connector_platform_oauth_redirect"||
    /^\/connector\/oauth\/[A-Za-z0-9_-]{8,160}$/.test(url.pathname));
 }catch{return false}
}
export function mcpConsentDetailsApproved(
 details:OAuthConsentDetails|undefined|null,approvedClients:string|undefined,
):boolean{
 if(!details?.client)return false;
 const id=details.client.id||details.client.client_id;
 if(!allowedMcpClientId(id,approvedClients))return false;
 const scope=(details.scope||"").split(/\s+/).filter(Boolean);
 if(!scope.includes("email")||scope.some(x=>!["email","openid","profile"].includes(x)))
  return false;
 return mcpChatgptCallbackAllowed(details.redirect_uri);
}
