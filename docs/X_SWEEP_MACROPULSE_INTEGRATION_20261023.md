# MacroPulse X discovery sweep — normal preset (23 October 2026)

## Outcome and ownership

The EXISTING ChatGPT scheduled task MacroPulse Market Watch (ID 6a59c6cad9ac8191ac5f2393e29e6c64) has been updated in place. Its two-hour even-MYT schedule, single Notion Post/Log publication path, enabled state, heartbeat semantics, Research Gap Gate handoff, Hormuz cached sensor, and canonical Dossier/System 2 authority remain unchanged. No new cron, paid X service, Supabase writer, task or independent Bluebelly research engine is authorised.

lib/x-sweep-core.ts defines the matching pure, testable default configuration and conservative candidate-selection contract. It does NOT perform web retrieval. The actual scheduled ChatGPT workflow must obtain genuinely accessible original post material or mark the individual account/attempt unavailable. Config is not proof of live acquisition.

## Exact user-selected normal preset

- sweep: x
- preset: normal
- lookbackHours: 2.5
- overlapMinutes: 30
- maxCandidatesPerRun: 250
- softLimitPerAccount: 40
- recoveryLookbackHours: 72
- deepInvestigationsCap: 12
- schedule: existing MacroPulse only
- newScheduledTask: false

Candidate and account limits are maximum workload budgets, not targets. Two-hour scheduling plus 30-minute overlap gives a normal 150-minute lookback. Account checkpoints must come from real successful observations. Without one, the collector cannot claim incremental completeness. Account-specific gaps after a missed source check may use recovery lookback, up to 72 hours, retaining unknown older gaps. Defer items over the limit rather than advancing the saved cursor and losing them.

## Approved X source registry

**29 October 2026 owner correction supersedes the 26 October exclusion:** @zerohedge / ZeroHedge is permitted as attributed X discovery and as an independent news article source. There is no source-account ban based on the TankerTrackers dispute. The existing core scan roster remains ten until any additional account is explicitly registered and source-health verified.

Current ten-account roster:
@Bluekurtic, @HFI_Research, @OilandEnergy, @HormuzReport, @TheStudyofWar, @Currentreport1, @arena, @KobeissiLetter, @FirstSquawk; plus Alchemy-linked @GordianKnotDev.

Historical 26 October SQL excluded ZeroHedge X posts. The 29 October forward migration withdraws the ban and leaves historic rejected-post records intact for audit, without promoting them as verified facts.

The existing **MacroPulse Market Watch** task has since been corrected to permit ZeroHedge and retain all previously monitored accounts. The ten-account scan roster and task schedule remain unchanged. Repository and database repairs require a coordinated tested deployment; a migration file alone is not proof it has been applied.

This is a registry of discovery targets, NOT a claim of ownership, reliability, identity validation, verified recent posts, or currently available timelines. Verify identity/handle at acquisition. Any future extra accounts require explicit registration and source-health checks, rather than duplicative hardcoded lists. The original reference is the approved WIRE_X_INTELLIGENCE_PIPELINE_SPEC.md.

## Admission and health rules

1. Capture original X post ID, exact URL, author/handle, author verification basis, actual publication timestamp, actual retrieval time, accessible content, source links, quoted/replied-to post, thread/repost relation, attached chart/media URL and licence where available.
2. Deduplicate platform+post ID, canonical URL, original report family, bare repost and repeated provider appearances. Quote posts containing genuinely different new commentary remain attributable separate items.
3. Timestamp unavailable: hold in unknown-publication-time queue, never mislabel as fresh. Account inaccessible: BLOCKED/UNAVAILABLE/PARTIAL, never "no new posts".
4. Social sentiment, reported attacks and claimed prices are discovery leads only. A post can be ATTRIBUTED without its underlying claim being CORROBORATED. PRIMARY applies only to a truly authenticated primary statement. CANONICAL requires separate existing evidence UUID/admission, never social post selection by itself.
5. Use a 12-lead maximum for further deep research, prioritised by market-regime significance and verifiability, not post likes.
6. X sweep is optional to MacroPulse publication. A blocked account is a source-health gap and does not block an accurate macro Pulse or a SKIPPED heartbeat.
7. Notion full Pulse should contain an appropriately short X change summary, source-attempt manifest and specific next discriminator/Research Gap handoff. Do not create a separate Wire database or shadow schedule.

## Production UI correction

The legacy case-monitor X placeholder previously said "No verified relevant X post in the current canonical window" with no actual source-fetch check. It now clearly says X source coverage is UNCONFIRMED for the Story. Neither the source roster nor the enabled scheduled task constitutes a live account retrieval proof.

## Verification and staged follow-up

- Verify the existing ChatGPT MacroPulse task schedule/prompt and observe its next natural Pulse for a real source-attempt manifest with original X URLs and explicit blocked/partial states. Read back Notion full Post and matching Log row before calling the recurring X sweep operationally proven.
- The TypeScript module and node tests establish bounds, 150-minute window, up-to-72-hour recovery, URL safety, dedupe, per-account backlog retention and truthful failed-source health. This is static acceptance, not proof that a provider successfully retrieved an X timeline.
- For an actual Bluebelly chronological Wire feed, a separately authorised and tested first-class social intake adapter with persisted source identity/media/time and read-only redacted public/private projections is still required. Do not render an unbacked LIVE X badge or call indexed snippets complete timelines. Use native embeds only for linkable original posts and under X embedding terms.
- No frontend X timeline, authenticated source-adapter ingestion, durable checkpoint database, historical backfill, or new paid provider is added by this change. Existing canonical Story/Dossier/thesis-version paths are untouched.
