import "server-only";
import {NextResponse,type NextRequest} from "next/server";
import {getMarketMonitor} from "@/lib/market-monitor-public";
import {publicMarketGroup,publicMarketObservations} from "@/lib/blue-desk-public-markets";
import {getSourceDatedBreadth} from "@/lib/bluebelly-breadth-reader";
import {calculateBreadthRow} from "@/lib/bluebelly-breadth-dated";
import {readBluebellyQualifiedNews,getBluebellyVerifiedEvents} from "@/lib/bluebelly-verified-event-server";
import {
 handleBluebellyMcpMessage,BLUEBELLY_MCP_RESOURCE,type McpInvocation,
} from "@/lib/bluebelly-mcp-contract";
import {mcpEnabled,mcpAuthenticateHeader,validateBluebellyMcpBearer} from "@/lib/bluebelly-mcp-auth";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=30;
const BASE_HEADERS={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
 "Mcp-Protocol-Version":"2025-11-25"};
const fail=(status:number,message:string,headers:Record<string,string>={})=>
 NextResponse.json({error:message},{status,headers:{...BASE_HEADERS,...headers}});
const exactHost=(req:NextRequest)=>(req.headers.get("host")||req.nextUrl.hostname).trim().toLowerCase()==="bluebelly-desk.vercel.app";

/** GET and DELETE are not used by this stateless JSON-response transport. */
export async function GET(req:NextRequest){
 if(!exactHost(req)||!mcpEnabled())return new NextResponse(null,{status:404,headers:BASE_HEADERS});
 return new NextResponse(null,{status:405,headers:{...BASE_HEADERS,Allow:"POST"}});
}
export async function POST(req:NextRequest){
 // Host allowlisting in middleware only permits OAuth discovery. Every MCP
 // request is separately token-gated, including initialize and tools/list.
 if(!exactHost(req)||!mcpEnabled())return new NextResponse(null,{status:404,headers:BASE_HEADERS});
 const identity=await validateBluebellyMcpBearer(req);
 if(!identity.ok)return fail(identity.reason==="AUTH_UNAVAILABLE"?503:401,
  identity.reason==="AUTH_UNAVAILABLE"?"OAuth resource unavailable":"OAuth authorization required",
  identity.reason==="AUTH_UNAVAILABLE"?{}:{"WWW-Authenticate":mcpAuthenticateHeader});
 if(!(req.headers.get("content-type")||"").toLowerCase().startsWith("application/json"))
  return fail(415,"JSON-RPC application/json required");
 const contentLength=Number(req.headers.get("content-length")||0);
 if(!Number.isFinite(contentLength)||contentLength>20_000||contentLength<0)
  return fail(413,"MCP request exceeds payload limit");
 let body:unknown;
 try{
  const raw=await req.text();
  if(raw.length>20_000)return fail(413,"MCP request exceeds payload limit");
  body=JSON.parse(raw);
 }catch{return fail(400,"Malformed JSON-RPC request")}
 const operations:McpInvocation={
  getMarketSnapshot:async ({group,limit})=>{
   const now=new Date();
   const includesBreadth=group==="all"||group==="breadth";
   const [monitor,breadth]=await Promise.all([
    group==="breadth"?Promise.resolve(null):getMarketMonitor().catch(()=>null),
    includesBreadth?getSourceDatedBreadth().catch(()=>null):Promise.resolve(null),
   ]);
   const markets=monitor?publicMarketObservations(monitor.rows,publicMarketGroup(group)):[];
   const breadthRows=includesBreadth?[
    {symbol:"S5FI",label:"S&P 500 · above 50D"},
    {symbol:"S5TH",label:"S&P 500 · above 200D"},
   ].map(item=>calculateBreadthRow(
     item.symbol,item.label,breadth?.series.find(x=>x.symbol===item.symbol),now,
   )):[];
   const rows=[...markets,...breadthRows].slice(0,limit);
   return {contractVersion:"bluebelly/market-observations/1",
    generatedAt:now.toISOString(),group,count:rows.length,observations:rows,
    status:group==="breadth"
      ?breadth?.retrievalStatus==="refreshed"?"SOURCE_DATED":"STALE_OR_UNAVAILABLE"
      :monitor?"SOURCE_DATED":"DEGRADED",
    breadthRetrievalStatus:includesBreadth?breadth?.retrievalStatus||"unavailable":null,
    limitations:["Missing session changes are null, not zero.",
     "Changes for daily nominal yields are basis points; other market changes are percentages.",
     "S5FI/S5TH breadth changes are percentage points and source-dated secondary observations; stale seeds return null levels.",
     "Monthly observations have no 1/3/5-session change.",
     "Research interpretations and private portfolio state are not included."]};
  },
  getVerifiedEvents:async ({since,limit})=>getBluebellyVerifiedEvents(new Date(),{since,limit}),
  getSourceHealth:async ()=>{
   const now=new Date();
   const {news,sourceReads}=await readBluebellyQualifiedNews(now,18);
   const available=Object.values(sourceReads).filter(s=>s==="READABLE").length;
   return {contractVersion:"bluebelly/news-source-health/1",asOf:now.toISOString(),
    status:available===0?"UNAVAILABLE":available<3?"DEGRADED":"READABLE",
    sourceReads,qualifiedNewsItemsInReaderWindow:news.length,
    disclaimer:"Readability does not prove complete worldwide event discovery or verified market reaction."};
  },
 };
 const response=await handleBluebellyMcpMessage(body,operations);
 if(response===null)return new NextResponse(null,{status:202,headers:BASE_HEADERS});
 return NextResponse.json(response,{headers:{...BASE_HEADERS,"Content-Type":"application/json"}});
}
