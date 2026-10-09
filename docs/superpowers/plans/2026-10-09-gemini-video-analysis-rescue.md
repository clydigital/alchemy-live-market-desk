# Gemini Video Analysis Rescue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Gemini public-YouTube analysis as a summary-only rescue after transcript retrieval fails, without allowing Gemini output to become a transcript or canonical evidence.

**Architecture:** Keep the existing Supadata → Chrome/YouTubeToTranscript → TranscriptAPI chain unchanged. At the worker's final extraction-failure boundary, classify the failure, optionally obtain one structured Gemini analysis while the lease is held, then atomically persist the original transcript failure and independent analysis outcome. Existing transcript, canonicalisation, and Market Motion gates remain authoritative.

**Tech Stack:** TypeScript 5.8, Node test runner, Next.js 15, `@google/genai` 2.28.x, Supabase/Postgres migrations.

**Spec:** `docs/superpowers/specs/2026-10-09-gemini-video-analysis-rescue-design.md`

## Global Constraints

- Gemini is a video-analysis provider, never a `TranscriptProvider`.
- Every success is labelled exactly `GEMINI_SUMMARY_ONLY` and uses schema version `gemini-video-analysis/1`.
- Default model is exactly `gemini-3.8-flash`; `GEMINI_VIDEO_MODEL` may override it.
- `GEMINI_API_KEY` is server-only; absence disables rescue without breaking transcript work.
- Gemini output must never populate transcript fields, complete a transcript job, create `transcript_evidence_id`, or satisfy canonical evidence/Market Motion gates.
- Original transcript error code, retryability, next-attempt time, and debt state remain authoritative after Gemini success or failure.
- Only deterministic structural error codes produce `VIDEO_UNAVAILABLE`; ambiguous failures stay `TRANSCRIPT_PROVIDER_FAILED`.
- Public YouTube HTTPS URLs are the only accepted Gemini remote input.
- The repository has no JumpWatch client; adding one is out of scope.

## Review Focus

- An invalid or non-YouTube URL must fail before any Gemini SDK call; Task 2 pins this.
- Malformed structured JSON, unknown labels, and negative timestamps must be rejected; Task 2 pins this.
- A reclaimed/retried transcript job with an existing summary-only payload must not call Gemini again; Task 4 pins this.
- Gemini timeout, quota, or malformed-response failure must preserve the original transcript error and retry schedule; Task 4 pins this.
- An absent API key must perform no Gemini call and must leave existing transcript behavior unchanged; Tasks 2 and 4 pin this.

---

### Task 1: Deterministic Video Retrieval Failure Classification

**Files:**
- Create: `lib/video-retrieval-failure.ts`
- Create: `tests/video-retrieval-failure.test.ts`

**Interfaces:**
- Consumes: `TranscriptApiError` and `TranscriptErrorCode` from `lib/transcriptapi.ts`.
- Produces: `VideoRetrievalFailureKind`, `classifyVideoRetrievalFailure(error)`, and `geminiRescueEligible(error)` for Task 4.

- [ ] **Step 1: Write failing classification tests**

Cover `video_private`, `video_deleted`, `video_not_found`, and `invalid_video_url` as `VIDEO_UNAVAILABLE`; cover `transcript_missing`, `language_unavailable`, provider capacity/auth/server errors, browser errors, network errors, timeout, malformed response, and unknown as `TRANSCRIPT_PROVIDER_FAILED`. Assert that only the latter category is Gemini-eligible.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --experimental-strip-types tests/video-retrieval-failure.test.ts`

Expected: FAIL because `lib/video-retrieval-failure.ts` does not exist.

- [ ] **Step 3: Implement the classifier**

Create:

```ts
export type VideoRetrievalFailureKind = "VIDEO_UNAVAILABLE" | "TRANSCRIPT_PROVIDER_FAILED";
export function classifyVideoRetrievalFailure(error: unknown): VideoRetrievalFailureKind;
export function geminiRescueEligible(error: unknown): boolean;
```

Use an allowlist of structural codes; do not inspect free-form messages.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test --experimental-strip-types tests/video-retrieval-failure.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/video-retrieval-failure.ts tests/video-retrieval-failure.test.ts
git commit -m "feat: classify video retrieval failures"
```

### Task 2: Structured Gemini Public-Video Client

**Files:**
- Create: `lib/gemini-video-analysis-contract.ts`
- Create: `lib/gemini-video-analysis.ts`
- Create: `tests/gemini-video-analysis.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: a canonical public YouTube HTTPS URL plus server configuration.
- Produces: `GeminiVideoAnalysis`, `GeminiVideoAnalysisResult`, `validateGeminiVideoAnalysis(value)`, `isGeminiVideoAnalysisConfigured(env?)`, and `analysePublicYouTubeVideo(input, options?)` for Task 4.

- [ ] **Step 1: Write failing contract-validation tests**

Assert the approved schema accepts every required field and label, normalises bounded strings, and rejects missing fields, unknown classifications, negative/non-finite timestamps, non-array claims, and oversized malformed output.

- [ ] **Step 2: Run the contract tests and verify RED**

Run: `node --test --experimental-strip-types tests/gemini-video-analysis.test.ts`

Expected: FAIL because the Gemini contract/client modules do not exist.

- [ ] **Step 3: Implement the contract types and validator**

Export the exact spec fields, plus:

```ts
export const GEMINI_VIDEO_ANALYSIS_SCHEMA_VERSION = "gemini-video-analysis/1" as const;
export const GEMINI_SUMMARY_ONLY_LABEL = "GEMINI_SUMMARY_ONLY" as const;
export function validateGeminiVideoAnalysis(value: unknown): GeminiVideoAnalysis;
```

Keep validation dependency-free and reject unsupported values rather than coercing them.

- [ ] **Step 4: Add failing client tests**

Inject a fake interaction runner and assert: public `youtube.com/watch` and `youtu.be` URLs are accepted; HTTP/non-YouTube/malformed URLs fail before the runner; the request carries the exact prompt version, JSON schema, URL as video input, and default `gemini-3.8-flash`; missing `GEMINI_API_KEY` reports unconfigured; `accessStatus = unavailable` is not accepted as a successful summary; timeout and malformed output produce bounded, sanitized errors.

- [ ] **Step 5: Install the pinned SDK range and implement the client**

Run: `npm install @google/genai@^2.28.0`

Implement:

```ts
export type GeminiVideoInteractionRunner = (input: GeminiVideoInteractionInput) => Promise<string>;
export function isGeminiVideoAnalysisConfigured(env?: NodeJS.ProcessEnv): boolean;
export async function analysePublicYouTubeVideo(
  input: { url: string; apiKey?: string; model?: string },
  options?: { runInteraction?: GeminiVideoInteractionRunner; timeoutMs?: number },
): Promise<GeminiVideoAnalysisResult>;
```

The default runner uses `GoogleGenAI().interactions.create`, structured JSON output, a 60-second bound, and the approved prompt. Never log or return the API key.

- [ ] **Step 6: Run the focused client tests and verify GREEN**

Run: `node --test --experimental-strip-types tests/gemini-video-analysis.test.ts`

Expected: PASS with no network call.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/gemini-video-analysis-contract.ts lib/gemini-video-analysis.ts tests/gemini-video-analysis.test.ts
git commit -m "feat: add structured Gemini video analysis client"
```

### Task 3: Fenced Supabase Persistence

**Files:**
- Create: `supabase/migrations/20261009090000_add_gemini_video_analysis_rescue.sql`
- Create: `tests/gemini-video-analysis-persistence.test.ts`
- Modify: `lib/transcript-worker.ts:17-49`
- Modify: `lib/supabase-transcript-worker-store.ts:19-167`
- Modify: `tests/transcript-worker-contract.test.ts`

**Interfaces:**
- Consumes: `GeminiVideoAnalysisResult` from Task 2.
- Produces: `GeminiVideoAnalysisOutcome = { status: "summary_only"; result: GeminiVideoAnalysisResult } | { status: "failed"; errorCode: string; errorMessage: string } | null`, claimed-job analysis status, and a fenced `saveExtractionFailure(..., analysisOutcome?)` that atomically writes transcript failure plus optional analysis fields.

- [ ] **Step 1: Write failing migration and store-contract tests**

Assert the migration adds the ten approved `video_*` columns and checks `video_retrieval_failure_kind`/`video_analysis_status`; the replacement `claim_transcript_jobs` returns `video_analysis_status`; the store maps it onto `ClaimedTranscriptJob`; success writes only `video_analysis_*` fields; failure records bounded analysis error fields; neither path writes transcript text/provider/evidence fields from Gemini; the update remains fenced by running status and claim token.

- [ ] **Step 2: Run focused persistence tests and verify RED**

Run: `node --test --experimental-strip-types tests/gemini-video-analysis-persistence.test.ts tests/transcript-worker-contract.test.ts`

Expected: FAIL because the migration and outcome-aware persistence do not exist.

- [ ] **Step 3: Add the migration**

Add fields and checks from the spec, default `video_analysis_status` to `not_attempted`, keep payload JSONB nullable, add a partial index for `summary_only`, and replace the latest fixed-four-creator claim RPC without changing its claimability, lease, security, or 25-job ceiling.

- [ ] **Step 4: Extend the worker/store types and fenced update**

Add `videoAnalysisStatus` to `ClaimedTranscriptJob`. Change:

```ts
saveExtractionFailure(
  job: ClaimedTranscriptJob,
  error: TranscriptApiError,
  attemptedAt: string,
  nextAttemptAt: string | null,
  failureKind: VideoRetrievalFailureKind,
  analysisOutcome?: GeminiVideoAnalysisOutcome | null,
): Promise<void>;
```

Map success to provider `gemini`, label `GEMINI_SUMMARY_ONLY`, model, prompt version, payload, and timestamps. Map analysis failure without replacing transcript error columns.

- [ ] **Step 5: Run focused persistence tests and verify GREEN**

Run: `node --test --experimental-strip-types tests/gemini-video-analysis-persistence.test.ts tests/transcript-worker-contract.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261009090000_add_gemini_video_analysis_rescue.sql lib/transcript-worker.ts lib/supabase-transcript-worker-store.ts tests/gemini-video-analysis-persistence.test.ts tests/transcript-worker-contract.test.ts
git commit -m "feat: persist fenced Gemini video rescues"
```

### Task 4: Transcript Worker Rescue Orchestration

**Files:**
- Modify: `lib/transcript-worker.ts:51-203`
- Modify: `lib/transcript-worker-handler.ts:17-74`
- Modify: `tests/transcript-worker.test.ts:66-268`
- Create: `tests/transcript-worker-handler.test.ts`

**Interfaces:**
- Consumes: Task 1 classifier, Task 2 Gemini client, and Task 3 outcome-aware store.
- Produces: exactly-once eligible Gemini rescue while the transcript lease is owned, preserving the original transcript outcome.

- [ ] **Step 1: Extend the in-memory store and write failing worker tests**

Cover: eligible `transcript_missing` calls Gemini and stores summary-only while returning `blocked`; retryable provider failure calls Gemini and preserves `retryable` plus the original next-attempt time; structural unavailable failure skips Gemini; existing `summary_only` skips Gemini; missing configuration skips Gemini; Gemini failure persists its own diagnostic but returns the original transcript code/status; successful transcript extraction never touches Gemini.

- [ ] **Step 2: Run the worker tests and verify RED**

Run: `node --test --experimental-strip-types tests/transcript-worker.test.ts`

Expected: FAIL because the worker has no analysis dependencies or orchestration.

- [ ] **Step 3: Implement worker orchestration**

Extend `TranscriptWorkerDependencies` with optional, fail-closed hooks so existing callers retain their current behavior:

```ts
videoAnalysisConfigured?: () => boolean;
analyseVideo?: (job: ClaimedTranscriptJob) => Promise<GeminiVideoAnalysisResult>;
```

At normalized extraction failure: classify; skip if unavailable/unconfigured/already saved; otherwise analyse while lease ownership is current; convert success/failure to `GeminiVideoAnalysisOutcome`; call the single fenced failure write; return the original transcript outcome unchanged.

- [ ] **Step 4: Write failing handler wiring tests**

Assert the handler injects `isGeminiVideoAnalysisConfigured` and calls `analysePublicYouTubeVideo` with `job.url`, `GEMINI_API_KEY`, and optional `GEMINI_VIDEO_MODEL`; assert no secret appears in the response; assert summary-only jobs are not included in `completedItemIds` passed to Market Motion.

- [ ] **Step 5: Implement handler wiring and verify GREEN**

Run: `node --test --experimental-strip-types tests/transcript-worker.test.ts tests/transcript-worker-handler.test.ts`

Expected: PASS.

- [ ] **Step 6: Run transcript regression tests**

Run: `node --test --experimental-strip-types tests/transcript-worker-retrieval.test.ts tests/transcript-worker-run-reconciliation.test.ts tests/transcript-worker-stale-fencing.test.ts tests/transcript-worker-throughput.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/transcript-worker.ts lib/transcript-worker-handler.ts tests/transcript-worker.test.ts tests/transcript-worker-handler.test.ts
git commit -m "feat: rescue failed transcript jobs with Gemini analysis"
```

### Task 5: Operational Visibility, Documentation, and Full Verification

**Files:**
- Modify: `lib/video-research-status.ts:16-203`
- Modify: `lib/scheduled-video-handoff.ts:12-130`
- Modify: `tests/video-research-status.test.ts`
- Modify: `tests/scheduled-video-handoff.test.ts`
- Modify: `.env.example`
- Modify: `README.md:76-90`
- Modify: `docs/research-video-intake.md`

**Interfaces:**
- Consumes: persisted analysis status/label from Task 3.
- Produces: operator-visible summary-only counts and notes that do not claim canonical transcript coverage.

- [ ] **Step 1: Write failing visibility tests**

Assert summary-only rescues get their own summary count and per-video label; transcript state remains blocked/retryable rather than ready; source-check notes mention available Gemini pre-screening but remain `blocked` and do not increment usable transcript/evidence count; Market Motion and `canonicaliseIntake` source contracts still require real ready transcripts.

- [ ] **Step 2: Run focused visibility tests and verify RED**

Run: `node --test --experimental-strip-types tests/video-research-status.test.ts tests/scheduled-video-handoff.test.ts tests/market-motion-ingestion.test.ts tests/transcript-worker-contract.test.ts`

Expected: FAIL on missing Gemini status fields/counts.

- [ ] **Step 3: Implement visibility changes**

Extend the narrow Supabase selects and projection types with analysis status/provider only. Add `geminiSummariesAvailable` to the summary and `analysis: { state: "summary_only" | "failed" | "none"; label: string }` per video. Keep transcript state computation unchanged.

- [ ] **Step 4: Document configuration and provenance**

Add blank `GEMINI_API_KEY=` and `GEMINI_VIDEO_MODEL=gemini-3.8-flash` entries to `.env.example`. Document public-video-only preview behavior, `GEMINI_SUMMARY_ONLY`, retry preservation, and the prohibition on canonical evidence.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test --experimental-strip-types tests/video-research-status.test.ts tests/scheduled-video-handoff.test.ts tests/market-motion-ingestion.test.ts tests/transcript-worker-contract.test.ts`

Expected: PASS.

- [ ] **Step 6: Run full verification**

Run, in order:

```bash
npm test
npx tsc --noEmit
npm run test:persistence
npm run test:task-c
npm run build
git diff --check origin/main...HEAD
```

Expected: every command exits 0 with no new warnings. If an unrelated pre-existing failure appears, record the exact command and failing test instead of hiding it.

- [ ] **Step 7: Commit**

```bash
git add .env.example README.md docs/research-video-intake.md lib/video-research-status.ts lib/scheduled-video-handoff.ts tests/video-research-status.test.ts tests/scheduled-video-handoff.test.ts
git commit -m "docs: expose Gemini summary-only rescue status"
```
