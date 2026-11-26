import "server-only";
import {createSupabaseAdminClient} from "./supabase/admin.ts";
import {X_CORE_ROSTER} from "./x-sweep-core.ts";
import {xWireFreshCheckComplete,xWireLiveFreshnessHours} from "./x-wire-pagination.ts";

export type BluebellyAbsorptionHealth={
  checkedAt:string;lastSourceAttemptAt:string|null;monitored:number;healthy:number;freshCompleted:number;historicalGaps:number;
  posts24h:number;handedToResearch48h:number;completedRuns7d:number;
  failedRuns7d:number;publishedUpdates7d:number;lastResearchRun:string|null;
  scheduledEvidence7d:number;latestScheduledStatus:string|null;latestScheduledAt:string|null;
  latestFreshnessGate:boolean|null;latestEvidenceGate:boolean|null;latestSourceGate:boolean|null;
  failedFreshnessRuns7d:number;
};
/** Aggregate-only reader: no raw X posts, owner notes, evidence or credentials leave this function. */
export async function getBluebellyAbsorptionHealth(now=new Date()):Promise<BluebellyAbsorptionHealth|null>{
  try{
    const db=createSupabaseAdminClient();
    const h24=new Date(now.getTime()-24*3600000).toISOString();
    const h48=new Date(now.getTime()-48*3600000).toISOString();
    const d7=new Date(now.getTime()-7*86400000).toISOString();
    const [source,posts,handed,runs]=await Promise.all([
      db.from("x_wire_accounts").select("handle,health,last_attempt_at,last_completed_at,last_error,uncovered_before,page_cursor"),
      db.from("x_wire_posts").select("post_id",{head:true,count:"exact"})
        .gte("retrieved_at",h24).not("handle","ilike","gordianknotdev"),
      db.from("research_intake_items").select("id",{head:true,count:"exact"})
        .ilike("publisher","X/@%").gte("created_at",h48),
      db.from("research_runs").select("schedule_slot,status,scheduled_for,started_at,completed_at,updates_published,evidence_added,freshness_gate_passed,evidence_gate_passed,required_sources_complete")
        .in("schedule_slot",["morning","evening"]).gte("scheduled_for",d7).lte("scheduled_for",now.toISOString()).order("scheduled_for",{ascending:false}).limit(30),
    ]);
    if(source.error||posts.error||handed.error||runs.error)return null;
    const roster=new Set(X_CORE_ROSTER.map(x=>x.handle.toLowerCase()));
    const rows=(source.data||[]).filter(a=>roster.has(a.handle.toLowerCase()));
    const fresh=rows.filter(a=>xWireFreshCheckComplete(a,now,xWireLiveFreshnessHours(a.handle)));
    const healthy=fresh.filter(a=>!a.uncovered_before&&a.health==="healthy").length;
    const completions=(runs.data||[]).filter(r=>r.status==="completed");
    const latest=(runs.data||[])[0];
    return {
      scheduledEvidence7d:completions.reduce((s,r)=>s+(Number(r.evidence_added)||0),0),
      latestScheduledStatus:latest?.status??null,
      latestScheduledAt:latest?.completed_at??latest?.started_at??latest?.scheduled_for??null,
      latestFreshnessGate:latest?.freshness_gate_passed??null,
      latestEvidenceGate:latest?.evidence_gate_passed??null,
      latestSourceGate:latest?.required_sources_complete??null,
      failedFreshnessRuns7d:completions.filter(r=>r.freshness_gate_passed===false).length,
      checkedAt:now.toISOString(),lastSourceAttemptAt:rows.map(a=>a.last_attempt_at)
        .filter((t):t is string=>Boolean(t)).sort().at(-1)||null,
      monitored:X_CORE_ROSTER.length,healthy,freshCompleted:fresh.length,
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
