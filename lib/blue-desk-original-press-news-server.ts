import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { projectOriginalPressNews, type OfficialPressReceipt } from "./blue-desk-original-press-news";
import type { NewsBriefV1 } from "./market-brief-news";
import {hormuzTopicFilter} from "./bluebelly-hormuz-relevance";

/**
 * Bounded public projection from the existing research run's directly checked
 * official RSS + original HTML receipts. Never promotes generic news, creator
 * claims or Notion text to SOURCE_VERIFIED status.
 */
export async function getOriginalPressNews(now=new Date(),limit=8,lookbackDays=2,topic?:"hormuz"):Promise<NewsBriefV1[]>{
 if(!Number.isFinite(now.getTime())||!Number.isInteger(lookbackDays)||lookbackDays<1||lookbackDays>7)return [];
 const db=createSupabaseAdminClient();
 const cutoff=new Date(now.getTime()-lookbackDays*86400000).toISOString();
 let query=db.from("research_intake_items")
   .select("id,item_key,item_type,status,publisher,title,summary,url,published_at,created_at,source_quality,relevance,novelty,materiality,candidate_score,review_reason,evidence_links")
   .eq("item_type","news").eq("status","accepted")
   .like("item_key","official-press:%")
   .gte("published_at",cutoff).lte("published_at",now.toISOString());
 if(topic==="hormuz")query=query.or(hormuzTopicFilter(["title","summary"]));
 const {data,error}=await query.order("published_at",{ascending:false}).limit(60);
 if(error)throw new Error("Original publisher receipt read failed");
 return projectOriginalPressNews((data||[]) as OfficialPressReceipt[],now,limit,lookbackDays);
}
