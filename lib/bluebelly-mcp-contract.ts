/**
 * Minimal stateless Streamable-HTTP JSON-RPC contract for a PRIVATE, read-only
 * Bluebelly MCP canary. No network access, OAuth tokens, database or writes
 * here: the authenticated route injects existing qualified source readers.
 *
 * Keep this bounded: more tools only after source-identity/freshness parity.
 */
export const BLUEBELLY_MCP_RESOURCE="https://bluebelly-desk.vercel.app/api/mcp" as const;
export const BLUEBELLY_MCP_METADATA="https://bluebelly-desk.vercel.app/.well-known/oauth-protected-resource" as const;
export const BLUEBELLY_MCP_PROTOCOL="2025-11-25" as const;
export type McpToolName="get_market_snapshot"|"get_verified_events"|"get_source_health";
export type McpRequest={jsonrpc:"2.0";id?:string|number|null;method:string;params?:unknown};
export type McpInvocation={
  getMarketSnapshot:(args:{group:string;limit:number})=>Promise<unknown>;
  getVerifiedEvents:(args:{since?:string;limit:number})=>Promise<unknown>;
  getSourceHealth:()=>Promise<unknown>;
};
const EMPTY={type:"object",properties:{},additionalProperties:false} as const;
export const BLUEBELLY_MCP_TOOLS=[
 {
  name:"get_market_snapshot",
  description:"Return source-dated market observations for one group, with 1/3/5 session changes when available. A missing observation is not a market move. Rates changes are basis points, other prices percentages. Read-only.",
  inputSchema:{type:"object",properties:{
    group:{type:"string",enum:["all","ai","breadth","rates","energy","fx","credit","equities","metals"],description:"A bounded market group."},
    limit:{type:"integer",minimum:1,maximum:80},
  },additionalProperties:false},
  annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},
  securitySchemes:[{type:"oauth2",scopes:["email"]}],
 },
 {
  name:"get_verified_events",
  description:"Read source-verified dated events from the shared Bluebelly Newsroom feed. No causal price reaction or interpretation is inferred. Default is 48 hours, optional UTC cursor up to 7 days.",
  inputSchema:{type:"object",properties:{
    since:{type:"string",format:"date-time",description:"UTC ISO timestamp not older than seven days."},
    limit:{type:"integer",minimum:1,maximum:18},
  },additionalProperties:false},
  annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},
  securitySchemes:[{type:"oauth2",scopes:["email"]}],
 },
 {
  name:"get_source_health",
  description:"Check whether the qualified Motion, original-press and macro source readers are accessible, and the time of this check. Read-only status; not a claim that all world events were collected.",
  inputSchema:EMPTY,
  annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},
  securitySchemes:[{type:"oauth2",scopes:["email"]}],
 },
] as const;
type JsonResult={jsonrpc:"2.0";id:string|number|null;result?:unknown;error?:{code:number;message:string}};
export function mcpError(id:string|number|null,code:number,message:string):JsonResult{
 return {jsonrpc:"2.0",id,error:{code,message}};
}
function validParams(value:unknown):Record<string,unknown>|null{
 if(value===undefined)return {};
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const proto=Object.getPrototypeOf(value);
 if(proto!==Object.prototype&&proto!==null)return null;
 return value as Record<string,unknown>;
}
function boundedInteger(value:unknown,defaultValue:number,max:number):number|null{
 if(value===undefined)return defaultValue;
 return typeof value==="number"&&Number.isInteger(value)&&value>=1&&value<=max?value:null;
}
function exactKeys(obj:Record<string,unknown>,allowed:readonly string[]){
 return Object.keys(obj).every(k=>allowed.includes(k));
}
const GROUPS=["all","ai","breadth","rates","energy","fx","credit","equities","metals"] as const;
export async function handleBluebellyMcpMessage(
 request:unknown,
 invoke:McpInvocation,
):Promise<JsonResult|null>{
 if(!request||typeof request!=="object"||Array.isArray(request))return mcpError(null,-32600,"Invalid request");
 const obj=request as Record<string,unknown>;
 if(obj.jsonrpc!=="2.0"||typeof obj.method!=="string"||obj.method.length>80||
   (obj.id!==undefined&&obj.id!==null&&typeof obj.id!=="string"&&typeof obj.id!=="number"))
   return mcpError(null,-32600,"Invalid request");
 const id=obj.id===undefined?null:obj.id as string|number|null;
 if(obj.method==="notifications/initialized"&&id===null)return null;
 if(id===null)return mcpError(null,-32600,"A request ID is required");
 const output=(result:unknown):JsonResult=>({jsonrpc:"2.0",id,result});
 if(obj.method==="initialize")return output({
  protocolVersion:BLUEBELLY_MCP_PROTOCOL,
  capabilities:{tools:{listChanged:false}},
  serverInfo:{name:"bluebelly-market-intelligence",version:"0.1.0"},
  instructions:"Source-dated, read-only market observations and verified events. Separate facts from inferred market causes. Never invent stale, unavailable or unverified changes.",
 });
 if(obj.method==="ping")return output({});
 if(obj.method==="tools/list")return output({tools:BLUEBELLY_MCP_TOOLS});
 if(obj.method!=="tools/call")return mcpError(id,-32601,"Method not found");
 const params=validParams(obj.params);
 if(!params||!exactKeys(params,["name","arguments"])||typeof params.name!=="string")
   return mcpError(id,-32602,"Invalid tool call");
 const args=validParams(params.arguments);
 if(!args)return mcpError(id,-32602,"Invalid tool arguments");
 let result:unknown;
 try{
  if(params.name==="get_market_snapshot"){
   const group=args.group===undefined?"all":args.group;
   const limit=boundedInteger(args.limit,30,80);
   if(typeof group!=="string"||!GROUPS.includes(group as typeof GROUPS[number])||
     limit===null||!exactKeys(args,["group","limit"]))return mcpError(id,-32602,"Invalid market selection");
   result=await invoke.getMarketSnapshot({group,limit});
  }else if(params.name==="get_verified_events"){
   const limit=boundedInteger(args.limit,12,18);
   if(limit===null||!exactKeys(args,["since","limit"])||
     (args.since!==undefined&&(typeof args.since!=="string"||args.since.length>32||
      !/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(args.since))))
      return mcpError(id,-32602,"Invalid event selector");
   result=await invoke.getVerifiedEvents({since:args.since as string|undefined,limit});
  }else if(params.name==="get_source_health"){
   if(!exactKeys(args,[]))return mcpError(id,-32602,"Invalid health selector");
   result=await invoke.getSourceHealth();
  }else return mcpError(id,-32601,"Unknown tool");
 }catch{
  // Avoid returning provider errors or internal details in model-readable text.
  return output({isError:true,content:[{type:"text",text:"Bluebelly source reader unavailable or selector outside supported window"}]});
 }
 const serial=JSON.stringify(result);
 if(serial.length>80_000)return output({isError:true,content:[{type:"text",text:"Response over private output limit"}]});
 return output({isError:false,structuredContent:result,
  content:[{type:"text",text:serial}]});
}
