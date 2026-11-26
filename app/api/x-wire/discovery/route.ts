import {NextResponse, type NextRequest} from "next/server";
import {BLUEBELLY_PRESENTATION_HOST,blueDeskHostAccess} from "@/lib/blue-desk-host";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {X_CORE_ROSTER} from "@/lib/x-sweep-core";
import {rankXWireMarketCandidates} from "@/lib/x-wire-market-candidates";
import type {XWireDurable} from "@/lib/x-wire-durable";
import {readXWireResearchPool,type XWireResearchRow} from "@/lib/x-wire-research-pool";
import {xWireSourceMaterial} from "@/lib/x-wire-source-material";
import {xWireFreshCheckComplete,xWireLiveFreshnessHours} from "@/lib/x-wire-pagination";
import {parseXWireDeltaWindow,xWireDeltaPage} from "@/lib/x-wire-incremental";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=15;
type SourceRecord={handle:string;health:string;last_completed_at:string|null;
  uncovered_before:string|null;page_cursor:string|null;last_error:string|null};

/** MacroPulse reads only this bounded public-source digest, NEVER the
 * private operational X Wire or the service-role client itself. GET does
 * not poll FxEmbed, claim leases, update Story state, or publish anything. */
export async function GET(request:NextRequest){
 const host=(request.headers.get("host")||request.nextUrl.hostname).toLowerCase().replace(/:443$/,"");
 if(host!==BLUEBELLY_PRESENTATION_HOST ||
   blueDeskHostAccess(request.nextUrl.pathname,host)!=="public")
  return new NextResponse(null,{status:404});
 let failureStage="database_client";
 try{
  const now=new Date();
  const db=createSupabaseAdminClient();
  failureStage="source_pool";
  const [poolResult,accountResult]=await Promise.allSettled([
   readXWireResearchPool(db,now),
   db.from("x_wire_accounts")
    .select("handle,health,last_completed_at,uncovered_before,page_cursor,last_error")
  ]);
  if(poolResult.status==="rejected")throw new Error("X source pool unavailable");
  const items=poolResult.value;
  const accountsRead=accountResult.status==="fulfilled"&&!accountResult.value.error;
  const accountRows=accountResult.status==="fulfilled"&&!accountResult.value.error?accountResult.value.data:[];
  if(!accountsRead)console.warn(JSON.stringify({kind:"x_discovery_read_health",stage:"accounts",state:"degraded",cause:"ledger_read_failed"}));
  failureStage="rank_and_redact";
  const posts=(items as XWireResearchRow[]).map(p=>({
   id:p.post_id,handle:p.handle,url:p.original_url,
   publishedAt:p.published_at,retrievedAt:p.retrieved_at,text:p.body,
   images:p.media_urls||[],quoteUrl:p.quote_url,attribution:"THIRD_PARTY_ONLY" as const,
   intakeStatus:p.intake_status
  })) as (XWireDurable["posts"][number]&{retrievedAt:string})[];
  const leads=rankXWireMarketCandidates(posts,now,12,{prioritizeKobeissi:true}).map(({post,theme,priority})=>{
   const p=posts.find(x=>x.id===post.id);
   return {postId:post.id,handle:post.handle,url:post.url,
    publishedAt:post.publishedAt,retrievedAt:p?.retrievedAt||null,
    theme,priority,excerpt:post.text.slice(0,240),sourceMaterial:xWireSourceMaterial(post),
    verification:"UNVERIFIED_SOCIAL_LEAD" as const};
  });
  const roster=new Set(X_CORE_ROSTER.map(x=>x.handle.toLowerCase()));
  const checked=((accountRows||[]) as SourceRecord[]).filter(a=>roster.has(a.handle.toLowerCase()));
  const fresh=checked.filter(a=>xWireFreshCheckComplete(a,now,xWireLiveFreshnessHours(a.handle))).length;
  const historicallyComplete=checked.filter(a=>!a.uncovered_before&&a.health==="healthy"&&!a.page_cursor&&!a.last_error&&!!a.last_completed_at).length;
  const healthy=checked.filter(a=>a.health==="healthy" && !!a.last_completed_at &&
   now.getTime()-Date.parse(a.last_completed_at)<15*3_600_000 &&
   !a.uncovered_before&&!a.page_cursor&&!a.last_error).length;
  // Optional bounded consumer delta, independent of ranked highlights. Same public redaction.
  // The readback clock is insertion/retrieval, not a claim that the provider timeline is complete.
  const params=request.nextUrl.searchParams;
  const since=params.get("since");
  let incremental:unknown=undefined;
  if(since!==null||params.has("afterId")||params.has("until")){
   const window=parseXWireDeltaWindow(params,now);
   if(!window)return NextResponse.json({error:"Invalid bounded incremental window"},{status:400,headers:{"Cache-Control":"no-store"}});
   failureStage="incremental_ledger";
   let query=db.from("x_wire_posts").select("post_id,handle,original_url,published_at,retrieved_at,body,media_urls,quote_url")
    .in("handle",X_CORE_ROSTER.map(x=>x.handle)).eq("intake_status","discovery")
    .gt("retrieved_at",window.since).lte("retrieved_at",window.until).lte("published_at",window.until)
    .order("post_id",{ascending:true}).limit(41);
   if(window.afterId)query=query.gt("post_id",window.afterId);
   const delta=await query;
   if(delta.error)throw new Error("X incremental ledger read failed");
   const {page,more,nextAfterId}=xWireDeltaPage((delta.data||[]) as Omit<XWireResearchRow,"intake_status">[]);
   incremental={scope:"REDACTED_DISCOVERY_ONLY",since:window.since,until:window.until,
    more,nextAfterId,
    items:page.map(p=>({postId:p.post_id,handle:p.handle,url:p.original_url,
     publishedAt:p.published_at,retrievedAt:p.retrieved_at,excerpt:p.body.slice(0,240),
     sourceMaterial:xWireSourceMaterial({text:p.body,images:p.media_urls||[],quoteUrl:p.quote_url}),
     verification:"UNVERIFIED_SOCIAL_LEAD" as const}))};
  }
  return NextResponse.json({
   contractVersion:"bluebelly/x-discovery/1",generatedAt:now.toISOString(),
   source:"Bluebelly X Wire / attributed third-party FxEmbed timeline",
   discoveryOnly:true,verifiedMarketClaims:0,
   coverage:{monitored:X_CORE_ROSTER.length,accountsRead,registered:accountsRead?checked.length:null,healthy:accountsRead?healthy:null,
    fresh:accountsRead?fresh:null,historicallyComplete:accountsRead?historicallyComplete:null,missingRegistration:accountsRead?X_CORE_ROSTER.length-checked.length:null,
    complete:accountsRead&&checked.length===X_CORE_ROSTER.length&&healthy===X_CORE_ROSTER.length},
   leads,incremental,notice:"X post existence and attribution do not verify underlying claims. Confirm primary sources, market measurement vintage and contradictions before MacroPulse or Research Gap promotion. Source status is not claim verification."
  },{headers:{"Cache-Control":since===null&&accountsRead?"public, s-maxage=120, stale-while-revalidate=60":"no-store",
    "X-Content-Type-Options":"nosniff"}});
 }catch{
  console.warn(JSON.stringify({kind:"x_discovery_read_health",stage:failureStage,state:"failed",cause:"read_or_projection_failed"}));
  return NextResponse.json({error:"X discovery ledger temporarily unavailable",
   discoveryOnly:true,coverage:{complete:false}},
   {status:503,headers:{"Cache-Control":"no-store"}});
 }
}

