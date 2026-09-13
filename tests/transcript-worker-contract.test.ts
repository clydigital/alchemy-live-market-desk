import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20260913162653_transcript_worker_lifecycle.sql"),
  "utf8",
);
const handler = fs.readFileSync(path.join(root, "lib", "transcript-worker-handler.ts"), "utf8");
const store = fs.readFileSync(path.join(root, "lib", "supabase-transcript-worker-store.ts"), "utf8");
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8")) as {
  crons: Array<{ path: string; schedule: string }>;
  rewrites?: Array<{ source: string; destination: string }>;
};

test("the database claim is atomic, bounded, leased and private", () => {
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /transcript_lease_expires_at <= now\(\)/i);
  assert.match(migration, /limit greatest\(1, least\(coalesce\(p_batch_size, 1\), 3\)\)/i);
  assert.match(migration, /transcript_claimed_by = btrim\(p_worker_id\)/i);
  assert.match(migration, /transcript_job_attempt_count = intake\.transcript_job_attempt_count \+ 1/i);
  assert.match(migration, /revoke all on function public\.claim_transcript_jobs[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.claim_transcript_jobs[\s\S]*to service_role/i);
});

test("only the exact retained placeholder state receives legacy claimability", () => {
  assert.match(migration, /intake\.transcript_job_status = 'blocked'[\s\S]*intake\.status = 'blocked'/i);
  assert.match(migration, /intake\.transcript_status = 'missing'/i);
  assert.match(migration, /intake\.transcript_attempt_count = 0/i);
  assert.match(migration, /transcript collection and claim verification are pending\./i);
  assert.match(migration, /intake\.external_id ~ '\^\[A-Za-z0-9_-\]\{11\}\$'/i);
});

test("the worker is authenticated, bounded, scheduled and separate from paused research", () => {
  assert.match(handler, /acceptsResearchAuthorization/);
  assert.match(handler, /batchSize: 1/);
  assert.match(handler, /leaseSeconds: 300/);
  assert.match(handler, /maxAttempts: 6/);
  assert.match(handler, /timeoutMs: 12_000/);
  assert.match(handler, /retrieveSupadataVideo/);
  assert.match(store, /canonicaliseIntake[\s\S]*new Set\(\[job\.itemKey\]\)/);
  assert.equal(
    vercel.crons.some((cron) => cron.path === "/api/cron/video/transcript-worker" && cron.schedule === "30 1 * * *"),
    true,
  );
  assert.equal(
    vercel.rewrites?.some((rewrite) => rewrite.source === "/api/cron/research/:path*" && rewrite.destination === "/api/automation-paused"),
    true,
  );
});
