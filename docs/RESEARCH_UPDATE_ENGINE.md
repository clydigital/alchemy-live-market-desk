# Research Update Engine

The original Live Desk is the canonical research backend. The Hybrid consumes
its redacted status through `/api/hybrid-feed`; it does not repeat ingestion.

The binding case-monitoring standard is in [`CASE_MONITORING_STANDARD.md`](CASE_MONITORING_STANDARD.md).
A Story is an unresolved market question, not a container for new headlines.

## Schedule

- 09:15 Asia/Kuala_Lumpur (01:15 UTC)
- 21:15 Asia/Kuala_Lumpur (13:15 UTC)

Each Vercel Cron cycle claims a stable run key before any provider call. It
performs bounded YouTube/TranscriptAPI intake, acquires the direct named news
feeds, then invokes the existing canonical Live publisher exactly once. A
completed, running, blocked or failed key is never silently repeated.

## Required source checks

Every run records one status for each source, even when nothing new exists:

- StockedUp: new YouTube videos and available captions/transcript
- Wall Street Truth Bombs: new live videos and available captions/transcript
- Traders Reality: new live videos and available captions/transcript
- ZeroHedge: recent dated market reporting
- Axios: recent dated business, policy and market reporting
- Investing.com: recent dated market reporting and releases
- FXStreet: recent dated FX, rates and macro reporting
- Alchemy Markets Market Insights: the 30 most recent dated articles only

A blocked source is recorded as blocked. It is never silently counted as
checked. `checked` requires a successful direct acquisition and one or more
dated retained items; `no_new_items` requires successful acquisition with no
retained item. A provider timeout, HTTP failure, malformed feed, missing
TranscriptAPI transcript or fallback article is always blocked.

## Editorial sequence

1. Discover new dated items since the prior successful run.
2. Obtain the transcript for each retained creator video. A title or video
   description is not a transcript.
3. Score source quality, relevance, novelty and materiality from 0–100.
4. Compare news direction with the Live Desk's current statistics. Record
   `stats_lead`, `news_lead` or `contradiction` when they diverge.
5. Review only positions 1–30 in the dated Alchemy article list.
6. Collect at least four distinct, dated HTTPS evidence links for every
   proposed story recalibration.
7. Before recalibrating a Story, explicitly answer the Story question:
   - `questionImpact`: `confirming`, `contradicting` or `unresolved`;
   - `decidingMonitor`: the observable statistic/physical measure/price-spread/statement stream that actually moved;
   - `stillMissing`: the evidence still required to settle the question.
8. Preserve the strongest support, strongest contradiction and next unresolved test.
9. Do not publish a Story recalibration just because a new headline exists. If no deciding monitor or causal link moved, keep it as intake/evidence rather than a thesis change.
10. Publish only when all source checks, the four-link evidence gate and the
   deterministic accuracy gate are open. Confidence can move by at most eight
   points in one run.

## Recalibration standard

Every Story update must be able to answer:

> **New evidence:** what changed?  
> **Question impact:** confirming, contradicting or unresolved?  
> **Deciding monitor:** which observable test moved?  
> **Still missing:** what would settle the remaining question?

This rule applies even when the eventual UI copy is more natural. A statement, X post or YouTube transcript can change the investigation, but it cannot overrule contradictory physical/statistical evidence by itself.

## Publishing

Create a JSON payload matching the types in `lib/research-update.ts`, validate
it without writing, then publish:

```powershell
$env:RESEARCH_UPDATE_TOKEN = "<server token>"
npm run research:publish -- run.json --dry-run
npm run research:publish -- run.json
```

The bearer token and Supabase service-role key are server secrets. They must
never use a `NEXT_PUBLIC_` prefix or appear in a research payload, source
record, transcript, commit, log, or automation prompt.

## Failure behaviour

- Missing dates reject the payload.
- Missing source checks reject the payload.
- A source access failure records a blocked run.
- A missing transcript blocks any video-derived story change.
- When a required source is blocked, the publisher persists the available
  intake but does not spend an OpenAI reasoning run or publish a Story.
- Fewer than four evidence links blocks the linked story change.
- Missing `questionImpact`, `decidingMonitor` or `stillMissing` rejects a Story recalibration.
- A warning or failed deterministic accuracy report blocks story changes.
- Runs and intake items remain visible in the operational queue so the next
  cycle can repair them instead of silently starting over.
