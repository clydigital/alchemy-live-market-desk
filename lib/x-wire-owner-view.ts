import "server-only";
import {createSupabaseAdminClient} from "./supabase/admin.ts";
import {X_CORE_ROSTER} from "./x-sweep-core.ts";
import {classifyXWireThemes} from "./x-wire-market-candidates.ts";
import {X_WIRE_THEMES,X_WIRE_PAGE_SIZE,parseXWireOwnerFilters,type XWireOwnerFilters} from "./x-wire-owner-query.ts";

type AccountRow={handle:string;health:string;last_attempt_at:string|null;last_completed_at:string|null;
  last_observed_post_at:string|null;last_error:string|null;last_fetched:number;
  page_cursor:string|null;uncovered_before:string|null};
type PostRow={post_id:string;handle:string;original_url:string;published_at:string;
  retrieved_at:string;body:string;intake_status:string;quote_url:string|null;media_urls:string[]|null};
export type XWireOwnerView={
  filters:XWireOwnerFilters;posts:Array<{id:string;handle:string;url:string;publishedAt:string;
    retrievedAt:string;text:string;status:string;quoteUrl:string|null;mediaCount:number;themes:string[]}>;
  accounts:Array<{handle:string;status:string;attemptedAt:string|null;completedAt:string|null;
    observedAt:string|null;lastFetched:number;error:string|null;historicalGap:boolean;resumePending:boolean}>;
  total:number;pageCount:number;page:number;sourceHealthy:number;sourceMonitored:number;error:string|null;
};
export async function getXWireOwnerView(raw:Record<string,unknown>,now=new Date()):Promise<XWireOwnerView>{
  const filters=parseXWireOwnerFilters(raw);
  const empty:XWireOwnerView={filters,posts:[],accounts:[],total:0,pageCount:0,page:filters.page,
    sourceHealthy:0,sourceMonitored:X_CORE_ROSTER.length,error:null};
  try {
    const db=createSupabaseAdminClient();
    const roster=new Set(X_CORE_ROSTER.map(x=>x.handle.toLowerCase()));
    let query=db.from("x_wire_posts")
      .select("post_id,handle,original_url,published_at,retrieved_at,body,intake_status,quote_url,media_urls",
        {count:"exact"})
      .not("handle","ilike","gordianknotdev");
    if(filters.handle)query=query.ilike("handle",filters.handle);
    if(filters.status)query=query.eq("intake_status",filters.status);
    if(filters.period!=="all"){
      const hours=filters.period==="24h"?24:filters.period==="7d"?168:720;
      query=query.gte("published_at",new Date(now.getTime()-hours*3600000).toISOString());
    }
    if(filters.q)query=query.ilike("body","%"+filters.q+"%");
    if(filters.theme){
      const terms=X_WIRE_THEMES.find(t=>t[0]===filters.theme)?.[2]||[];
      // Fixed, server-controlled terms only. Category lenses can overlap.
      if(terms.length)query=query.or(terms.map(t=>"body.ilike.%"+t+"%").join(","));
    }
    const [{data:postRows,count,error:postError},{data:sourceRows,error:sourceError}]=await Promise.all([
      query.order("published_at",{ascending:false}).order("post_id",{ascending:false})
        .range((filters.page-1)*X_WIRE_PAGE_SIZE,filters.page*X_WIRE_PAGE_SIZE-1),
      db.from("x_wire_accounts").select(
        "handle,health,last_attempt_at,last_completed_at,last_observed_post_at,last_error,last_fetched,page_cursor,uncovered_before"),
    ]);
    if(postError||sourceError)throw new Error("Stored X Wire records are unavailable");
    const total=count??0;
    const accounts=((sourceRows||[]) as AccountRow[]).filter(a=>roster.has(a.handle.toLowerCase()))
      .map(a=>{
        const stale=!a.last_completed_at || now.getTime()-Date.parse(a.last_completed_at)>15*3600000;
        const gap=Boolean(a.uncovered_before),resume=Boolean(a.page_cursor);
        const status=a.health==="healthy"&&(stale||gap||resume||a.last_error)?"partial":a.health;
        return {handle:a.handle,status,attemptedAt:a.last_attempt_at,completedAt:a.last_completed_at,
          observedAt:a.last_observed_post_at,lastFetched:a.last_fetched,error:a.last_error,
          historicalGap:gap,resumePending:resume};
      }).sort((a,b)=>a.handle.localeCompare(b.handle));
    const posts=((postRows||[]) as PostRow[]).map(p=>({
      id:p.post_id,handle:p.handle,url:p.original_url,publishedAt:p.published_at,
      retrievedAt:p.retrieved_at,text:p.body,status:p.intake_status,
      quoteUrl:p.quote_url,mediaCount:p.media_urls?.length??0,
      themes:classifyXWireThemes(p.body),
    }));
    return {...empty,posts,accounts,total,pageCount:Math.ceil(total/X_WIRE_PAGE_SIZE),
      sourceHealthy:accounts.filter(a=>a.status==="healthy").length};
  }catch {
    return {...empty,error:"X Wire records could not be read. Counts and health are unavailable."};
  }
}
