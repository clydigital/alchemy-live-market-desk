# Research Update Engine

Desk 1, the Alchemy Live Market Desk, is the canonical research system. Desk 2,
the Hybrid Market Desk, only adapts a completed and validated Desk 1 run. It
does not crawl sources, transcribe videos or generate a separate research view.

## Four-slot schedule

All times use `Asia/Kuala_Lumpur`.

| Time | Slot key | Owner | Purpose |
| --- | --- | --- | --- |
| 00:40 | `video_midnight` | Video intake | Discover new creator videos, obtain transcripts, independently review or listen, label claims and research unfamiliar jargon. |
| 08:30 | `morning` | Desk 1 | Run the full news, data, calendar and Market Insights scan. Consume validated video intake, compare two prior Desk 1 days, select focus and publish. |
| 11:30 | `video_late_morning` | Video intake | Capture videos published after the first intake and prepare them for the evening desk. |
| 22:00 | `evening` | Desk 1 | Scan the assigned desk sources for deltas, consume validated video intake, rerun freshness and evidence gates, and publish only material changes. |

The slots are intentionally non-overlapping. Video slots check only creator
channels. Desk slots check only news, Alchemy data and calendars. This prevents
the same source work being repeated at adjacent times.

Before discovery, read `GET /api/research-update`. Use the latest completed run
for the same source-owning slot as the cutoff. Reuse an existing `itemKey` when
referencing earlier evidence; the API will not move that item to a newer run.

## Source assignments

### Video intake sources

Every video run records `checked`, `no_new_items` or `blocked` for all eight:

- `fx-evolution`: FX Evolution
- `kevin-gerrity`: Kevin Gerrity
- `clearvalue-tax`: ClearValue Tax
- `stockedup`: StockedUp
- `wall-street-truth-bombs`: Wall Street Truthbombs
- `tradernick`: TraderNick
- `traders-reality`: Traders Reality
- `beginner-trading`: Beginner Trading

Creator videos are Tier 5 discovery material. They can contribute ideas,
framing, causal logic and questions. They cannot verify their own claims.

### Desk 1 sources

Every morning and evening run records a status for all eight:

- `zerohedge`: fast discovery and alternative framing
- `axios`: business, policy and geopolitical context
- `investing-com`: market reporting, releases and consensus context
- `fxstreet`: FX, rates and macro reporting
- `alchemy-data-tables`: current Alchemy market, macro and evidence records
- `economic-calendar`: scheduled economic catalysts through the next seven days
- `earnings-calendar`: scheduled company catalysts through the next seven days
- `alchemy-market-insights`: the 30 most recent dated articles only

The four publications are discovery and cross-assessment sources. Material
claims still need independent dated evidence, with official releases, filings,
direct statements and primary datasets preferred.

## Video workflow

A retained video must complete these steps in `processLog`:

1. `discover`
2. `transcribe`
3. `review_video`
4. `extract_claims`
5. `research_jargon`
6. `cross_assess`

Use an official transcript when available. Otherwise use
YouTubeToTranscript.com. `transcriptProvider` must be `official` or
`youtubetotranscript.com`, and `transcriptStatus` must be `ready` before the
video can affect a story. A title, description or generated summary is not a
transcript.

Set `videoReviewStatus` to `reviewed` after watching the relevant sections or
`listened` after independently listening. `transcript_only` does not pass the
video gate. Record the creator's reasoning in `creatorLogic`, then write a
separate `recontextualizedSummary` using Alchemy data and independent sources.

Every material creator claim receives one of these labels:

- `verified`: independent evidence supports the claim as stated.
- `partly_verified`: a bounded portion is supported, with caveats recorded.
- `contradicted`: stronger independent evidence conflicts with the claim.
- `outdated`: the claim may have been accurate for an earlier period but is no longer current.
- `unverified`: evidence is insufficient. The claim cannot support publication.

For each unfamiliar term, populate `termsDetected` and a matching
`jargonResearch` record covering meaning, measurement, assumptions, correct
usage, materiality and dated source links. Missing research rejects the run.

## Desk 1 workflow

A morning or evening run must complete these `processLog` steps:

1. `discover`
2. `consume_video_intake`
3. `cross_assess`
4. `calendar_scan`
5. `compare_desk_history`
6. `select_desk1`
7. `publish_desk1`

Both `economic` and `earnings` calendar checks must cover the scheduled time
through the next seven days. `previousDeskDays` must contain exactly the prior
two Desk 1 dates and their lead story and angle keys.

`storyFocus` records the proposed and final decision for each candidate. The
validator applies these rules deterministically:

- Prefer events from the previous 72 hours.
- Admit a story with a named catalyst in the next seven days.
- Admit an older story only when `materialChange` is true and the reason is explicit.
- Reject `cosmeticRewrite` candidates.
- Demote stale lead or top-three candidates to `background`.
- Demote a repeated lead from either prior Desk 1 day unless a material development is recorded.
- Permit at most one final lead.
- Record at least one decision per Desk 1 run and permit at most three active focus stories. A no-change run records background instead of publishing an empty state.

When a story has a meaningful geopolitical transmission channel, include a
`geopolitics` expert note. When it depends on pricing, positioning, rates,
liquidity, volatility or cross-asset transmission, include a `markets` expert
note. Each required note states its context, assessment, transmission path and
supporting evidence where available.

## Publication gates

A structurally invalid payload returns `422` and is not stored. A structurally
valid run can be stored as `blocked` so the next cycle can repair it.

Desk 1 publication opens only when all of these are true:

- Every source assigned to the slot was checked or had no new items.
- Every required process step completed.
- Both seven-day calendar checks completed.
- Retained video evidence has an approved transcript and independent review or listen.
- Referenced persisted intake belongs to a completed run and has an accepted or published disposition.
- Final lead and top-three choices satisfy freshness rules.
- Each recalibration links to at least four distinct dated HTTPS evidence URLs.
- No linked video contains an unverified material claim.
- The deterministic market accuracy gate is open.

Confidence can move by at most eight points in one run. A positive move writes
a `confirmation` update, a negative move writes a `contradiction`, and a zero
move writes a `status` update. Publication is idempotent for the same story,
headline and observation time.

## Persistence

The applied Supabase pipeline stores:

- `research_runs`: source checks, process log, calendar checks, all gate states,
  counts, warnings and completion status.
- `research_intake_items`: transcript provenance and text, review status,
  creator logic, recontextualised summary, claim checks, jargon research,
  expert notes, freshness score, evidence and disposition.
- `research_story_focus`: proposed and final Desk 1 decisions, freshness status,
  material-change reason, demotion reason, catalysts, evidence keys and expert notes.
- `story_updates` and `stories`: only the Desk 1 changes that pass every gate.

The private views `research_run_status`, `research_intake_queue` and
`research_focus_queue` are read server-side with the service role. The UI and
public APIs never receive raw transcript text.

The live project `qdtlrfgxpsnxajiptrno` already contains migration
`20260805051227 upgrade_research_pipeline_schema`, including the four slot
constraint and fields above. Migration
`20260805080423_harden_research_pipeline_views` does not recreate that schema;
it makes the three operational views security-invoker and readable only by the
service role after a database-advisor review found broad grants on the two older
views. Do not recreate the pipeline migration unless a fresh schema inspection
proves that it is absent or incomplete.

## API contract

`GET /api/research-update` returns:

- the four schedule definitions and timezone
- Desk 1 and Desk 2 ownership policy
- health for the latest due instance of each slot
- recent private run, focus and intake views without transcript text

`POST /api/research-update` requires `Authorization: Bearer
<RESEARCH_UPDATE_TOKEN>`. The TypeScript payload contract is
`ResearchRunInput` in `lib/research-update.ts`.

Validate without writing, then publish:

```powershell
$env:RESEARCH_UPDATE_TOKEN = "<server token>"
npm run research:publish -- run.json --dry-run
npm run research:publish -- run.json
```

`GET /api/hybrid-feed` is contract version 2. Its `research` object contains:

- `contract`: Desk 1 canonical ownership and `independentIngestion: false`
- `desk1Run`: the latest completed `morning` or `evening` run
- `focus`: non-rejected focus decisions from that run
- `evidence`: accepted or published intake explicitly referenced by that focus
- `monitoring`: blocker counts only, never blocker content as a Desk 2 input

## Secrets and failure handling

`SUPABASE_SERVICE_ROLE_KEY` and `RESEARCH_UPDATE_TOKEN` are server-only secrets.
They must not use a `NEXT_PUBLIC_` prefix or appear in a payload, transcript,
source record, commit, log or automation prompt.

A blocked source, transcript, review, process step, calendar or evidence gate is
recorded explicitly. Runs and intake items remain in the operational monitor so
a later slot can repair the issue without silently restarting or publishing a
weaker story.
