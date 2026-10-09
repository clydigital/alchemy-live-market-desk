import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20261009090000_add_gemini_video_analysis_rescue.sql",
);

test("the Gemini rescue migration adds only the three fenced MVP fields", () => {
  assert.equal(fs.existsSync(migrationPath), true, "Gemini rescue migration must exist");
  const migration = fs.readFileSync(migrationPath, "utf8");
  assert.match(migration, /video_retrieval_failure_kind text/i);
  assert.match(migration, /VIDEO_UNAVAILABLE/);
  assert.match(migration, /TRANSCRIPT_PROVIDER_FAILED/);
  assert.match(migration, /video_analysis_status text not null default 'not_attempted'/i);
  assert.match(migration, /'summary_only'/);
  assert.match(migration, /'failed'/);
  assert.match(migration, /video_analysis_payload jsonb/i);
  assert.match(
    migration,
    /drop function if exists public\.claim_transcript_jobs\(text, integer, integer\)[\s\S]*create or replace function public\.claim_transcript_jobs/i,
  );
  assert.match(migration, /returns table[\s\S]*video_analysis_status text/i);
  assert.match(migration, /security invoker[\s\S]*set search_path = ''/i);
  assert.match(migration, /revoke all[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute[\s\S]*to service_role/i);
});

test("the store keeps Gemini summary data out of transcript and evidence fields", () => {
  const store = fs.readFileSync(path.join(root, "lib", "supabase-transcript-worker-store.ts"), "utf8");
  assert.match(store, /video_retrieval_failure_kind:\s*failureKind/);
  assert.match(store, /video_analysis_status:\s*analysisOutcome\.status/);
  assert.match(store, /video_analysis_payload:\s*analysisPayload/);
  assert.match(store, /GEMINI_SUMMARY_ONLY/);
  assert.match(store, /\.eq\("transcript_job_status",\s*"running"\)[\s\S]*\.eq\("transcript_claim_token",\s*job\.claimToken\)/);
  assert.doesNotMatch(
    store.match(/function geminiAnalysisPayload[\s\S]*?\n\}/)?.[0] ?? "",
    /transcript_text|transcript_provider|transcript_evidence_id/,
  );
});
