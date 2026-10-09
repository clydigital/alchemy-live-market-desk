# Gemini Video Analysis Rescue — Design

## Status

Approved conversational design. Written specification awaiting review.

## Goal

Add Gemini public-YouTube analysis as a resilient, analysis-only rescue lane after the configured transcript transports fail. The lane must preserve useful creator intelligence without claiming that Gemini recovered a transcript or produced canonical evidence.

The production source of truth is `origin/main` in `clydigital/alchemy-live-market-desk`.

## Existing flow

The current transcript worker keeps one leased job while extraction fails over through:

```text
Supadata
→ Chrome / YouTubeToTranscript
→ TranscriptAPI
```

The repository does not currently contain a JumpWatch client. JumpWatch is outside this change until its API and operating contract are available.

After extraction, a real timestamped transcript is persisted, reviewed, and canonicalised. Two existing gates already protect provenance:

- `canonicaliseIntake(...)` rejects video rows unless `transcript_status = ready`;
- Creator Market Motion ingestion requires both `transcript_status = ready` and `video_review_status = reviewed`.

The Gemini lane must not weaken either gate.

## Target flow

```text
Supadata
→ Chrome / YouTubeToTranscript
→ TranscriptAPI
→ classify final transcript outcome
   ├─ VIDEO_UNAVAILABLE
   │  └─ preserve terminal video state; do not call Gemini
   └─ TRANSCRIPT_PROVIDER_FAILED
      ├─ Gemini configured and no saved rescue
      │  └─ analyse public YouTube URL
      │     ├─ save GEMINI_SUMMARY_ONLY
      │     └─ preserve original transcript retry/debt state
      └─ Gemini absent/failed
         └─ preserve original transcript retry/debt state
```

Gemini success enriches the intake record. It does not make the transcript job successful.

## Core invariants

1. Gemini is a video-analysis provider, never a `TranscriptProvider`.
2. Gemini output never populates `transcript_text`, `transcript_segments`, `transcript_language`, or `transcript_provider`.
3. Gemini success never sets `transcript_status = ready`.
4. Gemini success never sets `transcript_job_status = completed` and never creates `transcript_evidence_id`.
5. The original transcript failure, retryability, next-attempt time, and research debt remain authoritative.
6. A later real transcript may proceed through the existing review and canonical evidence path.
7. Private, members-only, unlisted, deleted, invalid, and upcoming videos do not enter the Gemini public-URL lane when the system has deterministic evidence of that state.
8. Ambiguous provider failures are not promoted to `VIDEO_UNAVAILABLE` merely from error-message guessing.
9. Gemini output is labelled `GEMINI_SUMMARY_ONLY` wherever it is stored or shown.
10. The absence of `GEMINI_API_KEY` disables the rescue lane without breaking transcript processing.

## Failure classification

Add a small deterministic classifier with two public categories:

```ts
type VideoRetrievalFailureKind =
  | "VIDEO_UNAVAILABLE"
  | "TRANSCRIPT_PROVIDER_FAILED";
```

`VIDEO_UNAVAILABLE` is limited to structural codes already supported by the transcript domain, including:

- `video_private`;
- `video_deleted`;
- `video_not_found`;
- `invalid_video_url`;
- additional explicit access codes introduced for members-only, unlisted, or upcoming videos.

Provider, browser, network, timeout, rate-limit, payment, missing-caption, and language-availability failures classify as `TRANSCRIPT_PROVIDER_FAILED`. In particular, `transcript_missing` remains eligible because a public video may still be analyzable even when captions are absent or delayed.

The intake row stores this coarse classification separately from the exact provider error code.

## Gemini API client

Add a server-only Gemini client using Google's supported `@google/genai` SDK and `GEMINI_API_KEY`.

The client accepts the canonical public YouTube URL, uses the stable `gemini-3.8-flash` model by default, and requests structured JSON. `GEMINI_VIDEO_MODEL` may override that default. Model and prompt versions are persisted with every result.

Required result fields:

```ts
type GeminiVideoAnalysis = {
  schemaVersion: "gemini-video-analysis/1";
  accessStatus: "full" | "partial" | "unavailable";
  mainThesis: string;
  directionalBias: "bullish" | "bearish" | "neutral" | "mixed" | "unclear";
  conviction: "high" | "medium" | "low" | "unclear";
  claims: Array<{
    text: string;
    classification: "creator_claim" | "observable_content" | "inference";
    timestampSeconds: number | null;
    figures: string[];
    dates: string[];
    requiresVerification: boolean;
    verificationTarget: string | null;
  }>;
  uncertainty: string[];
  contradictions: string[];
  summary: string;
};
```

The prompt explicitly forbids invented facts, quotations, and timestamps. Runtime validation rejects malformed output and timestamps that are negative or otherwise invalid.

## Persistence

Extend `research_intake_items` with analysis-specific fields rather than overloading transcript fields:

```text
video_retrieval_failure_kind
video_analysis_status
video_analysis_provider
video_analysis_model
video_analysis_prompt_version
video_analysis_payload
video_analysis_attempted_at
video_analysis_completed_at
video_analysis_error_code
video_analysis_error_message
```

`video_analysis_status` uses:

```text
not_attempted
summary_only
failed
not_applicable
```

`summary_only` is the only Gemini success state. The structured payload contains the complete analysis and its labels. The existing `summary`, `creator_logic`, `claim_checks`, and transcript review fields are not overwritten, preventing downstream code from mistaking Gemini analysis for transcript review.

The migration updates the latest `claim_transcript_jobs` return contract so a claimed job carries its saved analysis status. This makes rescue idempotent: a retrying transcript job does not pay for or duplicate an already saved Gemini analysis.

## Worker orchestration

Keep transcript transport failover inside `retrieveTranscriptForWorker(...)`.

Add Gemini rescue at the extraction-failure boundary in `processTranscriptJob(...)`, after the final transcript error has been normalized. The worker receives two new injected operations:

```ts
analyseVideo?: (job: ClaimedTranscriptJob) => Promise<GeminiVideoAnalysis>;
saveVideoAnalysis(...): Promise<void>;
saveVideoAnalysisFailure(...): Promise<void>;
```

Processing order:

1. Normalize the final transcript failure.
2. Classify it.
3. Persist the transcript failure exactly as today.
4. If the failure is eligible, Gemini is configured, and no summary is already stored, attempt Gemini analysis.
5. Persist Gemini success or failure independently.
6. Return the original transcript outcome (`retryable` or `blocked`) so transcript lifecycle semantics remain unchanged.

Gemini failure never replaces or masks the original transcript error.

## Operational visibility

Extend video research status with summary-only counts and per-video analysis labels. A creator with Gemini analysis remains transcript-degraded, but operators can see that a pre-screening result exists.

Scheduled source checks may mention available summary-only analysis in their note, but they must not report canonical transcript coverage or increment canonical creator-evidence counts.

The Gemini payload is available to an intelligence operator or a later research-lead workflow. It is not admitted into `intelligence_evidence`, Creator Market Motion, Story reasoning, Regime reasoning, or Dossier reasoning by this change.

## Security and configuration

- `GEMINI_API_KEY` is server-only and never returned to clients or committed.
- The lane is disabled when the key is absent.
- `GEMINI_VIDEO_MODEL` may override the default model without a code change.
- Public YouTube HTTPS URLs are the only accepted remote input.
- Logs include video ID, model, prompt version, duration, status, and sanitized error code; they exclude the key and full provider payload.
- Request timeout and output size are bounded.

## Expected files

Likely add:

- `lib/video-retrieval-failure.ts`
- `lib/gemini-video-analysis-contract.ts`
- `lib/gemini-video-analysis.ts`
- `tests/video-retrieval-failure.test.ts`
- `tests/gemini-video-analysis.test.ts`
- one Supabase migration for analysis fields and the claim RPC contract

Likely modify:

- `lib/transcript-worker.ts`
- `lib/transcript-worker-handler.ts`
- `lib/supabase-transcript-worker-store.ts`
- `lib/video-research-status.ts`
- `lib/scheduled-video-handoff.ts`
- focused worker, store-contract, status, and handoff tests
- `package.json` and lockfile for `@google/genai`
- environment/configuration documentation

## Test requirements

Tests must prove:

1. Structural video failures classify as `VIDEO_UNAVAILABLE`.
2. Provider and caption failures classify as `TRANSCRIPT_PROVIDER_FAILED`.
3. Gemini is called only after the transcript chain fails with an eligible category.
4. Gemini is skipped when no key is configured.
5. Gemini is skipped for deterministic unavailable-video states.
6. Gemini is skipped when a summary-only payload already exists.
7. Gemini success preserves the original transcript failure and retry schedule.
8. Gemini failure does not mask the transcript error.
9. Structured output validation rejects invented/invalid shapes and invalid timestamps.
10. Persistence never writes Gemini output into transcript fields.
11. `canonicaliseIntake(...)` continues to reject summary-only video rows.
12. Market Motion continues to require a real ready transcript and reviewed state.
13. Status surfaces distinguish transcripts from Gemini summary-only rescues.
14. The full test suite, typecheck, production build, and applicable Supabase contract tests pass.

## Acceptance criteria

The change is complete when:

1. A failed transcript chain can produce a persisted, structured Gemini summary for a public video.
2. The ledger distinguishes `VIDEO_UNAVAILABLE` from `TRANSCRIPT_PROVIDER_FAILED`.
3. Every Gemini result is explicitly marked `GEMINI_SUMMARY_ONLY`.
4. No Gemini result can satisfy transcript-ready, completed-transcript-job, canonical-evidence, or Market Motion gates.
5. Transcript retries continue after Gemini success.
6. Existing successful transcript behavior is unchanged.
7. Missing Gemini configuration is harmless and observable.
8. The required server secret and preview/public-video limitations are documented.

## Explicit non-goals

- Building a JumpWatch client without an API contract.
- Recovering verbatim transcripts from Gemini output.
- Treating generated quotations as evidence.
- Supporting private, members-only, unlisted, or upcoming videos through Gemini public URLs.
- Allowing Gemini analysis to create canonical evidence.
- Automatically verifying creator claims inside the Gemini request.
