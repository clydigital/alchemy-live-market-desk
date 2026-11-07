import "server-only";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {rankXWireMarketCandidates} from "./x-wire-market-candidates";
import type {XWireDurable} from "./x-wire-durable";

export type HormuzWireLead = {
  id:string;handle:string;url:string;publishedAt:string;excerpt:string;
};
export type HormuzWireRead = {
  status:"available"|"empty"|"unavailable";leads:HormuzWireLead[];
};

type PostRow = {
  post_id:string;handle:string;original_url:string;published_at:string;
  body:string;intake_status:string;
};
const HORMUZ_TERMS=/\b(?:hormuz|strait of hormuz|iran|iranian|tehran|doha|qatari|persian gulf|oman|israel|ceasefire)\b/i;

/**
 * Read already-persisted public-post discovery only. No X polling, leases,
 * source promotion, new scheduler or private account-health exposure.
 * The exact post URL and timestamp are retained; posts are NOT verified facts.
 */
export async function getHormuzWireLeads(now=new Date()):Promise<HormuzWireRead>{
  try{
    const db=createSupabaseAdminClient();
    const since=new Date(+now-48*3600000).toISOString();
    const {data,error}=await db.from("x_wire_posts")
      .select("post_id,handle,original_url,published_at,body,intake_status")
      .eq("intake_status","discovery")
      .not("handle","ilike","gordianknotdev")
      .gte("published_at",since)
      .order("published_at",{ascending:false}).limit(250);
    if(error)throw new Error("Stored X Wire discovery unavailable");
    const relevant=((data||[]) as PostRow[]).filter(row=>
      HORMUZ_TERMS.test(row.body));
    const posts:XWireDurable["posts"]=relevant.map(row=>({
      id:row.post_id,handle:row.handle,url:row.original_url,
      publishedAt:row.published_at,text:row.body,images:[],
      quoteUrl:null,attribution:"THIRD_PARTY_ONLY" as const,
      intakeStatus:row.intake_status,
    }));
    const leads=rankXWireMarketCandidates(posts,now,12).slice(0,3)
      .map(({post})=>({
        id:post.id,handle:post.handle,url:post.url,
        publishedAt:post.publishedAt,excerpt:post.text.slice(0,220),
      }));
    return {status:leads.length?"available":"empty",leads};
  }catch{
    return {status:"unavailable",leads:[]};
  }
}
