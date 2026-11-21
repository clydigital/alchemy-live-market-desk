# Creator roster repair — staged, not activated

The Work workflow monitors eleven approved creators, but production discovery, transcript selection and the SQL claim gate only recognised five. The scheduled canonical desk source contract recognises four. Newly added Work creators therefore cannot become production transcript reviews simply by being listed in the task prompt.

This patch shares the eleven approved identities between discovery, selection and legacy placeholder eligibility. Exact original video ID deduplication, Shorts/live exclusions, existing per-invocation batch/time limits, leases, service-role-only access and attribution remain unchanged. Discovery failure remains explicit rather than "no uploads". No transcripts, claims or owner records are committed here.

## Activation gates

1. Generate an additive timestamped migration using the Supabase CLI from `docs/sql/creator-roster-claim-repair.sql`, compare with the current production function, and run actual SQL claim contracts for a newly authorised publisher, unknown publisher, malformed ID, cooldown, unexpired lease, expired lease and denied anon/authenticated execution. This proposed SQL is not itself a migration or runtime acceptance receipt.
2. Preserve the existing Work 18-per-MYT-day policy and included-provider spending limits. The production leased worker currently has per-invocation capacity, not a verified shared Work/production day reservation. Do not enable a larger paid-provider queue or claim the shared ceiling is enforced until the existing durable intake path supplies a verified combined budget. No new schedule or provider purchase.
3. Validate the exact original channel for each new handle; ClearValueTax is pinned to its approved official channel ID. A handle/name mapping is configuration, not original source authentication. Keep Fireship/Code Report limited to substantive AI/compute/adoption and investor-relevant material and retain remaining channel-specific eligibility rules from the existing Work contract.
4. Run full tests, TypeScript, production build and database contracts. Inspect active production SHA and a bounded next scheduled discovery/worker receipt only after the SQL and budget gates pass.
5. Reconcile exact IDs with existing ready/reviewed rows before any provider call. Notion receipt and Library sync remain separate. No direct "reviewed" flag writes.
6. The scheduled canonical desk source contract and public score readers keep their existing narrower approval scope. This PR does not expand canonical/public source admission or equate eleven discovery entries with eleven healthy/admitted feeds. Verify any later consumer expansion separately.

The current local executor is unavailable. The staged SQL, source checks and tests are reviewable in this branch; no production database change, provider call, new automation or automatic publication is performed by this patch. Do not merge/deploy as an end-to-end eleven-creator repair before these gates are satisfied.

## Additional legacy-claim defect verified read-only

With production `standard_conforming_strings=on`, the inherited double-backslash YouTube URL regular expression does not match an ordinary valid watch URL. A read-only SQL comparison returned inherited=false and correctly escaped=true. The proposed SQL corrects only that literal's escaping while retaining the same anchored HTTPS host, exact eleven-character ID and query-tail rules. This correction is not applied to production in this PR. Current pending/retryable claims are distinct from the legacy-blocked-placeholder branch; do not assume this defect explains all missing videos.
