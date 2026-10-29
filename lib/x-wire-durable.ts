import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin.ts";
import { X_CORE_ROSTER, X_SWEEP_DEFAULTS, isExcludedXWireHandle, normaliseXPostUrl, xSourceHealth, type XAccountAttempt } from "./x-sweep-core.ts";
import { parseFxTimeline, xWireRequestWindow, xWireRecoveryAnchor } from "./x-wire-pagination.ts";
import type { XWirePost } from "./x-wire-provider.ts";

const ORIGIN = "https://api.fxtwitter.com";
const PAGE_LIMIT = 6; // high-output accounts may need several 20-post provider pages
const MAX_SCAN_MS = 18_000; // 5 concurrent accounts, at most two bounded waves per SSR invocation
const PAGE_SIZE = 50;
const CONCURRENT_ACCOUNTS = 5;
// Existing morning/evening acquisition is 12h apart; older completions are stale.
const HEALTH_COMPLETION_MAX_AGE_HOURS = 15;
type Db = ReturnType<typeof createSupabaseAdminClient>;
type StoredAccount = {
  handle: string; health: XAccountAttempt["status"]; last_attempt_at: string | null;
  last_completed_at: string | null; last_observed_post_at: string | null;
  last_error: string | null; last_fetched: number; page_cursor: string | null;
  window_start_at: string | null; uncovered_before: string | null;
};
type StoredPost = {
  post_id:string; handle:string; original_url:string; published_at:string;
  retrieved_at:string; body:string; media_urls:string[]; quote_url:string|null;
  intake_status:"discovery"|"deferred"|"reviewed"|"rejected";
};
function eligibleQuoteUrl(value:string|null):string|null {
  if(!value)return null;
  try {
    const quote=normaliseXPostUrl(value);
    return isExcludedXWireHandle(quote.handle)?null:quote.url;
  }catch{return null;}
}
function ms(value: string | null | undefined) { const n=value?Date.parse(value):NaN;return Number.isFinite(n)?n:0; }
function plus(now:string, minutes:number) {return new Date(ms(now)+minutes*60_000).toISOString();}
function safeError(e:unknown) {return e instanceof Error ? e.message.slice(0,180) : "X source or storage unavailable";}
function emptyAccount(handle:string, now:string, reason:string):XAccountAttempt {
  return {handle,status:"unavailable",attemptedAt:"",lastSuccessAt:null,lastObservedPostAt:null,
    fetched:0,newPosts:0,error:reason};
}
async function loadAccounts(db:Db) {
  const { data,error }=await db.from("x_wire_accounts")
    .select("handle,health,last_attempt_at,last_completed_at,last_observed_post_at,last_error,last_fetched,page_cursor,window_start_at,uncovered_before");
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
  if(isExcludedXWireHandle(handle))return; // Never lease or fetch an explicitly excluded account.
  const {data:claimRows,error:claimErr}=await db.rpc("claim_x_wire_account",{p_handle:handle});
  if(claimErr)throw claimErr;
  const claim=Array.isArray(claimRows)?claimRows[0]:null;
  if(!claim)return; // fresh lease or cooldown held by another view
  const token=String(claim.claimed_token);
  const {data:existing}=await db.from("x_wire_accounts")
    .select("last_observed_post_at,uncovered_before").eq("handle",handle).maybeSingle();
  const anchor=xWireRecoveryAnchor(now,claim.checkpoint_at,existing?.uncovered_before ?? null,
    X_SWEEP_DEFAULTS.recoveryLookbackHours);
  const window=xWireRequestWindow(now,anchor,claim.resume_cursor,claim.resume_start_at,
    X_SWEEP_DEFAULTS.lookbackHours,X_SWEEP_DEFAULTS.overlapMinutes,X_SWEEP_DEFAULTS.recoveryLookbackHours);
  let latest=ms(existing?.last_observed_post_at);
  const missingBefore = existing?.uncovered_before ?? (window.gap ? claim.checkpoint_at ?? window.startAt : null);
  const gapMarker = missingBefore ? {uncovered_before:missingBefore} : {};
  // Clear a recoverable gap only after the requested start was actually covered.
  // Gaps beyond the 72h provider recovery window remain explicitly unresolved.
  const unresolvedGap = missingBefore && ms(window.startAt)>ms(missingBefore) ? missingBefore : null;
  const completeGapMarker = {uncovered_before:unresolvedGap};
  let cursor:string|null=window.cursor, fetched=0, kept=0;
  const seenCursors=new Set<string>();
  const startedAt=Date.now();
  try {
    for(let page=0;page<PAGE_LIMIT;page++) {
      if(page>0 && Date.now()-startedAt>=MAX_SCAN_MS)break;
      const url=new URL(ORIGIN+"/2/profile/"+handle+"/statuses");
      url.searchParams.set("count",String(PAGE_SIZE));
      if(cursor)url.searchParams.set("cursor",cursor);
      else url.searchParams.set("since",String(Math.floor(Date.parse(window.startAt)/1000)));
      let response=await fetchImpl(url.toString(), {
        headers:{Accept:"application/json"},cache:"no-store",redirect:"error",
        signal:AbortSignal.timeout(7000),
      });
      // FxEmbed sometimes returns 404 for a time-filtered first page even
      // while the same original account timeline is available without since.
      // One bounded same-host retry, then validate every row and the original
      // observation window exactly as before. No extra provider or login.
      if(response.status===404 && !cursor){
        const fallback=new URL(url.toString());
        fallback.searchParams.delete("since");
        response=await fetchImpl(fallback.toString(), {
          headers:{Accept:"application/json"},cache:"no-store",redirect:"error",
          signal:AbortSignal.timeout(7000),
        });
      }
      if(response.status===204 && !cursor) {
        await finish(db,handle,token,{...completeGapMarker,health:unresolvedGap?"partial":"healthy",
          last_error:unresolvedGap?"Unrecovered historical coverage gap":null,last_fetched:fetched,
          last_completed_at:now,window_start_at:null,page_cursor:null,next_attempt_at:plus(now,30),
          last_observed_post_at:latest?new Date(latest).toISOString():null});
        return;
      }
      if(response.status===404 && cursor) {
        // FxEmbed documents 404 for either an empty timeline OR user failure.
        // It does not prove that the cursor was exhausted. Drop the poisoned
        // continuation token, retain the historical uncertainty, and retry the
        // fresh head after cooldown. Already saved posts remain immutable.
        await finish(db,handle,token,{...gapMarker,uncovered_before:missingBefore||window.startAt,
          health:"partial",last_error:"HTTP 404 on continuation; incomplete coverage, restarting fresh head",
          page_cursor:null,window_start_at:null,next_attempt_at:plus(now,5),last_fetched:fetched,
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
      const complete=parsed.reachedWindowStart || (next===null && parsed.total<PAGE_SIZE);
      // A missing cursor on a full page is ambiguous, never a completed checkpoint.
      if(!next && parsed.total===PAGE_SIZE && !parsed.reachedWindowStart)throw new Error("Full page without continuation cursor");
      if(complete){
        await finish(db,handle,token,{...completeGapMarker,
          health:parsed.malformed||unresolvedGap?"partial":"healthy",
          last_error:unresolvedGap?"Unrecovered historical coverage gap":parsed.malformed?parsed.malformed+" untrusted row(s) withheld":null,
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
    await finish(db,handle,token,{...gapMarker,health:"partial",page_cursor:cursor,window_start_at:window.startAt,
      last_error:"Bounded pagination incomplete; cursor saved for next pass",
      next_attempt_at:plus(now,5),last_fetched:fetched,
      last_observed_post_at:latest?new Date(latest).toISOString():null});
  } catch(e) {
    const message=safeError(e);
    try {
      // If one page was durably stored before a later provider 404/429,
      // report PARTIAL and keep the cursor. The historical response showed
      // KobeissiLetter had 15 genuine posts but was labelled UNAVAILABLE.
      // Neither state is success; never advance last_completed_at.
      const hadPartialData=fetched>0;
      const invalidCursor=message==="Repeated pagination cursor";
      const recentlyActive404=message==="HTTP 404" && latest>0 &&
        ms(now)-latest<=X_SWEEP_DEFAULTS.recoveryLookbackHours*3_600_000;
      await finish(db,handle,token,{...gapMarker,
        ...(invalidCursor?{uncovered_before:missingBefore||window.startAt}:{}),
        health:invalidCursor||hadPartialData?"partial":
          message.startsWith("HTTP 429")||message.startsWith("HTTP 403")?"blocked":"unavailable",
        last_error:message,
        page_cursor:invalidCursor?null:hadPartialData?cursor:claim.resume_cursor,
        window_start_at:invalidCursor?null:hadPartialData?window.startAt:claim.resume_start_at,
        next_attempt_at:plus(now,invalidCursor||hadPartialData||recentlyActive404?5:30),last_fetched:fetched});
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
  const failures=new Map<string,string>();
  let next=0;
  await Promise.all(Array.from({length:CONCURRENT_ACCOUNTS},async()=>{
    while(next<X_CORE_ROSTER.length){
      const i=next++;
      try{await scanOne(db,X_CORE_ROSTER[i].handle,now,fetchImpl,quota);}
      catch(e){failures.set(X_CORE_ROSTER[i].handle,safeError(e)); /* Failure is shown in source health */ }
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
      const failure=failures.get(x.handle);
      const stale=found.health==="healthy" &&
        (ms(now)-ms(found.last_completed_at)>HEALTH_COMPLETION_MAX_AGE_HOURS*3_600_000);
      return {handle:x.handle,status:failure?"unavailable":found.uncovered_before||stale?"partial":found.health,
        attemptedAt:found.last_attempt_at||"",lastSuccessAt:found.last_completed_at,
        lastObservedPostAt:found.last_observed_post_at,
        fetched:found.last_fetched,newPosts:0,
        error:failure || (stale ? "Last completed source check older than 15 hours; freshness unconfirmed." :
          found.uncovered_before ? "Unresolved historical source coverage. "+(found.last_error||"") : found.last_error)};
    });
    const posts: (XWirePost & {intakeStatus:string})[] =
      ((postsRead.data||[]) as StoredPost[]).filter(x=>!isExcludedXWireHandle(x.handle)).map(x=>({
        id:x.post_id,url:x.original_url,handle:x.handle,publishedAt:x.published_at,
        text:x.body,images:Array.isArray(x.media_urls)?x.media_urls:[],
        quoteUrl:eligibleQuoteUrl(x.quote_url),attribution:"THIRD_PARTY_ONLY",intakeStatus:x.intake_status,
      }));
    return {storageHealthy:true,retrievedAt:now,posts,accounts,health:xSourceHealth(accounts),
      deferredCount:deferredRead.count||0,pendingCount:pendingRead.count||0,
      notice:"Stored candidate backlog only. Complete checkpoints require exhausted pagination; 'healthy' is provider coverage, not independent X or market-claim verification."};
  }catch(e){return unavailable(safeError(e));}
}
