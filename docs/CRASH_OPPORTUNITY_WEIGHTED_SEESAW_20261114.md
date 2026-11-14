# Crash vs Opportunity weighted seesaw · 14 November 2026

## Purpose

Make the competing risk and recovery readings visible in a single dynamic two-pan balance, rather than implying that an old editorial story or a single 1D price swing is an investment decision. The **crash-risk pan is on the right** and rotates downward when the qualified crash evidence outweighs the opportunity evidence. The **opportunity pan is on the left** and sinks when the reverse is true. They can both carry weight at the same time.

The animation is a brief opening settle towards the data-derived angle, not a claim that there is a live intraday data stream. The page recalculates from admitted feeds when requested; it has no additional scheduler or invented quote ticks. Reduced-motion users see the final position without animation.

## Evidence ledger: fixed research priorities, never probabilities

| Qualified observation | Maximum weight | Risk side | Opportunity side | Neutral | Unknown |
| --- | ---: | --- | --- | --- | --- |
| HY OAS over 5 matched FRED observations | 2.0 units | Widening ≥30bp (existing source model) | Narrowing ≤−20bp | Between existing thresholds | Missing/stale/incorrect source |
| RSP relative to SPX over 5 completed sessions | 1.5 units | Underperforms by ≥1.0 percentage point | Outperforms by ≥1.0pp | Inside ±1.0pp | Missing/mismatched |
| 1D matched SMH/QQQ/RSP/SPY tape | 1.0 unit | Existing four-ETF RISK_OFF | Existing four-ETF RISK_ON | MIXED | No valid match |

A reading contributes its **entire declared research weight** to only the qualified directional side. A MIXED reading contributes to a separately shown neutral bucket; a missing reading is shown as unavailable. The visible weights total at most 4.5 units across both pans. Neither total nor tilt is a crash probability.

The tilt is `13 degrees × (crash units − opportunity units) / 4.5`, a transparent bounded angle. For example 2.5 crash / 0 opportunity / 2.0 neutral yields +7.22°, right-hand pan lower. Simultaneous opportunity and crash support produces counterweights and a smaller tilt. With no dated eligible inputs, the beam remains level and **UNMEASURED**.

This visual is separate from the existing three scenario cards and seven-pillar research view. It does not automatically accept quarterly issuer FCF/capex work, creator interpretations, 200D assumptions or unverifiable liquidity stories. Equity tape and breadth are partially correlated, and that limitation is displayed.

## Interpretation

- Red pan lower: available observational evidence is leaning defensively, **not a confirmed systemic crash**.
- Green pan lower: available observational evidence favours opportunity, **not an entry signal or durable bottom**.
- Level pan: both sides equal, or unavailable; the summary explicitly differentiates the two.
- Each of the three cards displays original market session, source-derived observation and weight.
- A separate legend reports neutral and unavailable units and how many inputs were eligible. A click or a background task is **not required** to produce a fake new swing.

## Validation

Tests cover all-right, all-left, mixed counterweights, neutral credit, missing source, invalid FRED date alignment and preservation of historical pages and admissions. Repository CI/build and production READY SHA plus uncached HTML readback must pass before claiming the new seesaw is live.
