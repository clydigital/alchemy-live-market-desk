# Bluebelly Figtree + plugin handoff pre-production acceptance

Date: 28 October 2026. This is a rollout check, **not** proof of autonomous plugin-to-Supabase ingestion.

## Typographic authority

The single production font is **Figtree** via `next/font/google` on root layout, exposed as `--font-figtree` and `--bluebelly-font`. This applies to headlines, news cards, Regime Watch, input fields, chart text, private Presenter, researcher screens, printed drafts, shared technical checks and code snippets. Text size remains adjustable. No individual page may replace the typeface with Georgia, Arial, Inter or monospace. SVG wordmark explicitly prefers Figtree but embedded SVG/image fallbacks depend on the user's available font; type shown in normal HTML uses the self-hosted font.

## Live routing contract for the two installed Alchemy plugins

Both installed user-scoped plugins were inspected through their actual current manifest/skill sources, not inferred from a name.

- `alchemy-research-suite`, version 0.1.5: its `bluebelly-platform-router` and original-source audit instructions name Bluebelly the intended destination and preserve upstream research ownership.
- `alchemy-research-workflows`, version 0.1.5: its `bluebelly-story-compiler` produces source-labelled story writing and creator commentary; it does not itself admit canonical evidence.

The current **implemented** destinations are:

| Work product | Live route | Access and limitation |
|---|---|---|
| Qualified original-source news | `/newsroom` | Public; `NewsBriefV1` / qualified original release only |
| Ongoing thematic research | `/regime-watch` | Public; historical public Story snapshots, **not** actual current canonical Regime status |
| Broader published Story history | `/key-stories` | Public; existing governed public projection |
| Markets and yield observations | `/markets` | Public; measured observations with timestamps |
| Catalysts and earnings | `/calendar` | Public; source-event date rules |
| Public daily report | `/daily-report` | Public; existing published/read-only pipeline |
| Private editorial and source investigation | `/owner/research`, `/owner/x-wire`, `/owner/editorial` | Authenticated; any redirect from editorial remains an existing internal decision |
| Presenter technical checks | `/owner/presenter` | Authenticated/allowlisted |
| Owner delivery/reports | `/my-reports`, `/owner/daily-report` | Authenticated/allowlisted |

**Not implemented as a separate live route:** Creator Summary / Creator Intelligence UI, dedicated Power Stack private portfolio UI, canonical Regime public status adapter. Plugin documentation describing these as future Bluebelly sections is a routing intent and must **not** be represented as deployment proof. Use owner research and original transcript ledger until feature-level readback exists. Legacy Live/Hybrid remains only backend compatibility.

## Ingestion and pre-production proof rules

1. Plugin result or Notion page alone is not proof of canonical DB ingestion, Newsroom appearance, or publication. Each hop requires source ID, source URL, publisher, as-of, observed-at, status, and actual write/readback receipt where applicable.
2. A creator video or X post is a **lead**, not verified news, and cannot directly change a Story/Regime. A source-verified press update can show in public Newsroom without changing a regime.
3. Keep current five ChatGPT schedules and existing Vercel crons; no new task, duplicate reasoning table or read/write endpoint.
4. CI must pass new Figtree/route tests, full existing test suite, Task C, TypeScript, Next build and PostgreSQL contract tests before main merge.
5. Pre-production means the full GitHub pull-request suite, Task C, TypeScript, Next build, PostgreSQL contracts and source/route regression tests. A further Vercel preview can be used only if its existing deployment policy permits; project-level Ignored Build Step currently skips every non-main branch, even when a branch-specific `vercel.json` exception is attempted. No preview should be claimed READY when Vercel reports CANCELED. Cron/workers must not be manually fired to prove a visual patch.
6. Production promotion: GitHub squash merge only after all checks; verify Vercel deployment READY with exact merge commit SHA and actual `bluebelly-desk.vercel.app` alias.
7. Post-promotion smoke: Today, Newsroom, Regime Watch, Markets, Daily Report all resolve; `/owner/presenter` remains a private route; font is visually checked on desktop and mobile where screenshot/browser access permits.
8. Preview attempted on the Figtree branch: Vercel cancelled the deployment because the project-level ignored build step ran `if [ \"$VERCEL_GIT_COMMIT_REF\" = \"main\" ]; then exit 1; else exit 0; fi`. The temporary branch exception was reverted, and the original project ignore-step value was re-submitted. Do not claim preview visual or pixel parity. Once CI is green, main production deployment must be verified by exact commit/alias and browser access separately.

## Specialist plugin compatibility follow-up

Both installed plugin releases were updated to 0.1.5 with corrected Bluebelly navigation prompts and a deployed-route reference, and readback confirmed prior skill files persisted. Some specialist skill text still says Live/Hybrid layout when discussing legacy Dossier provenance. The current controlling Bluebelly-first platform skills override the *destination* but not the Dossier's evidence ownership. Revise the legacy phrasing in a separately versioned plugin release after confirming the Creator Summary/public-Regime feature status; do not release fabricated routes. The plugin release updates were performed separately via owned Plugin Creator release IDs; they are **not** application repository code and do not prove backend source ingestion.
