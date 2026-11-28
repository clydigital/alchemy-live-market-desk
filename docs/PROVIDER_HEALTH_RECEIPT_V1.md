# Provider health receipt v1 (MD1)

Internal operational diagnostics only; no new scheduler, paid provider, canonical writer or public exposure. Consumers in MD2–05 may read the contract but must not infer that every adapter already emits it.

## Envelope

- kind: provider_health_receipt_v1
- provider: registered primary provider identifier
- capability: requested capability identifier
- timestamp: UTC ISO-8601 completion timestamp
- state: healthy | recovered | degraded | failed | unknown
- cause: bounded machine code or null (credential_not_visible_at_runtime, auth, rate_limit, quota, budget_disabled, timeout, capability_mismatch, malformed_response, unknown); preserve original normalized provider codes
- fallbackAttempted: boolean
- attempts: ordered array of {provider, outcome: success | failed | skipped, cause, timestamp}
- residualCoverage: explicit bounded capability coverage; no inference of canonical persistence from retrieval
- nextRetry: UTC timestamp or null (null means no confirmed retry timestamp, not a new schedule)
- retryOwner: existing scheduler/worker identifier

Healthy requires successful primary retrieval of the requested capability; recovered requires an authorized fallback with equivalent capability; degraded means only partial or non-equivalent coverage (e.g. Gemini summary only, never a transcript); failed means no usable capability; unknown means no reliable attempt evidence. A skipped budget-disabled provider must report that cause explicitly and must not be invoked. Do not treat missing runtime visibility as proof of missing Vercel team shared configuration. Never include raw errors, payloads, keys, token-bearing URLs, private research, or user identifiers in this envelope.

Initial producer: existing leased transcript retrieval emits a structured server log at completion, including successful fallback or exhausted chain. The worker retains existing authority over retry/persistence and Gemini summary rescue. Other producers and durable readback/UI integration are not yet implemented by this contract. No additional provider probes, schedules or schema changes are authorized by this document.

FMP remains a separate capability-specific acceptance check; do not substitute unrelated issuer data for analyst estimates. X Wire third-party preview does not establish original-X verification or persisted coverage. Firecrawl/Jina publisher acquisition is not proof of original claim verification. 

## Additive producer persistence and discovery degradation
Successful transcript retrieval carries the sanitized envelope as `transcript.metadata.providerHealthReceipt`; the existing leased store writes it to the existing `research_intake_items.transcript_metadata` checkpoint together with the transcript, with no new store or write. The receipt describes retrieval, not completed interpretation or evidence. Failed attempt chain envelopes remain server logs; existing failure checkpoint fields retain failure code, retry clock and Gemini status, not the complete ordered chain. X discovery preserves the existing bounded public lead projection when only account coverage is unavailable, with accountsRead=false, unknown counts, complete=false and no-store. Total source-pool or incremental-ledger failure still fails closed. Sanitized stage diagnostics remain server-side.

Failed retrieval now also passes the locally generated ordered transport receipt through the normalized error, appends actual Gemini rescue outcome and retry clock, and writes the result to existing transcript metadata in the same lease-fenced failure checkpoint. Existing metadata keys are preserved via a lease-scoped read; if that read fails the prior failure/retry checkpoint still proceeds and receipt persistence failure is logged. This is the latest attempt per item, not an immutable history. No new storage, schema, or provider calls.

### 26 November — X Wire read partition isolation

Observed 15:19:25 MYT HTTP 503 followed by 15:19:59 HTTP 200 with 8/16 healthy but 0/16 fresh; no matching runtime log established the exact failing stage. All active account attempts were overdue in the inspected ledger. Public discovery can now retain redacted leads when one of the existing three bounded post partitions fails, exposes only aggregate partition counts and marks coverage incomplete/no-store. All-partition failure still returns 503; incremental errors remain fail-closed; strict collector/private pool callers still reject any partial read. Complete coverage now requires both freshness and healthy coverage across the full roster, as well as all partitions. No extra provider calls, new schedules, database writes or historical gap clearing. Existing 2/2.5h live freshness thresholds and actual collector cadence remain distinct; a successful HTTP response is not fresh acquisition.

### 26 November — redistribution of existing source-only retry opportunities

Owner approved moving two existing continuation retries, not adding cron entries. Keep 01:55/13:55 UTC primary continuation, all acquisition/watchdog, Research Gap, official actuals, video, dossier and GitHub fallback entries. Replace 02:15/14:15 UTC second continuation with existing authenticated intelligence-watchdog routes at 07:45/19:45 UTC (15:45/03:45 MYT). Exactly 38 Vercel entries remain, four continuation/retry invocations. Watchdog routes are source-only X retries; existing auth, schedule flag, lease/cooldown, retry-only eligibility, concurrency, 24s global provider budget and all caps remain. No paid provider, new route, task, schema or writer. When source-only disabled, relocated watchdogs return not_required before legacy execution; full legacy cadence rollback requires restoring the two original entries. Scheduled times are nominal, not guaranteed freshness; even ideal spacing cannot continuously meet 2/2.5h across all sources. Actual call use may differ because due-only eligibility changes; the existing per-invocation caps and invocation count remain, no promise that measured free-provider usage is identical. Validate actual post-deploy account timestamps at next relocated slot.
