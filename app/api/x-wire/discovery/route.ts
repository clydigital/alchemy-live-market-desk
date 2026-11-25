import {NextResponse, type NextRequest} from "next/server";
import {BLUEBELLY_PRESENTATION_HOST,blueDeskHostAccess} from "@/lib/blue-desk-host";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {X_CORE_ROSTER} from "@/lib/x-sweep-core";
import {rankXWireMarketCandidates} from "@/lib/x-wire-market-candidates";
import type {XWireDurable} from "@/lib/x-wire-durable";
import {readXWireResearchPool,type XWireResearchRow} from "@/lib/x-wire-research-pool";
import {xWireSourceMaterial} from "@/lib/x-wire-source-material";
import {xWireFreshCheckComplete,xWireLiveFreshnessHours} from "@/lib/x-wire-pagination";

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
 try{
  const now=new Date();
  const db=createSupabaseAdminClient();
  const [items,accounts]=await Promise.all([
   readXWireResearchPool(db,now),
   db.from("x_wire_accounts")
    .select("handle,health,last_completed_at,uncovered_before,page_cursor,last_error")
  ]);
  if(accounts.error)throw new Error("X source ledger not readable");
  const posts=(items as XWireResearchRow[]).map(p=>({
   id:p.post_id,handle:p.handle,url:p.original_url,
   publishedAt:p.published_at,retrievedAt:p.retrieved_at,text:p.body,
   images:p.media_urls||[],quoteUrl:p.quote_url,attribution:"THIRD_PARTY_ONLY" as const,
   intakeStatus:p.intake_status
  })) as (XWireDurable["posts"][number]&{retrievedAt:string})[];
  const leads=rankXWireMarketCandidates(posts,now,12).map(({post,theme,priority})=>{
   const p=posts.find(x=>x.id===post.id);
   return {postId:post.id,handle:post.handle,url:post.url,
    publishedAt:post.publishedAt,retrievedAt:p?.retrievedAt||null,
    theme,priority,excerpt:post.text.slice(0,240),sourceMaterial:xWireSourceMaterial(post),
    verification:"UNVERIFIED_SOCIAL_LEAD" as const};
  });
  const roster=new Set(X_CORE_ROSTER.map(x=>x.handle.toLowerCase()));
  const checked=((accounts.data||[]) as SourceRecord[]).filter(a=>roster.has(a.handle.toLowerCase()));
  const fresh=checked.filter(a=>xWireFreshCheckComplete(a,now,xWireLiveFreshnessHours(a.handle))).length;
  const historicallyComplete=checked.filter(a=>!a.uncovered_before&&a.health==="healthy"&&!a.page_cursor&&!a.last_error&&!!a.last_completed_at).length;
  const healthy=checked.filter(a=>a.health==="healthy" && !!a.last_completed_at &&
   now.getTime()-Date.parse(a.last_completed_at)<15*3_600_000 &&
   !a.uncovered_before&&!a.page_cursor&&!a.last_error).length;
  // Optional bounded consumer delta, independent of ranked highlights. Same public redaction.
  // The readback clock is insertion/retrieval, not a claim that the provider timeline is complete.
  const params=request.nextUrl.searchParams;
  const since=params.get("since"), until=params.get("until")||now.toISOString(), afterId=params.get("afterId");
  let incremental:unknown=undefined;
  if(since!==null){
   const start=Date.parse(since),end=Date.parse(until);
   if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end>now.getTime()+1000||
      end-start>24*3_600_000||(afterId!==null&&(!params.has("until")||!/^\d{6,25}$/.test(afterId)))){
    return NextResponse.json({error:"Invalid bounded incremental window"},{status:400,headers:{"Cache-Control":"no-store"}});
   }
   const startIso=new Date(start).toISOString(),endIso=new Date(end).toISOString();
   let query=db.from("x_wire_posts").select("post_id,handle,original_url,published_at,retrieved_at,body")
    .in("handle",X_CORE_ROSTER.map(x=>x.handle)).eq("intake_status","discovery")
    .gt("retrieved_at",startIso).lte("retrieved_at",endIso).lte("published_at",endIso)
    .order("post_id",{ascending:true}).limit(41);
   if(afterId)query=query.gt("post_id",afterId);
   const delta=await query;
   if(delta.error)throw new Error("X incremental ledger read failed");
   const rows=delta.data||[], page=rows.slice(0,40);
   incremental={scope:"REDACTED_DISCOVERY_ONLY",since:startIso,until:endIso,
    more:rows.length>40,nextAfterId:rows.length>40?page[page.length-1].post_id:null,
    items:page.map(p=>({postId:p.post_id,handle:p.handle,url:p.original_url,
     publishedAt:p.published_at,retrievedAt:p.retrieved_at,excerpt:p.body.slice(0,240),
     verification:"UNVERIFIED_SOCIAL_LEAD" as const}))};
  }
  return NextResponse.json({
   contractVersion:"bluebelly/x-discovery/1",generatedAt:now.toISOString(),
   source:"Bluebelly X Wire / attributed third-party FxEmbed timeline",
   discoveryOnly:true,verifiedMarketClaims:0,
   coverage:{monitored:X_CORE_ROSTER.length,registered:checked.length,healthy,
    fresh,historicallyComplete,missingRegistration:X_CORE_ROSTER.length-checked.length,
    complete:checked.length===X_CORE_ROSTER.length&&healthy===X_CORE_ROSTER.length},
   leads,incremental,notice:"X post existence and attribution do not verify underlying claims. Confirm primary sources, market measurement vintage and contradictions before MacroPulse or Research Gap promotion. Source status is not claim verification."
  },{headers:{"Cache-Control":since===null?"public, s-maxage=120, stale-while-revalidate=60":"no-store",
    "X-Content-Type-Options":"nosniff"}});
 }catch{
  return NextResponse.json({error:"X discovery ledger temporarily unavailable",
   discoveryOnly:true,coverage:{complete:false}},
   {status:503,headers:{"Cache-Control":"no-store"}});
 }
}

