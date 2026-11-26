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
