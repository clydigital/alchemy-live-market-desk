import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const lifecycleMigration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20260913162653_transcript_worker_lifecycle.sql"),
  "utf8",
);
const capacityMigration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20260914033000_transcript_worker_capacity.sql"),
  "utf8",
);
const handler = fs.readFileSync(path.join(root, "lib", "transcript-worker-handler.ts"), "utf8");
const worker = fs.readFileSync(path.join(root, "lib", "transcript-worker.ts"), "utf8");
const store = fs.readFileSync(path.join(root, "lib", "supabase-transcript-worker-store.ts"), "utf8");
const transcriptReview = fs.readFileSync(path.join(root, "lib", "transcript-research-review.ts"), "utf8");
const intelligenceRuntime = fs.readFileSync(path.join(root, "lib", "intelligence", "runtime.ts"), "utf8");
const authConfig = fs.readFileSync(path.join(root, "lib", "supabase", "config.ts"), "utf8");
const route = fs.readFileSync(path.join(root, "app", "api", "cron", "video", "transcript-worker", "route.ts"), "utf8");
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8")) as {
  crons: Array<{ path: string; schedule: string }>;
  rewrites?: Array<{ source: string; destination: string }>;
};

test("the database claim is atomic, leased, private and supports a 25-job capability ceiling", () => {
  assert.match(lifecycleMigration, /for update skip locked/i);
  assert.match(lifecycleMigration, /transcript_lease_expires_at <= now\(\)/i);
  assert.match(capacityMigration, /limit greatest\(1, least\(coalesce\(p_batch_size, 1\), 25\)\)/i);
  assert.match(capacityMigration, /transcript_claimed_by = btrim\(p_worker_id\)/i);
  assert.match(capacityMigration, /transcript_job_attempt_count = intake\.transcript_job_attempt_count \+ 1/i);
  assert.match(capacityMigration, /revoke all on function public\.claim_transcript_jobs[\s\S]*from public, anon, authenticated/i);
  assert.match(capacityMigration, /grant execute on function public\.claim_transcript_jobs[\s\S]*to service_role/i);
});

test("only the exact retained placeholder state receives legacy claimability", () => {
  assert.match(capacityMigration, /intake\.transcript_job_status = 'blocked'[\s\S]*intake\.status = 'blocked'/i);
  assert.match(capacityMigration, /intake\.transcript_status = 'missing'/i);
  assert.match(capacityMigration, /intake\.transcript_attempt_count = 0/i);
  assert.match(capacityMigration, /transcript collection and claim verification are pending\./i);
  assert.match(capacityMigration, /intake\.external_id ~ '\^\[A-Za-z0-9_-\]\{11\}\$'/i);
});

test("the worker uses incremental concurrent capacity below the 300-second platform ceiling", () => {
  assert.match(worker, /MAX_CLAIM_LIMIT = 25/);
  assert.match(worker, /DEFAULT_BATCH_SIZE = 15/);
  assert.match(worker, /MAX_CONCURRENCY = 3/);
  assert.match(worker, /DEFAULT_SOFT_DEADLINE_MS = 240_000/);
  assert.match(worker, /trancheSize = Math\.min\(maxConcurrency, batchSize - claimed\)/);
  assert.match(worker, /Promise\.all/);
  assert.match(route, /maxDuration = 300/);
});

test("the worker is authenticated, scheduled and separate from paused research", () => {
  assert.match(handler, /acceptsResearchAuthorization/);
  assert.match(authConfig, /MACHINE_AUTH_PATHS[\s\S]*"\/api\/cron\/video\/transcript-worker"/);
  assert.match(handler, /batchSize: DEFAULT_BATCH_SIZE/);
  assert.match(handler, /maxConcurrency: MAX_CONCURRENCY/);
  assert.match(handler, /softDeadlineMs: DEFAULT_SOFT_DEADLINE_MS/);
  assert.match(handler, /claimHeadroomMs: DEFAULT_CLAIM_HEADROOM_MS/);
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


test("creator review is bounded while evidence routing remains archived-capable", () => {
  const routingPath = path.join(root, "lib", "creator-story-routing.ts");
  assert.equal(fs.existsSync(routingPath), true, "creator-only Story loader must exist");
  const routing = fs.readFileSync(routingPath, "utf8");
  assert.match(transcriptReview, /loadPersistentStoriesForCreatorReview/);
  assert.match(store, /loadPersistentStoriesForCreatorRouting/);
  assert.match(routing, /CREATOR_REVIEW_STORY_LIMIT = 40/);
  assert.match(routing, /loadPersistentStoriesForCreatorReview[\s\S]*\.limit\(CREATOR_REVIEW_STORY_LIMIT\)/);
  assert.match(routing, /loadPersistentStoriesForCreatorRouting[\s\S]*\.neq\("status",\s*"discarded"\)/);
  assert.doesNotMatch(routing.match(/loadPersistentStoriesForCreatorRouting[\s\S]*?\n\}/)?.[0] ?? "", /\.neq\("status",\s*"archived"\)/);
  assert.doesNotMatch(transcriptReview, /\.from\("stories"\)/);
  assert.doesNotMatch(store, /\.from\("stories"\)/);
});

test("canonical intelligence keeps archived Stories out of normal reasoning but admits explicitly queued archived maintenance targets", () => {
  assert.match(
    intelligenceRuntime,
    /STORY_REGISTRY_FIELDS[\s\S]*status=neq\.archived&status=neq\.discarded&order=updated_at\.desc/,
  );
  assert.match(
    intelligenceRuntime,
    /loadExplicitlyQueuedArchivedReviewContext[\s\S]*intelligence_reevaluation_queue\?select=target_id,requested_by_evidence_id[\s\S]*status=in\.\(pending,retryable\)[\s\S]*status=eq\.archived/,
  );
  assert.match(intelligenceRuntime, /storyReviewStories = \[[\s\S]*queuedArchivedStories/);
  assert.match(
    intelligenceRuntime,
    /loadOrCreateStoryReviewTargets\(engineRunId, storyReviewStories, storyReviewEvidence, researchDebt\)/,
  );
  assert.match(intelligenceRuntime, /const storiesPack = existingStoryPack\(stories\)/);
});

test("queued archived review pins its trigger Evidence even when normal recruitment capacity would drop it", () => {
  assert.match(
    intelligenceRuntime,
    /requiredEvidenceIds = unique\(\[[\s\S]*canonicalisedEvidenceIds[\s\S]*queuedArchivedReview\.triggerEvidenceIds/,
  );
  assert.match(
    intelligenceRuntime,
    /intelligence_evidence\?id=in\.\(\$\{requiredIds\.join\(","\)\}\)&select=\$\{EVIDENCE_PACK_FIELDS\}/,
  );
  assert.match(
    intelligenceRuntime,
    /storyReviewEvidence = unique\(\[[\s\S]*evidence\.filter\(\(item\) => queuedTriggerEvidenceIds\.has\(item\.id\)\)/,
  );
});
