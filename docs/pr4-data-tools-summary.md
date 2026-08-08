# Live Desk V8 PR 4: data tools and article memory

This stacked layer sits on top of PR 3 and remains safe to preview before the PR 2 persistence migrations are applied.

## Included

- Article memory workspace with Article Charts and Change Meter views.
- Rules-based chart-idea status checks using publication context, current price and article-native confirmation, invalidation and target levels where they can be parsed reliably.
- Stable Story artwork fallbacks using the four approved ZIP images, with deterministic assignment per Story and same-origin delivery.
- Resilient researched-image handling that keeps the local fallback available when remote article images fail.
- High-impact economic-calendar intake for payrolls, CPI, PPI, PCE, FOMC and central-bank decisions, GDP, retail sales, ISM/PMI, JOLTS, ADP and jobless claims.
- Immediate Overview release reminder with actual, forecast, previous, revisions, affected assets and the deciding desk question.
- Release-to-Story links so scheduled catalysts are visibly attached to active research questions before the print lands.
- Four-slot research health model for 00:40, 08:30, 11:30 and 22:00 Asia/Kuala_Lumpur, backed by the existing research-run ledger.
- Read-only four-slot health endpoint at `/api/research-schedule-health`.

## Data safety

- No mock market or macro observations are inserted.
- No Supabase migration is applied in this layer.
- Existing current-state tables remain the fallback until PR 2 persistence is explicitly approved.
- Production and `main` remain unchanged.

## Known boundaries

- Article status remains rules-based until a durable idea-status ledger is activated.
- Historical Market Pulse comparison still needs persisted weekly snapshots.
- Upcoming releases can be attached to active Stories before release, but durable claim verification and post-release causal-edge history require the PR 2 persistence layer.
- Fiscal Supply and Treasury Liquidity records are defined in PR 2 but their full UI and ingestion workers remain a later implementation step.
