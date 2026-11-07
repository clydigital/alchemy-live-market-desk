import "server-only";
import {createSupabaseAdminClient} from "./supabase/admin.ts";
import {X_CORE_ROSTER} from "./x-sweep-core.ts";

export type BluebellyAbsorptionHealth={
  checkedAt:string;monitored:number;healthy:number;historicalGaps:number;
  posts24h:number;handedToResearch48h:number;completedRuns7d:number;
  failedRuns7d:number;publishedUpdates7d:number;lastResearchRun:string|null;
};
/** Aggregate-only reader: no raw X posts, owner notes, evidence or credentials leave this function. */
export async function getBluebellyAbsorptionHealth(now=new Date()):Promise<BluebellyAbsorptionHealth|null>{
  try{
    const db=createSupabaseAdminClient();
    const h24=new Date(now.getTime()-24*3600000).toISOString();
    const h48=new Date(now.getTime()-48*3600000).toISOString();
    const d7=new Date(now.getTime()-7*86400000).toISOString();
    const [source,posts,handed,runs]=await Promise.all([
      db.from("x_wire_accounts").select("handle,health,last_completed_at,last_error,uncovered_before,page_cursor"),
      db.from("x_wire_posts").select("post_id",{head:true,count:"exact"})
        .gte("retrieved_at",h24).not("handle","ilike","gordianknotdev"),
      db.from("research_intake_items").select("id",{head:true,count:"exact"})
        .ilike("publisher","X/@%").gte("created_at",h48),
      db.from("research_runs").select("schedule_slot,status,completed_at,updates_published")
        .in("schedule_slot",["morning","evening"]).gte("scheduled_for",d7).limit(30),
    ]);
    if(source.error||posts.error||handed.error||runs.error)return null;
    const roster=new Set(X_CORE_ROSTER.map(x=>x.handle.toLowerCase()));
    const rows=(source.data||[]).filter(a=>roster.has(a.handle.toLowerCase()));
    const healthy=rows.filter(a=>a.health==="healthy"&&!a.last_error&&!a.uncovered_before&&
      !a.page_cursor&&a.last_completed_at&&
      now.getTime()-Date.parse(a.last_completed_at)<15*3600000).length;
    const completions=(runs.data||[]).filter(r=>r.status==="completed");
    return {
      checkedAt:now.toISOString(),monitored:X_CORE_ROSTER.length,healthy,
      historicalGaps:rows.filter(a=>Boolean(a.uncovered_before)).length,
      posts24h:posts.count??0,handedToResearch48h:handed.count??0,
      completedRuns7d:completions.length,
      failedRuns7d:(runs.data||[]).filter(r=>r.status==="failed"||r.status==="blocked").length,
      publishedUpdates7d:completions.reduce((s,r)=>s+(Number(r.updates_published)||0),0),
      lastResearchRun:completions.map(r=>r.completed_at).filter((x):x is string=>Boolean(x))
        .sort().at(-1)||null,
    };
  }catch{return null;}
}
