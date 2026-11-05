import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 BLUEBELLY_MCP_RESOURCE,BLUEBELLY_MCP_METADATA,BLUEBELLY_MCP_TOOLS,
 handleBluebellyMcpMessage,type McpInvocation,
} from "../lib/bluebelly-mcp-contract.ts";
import {allowedMcpClientId,mcpAudienceAndClientClaimsValid} from "../lib/bluebelly-mcp-claims.ts";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";

const received:string[]=[];
const invocations:McpInvocation={
 getMarketSnapshot:async ({group,limit})=>{received.push("market");return {group,limit,observations:[{
   symbol:"US10Y",last:4.12,changeUnit:"bp",change:2.3,
   asOf:"2026-11-05",sourceUrl:"https://home.treasury.gov/"
 }]};},
 getVerifiedEvents:async ({since,limit})=>{received.push("news");return {since,limit,count:1,events:[{
  sourceRecordId:"rba-verified",verification:"SOURCE_VERIFIED",
  originalUrl:"https://www.rba.gov.au/media-releases/2026/mr-26-30.html",
  occurredAt:"2026-11-03T03:30:00.000Z",marketReaction:{status:"NOT_VERIFIED",value:null}
 }]};},
 getSourceHealth:async()=>{received.push("health");return {status:"DEGRADED",sourceReads:{
  motion:"READABLE",originalPress:"UNAVAILABLE",officialMacro:"READABLE"
 }};},
};
const req=(method:string,params?:unknown,id:number|string=1)=>({jsonrpc:"2.0" as const,id,method,params});
test("initialize and deterministic read-only tool discovery do not read sources",async()=>{
 received.length=0;
 const init=await handleBluebellyMcpMessage(req("initialize",{protocolVersion:"2025-11-25"}),invocations);
 assert.equal((init?.result as {protocolVersion:string}).protocolVersion,"2025-11-25");
 const tools=await handleBluebellyMcpMessage(req("tools/list"),invocations);
 const listed=(tools?.result as {tools:typeof BLUEBELLY_MCP_TOOLS}).tools;
 assert.deepEqual(listed.map(x=>x.name),["get_market_snapshot","get_verified_events","get_source_health"]);
 for(const tool of listed){
  assert.equal(tool.annotations.readOnlyHint,true);
  assert.deepEqual(tool.securitySchemes,[{type:"oauth2",scopes:["email"]}]);
 }
 assert.deepEqual(received,[]);
 assert.equal(await handleBluebellyMcpMessage({jsonrpc:"2.0",method:"notifications/initialized"},invocations),null);
});
test("valid tools use bounded arguments and retain source provenance and unknown reaction",async()=>{
 received.length=0;
 const market=await handleBluebellyMcpMessage(req("tools/call",{name:"get_market_snapshot",arguments:{group:"rates",limit:4}}),invocations);
 assert.equal((market?.result as {structuredContent:{group:string}}).structuredContent.group,"rates");
 const news=await handleBluebellyMcpMessage(req("tools/call",{name:"get_verified_events",arguments:{
  since:"2026-11-03T00:00:00Z",limit:12,
 }}),invocations);
 const result=(news?.result as {structuredContent:{events:Array<{marketReaction:{value:null}}>}});
 assert.equal(result.structuredContent.events[0].marketReaction.value,null);
 const health=await handleBluebellyMcpMessage(req("tools/call",{name:"get_source_health",arguments:{}}),invocations);
 assert.equal((health?.result as {structuredContent:{status:string}}).structuredContent.status,"DEGRADED");
 assert.deepEqual(received,["market","news","health"]);
});
test("malformed and excessive arguments do not reach any provider",async()=>{
 received.length=0;
 const attempts=[
  req("tools/call",{name:"get_market_snapshot",arguments:{group:"private"}}),
  req("tools/call",{name:"get_market_snapshot",arguments:{group:"all",limit:500}}),
  req("tools/call",{name:"get_verified_events",arguments:{since:"2026-11-04 00:00:00"}}),
  req("tools/call",{name:"get_verified_events",arguments:{limit:19}}),
  req("tools/call",{name:"get_source_health",arguments:{debug:true}}),
  req("tools/call",{name:"mutate_story",arguments:{}}),
  req("tools/call",{name:"get_verified_events",arguments:null}),
  req("resources/read",{uri:"secret"}),
  [],
  {jsonrpc:"2.0",method:"tools/list"},
 ];
 for(const input of attempts){
  const result=await handleBluebellyMcpMessage(input,invocations);
  assert.ok(result?.error);
 }
 assert.deepEqual(received,[]);
});
test("provider failures are surfaced only as unavailable, not secrets or fabricated empty results",async()=>{
 const bad:McpInvocation={
  ...invocations,getMarketSnapshot:async()=>{throw Error("SUPABASE_SERVICE_ROLE_KEY private provider secret");},
 };
 const result=await handleBluebellyMcpMessage(req("tools/call",{name:"get_market_snapshot"}),bad);
 const payload=JSON.stringify(result);
 assert.match(payload,/isError/);
 assert.doesNotMatch(payload,/SUPABASE_SERVICE_ROLE_KEY|private provider secret/);
});
test("regular dashboard tokens and third-party clients fail closed, even with valid users",()=>{
 const good={aud:BLUEBELLY_MCP_RESOURCE,scope:"openid email",client_id:"https://chatgpt.com/oauth/client.json",
  sub:"11a1e112-4444-4a3b-a5e8-09c0c74227aa",iat:1793900000,exp:1793903600};
 const allow="https://chatgpt.com/oauth/client.json";
 assert.equal(mcpAudienceAndClientClaimsValid(good,allow),true);
 assert.equal(mcpAudienceAndClientClaimsValid({...good,aud:"authenticated"},allow),false);
 assert.equal(mcpAudienceAndClientClaimsValid({...good,aud:[BLUEBELLY_MCP_RESOURCE,"authenticated"]},allow),false);
 assert.equal(mcpAudienceAndClientClaimsValid({...good,scope:"openid"},allow),false);
 assert.equal(mcpAudienceAndClientClaimsValid({...good,client_id:"unauthorized-mcp-client"},allow),false);
 assert.equal(mcpAudienceAndClientClaimsValid({...good,exp:undefined},allow),false);
 assert.equal(allowedMcpClientId(good.client_id,undefined),false);
 assert.equal(allowedMcpClientId("not-allowed",allow),false);
});
test("host allowlist only routes exact discovery and MCP paths; runtime still enforces OAuth",()=>{
 assert.equal(blueDeskHostAccess("/api/mcp","bluebelly-desk.vercel.app"),"public");
 assert.equal(blueDeskHostAccess("/.well-known/oauth-protected-resource","bluebelly-desk.vercel.app"),"public");
 assert.equal(blueDeskHostAccess("/api/owner/verified-events","bluebelly-desk.vercel.app"),"blocked");
 assert.equal(blueDeskHostAccess("/api/internal/dossier-v2","bluebelly-desk.vercel.app"),"blocked");
 assert.equal(blueDeskHostAccess("/api/mcp/delete","bluebelly-desk.vercel.app"),"blocked");
 assert.equal(BLUEBELLY_MCP_METADATA,"https://bluebelly-desk.vercel.app/.well-known/oauth-protected-resource");
 const source=readFileSync(new URL("../app/api/mcp/route.ts",import.meta.url),"utf8");
 assert.match(source,/validateBluebellyMcpBearer\(req\)/);
 assert.match(source,/!mcpEnabled\(\)/);
 assert.match(source,/exactHost\(req\)/);
 assert.doesNotMatch(source,/SUPABASE_SERVICE_ROLE_KEY|createSupabaseAdminClient/);
});
