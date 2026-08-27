# TASK — SUPADATA PRODUCTION ACCEPTANCE REPAIR

Repository:
`clydigital/alchemy-live-market-desk`

Base:
CURRENT `main`.

Before editing anything, inspect the exact current `main` SHA. Do not work from a remembered SHA.

Source chat:
Current Alchemy Markets source chat — Supadata / creator-video intake failure discovered on 27 Aug 2026.

## READ FIRST — SMALLEST RELEVANT SOURCE SET

Read only what is necessary:

1. ALCHEMY_PROJECT_OPERATING_MANUAL
2. ALCHEMY_LIVE_HYBRID_REPAIR_EXECUTION_BRIEF
3. Current code for:
   - `lib/video-intake-service.ts`
   - `lib/video-intake-handler.ts`
   - `lib/supadata.ts`
   - `lib/supadata-transcript-store.ts`
   - `lib/transcript-pipeline.ts`
   - `lib/youtube-transcript-persistence.ts`
   - `lib/youtube-reliability.ts`
   - `lib/scheduled-video-handoff.ts`
   - `lib/scheduled-video-identity.ts`
   - relevant cron routes
   - `vercel.json`
4. Existing Supadata / video-intake tests.
5. PR #106 — “Use Supadata native captions for priority video intake”
6. PR #107 — FX Evolution Supadata eligibility follow-up
7. PR #108 — Supadata targeted retry repair

Inspect actual current code and history. Do not assume the diagnosis below is complete.

---

# PRODUCTION FAILURE TO EXPLAIN

The creator-video pipeline is supposed to be:

YouTube Data API discovery
→ persist discovered video
→ Supadata native-caption request
→ transcript persistence
→ video-run finalisation
→ Live consumes completed creator evidence.

Production evidence from 27 Aug shows:

StockedUp video:
`KHacM8aduWM`

Title:
`Nvidia CRUSHED Earnings — Get Ready For Tomorrow`

The video was successfully discovered and persisted.

But its persisted state was approximately:

- transcript_status = `missing`
- transcript_provider = null
- transcript_attempt_count = 0
- transcript_error_code = null
- transcript_http_status = null

The corresponding video run remained:

- status = `running`
- completed_at = null
- source_checks = []
- process_log stuck at `detect_new_videos: running`
- no meaningful heartbeat after startup.

Production history also showed several consecutive recent video jobs permanently stranded in `running`.

Earlier pre-Supadata runs completed discovery/finalisation even when TranscriptAPI subsequently failed.

PR #106 is therefore a strong regression boundary and MUST be audited carefully.

Another important production observation:

There are many previously ready creator transcripts persisted under `transcript_provider = transcriptapi`, but there was no confirmed successfully persisted `transcript_provider = supadata` transcript in production at the time of this investigation.

Do not assume Supadata itself is broken.

The current evidence says execution stops somewhere after the first discovered-video persistence and before a Supadata result is persisted.

---

# PRIMARY GOAL

Make the scheduled creator-video path robust enough that a real eligible StockedUp upload can complete:

discovery
→ canonical intake-item persistence
→ Supadata native-caption request
→ timestamped transcript persistence
→ transcript/run-state update
→ source-check finalisation
→ terminal video-run state.

The repair must also make the exact failure stage observable if any of those steps fail.

This is a bounded provider-integration/orchestration repair.

Do NOT redesign the whole research architecture.

---

# INVESTIGATION REQUIREMENTS

Before changing code, determine the actual first failing edge.

Pay particular attention to the sequence immediately after:

`ensureVideoIntakeItem(...)`

and before / inside:

- `store.findReadyTranscript(...)`
- `store.findVideoItem(...)`
- `retrieveSupadataVideo(...)`
- transcript persistence
- `recalculateRunState(...)`
- `finalizeVideoIntakeRun(...)`

Check for:

- persistence/query exceptions;
- stale assumptions introduced by `SupadataTranscriptStore`;
- incorrect run ownership when cached transcripts belong to an earlier run;
- provider provenance lookup failures;
- schema/query mismatches;
- lifecycle recalculation changing state unexpectedly;
- errors thrown before the Supadata HTTP call;
- uncaught errors that leave the run permanently `running`;
- timeout / function termination behaviour;
- missing heartbeat/finalisation protection;
- retry/idempotency problems;
- any difference between tests and the real scheduled runtime.

Do not guess.

Explain the identified failure mechanism in the PR.

---

# REQUIRED REPAIR BEHAVIOUR

## 1. Persist stage-level observability

A scheduled video run must expose meaningful stages such as:

1. create_run
2. youtube_discovery_started
3. youtube_discovery_complete
4. video_item_persisted
5. transcript_cache_checked
6. supadata_request_started
7. supadata_response_received
8. transcript_persisted
9. transcript_state_updated
10. source_checks_finalized
11. run_completed

Exact names may differ if current project conventions suggest better ones.

The persisted run must show the last successfully reached stage.

Do not rely solely on transient server logs.

## 2. Never leave failed executions permanently `running`

If the scheduled intake throws after run creation, persist a terminal or explicitly recoverable failure/degraded state including:

- stage
- error summary
- timestamp
- retryability where known.

A stale `running` row must not survive indefinitely with no heartbeat.

Add an appropriate stale-run recovery/watchdog mechanism if the existing architecture needs one.

Prefer deterministic/idempotent behaviour.

## 3. Commit discovery independently of transcript completion

Once YouTube discovery has completed, persist the source-check/discovery result before transcript work begins.

For example, if StockedUp is successfully checked and one upload is found, that fact must survive even if Supadata later fails.

Do not wait until the entire transcript lifecycle finishes before preserving the discovery outcome.

Live should still fail closed on unavailable transcript evidence where appropriate, but diagnostics must distinguish:

- discovery failed
- no new uploads
- upload discovered
- transcript pending
- transcript failed
- transcript complete.

## 4. Supadata must remain the primary scheduled transcript provider

Do not reintroduce TranscriptAPI.

Current intended provider behaviour remains:

- Supadata
- native captions only
- `mode=native`
- `text=false`
- English request where current policy specifies it
- timestamped transcript
- no generated-transcript fallback
- DB-first cache
- bounded provider spend
- debt/retry semantics preserved.

## 5. Add a production-safe Supadata canary / targeted acceptance path

Create or strengthen a narrowly scoped manual test path capable of validating a single already-discovered video ID without running the entire research pipeline.

It should be suitable for testing a video such as:

`KHacM8aduWM`

Expected behaviour:

- verify the video exists in canonical intake state;
- use the real configured `SUPADATA_API_KEY` at runtime;
- call Supadata native-caption mode;
- return/persist a clear provider result;
- increment transcript attempt state correctly;
- record provider = `supadata`;
- persist success or an exact classified failure;
- update relevant transcript/run state;
- never silently fall back to another provider.

The endpoint/workflow must be authenticated and safe.

Do NOT execute this canary against production or mutate production data unless explicitly authorised after review.

## 6. Make provider failures diagnosable

If Supadata returns:

- auth error
- missing transcript
- 206 unavailable
- rate limit
- timeout
- malformed response
- provider/server error

the persisted intake item and run must clearly show that result.

If execution fails BEFORE Supadata is called, the persisted state must make that equally obvious.

## 7. Preserve architecture

Live remains the sole canonical research/intelligence owner.

Do not add Story reasoning to the video subsystem.

Do not change Hybrid.

Do not add the proposed YouTubeToTranscript.com browser fallback in this PR.

That fallback is intentionally OUT OF SCOPE and should only be kept in mind for a later resilience layer.

---

# SCHEDULING OBSERVATION

Current project state has had a timing mismatch around video intake and Live research.

Inspect the current code before changing anything.

The intended long-term orchestration is:

video intake completes
→ then Live research begins

rather than relying solely on a guessed fixed delay.

However, do not expand this bounded repair into a large scheduler redesign unless the Supadata failure cannot be fixed safely without touching that edge.

If scheduling/identity mismatch is directly relevant, make only the smallest necessary correction and document any remaining orchestration debt separately.

---

# TEST REQUIREMENTS

Add regression coverage that would have caught the production failure.

At minimum test:

1. discovered StockedUp video proceeds beyond `ensureVideoIntakeItem`;
2. real provider function is reached by the scheduled path;
3. successful Supadata result persists:
   - transcript_status = ready
   - transcript_provider = supadata
   - transcript_attempt_count increments
   - timestamped transcript data retained;
4. Supadata failure persists exact provider/error state;
5. error before provider invocation persists a terminal/recoverable run failure;
6. discovery/source checks remain persisted even if transcript processing fails;
7. rerunning the same scheduled run/video is idempotent;
8. cached transcripts do not consume provider budget;
9. old cached TranscriptAPI transcripts remain readable without falsely claiming Supadata provenance;
10. stale runs cannot remain indefinitely `running`;
11. no generated transcript fallback can occur;
12. no TranscriptAPI provider request remains in scheduled or targeted paths;
13. existing debt/retry semantics still work;
14. existing scheduled-video → desk handoff tests remain valid.

Run the focused tests, then the full repository test suite and production build/typecheck.

---

# PRODUCTION ACCEPTANCE TARGET

Do NOT claim this repair is fully production-proven merely because unit tests pass.

The final PR report must state that the ultimate production acceptance test is:

eligible creator upload
→ YouTube discovery ✅
→ Supadata request ✅
→ native transcript ✅
→ DB shows `transcript_provider = supadata` ✅
→ transcript_status = ready ✅
→ attempt count >= 1 ✅
→ video run reaches terminal completed/degraded state ✅
→ source checks persist ✅
→ a subsequent Live cycle can see the creator transcript ✅

If production execution has not been explicitly authorised, leave this as the post-merge acceptance procedure rather than running it yourself.

---

# SCOPE / SAFETY

- Work from current main only.
- Keep the repair narrow.
- No Hybrid changes.
- No Story reasoning changes.
- No browser-automation fallback yet.
- No destructive database changes.
- Do not manually rewrite production research rows.
- Do not merge.
- Do not deploy.
- Do not run a production transcript retry without explicit approval.
- Preserve replay/idempotency.
- Preserve canonical provenance.

---

# DELIVERABLE

Prepare a PR against current `main` containing:

1. root-cause explanation;
2. smallest correct repair;
3. stage-level persistence/diagnostics;
4. robust terminal-state handling;
5. production-safe single-video Supadata acceptance path;
6. regression tests;
7. full test/build results;
8. exact remaining production acceptance steps.

In the final response provide:

- current main SHA inspected;
- root cause;
- files changed;
- why the repair fixes the real production failure;
- focused test results;
- full suite/build results;
- PR number/link;
- exact production canary procedure;
- any remaining risk or follow-up work.

Do not merge or deploy.
