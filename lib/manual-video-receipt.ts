import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "./supabase/admin.ts";
import { CREATOR_ROSTER, isRatesOutlookTitle } from "./video-intake-policy.ts";

// Source-only import for the existing authenticated video-intake handler. The
// caller is the authorised private Work collector, not a public video viewer.
// This is NOT a second reviewer or a provider request.
const PRIVATE_RECEIPT = "https://app.notion.com/p/409519b67a9481f9ac8adbe7d1adae48";
const MAX_BYTES = 1_500_000;
const knownChannelIds: Record<string, string> = {
  "fx-evolution": "UCvJZEG5x-DVYZKTz--pS39w",
  "stockedup": "UC-m6zNItyoDk5lSykDlhE4Q",
  "wall-street-truth-bombs": "UCTK_cv-y88CScoudcXnS1Ew",
};
export class ManualCaptionError extends Error {
  readonly status: number;
  constructor(message: string, status = 422) { super(message); this.status = status; }
}
const obj = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new ManualCaptionError("Receipt must be an object.");
  return v as Record<string, unknown>;
};
function str(v: unknown, max: number, name: string): string {
  if (typeof v !== "string" || !v.trim() || v.length > max) throw new ManualCaptionError("Invalid " + name + ".");
  return v;
}
function clock(v: unknown, now: Date, name: string): string {
  const s = str(v, 50, name);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(s) ||
      !Number.isFinite(Date.parse(s)) || Date.parse(s) > +now) throw new ManualCaptionError("Invalid " + name + ".");
  return new Date(s).toISOString();
}
export function parseManualCaptionReceipt(value: unknown, now = new Date(), env: Record<string,string|undefined> = process.env) {
  const r = obj(value);
  if (Buffer.byteLength(JSON.stringify(r), "utf8") > MAX_BYTES) throw new ManualCaptionError("Receipt exceeds size limit.", 413);
  if (r.version !== "native-caption-receipt/1" || r.provider !== "scrapecreators" || r.sourceKind !== "native_caption" || r.sourceReceiptUrl !== PRIVATE_RECEIPT) {
    throw new ManualCaptionError("Only an authenticated existing private native-caption receipt is accepted.");
  }
  const videoId = str(r.videoId, 11, "videoId");
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId) || r.url !== "https://www.youtube.com/watch?v=" + videoId) throw new ManualCaptionError("Video URL and ID must match.");
  const channel = CREATOR_ROSTER.find(c => c.key === r.channelKey);
  if (!channel) throw new ManualCaptionError("Channel is not in the standing creator roster.");
  const expectedId = ("officialChannelId" in channel ? channel.officialChannelId : undefined) ?? knownChannelIds[channel.key] ?? env[channel.env]?.trim();
  if (!expectedId || r.channelId !== expectedId) throw new ManualCaptionError("Original channel identity is unverified or outside the roster.");
  const title = str(r.title, 300, "title");
  if (channel.key === "clearvalue-tax" && !isRatesOutlookTitle(title)) throw new ManualCaptionError("Video outside rates/Fed scope.");
  if (r.isLive !== false || r.isShort !== false || typeof r.durationSeconds !== "number" || !Number.isFinite(r.durationSeconds) || r.durationSeconds <= 180 || r.durationSeconds > 43200) throw new ManualCaptionError("Only eligible completed long-form uploads can be admitted.");
  const duration = r.durationSeconds;
  const publishedAt = clock(r.publishedAt, now, "publishedAt");
  const retrievedAt = clock(r.retrievedAt, now, "retrievedAt");
  if (Date.parse(retrievedAt) < Date.parse(publishedAt)) throw new ManualCaptionError("Retrieval predates publication.");
  const receiptId = str(r.receiptId, 180, "receiptId");
  if (!/^[A-Za-z0-9_-]+$/.test(receiptId)) throw new ManualCaptionError("Invalid receipt ID.");
  const language = str(r.language, 32, "language");
  const transcriptText = str(r.transcriptText, 400000, "transcriptText");
  if (transcriptText.trim().length < 300) throw new ManualCaptionError("Caption receipt is too short to establish full coverage.");
  const sha = createHash("sha256").update(transcriptText, "utf8").digest("hex");
  if (r.transcriptSha256 !== sha) throw new ManualCaptionError("Transcript fingerprint mismatch.");
  if (!Array.isArray(r.segments) || r.segments.length < 4 || r.segments.length > 10000) throw new ManualCaptionError("Authentic timestamped segments are required.");
  let lastStart = -1;
  const segments = r.segments.map((s) => {
    const seg = obj(s);
    const start = seg.startMs, end = seg.endMs;
    if (typeof start !== "number" || typeof end !== "number" || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start < lastStart || end <= start || end > (duration + 5) * 1000) throw new ManualCaptionError("Invalid caption timestamps.");
    lastStart = start;
    return { startSeconds: start / 1000, endSeconds: end / 1000, durationSeconds: (end - start) / 1000, text: str(seg.text, 4000, "caption segment") };
  });
  const lastEnd = Math.max(...segments.map(s => s.endSeconds));
  if (segments[0].startSeconds > 60 || lastEnd < duration - Math.max(30, Math.min(120, duration * 0.05))) {
    throw new ManualCaptionError("Caption timestamps do not establish near-full video coverage.");
  }
  // A hash proves integrity of the supplied bytes, not independent authenticity.
  // The trusted caller attests native-caption provenance; review remains pending.
  return { videoId, channelKey: channel.key, publisher: channel.name, channelId: expectedId, title, url: "https://www.youtube.com/watch?v=" + videoId, publishedAt, retrievedAt, receiptId, language, duration, transcriptText, sha, segments };
}
export type ManualCaptionReceipt = ReturnType<typeof parseManualCaptionReceipt>;
type Intake = {
  id: string; run_id: string; publisher: string; title: string; url: string; published_at: string;
  transcript_status: string; transcript_job_status: string; video_review_status: string | null;
  transcript_evidence_id: string | null; transcript_attempt_count: number; transcript_metadata: Record<string,unknown> | null;
  transcript_text: string | null; updated_at: string;
};
const select = "id,run_id,publisher,title,url,published_at,transcript_status,transcript_job_status,video_review_status,transcript_evidence_id,transcript_attempt_count,transcript_metadata,transcript_text,updated_at";
function check(error: {message:string}|null, message: string) {
  if (error) throw new Error(message); // Never echo source text or database secrets.
}
export function buildManualCaptionCheckpoint(r: ManualCaptionReceipt, previous?: Pick<Intake,"transcript_metadata"|"transcript_attempt_count">, now=new Date()) {
  return {
    transcript_status: "ready", transcript_provider: "other", transcript_text: r.transcriptText,
    transcript_language: r.language, transcript_segments: r.segments, transcript_duration_seconds: r.duration,
    transcript_retrieved_at: r.retrievedAt, transcript_attempted_at: r.retrievedAt, transcript_http_status: 200,
    transcript_error_code: null, transcript_error_message: null, transcript_retryable: false,
    transcript_attempt_count: (previous?.transcript_attempt_count ?? 0) + 1,
    transcript_metadata: {
      ...(previous?.transcript_metadata ?? {}), source_scope: "full_native_caption", retrievalProvider: "scrapecreators", transcriptSource: "native_caption",
      manualReceipt: { version: "native-caption-receipt/1", id: r.receiptId, url: PRIVATE_RECEIPT, sha256: r.sha, channelId: r.channelId, retrievedAt: r.retrievedAt, segmentCount: r.segments.length },
    },
    video_review_status: "transcript_only", transcript_job_status: "pending", transcript_next_attempt_at: null,
    transcript_claim_token: null, transcript_lease_expires_at: null, transcript_job_last_error: null,
    transcript_interpreted_at: null, status: "blocked",
    review_reason: "Verified private caption receipt stored; existing leased worker must interpret and persist evidence.",
    updated_at: now.toISOString(),
  };
}
export async function admitManualCaptionReceipt(r: ManualCaptionReceipt, client: SupabaseClient = createSupabaseAdminClient()) {
  const read = async () => {
    const {data,error} = await client.from("research_intake_items").select(select).eq("item_type","video").eq("external_id",r.videoId).maybeSingle<Intake>();
    check(error, "Could not read canonical video receipt."); return data;
  };
  const result = (row: Intake, disposition: "queued_review"|"already_present") => ({
    status: disposition, itemId: row.id, runId: row.run_id, videoId: r.videoId, transcriptStatus: row.transcript_status,
    reviewStatus: row.video_review_status, jobStatus: row.transcript_job_status, evidenceId: row.transcript_evidence_id,
  });
  const existing = async (row: Intake) => {
    if (row.publisher !== r.publisher || row.url !== r.url || Date.parse(row.published_at) !== Date.parse(r.publishedAt)) {
      throw new ManualCaptionError("Canonical video identity or source publication clock conflicts.",409);
    }
    if (row.transcript_status === "ready" && row.transcript_text?.trim()) return result(row,"already_present");
    if (row.transcript_job_status === "running" || row.transcript_job_status === "completed" || row.video_review_status === "reviewed" || row.transcript_evidence_id) throw new ManualCaptionError("Active or completed worker state cannot be overwritten.",409);
    const {data,error} = await client.from("research_intake_items").update(buildManualCaptionCheckpoint(r,row))
      .eq("id",row.id).eq("updated_at",row.updated_at).neq("transcript_status","ready")
      .in("transcript_job_status",["pending","retryable","blocked","failed"])
      .is("transcript_evidence_id",null).select(select).maybeSingle<Intake>();
    check(error,"Could not persist private caption checkpoint.");
    if (!data) throw new ManualCaptionError("Concurrent intake changed; reconcile before retrying.",409);
    return result(data,"queued_review");
  };
  const current = await read();
  if (current) return existing(current);
  // Manual source receipt gets its own idempotent existing run ledger identity;
  // no scheduled-run reassignment, no new cron and no full-coverage claims.
  const runKey = "manual-video-receipt:" + r.videoId;
  const {error:runError} = await client.from("research_runs").upsert({
    run_key:runKey,schedule_slot:"manual",scheduled_for:r.retrievedAt,status:"blocked",
    accuracy_gate:"blocked",required_sources_complete:false,evidence_gate_passed:false,
    summary:"Private native-caption source receipt; review and evidence pending.",
    source_checks:[{source:r.channelKey,status:"checked",itemCount:1,note:"Exact-ID private receipt only; not full discovery coverage."}],
  },{onConflict:"run_key",ignoreDuplicates:true});
  check(runError,"Could not initialise manual receipt ledger.");
  const {data:run,error:lookupError} = await client.from("research_runs").select("id").eq("run_key",runKey).single<{id:string}>();
  check(lookupError,"Could not read manual receipt ledger.");
  if (!run) throw new Error("Manual receipt ledger absent.");
  // Source and pending review are inserted atomically, so discovery cannot
  // claim a newly created empty row and make a duplicate transcript call.
  const {data,error} = await client.from("research_intake_items").insert({
    run_id:run.id,item_key:"youtube:"+r.channelKey+":"+r.videoId,item_type:"video",
    external_id:r.videoId,publisher:r.publisher,title:r.title,url:r.url,published_at:r.publishedAt,
    summary:"Native-caption source receipt; structured review pending.",
    affected_story_slugs:[],source_quality:80,relevance:70,novelty:80,materiality:65,candidate_score:73,
    recommended_action:"collect_evidence",news_signal:"Creator source received; claims await structured review.",
    divergence_kind:"none",evidence_links:[{url:r.url,kind:"direct_video"}],
    ...buildManualCaptionCheckpoint(r),
  }).select(select).single<Intake>();
  if (error && error.code==="23505") {
    const raced = await read();
    if (raced) return existing(raced);
  }
  check(error,"Could not insert private caption checkpoint.");
  if (!data) throw new Error("Caption checkpoint absent.");
  const {error:finishError} = await client.from("research_runs").update({
    status:"completed",completed_at:new Date().toISOString(),videos_found:1,transcripts_ready:1,
    updated_at:new Date().toISOString(),
  }).eq("id",run.id).eq("status","blocked");
  check(finishError,"Caption checkpoint saved; run ledger reconciliation required.");
  return result(data,"queued_review");
}
