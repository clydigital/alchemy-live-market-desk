# Blue Desk redefinition — System 1 / System 2 boundary

Status: implementation foundation; no changes to canonical reasoning or production publication.

## Authority

| Layer | Purpose | May publish factual news? | May mutate canonical Story? |
| --- | --- | --- | --- |
| System 1 (MacroPulse, discovery, Research Gap) | Detect developments and open questions | Only after independent source verification and news admission | No |
| System 2 (existing Dossier V2) | Adjudicate evidence and Story thesis | Not its primary function | Yes, exclusively through existing canonical thesis-version path and evidence IDs |
| Motion | Bounded context, signals and hypotheses | Only if underlying claims are independently verified | No; Motion is not evidence |
| Blue Desk public read projections | Display verified News, Stories, Markets, research and divergence | Display approved published facts | No |
| Divergence read analysis | Compare expectations to measured reaction; enumerate and test explanations | Display timestamped measurements with provenance | No |
| Private Presenter Prep | Reconcile owner technical checks with canonical interpretations | No public publication authority | No |

## Enforced invariants

1. Do not create a third Story writer, new reasoning engine or new reasoning table.
2. Only canonical evidence UUIDs justify a Story thesis mutation.
3. System 1 discovery and Motion are not evidence, even when they link to a source.
4. News can be source-verified and publishable without an accepted Story thesis change.
5. Historical editions resolve by exact ID; never fall back to latest or mix in future evidence.
6. Market observations must carry instrument, units, timestamp, reporting period and original source; a price move alone does not establish causality.
7. Divergence outcomes are YES, NO, PARTIAL or UNKNOWN; unknown inputs remain unknown.
8. Owner technical analysis and operations are never included in anonymous public responses.
9. Preserve all current backend APIs, cron, provider jobs, canonical tables and archives.
10. Public and owner readers may share projection code but must not share authorization scope.

## First build gate: permission and exact-read regression baseline

- Inventory app routes and APIs into PUBLIC_APPROVED, OWNER_ONLY, MACHINE_ONLY or INTERNAL.
- Verify anonymous/owner/unauthorized/expired/machine access against actual deployments and RLS.
- Freeze one real AI, rates and oil edition fixture with IDs, timestamps and source provenance; mark unavailable data as unavailable.
- Test valid exact edition, older-than-24 edition, missing ID, mismatched Story/edition, malformed ID and post-edition evidence contamination.
- Verify the homepage independently admits source-verified factual News without requiring Story mutation.
- Stop public cutover if owner notes, raw research or operational endpoints are anonymous-accessible.

## Current repository observations (2026-10-25)

- `app/blue-desk/page.tsx` already separates editorial Story eligibility, verified news fallback and frozen source-fact fallback. Preserve that separation.
- `app/blue-desk/stories/[articleId]/page.tsx` already calls `getHybridExactDailyBriefEdition` and validates article/edition pairing. Regression-test this implementation rather than assuming the earlier latest-24 limitation still applies.
- `lib/supabase/config.ts` returns true for `dashboardAuthRequired()` only when `DASHBOARD_AUTH_REQUIRED === "true"`. Effective deployment configuration and endpoint authorization remain to be audited; this source observation does not establish a leak.

## Scope of this branch

This initial commit freezes architecture and test requirements. It does **not** change authorization, run migrations, deploy, modify System 2 or claim the security gate has passed.
