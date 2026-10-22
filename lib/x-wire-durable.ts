import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin.ts";
import { X_CORE_ROSTER, X_SWEEP_DEFAULTS, xSourceHealth, type XAccountAttempt } from "./x-sweep-core.ts";
import { parseFxTimeline, xWireRequestWindow } from "./x-wire-pagination.ts";
import type { XWirePost } from "./x-wire-provider.ts";

const ORIGIN = "https://api.fxtwitter.com";
const PAGE_LIMIT = 2; // bounded per-invocation; resume cursor stays durable
const PAGE_SIZE = 50;
const CONCURRENT_ACCOUNTS = 5;
type Db = ReturnType<typeof createSupabaseAdminClient>;
type StoredAccount = {
  handle: string; health: XAccountAttempt["status"]; last_attempt_at: string | null;
  last_completed_at: string | null; last_observed_post_at: string | null;
  last_error: string | null; last_fetched: number; page_cursor: string | null;
  window_start_at: string | null;
};
type StoredPost = {
  post_id:string; handle:string; original_url:string; published_at:string;
  retrieved_at:string; body:string; media_urls:string[]; quote_url:string|null;
  intake_status:"discovery"|"deferred"|"reviewed"|"rejected";
};
function ms(value: string | null | undefined) { const n=value?Date.parse(value):NaN;return Number.isFinite(n)?n:0; }
function plus(now:string, minutes:number) {return new Date(ms(now)+minutes*60_000).toISOString();}
function safeError(e:unknown) {return e instanceof Error ? e.message.slice(0,180) : "X source or storage unavailable";}
function emptyAccount(handle:string, now:string, reason:string):XAccountAttempt {
  return {handle,status:"unavailable",attemptedAt:now,lastSuccessAt:null,lastObservedPostAt:null,
    fetched:0,newPosts:0,error:reason};
}
async function loadAccounts(db:Db) {
  const { data,error }=await db.from("x_wire_accounts")
    .select("handle,health,last_attempt_at,last_completed_at,last_observed_post_at,last_error,last_fetched,page_cursor,window_start_at");
  if(error)throw error;
  return (data || []) as StoredAccount[];
}
async function finish(db:Db,handle:string,token:string,values:Record<string,unknown>) {
  const {data,error}=await db.from("x_wire_accounts").update({
    ...values,lease_token:null,lease_expires_at:null,updated_at:new Date().toISOString(),
  }).eq("handle",handle).eq("lease_token",token).select("handle").maybeSingle();
  if(error||!data)throw new Error("X account lease lost or account update failed");
}
async function scanOne(db:Db,handle:string, now:string,fetchImpl:typeof fetch,
  quota:{total:number}) {
  const {data:claimRows,error:claimErr}=await db.rpc("claim_x_wire_account",{p_handle:handle});
  if(claimErr)throw claimErr;
  const claim=Array.isArray(claimRows)?claimRows[0]:null;
  if(!claim)return; // fresh lease or cooldown held by another view
  const token=String(claim.claimed_token);
  const window=xWireRequestWindow(now,claim.checkpoint_at,claim.resume_cursor,claim.resume_start_at,
    X_SWEEP_DEFAULTS.lookbackHours,X_SWEEP_DEFAULTS.overlapMinutes,X_SWEEP_DEFAULTS.recoveryLookbackHours);
  const {data:existing}=await db.from("x_wire_accounts")
    .select("last_observed_post_at").eq("handle",handle).maybeSingle();
  let latest=ms(existing?.last_observed_post_at);
  let cursor:string|null=window.cursor, fetched=0, kept=0, status:XAccountAttempt["status"]="partial";
  const seenCursors=new Set<string>();
  try {
    for(let page=0;page<PAGE_LIMIT;page++) {
      const url=new URL(ORIGIN+"/2/profile/"+handle+"/statuses");
      url.searchParams.set("count",String(PAGE_SIZE));
      if(cursor)url.searchParams.set("cursor",cursor);
      else url.searchParams.set("since",String(Math.floor(Date.parse(window.startAt)/1000)));
      const response=await fetchImpl(url.toString(), {
        headers:{Accept:"application/json"},cache:"no-store",redirect:"error",
        signal:AbortSignal.timeout(7000),
      });
      if(response.status===204 && !cursor) {
        await finish(db,handle,token,{health:"healthy",last_error:null,last_fetched:fetched,
          last_completed_at:now,window_start_at:null,page_cursor:null,next_attempt_at:plus(now,30),
          last_observed_post_at:latest?new Date(latest).toISOString():null});
        return;
      }
      if(!response.ok)throw new Error("HTTP "+response.status);
      if(!(response.headers.get("content-type")||"").includes("json"))
        throw new Error("Non-JSON provider response");
      const body=await response.text();
      if(body.length>1_000_000)throw new Error("Oversized provider response");
      const parsed=parseFxTimeline(JSON.parse(body),handle,window.startAt,now);
      fetched+=parsed.total;
      // Save every retrieved valid candidate, even if beyond the active work budget.
      // Deferred items are durable, not dropped or quietly counted as reviewed.
      const writes=parsed.posts.map(post=>{
        const active=kept<X_SWEEP_DEFAULTS.softLimitPerAccount &&
          quota.total<X_SWEEP_DEFAULTS.maxCandidatesPerRun;
        if(active){kept++;quota.total++;}
        latest=Math.max(latest,Date.parse(post.publishedAt));
        return {
          post_id:post.id,handle,original_url:post.url,published_at:post.publishedAt,
          retrieved_at:new Date().toISOString(),body:post.text,media_urls:post.images,
          quote_url:post.quoteUrl,intake_status:active?"discovery":"deferred",
          original_verified:false,
        };
      });
      if(writes.length){
        const {error:saveErr}=await db.from("x_wire_posts").upsert(writes,{
          onConflict:"post_id",ignoreDuplicates:true,
        });
        if(saveErr)throw new Error("Post backlog persistence failed");
      }
      const next=parsed.nextCursor;
      if(next && (next===cursor || seenCursors.has(next)))throw new Error("Repeated pagination cursor");
      if(next)seenCursors.add(next);
      cursor=next;
      const complete=next===null && parsed.total<PAGE_SIZE;
      // A missing cursor on a full page is ambiguous, never a completed checkpoint.
      if(!next && parsed.total===PAGE_SIZE)throw new Error("Full page without continuation cursor");
      if(complete){
        await finish(db,handle,token,{health:parsed.malformed?"partial":"healthy",
          last_error:parsed.malformed?parsed.malformed+" untrusted row(s) withheld":null,
          last_fetched:fetched,last_completed_at:now,window_start_at:null,page_cursor:null,
          next_attempt_at:plus(now,30),last_observed_post_at:latest?new Date(latest).toISOString():null});
        return;
      }
      const {data:saved,error:saveErr}=await db.from("x_wire_accounts").update({
        page_cursor:cursor,window_start_at:window.startAt,last_fetched:fetched,health:"partial",
        last_observed_post_at:latest?new Date(latest).toISOString():null,
        updated_at:new Date().toISOString(),
      }).eq("handle",handle).eq("lease_token",token).select("handle").maybeSingle();
      if(saveErr||!saved)throw new Error("Cursor persistence failed or lease lost");
    }
    await finish(db,handle,token,{health:"partial",page_cursor:cursor,window_start_at:window.startAt,
      last_error:"Bounded pagination incomplete; cursor saved for next pass",
      next_attempt_at:plus(now,5),last_fetched:fetched,
      last_observed_post_at:latest?new Date(latest).toISOString():null});
  } catch(e) {
    const message=safeError(e);
    try {
      await finish(db,handle,token,{health:message.startsWith("HTTP 429")||message.startsWith("HTTP 403")?"blocked":"unavailable",
        last_error:message,next_attempt_at:plus(now,30),last_fetched:fetched});
    } catch{ /* Preserve the original lease and unfinished cursor; never pretend success */ }
  }
}
export type XWireDurable = {
  storageHealthy:boolean; retrievedAt:string; posts:(XWirePost & {intakeStatus:string})[];
  accounts:XAccountAttempt[]; health:ReturnType<typeof xSourceHealth>;
  deferredCount:number; pendingCount:number; notice:string;
};
/** Invoked only from authenticated owner SSR route. No new cron / research writer. */
export async function getXWireDurable(opts:{now?:Date;fetchImpl?:typeof fetch;db?:Db}={}):Promise<XWireDurable> {
  const now=(opts.now||new Date()).toISOString(), fetchImpl=opts.fetchImpl||fetch;
  const unavailable=(reason:string):XWireDurable=>{
    const accounts=X_CORE_ROSTER.map(x=>emptyAccount(x.handle,now,reason));
    return {storageHealthy:false,retrievedAt:now,posts:[],accounts,health:xSourceHealth(accounts),
      deferredCount:0,pendingCount:0,notice:"Durable source ledger unavailable; no provider freshness or successful ingestion is asserted."};
  };
  let db:Db;
  try{ db=opts.db||createSupabaseAdminClient();await loadAccounts(db); }
  catch(e){return unavailable(safeError(e));}
  const quota={total:0};
  let next=0;
  await Promise.all(Array.from({length:CONCURRENT_ACCOUNTS},async()=>{
    while(next<X_CORE_ROSTER.length){
      const i=next++;
      try{await scanOne(db,X_CORE_ROSTER[i].handle,now,fetchImpl,quota);}
      catch{ /* Account source health read back below; do not suppress other accounts */ }
    }
  }));
  try{
    const [source,postsRead,deferredRead,pendingRead]=await Promise.all([
      loadAccounts(db),
      db.from("x_wire_posts").select("post_id,handle,original_url,published_at,retrieved_at,body,media_urls,quote_url,intake_status")
        .order("published_at",{ascending:false}).limit(250),
      db.from("x_wire_posts").select("post_id",{count:"exact",head:true}).eq("intake_status","deferred"),
      db.from("x_wire_posts").select("post_id",{count:"exact",head:true}).eq("intake_status","discovery"),
    ]);
    if(postsRead.error||deferredRead.error||pendingRead.error)throw new Error("Backlog readback failed");
    const byHandle=new Map(source.map(x=>[x.handle.toLowerCase(),x]));
    const accounts:XAccountAttempt[]=X_CORE_ROSTER.map(x=>{
      const found=byHandle.get(x.handle.toLowerCase());
      if(!found)return emptyAccount(x.handle,now,"Checkpoint missing");
      return {handle:x.handle,status:found.health,
        attemptedAt:found.last_attempt_at||now,lastSuccessAt:found.last_completed_at,
        lastObservedPostAt:found.last_observed_post_at,
        fetched:found.last_fetched,newPosts:0,error:found.last_error};
    });
    const posts: (XWirePost & {intakeStatus:string})[] =
      ((postsRead.data||[]) as StoredPost[]).map(x=>({
        id:x.post_id,url:x.original_url,handle:x.handle,publishedAt:x.published_at,
        text:x.body,images:Array.isArray(x.media_urls)?x.media_urls:[],
        quoteUrl:x.quote_url,attribution:"THIRD_PARTY_ONLY",intakeStatus:x.intake_status,
      }));
    return {storageHealthy:true,retrievedAt:now,posts,accounts,health:xSourceHealth(accounts),
      deferredCount:deferredRead.count||0,pendingCount:pendingRead.count||0,
      notice:"Stored candidate backlog only. Complete checkpoints require exhausted pagination; 'healthy' is provider coverage, not independent X or market-claim verification."};
  }catch(e){return unavailable(safeError(e));}
}
