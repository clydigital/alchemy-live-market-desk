import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 mcpConsentAuthorizationId,mcpConsentDetailsApproved,mcpChatgptCallbackAllowed,
} from "../lib/bluebelly-mcp-consent.ts";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";
const client="https://chatgpt.com/oauth/client.json";
const allowed={authorization_id:"5bbcc44a-8e09-4e3e-a622-aca9a70f0cb7",
 client:{id:client,name:"ChatGPT"},scope:"openid email profile",
 redirect_uri:"https://chatgpt.com/connector_platform_oauth_redirect"};
test("only exact approved OAuth client, requested email scope and registered ChatGPT callback may be consented",()=>{
 assert.equal(mcpConsentDetailsApproved(allowed,client),true);
 assert.equal(mcpConsentDetailsApproved({...allowed,client:{id:"untrusted-client"}},client),false);
 assert.equal(mcpConsentDetailsApproved({...allowed,scope:"openid"},client),false);
 assert.equal(mcpConsentDetailsApproved({...allowed,scope:"email files:write"},client),false);
 assert.equal(mcpConsentDetailsApproved({...allowed,redirect_uri:"https://evil.example/oauth/callback"},client),false);
 assert.equal(mcpConsentDetailsApproved({...allowed,redirect_uri:"https://chatgpt.com.evil.example/connector_platform_oauth_redirect"},client),false);
 assert.equal(mcpConsentDetailsApproved(allowed,undefined),false);
});
test("OAuth callback checks resist redirect URI injection, forged clients and URL credentials",()=>{
 assert.equal(mcpChatgptCallbackAllowed("https://chatgpt.com/connector/oauth/a123456789"),true);
 assert.equal(mcpChatgptCallbackAllowed("https://chatgpt.com/connector_platform_oauth_redirect?code=REDACTED"),true);
 for(const url of [
  "http://chatgpt.com/connector_platform_oauth_redirect",
  "https://chatgpt.com@evil.example/connector_platform_oauth_redirect",
  "https://chatgpt.com/profile",
  "https://evil.example/connector_platform_oauth_redirect",
  "javascript:alert(1)",
  "https://chatgpt.com.evil.example/connector/oauth/a123456789",
 ]){
  assert.equal(mcpChatgptCallbackAllowed(url),false,url);
 }
});
test("Consent POST requires origin, owner session, active RLS allowlist and never accepts a client URL from a form",()=>{
 const code=readFileSync(new URL("../app/api/oauth/decision/route.ts",import.meta.url),"utf8");
 for(const term of [
  'mcpEnabled()','get("origin")','getUser()','app_access_allowlist',
  'getAuthorizationDetails(id)','approveAuthorization(id)','denyAuthorization(id)',
  'mcpChatgptCallbackAllowed(out.data.redirect_url)','form.keys()',
 ]){
  assert.ok(code.includes(term),term);
 }
 assert.doesNotMatch(code,/createSupabaseAdminClient|SUPABASE_SERVICE_ROLE_KEY|autoApprove/i);
 assert.equal(mcpConsentAuthorizationId("5bbcc44a-8e09-4e3e-a622-aca9a70f0cb7"),true);
 assert.equal(mcpConsentAuthorizationId("../oauth/evil"),false);
});
test("Consent routes remain private when enabled and fail closed on public without flag",()=>{
 const current=process.env.BLUEBELLY_MCP_ENABLED;
 try{
  delete process.env.BLUEBELLY_MCP_ENABLED;
  assert.equal(blueDeskHostAccess("/oauth/consent","bluebelly-desk.vercel.app"),"blocked");
  assert.equal(blueDeskHostAccess("/api/oauth/decision","bluebelly-desk.vercel.app"),"blocked");
  process.env.BLUEBELLY_MCP_ENABLED="true";
  assert.equal(blueDeskHostAccess("/oauth/consent","bluebelly-desk.vercel.app"),"private");
  assert.equal(blueDeskHostAccess("/api/oauth/decision","bluebelly-desk.vercel.app"),"private");
  assert.equal(blueDeskHostAccess("/api/oauth/decision/extra","bluebelly-desk.vercel.app"),"blocked");
 }finally{if(current===undefined)delete process.env.BLUEBELLY_MCP_ENABLED;
  else process.env.BLUEBELLY_MCP_ENABLED=current;}
});
