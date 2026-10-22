# Blue Desk P−1 — raw readers, permissions and release proof

**Audit date:** 23 October 2026 · **Status:** BLOCKED / READ-ONLY INVENTORY · **Authority:** current Supabase live SQL inspection plus GitHub default-branch reader code. This record does **not** authorise a database grant change, production merge or Hybrid retirement.

## 1. Current production proof

Supabase project `qdtlrfgxpsnxajiptrno`, SQL catalog inspected read-only via authenticated connector. Never place a service-role credential or JWT in this report.

| Public object | RLS | Anon SELECT grant | Relevant RLS policy |
| --- | --- | --- | --- |
| `evidence` | Enabled | **Yes** | `public_read_evidence` SELECT `TO public` `USING (true)` |
| `research_source_registry` | Enabled | **Yes** | `public_read_research_source_registry` SELECT `TO public` `USING (true)` |
| `research_schedule_slots` | Enabled | **Yes** | `public_read_research_schedule_slots` SELECT `TO public` `USING (true)` |
| `hybrid_publication_snapshots` | Enabled | **No** | Owner/server-only private raw publisher |
| `story_events` / `story_thesis_versions` | Enabled | **No** | Private raw Story write-side history |
| `app_access_allowlist` | Enabled | **No** | Authenticated user's own approved address, active only |

Observed on 23 October: `evidence` has **128 rows, 109 active**, 14 distinct Story IDs; 21 rows have no source ID; 101 contain `ai_price_reason`; all 128 have detail and 120 carry nonempty `chart_series`. These are **column-presence statistics**, not evidence that the fields are safe, current, licensed or canonically accepted. Earliest created 31 July 2026, latest 1 October 2026 (UTC).

Default ACL of `postgres` in `public`: table/sequence client roles have been removed; **new function EXECUTE** still defaults to client roles. The `supabase_admin` defaults still grant table `arwdDxtm`, sequence `rwU` and function EXECUTE to `anon` and `authenticated`. Current authenticated `postgres` role is not authorised to change `supabase_admin` defaults. Refer to #849 for privileged platform path; no escalation or unauthorised SQL mutation.

## 2. Proven consumer map (source of truth is BOTH repositories)

| App | Current source and dependency | Cutover requirement |
| --- | --- | --- |
| Live | `clydigital/alchemy-live-market-desk` → `lib/data.ts` → `loadDeskData` | Direct `query<StoryEvidence>("evidence", select=*)`, 240 latest active rows. Also `loadStoryDetailSupport` selects 80 active rows for one Story. Preserve pages and original Story IDs. |
| Live | `lib/data.ts` → `loadDeskData` | Direct raw `research_source_registry select=*`; independent source-licence/owner usage audit required. |
| Hybrid | `clydigital/alchemy-hybrid-market-desk` → `lib/data.js` → `getPulseData` | Uses browser-public Supabase key and directly queries `evidence select=*` (240 active) and `research_source_registry select=*`. **Must migrate on its own deployed repo.** |
| Hybrid | `components/EvidenceGame.jsx`, `components/ResearchDeck.jsx`, `components/PulseOverview.jsx`, `components/StoryExplorer.jsx`, `components/EvidenceReviewCard.jsx` | Story association, claim/detail, strength, judgement, price stance/reason, chart series and review state may be rendered or interacted with; do not silently wipe from Journey/Evidence Game. Review for owner-write coupling. |
| Canonical Live → Hybrid | `app/api/internal/canonical-feed/route.ts` | Dedicated bearer and existing canonical publisher; **not** currently proof that every legacy evidence field is migrated or licensed. Do not substitute a whole raw Evidence table in this contract. |
| Schedules | `research_schedule_slots` | No independently verified anonymous consumer map yet. Do not revoke SELECT without scanning all direct and cross-app callers. |

## 3. Field-by-field admissibility (not yet approved)

`evidence` schema in production: `id, story_id, source_id, evidence_type, claim, detail, strength, created_at, ai_price_stance, ai_price_reason, chart_series, judged_asset, is_active`.

Potential identity/metadata projection: `id`, `story_id`, `source_id`, observation time, `evidence_type`, bounded `strength` and active flag **only after proving publisher semantics and source association**. Content fields `claim, detail, ai_price_stance, ai_price_reason, chart_series, judged_asset` need independent rights and source/method verification; raw AI interpretation and chart points **cannot** be assumed published or redistributable. Rows missing a source ID must not acquire an invented source witness. Verify an original source URL, chronology and field rights before user-facing publication.

Legacy `evidence` and canonical `intelligence_evidence` are different tables and must not be equated; Motion is non-evidentiary and never authorises a Story mutation.

## 4. Stop/go matrix

**Hold: no anon SELECT revoke** on `evidence`, `research_source_registry` or `research_schedule_slots` until all below are *independently* verified:

1. Field-by-field rights and public/owner read DTO review, source IDs and source clocks including zero-source rows.
2. Server-only Live read adapter with explicit columns, bounded pagination/as-of, stable original-source UUIDs, cache and DTO tests; no raw service key in client.
3. Independent Hybrid consumer migration and deployed read contract (not merely this Live repo's native Blue Desk feed); all `EvidenceGame`, Story, Journey and related pages preserved or deliberately retired with acceptance.
4. Valid current/archived exact editions and quiet/error/permission-denied cases against real persisted IDs.
5. Anonymous denied; approved owner, unauthorised owner, expired owner and **positive/negative** machine-token callers tested on both origins. Record response statuses and timestamps; SSO alone is not app authorization.
6. `research_source_registry` and `research_schedule_slots` caller inventory and rights review; dedicated platform path to fix `supabase_admin` defaults and future EXECUTE.
7. Shadow run/read-only comparison and rollback rehearsal; no deletion of backend/cron/auth/archives.

The pure helper `assessRawConsumerCutover` is a conservative **review preparation gate**, not a deployer; `READY_FOR_AUTHORISED_REVIEW` still requires explicit owner approval and current SQL/runtime evidence. It cannot change grants. `summariseLegacyEvidenceExposure` generates count-only diagnostics and intentionally never serializes a claim, AI rationale or chart point.

## 5. Current review environment

PRs #966 → #969 are source-integration drafts; #971 fixes exact older-than-24 edition reads; **PR #970 is preview-only and must never merge into main** because of its exact Git deployment exception. SSO-protected Vercel candidate `dpl_6FJvkK6rqrhsKxwrz3uR2j2nK8TL` is READY at SHA `d556b96218d7cb72448a4c0d790e494c9a747dba`. GitHub CI was green. Owner session, direct public/private runtime matrix and 360/768/1440 screenshots have **not** been certified because connected browsers are unavailable. READY is not approval to replace Live.

**Immediate next bounded coding PR:** create source-reviewed private Live legacy evidence DTO *only after licensing/admission rules are signed off*, then migrate Hybrid `getPulseData` on its own branch using a separately scoped server bearer, with no caller deletion. Keep raw `anon` SELECT until both current and archived Journey parity prove the replacement; only then propose audited SQL revoke in a separate reviewed migration.
