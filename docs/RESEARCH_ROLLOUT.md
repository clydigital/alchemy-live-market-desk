# Alchemy Research Architecture and Rollout

## Responsibility split

The Alchemy Live Market Desk is Desk 1 and the canonical research layer. It
owns ingestion, transcript studies, structured data, evidence records, chart
requirements, focus decisions, thesis changes and append-only research memory.

The Hybrid Market Desk is Desk 2 and the presentation and learning layer. It
consumes the validated Desk 1 feed for guided journeys, World transmission
maps, decision snapshots and review history. It must not run ingestion,
transcription or independent story generation.

```text
Creator videos -> video intake -> claim and jargon checks --+
                                                         |
News + Alchemy data + calendars -> Desk 1 validation -----+-> canonical Desk 1 state -> Desk 2 adaptation
```

## Source hierarchy

1. Official releases, filings, direct statements and official transcripts.
2. Exchange, market, macro and physical datasets.
3. Reputable licensed or attributable reporting.
4. Open-news and social discovery.
5. Creator commentary used only to generate leads and improve framing.

The required creator set is FX Evolution, Kevin Gerrity, ClearValue Tax,
StockedUp, Wall Street Truthbombs, TraderNick, Traders Reality and Beginner
Trading. Every retained video needs an official or YouTubeToTranscript.com
transcript, independent review or listening, claim labels and cross-assessment.

The required desk set is ZeroHedge, Axios, Investing.com, FXStreet, Alchemy
data tables, the economic calendar, the earnings calendar and Alchemy Market
Insights. Publication sources should be upgraded to Tier 1 or Tier 2 evidence
wherever a material claim can be checked directly.

## Research memory

Research memory is an auditable decision history, not an AI summary cache. It
preserves the input item, original time, claim verdicts, evidence, expert notes,
story focus decision, demotion reason, publication result and unresolved test.

The previous two Desk 1 days are part of each publication decision. An
unchanged story becomes background, a cosmetic rewrite is rejected, and a lead
cannot repeat without a material development. This keeps reviews meaningful:
they show why the desk changed its mind, held its view or stopped leading with a
story.

## Context experts

Geopolitics Expert notes are required when sanctions, conflict, diplomacy,
trade policy, elections, state capacity or physical chokepoints materially
change the transmission path.

Markets Expert notes are required when positioning, liquidity, volatility,
rates, curves, basis, cross-asset confirmation or market structure materially
change interpretation.

Expert notes are context-sensitive analysis, not a substitute for source
evidence. Their job is to explain transmission and materiality.

## Publication gate

A priority story remains **Researching** until it has:

- completed its slot-specific source and process checks
- passed transcript, review and material-claim checks for any creator evidence
- passed the 72-hour freshness or seven-day catalyst rule
- survived comparison with the previous two Desk 1 days
- at least four distinct dated links for a proposed story recalibration
- support, contradiction and an unresolved test
- the relevant context-expert notes
- an open deterministic market accuracy gate

## Rollout

### Phase 0: ownership and contract

Complete. Desk 1 is canonical, source roles are explicit and Desk 2 consumes a
read-only validated adaptation feed.

### Phase 1: four-slot research pipeline

Implemented in application code and the live Supabase schema. Operate 00:40 and
11:30 video intake separately from 08:30 and 22:00 Desk 1 publication. Monitor
source completion, claim verdicts, jargon research, expert notes, freshness,
demotions and publication counts.

### Phase 2: official data depth

Connect and maintain BLS, FRED, EIA, SEC EDGAR, company investor relations,
central banks and finance ministries. Preserve units, frequency, observation
time, release time, revisions and official source URLs.

### Phase 3: licensed reporting and social evidence

Add Reuters or another licensed news feed and approved X embedding. A social
post may verify that a statement was made, not that the statement is true.
Store the post ID, author, publication time, canonical URL and verification
status, and provide a linked fallback when embedding is unavailable.

### Phase 4: licensed physical intelligence

Add Kpler or S&P Commodity Insights, then licensed CME or ICE data where
required. Prioritise Kpler for vessel movement and barrels. Prioritise S&P when
assessed prices, refining, outages and curves are required together.

## Data rule

Store raw source material separately from interpreted evidence. Preserve the
original publication time, observation time, units, frequency, revision
history, source URL, transcript provider, review status, validation state and
licence classification.
