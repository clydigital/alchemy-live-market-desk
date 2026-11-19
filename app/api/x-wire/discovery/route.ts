import {NextResponse, type NextRequest} from "next/server";
import {BLUEBELLY_PRESENTATION_HOST,blueDeskHostAccess} from "@/lib/blue-desk-host";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {X_CORE_ROSTER} from "@/lib/x-sweep-core";
import {rankXWireMarketCandidates} from "@/lib/x-wire-market-candidates";
import type {XWireDurable} from "@/lib/x-wire-durable";
import {readXWireResearchPool,type XWireResearchRow} from "@/lib/x-wire-research-pool";
import {xWireSourceMaterial} from "@/lib/x-wire-source-material";

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
  const healthy=checked.filter(a=>a.health==="healthy" && !!a.last_completed_at &&
   now.getTime()-Date.parse(a.last_completed_at)<15*3_600_000 &&
   !a.uncovered_before&&!a.page_cursor&&!a.last_error).length;
  return NextResponse.json({
   contractVersion:"bluebelly/x-discovery/1",generatedAt:now.toISOString(),
   source:"Bluebelly X Wire / attributed third-party FxEmbed timeline",
   discoveryOnly:true,verifiedMarketClaims:0,
   coverage:{monitored:X_CORE_ROSTER.length,healthy,
    complete:checked.length===X_CORE_ROSTER.length&&healthy===X_CORE_ROSTER.length},
   leads,notice:"X post existence and attribution do not verify underlying claims. Confirm primary sources, market measurement vintage and contradictions before MacroPulse or Research Gap promotion. Source status is not claim verification."
  },{headers:{"Cache-Control":"public, s-maxage=120, stale-while-revalidate=60",
    "X-Content-Type-Options":"nosniff"}});
 }catch{
  return NextResponse.json({error:"X discovery ledger temporarily unavailable",
   discoveryOnly:true,coverage:{complete:false}},
   {status:503,headers:{"Cache-Control":"no-store"}});
 }
}

