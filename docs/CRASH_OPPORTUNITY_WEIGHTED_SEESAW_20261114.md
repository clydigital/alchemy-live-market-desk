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

## Automatic reviewed-transcript scoring layer (14 November extension)

The original market-only 4.5-unit balance remains the base. This release reads
up to eight existing completed, reviewed creator videos from the same private
`research_intake_items` ledger used by Bluebelly's owner research pipeline.
Each one can supply up to ten structured claim observations, but **none of the
private video transcript text, review prose, video title, claims or author
identity is rendered in public page HTML**. One bounded server-only read
calculates aggregate agreement when the page is requested; it never launches
a retrieval, an AI model or an additional scheduled task.

A transcript earns *secondary agreement units* only when:
1. Its video is within seven days, has a valid video ID, a reviewed transcript,
   and an allowed creator source; completed private reviews are required.
2. An extracted `market_observation` or `cited_fact` contains one explicit,
   non-hypothetical, unambiguous directional statement about **HY credit
   spreads**, **RSP/S&P breadth** or the **equity tape**. Negated, ambiguous
   or conditional opinions are not eligible.
3. The original-date market observation is qualified through the existing
   source-specific market gate and confirms the **same direction** within four
   calendar days of the video. A creator's citation or research-lead score
   is not accepted as verification on its own.
4. No more than one video per publisher can count; 0.25 units/publisher,
   0.50 units/topic and 1.00 unit in total. The two most corroborated topics
   are selected deterministically. Repeated videos or unconfirmed mechanisms
   can never inflate the pan.
5. Credit requires a dated original FRED HY OAS snapshot matching its own
   source date. If data are missing, future, stale or mixed, that topic adds
   **zero** transcript weight.

A separate dashboard area displays the raw **count of reviewed videos**
in the input window, number of matched sources, total transcript addition
to opportunity/crash pans, topics and corresponding independent source
dates. Missing reviews and unavailable database reads are separate statuses.
This is a constrained *research agreement bonus*, **not a second independent
market data source, not a probability, and not proof of a creator's entire
causal explanation**.

The 4.5-unit market base plus up to 1.0 units of matched creator context
can appear simultaneously on both sides. The tilt remains bounded to
±13 degrees; the balance includes 0.25-unit visible blocks so fractional
transcript contributions do not disappear or round upward. A viewer can
distinguish data evidence from transcript corroboration in the totals.

**Operational limitation:** The automated public page consumes only existing
**completed and reviewed transcript rows** in Bluebelly's database. A video
that exists solely in a separate Notion or ChatGPT Work transcript ledger does
not score until it is ingested into the existing reviewed database pipeline.
The related MacroPulse public research briefs remain unadjudicated research
and never enter the numerical counterweight. This avoids silently fabricating
an ingestion bridge that does not exist.

**Schema/verification limitation:** The V8 `creator_claims` and
`claim_verifications` migrations are not deployed in this production
database as of this implementation. Therefore this algorithm uses
independent qualified market **direction** as narrow corroboration and
leaves broader creator claims about cash generation, bankruptcies,
government decisions, CEO events or CDS constituents unscored unless the
required verification data become available. That is an explicit coverage
gap rather than a false green or red reading.

## Neutral-state and visual-refresh clarification (14 November hotfix)

When every dated input is MIXED, the balance shows **NO DIRECTIONAL SIGNAL** rather than **BALANCED**: zero qualified weight on both pans is not opposing bullish/bearish evidence. The measured neutral units remain visible in the legend; the seesaw intentionally stays level. By contrast, equal nonzero weights are BALANCED counterweights. Missing inputs remain UNMEASURED. No threshold or market/admission logic changes.

The physical pans counter-rotate while the beam settles so weights remain upright. A small client-only 10-minute refresh triggers the existing dynamic server read whenever the page is visible; no background task, source ingestion, or new API is created. Only changes in a qualified score produce a different settled angle; reduced-motion preference is honoured. Dates and the absence of verified directional support remain explicit.

## Graded early-pressure weights · 14 November correction

The binary scoring design made the pans permanently empty during normal mixed
sessions, despite nonzero source movements. That was correct for a *strong signal
filter* but unsuitable for an instrument intended to show a moving balance. The
same original thresholds and qualified source dates remain decisive for BULL or
BEAR classification. A separately labelled **EARLY / BELOW THRESHOLD** lane now
uses magnitude from those same qualified source measurements:

- HY OAS source-matched five-observation change: for narrowing, opportunity
  units = up to 2.0 × absolute bp / 20bp; for widening, crash units = up to
  2.0 × bp / 30bp. Values below thresholds are visibly provisional.
- RSP versus SPX matched five-session relative change: absolute percentage-point
  gap × 1.5, capped at 1.5 units. Underperformance adds proportional risk,
  outperformance adds proportional opportunity.
- The one-day four-ETF tape retains its strict full-direction qualification.
  When MIXED, it is not invented into a directional magnitude; its 1.0 weight
  remains neutral. Missing and stale observations also remain unscored.
- Each market pillar allocates at most its original 2.0/1.5/1.0 capacity.
  The unused portion stays in **unallocated/neutral** and remains visible,
  so total market weights still reconcile exactly to 4.5 units.
- Creator corroboration rules do **not** change. Creator interpretations cannot
  validate an early market reading, and these units remain heuristics rather
  than empirical crash probabilities.

Example using the verified 12–13 Nov values: HY OAS -12bp contributes
1.20 early-opportunity units, RSP/SPX -0.14pp contributes 0.21 early-risk
units, and mixed 1D tape contributes 1.00 neutral unit. Total opportunity
1.20, risk 0.21, neutral capacity 3.09; seesaw angle approximately -2.86°.
This must display "EARLY OPPORTUNITY TILT," not "confirmed recovery."
