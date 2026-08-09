# Case Monitoring Standard

This is a binding research rule for the Alchemy Live Market Desk and every downstream Hybrid investigation.

## Core rule

A Story is an unresolved market question, not a container for headlines.

Every active Story must define the observable evidence that can answer its question. New updates must state whether the new evidence:

- confirms the current thesis;
- contradicts it;
- leaves the question unresolved; or
- exposes a monitor/data coverage gap.

A fresh headline is not automatically a Story update. If it does not move a confirmation condition, invalidation condition, causal link or deciding monitor, it should remain source context rather than change the thesis.

## Required monitor contract

Every case should carry, where available:

1. **Central question** — the exact unresolved question.
2. **Monitor** — the statistic, physical measure, price/spread or statement stream that can answer it.
3. **Current reading** — the newest verified observation.
4. **Prior comparison** — the previous reading, prior snapshot or relevant baseline.
5. **Source timestamp** — when the underlying source was observed or published.
6. **Cadence** — intraday, daily, weekly, monthly, earnings-driven, etc.
7. **Provenance** — official, physical-flow, market, specialist derived, reporting, statement, X, YouTube/transcript, etc.
8. **Confirmation condition** — what observable state strengthens the thesis.
9. **Invalidation condition** — what observable state weakens or breaks the thesis.
10. **Interpretation** — what the latest reading does and does not establish.

If continuous history is unavailable, persist snapshots. Showing `X hours/days ago → now` is preferable to presenting a context-free current number.

## Monitor selection hierarchy

Choose evidence based on its ability to answer the Story, not on what is easiest to fetch.

1. Physical or operational reality: vessel transits, inventories, capacity, production, traffic, utilisation, shipment volumes.
2. Official statistical releases and filings.
3. Direct market prices, curves, spreads, volatility, breadth and positioning.
4. Official statements, central-bank/government/company guidance.
5. Specialist industry data.
6. Verified reporting.
7. X/Twitter and YouTube/transcript monitoring.

Social and video sources are discovery/statement monitors. They do not overrule contradictory physical or statistical evidence by themselves.

## No proxy substitution

If the deciding monitor is missing, label the coverage gap.

Do not replace:

- breadth with SPY direction;
- a crack spread with crude direction;
- commercial Hormuz transits with a wider AIS bounding-box vessel count;
- Fed probability with a dollar ETF;
- repatriation with USDJPY alone;
- AI cash conversion with Nasdaq direction.

Related market data can provide context, but the case must remain visibly incomplete until the deciding evidence is available.

## Hormuz example

For the question **"Has Strait activity resumed normal commercial conditions?"**, the preferred monitor stack is:

- IMF PortWatch daily Hormuz crossings;
- prior daily crossing and stable pre-crisis baseline;
- rolling transit recovery / normalisation threshold;
- tanker versus cargo breakdown;
- war-risk insurance multiple;
- carrier posture (transiting / limited / rerouting / stopped);
- AIS presence and AIS-gap/dark-vessel count as supporting context;
- verified incidents and official reopening statements;
- crude, freight and product-market response as market confirmation.

Do not call the Strait normal because a deal is announced or because vessels are visible in the wider Gulf watch box.

## Live / Hybrid ownership

**Live Market Desk owns the canonical monitor readings and evaluation.**

Hybrid consumes the approved Live contract. It may change presentation and interaction, but it must not independently change the reading, timestamp, source strength, confirmation state or history.

Presentation rule:

- **Live:** direct analyst monitor board, visible beside the Story question and thesis.
- **Hybrid:** the same key monitor board is visible on the case overview. Detailed source/evidence cards remain inside the Evidence Room so the investigation still feels discoverable and game-like.

## Update writing rule

Every material Story update should be writable as:

> **New evidence:** [what changed]. **Question impact:** [confirming / contradicting / unresolved]. **Why:** [which monitor or causal link moved]. **Still missing:** [remaining deciding evidence].

This is the default logic even when the final client-facing prose is more natural.
