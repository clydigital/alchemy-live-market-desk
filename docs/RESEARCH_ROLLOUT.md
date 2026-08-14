# Alchemy Research Architecture and Rollout

## Responsibility split

The original Alchemy Live Market Desk is the canonical research layer. It owns source ingestion, transcript studies, structured data, evidence records, chart requirements, thesis changes and append-only research memory.

The Hybrid Market Desk is the presentation and learning layer. It consumes the shared Supabase state and turns it into guided journeys, World transmission maps, decision snapshots and review history. It must not become a second source of truth.

The original Live Market Desk, Book of the Day and Company Deep Dive remain the authoritative output paths. The hybrid supplements them.

## Transcript and method library

Creator transcripts are Tier 5 commentary. They may improve story selection, structure, pacing, explanation and title ideation, but do not verify a market claim.

- **Wall Street Truthbombs / Mark Malek:** reviewed corpus. Use contradiction, accepted-view pass, overlooked measurable variable, causal transmission and dated tripwires.
- **StockedUp:** partial review. Use myth-to-reality openings, claim-evidence-implication flow and near-term event framing. Avoid alarm language and unsupported certainty.
- **TraderNick:** queued for a full corpus review as a candidate fundamentals-plus-technicals model.
- **Traders Reality:** queued. Do not infer its method until the supplied corpus is reviewed.
- **Beginner Trading:** queued. Do not infer its method until the supplied corpus is reviewed.
- **Trade The Pool livestream:** production and chart-clarity benchmark, especially visible price scales.
- **FXIFY livestream:** audio and visual delivery benchmark.
- **Official company calls:** Tier 1 evidence for guidance, wording changes, capex, demand and prior-quarter comparison.

## Source tiers

1. Official releases, filings and direct statements.
2. Exchange, market and physical datasets.
3. Reputable licensed reporting.
4. Social posts and open-news discovery.
5. Commentary used only to generate research leads.

## Publication gate

A priority story remains **Researching** until it has:

- Three credible sources, including at least one Tier 1 source.
- Three evidence records.
- One meaningful contradiction.
- One functioning chart tied to the deciding question.
- One confirmation condition.
- One invalidation condition.
- One dated update explaining the current balance of evidence.

## Rollout

### Phase 0: responsibility split and shared contract

Complete. Both apps share Supabase state and stable story slugs. Creator methods are separated from story evidence.

### Phase 1: canonical research layer

Owner: original Live Market Desk. Status: in progress.

Connect BLS, FRED, EIA, SEC EDGAR, BOJ and Japan MOF. Maintain the source registry, descriptive research-state diagnostics, transcript-method library and research memory.

### Phase 2: hybrid presentation layer

Owner: Hybrid Market Desk. Status: in progress.

Consume verified state for guided journeys, World story pages, decision snapshots and review history. Mirrored evidence remains read-only and links back to the canonical layer.

### Phase 3: expanded official and licensed feeds

Add company IR feeds, OPEC extraction, Treasury and Census data, Reuters or another licensed news feed, and approved X embedding. Social posts may establish that a statement was made, not that it is true.

### Phase 4: licensed physical intelligence

Add Kpler or S&P Commodity Insights, then licensed CME or ICE data where required. Prioritise Kpler for vessel movement and barrels. Prioritise S&P when assessed prices, refining, outages and curves are required together.

## Data rule

Store raw source material separately from interpreted evidence. Preserve original publication time, observation time, units, frequency, revision history, source URL, validation status and licence classification.
