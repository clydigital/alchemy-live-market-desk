# COTSignal Method Alignment

## Status

This document refines the COT Positioning Lens using the user-supplied Patrick Sresny / Big Picture Trading walkthrough of the COTSignal dashboard.

It does not replace the Original desk's source hierarchy. Official CFTC data remains canonical.

Where the desk refers specifically to a **COTSignal-style score**, heatmap or interpretation, this document takes precedence over more general positioning-display assumptions.

## Live website methodology correction — 28 October 2026

The public COTSignal explanation currently describes a configurable **52–260 weekly-report historical window**, typically shown with a three-year selection. Its 0–100 score is a **range-normalisation** of current raw net positioning between the minimum and maximum in that selected lookback; it is **not** an empirical percentile rank, probability or forecast. A score of 50 is the midpoint of the selected historical min/max range, not necessarily the median observation.

Earlier supplied walkthrough notes below described a 52-week percentile view. Preserve those notes as historical walkthrough evidence, **not as the authoritative current website formula**. Do not silently convert the existing Alchemy 52-week rank into a COTSignal number. Until a tested matching range formula is implemented from official CFTC records, label Alchemy’s current page **Alchemy 52-week Rank**, not COTSignal-style.

Formula for a candidate independently calculated range position, when a complete lookback exists: `100 * (currentNet - minNet) / (maxNet - minNet)`. If `maxNet == minNet`, mark score UNAVAILABLE rather than inventing a neutral midpoint; for Commercials store raw and explicitly inverted `100 - raw`. Never claim direct numerical parity with COTSignal without matching report family, vintage, contract, lookback and rounding.

## What COTSignal actually measures

The COTSignal homepage converts the weekly CFTC Commitment of Traders report into positioning context.

Its stated purpose is to show:

- where positioning is crowded long or crowded short relative to its own recent history;
- where positioning is washed out or under-owned;
- which markets changed most after the latest weekly report;
- how current positioning compares with price.

It is explicitly **not** a standalone trade-signal system.

The Alchemy desk should preserve that framing whenever it uses COTSignal as a secondary perspective.

## COTSignal homepage structure

The user-supplied walkthrough describes this order:

1. Weekly positioning extremes.
2. Four asset-class heatmaps.
3. Weekly plain-English insights.
4. Filters for asset class and trader group.
5. A market detail view opened from each tile.

The four heatmap groups are:

- indices and bonds;
- currencies;
- hard commodities;
- soft commodities.

## Main heatmap methodology

Each heatmap tile represents:

- one futures market;
- one legacy trader category;
- one **historical-range position score** for the explicitly selected window.

The trader groups used in this view are:

- Commercials;
- Large Speculators;
- Small Speculators.

The earlier walkthrough used a **52-week lookback**. The current website allows **52–260 weekly reports**, commonly displaying a **three-year window**.

Interpretation:

- darker green means relatively greater long exposure within the selected historical window;
- darker red means positioning is more washed out or under-owned;
- lighter colours near grey mean positioning is closer to neutral;
- the number inside the tile is the selected-window min/max-normalised position score (not an empirical percentile rank).

The score describes historical stretch. It does not predict the next price move.

## Commercial-score inversion

COTSignal applies a proprietary presentation change to Commercials.

Its commercial score is displayed as:

```text
100 - commercial positioning index
```

The purpose is visual consistency across trader groups.

Under this presentation:

- a higher displayed commercial reading means commercial hedgers are more heavily hedged than normal;
- a lower displayed commercial reading means commercial hedgers are less hedged and more exposed.

## Alchemy handling of the inversion

Alchemy must store the raw commercial calculation and the inverted display value separately.

Required fields:

```text
raw_commercial_index
cotsignal_style_commercial_score
commercial_score_inverted: true
inversion_formula: 100 - raw_commercial_index
```

The Original must never overwrite the raw series with the inverted value.

Any COTSignal-style comparison must visibly state:

> Commercial score inverted for visual consistency.

This inversion is used only in an explicitly labelled legacy display: COTSignal-style range scores or Alchemy’s independently defined rank view. Preserve raw observations and clarify which calculation is shown.

Alchemy's canonical TFF and Disaggregated views should retain their normal participant definitions and raw direction.

## Detail-view methodology

Clicking a COTSignal market tile opens a deeper market view.

The walkthrough identifies three important elements:

### 1. Positioning barometer

The selected trader group receives a barometer-style ranking based on the same selected-window positioning context shown in the heatmap.

The user can toggle between:

- Commercials;
- Large Specs;
- Small Specs.

### 2. Five-year net-position context

Each trader group's net positioning is calculated as a percentage of total open interest and displayed against a **five-year lookback**.

This provides an apples-to-apples comparison across futures markets with different contract sizes and open-interest levels.

Required calculation:

```text
net_position_pct_open_interest = (gross_long - gross_short) / total_open_interest * 100
```

The five-year series is separate from the selected-window range-position heatmap score.

### 3. Positioning versus price

The detail view shows a selected-window positioning score alongside the asset price history.

This is used to inspect:

- whether a positioning extreme coincided with a price extreme;
- whether price and positioning are diverging;
- whether exposure is building or unwinding while price moves;
- whether the latest reading is unusual but not yet confirmed by price.

It must not be described as proof that price will reverse.

## Weekly extremes

The top band should rank the most notable readings after the latest CFTC release.

Alchemy may show:

- most crowded longs;
- most crowded shorts;
- most washed-out markets;
- largest week-over-week selected-window range-score changes;
- new extremes within the stated lookback window.

The title should be **Weekly Positioning Extremes**, not Top Trades or Trade Signals.

## Weekly insights

The right-hand insight panel should give a concise plain-English explanation of what is interesting in the latest report.

Each insight should answer:

1. What changed?
2. Which trader group changed?
3. How unusual is the reading over 52 weeks?
4. What does the five-year open-interest context show?
5. Does price confirm or diverge?
6. Which active Alchemy story is affected?
7. What is the data-lag caveat?

The insight may say:

- positioning is crowded;
- positioning is washed out;
- exposure is building;
- exposure is unwinding;
- price and positioning diverge;
- the next catalyst could amplify an unwind.

It may not say:

- buy;
- sell;
- guaranteed reversal;
- commercials are always right;
- large specs are trapped.

## Alchemy page modes

The Original Positioning page should offer two clearly separated modes.

### Alchemy Institutional View

Canonical source and participant mapping:

- TFF for currencies, rates and equity indices;
- Disaggregated COT for energy, metals and physical commodities;
- official CFTC participant definitions;
- 52-week, three-year and five-year Alchemy calculations;
- no commercial inversion unless explicitly requested.

### COTSignal-style Legacy View

Secondary comparison and reader-friendly layout:

- Commercials;
- Large Specs;
- Small Specs;
- explicit selected-window range score, with lookback and formula;
- commercial score inversion;
- weekly extremes;
- five-year net position as percentage of open interest;
- positioning score beside price;
- external link to COTSignal.

The two views must not be silently mixed.

## COTSignal data-use rule

Unless a licensed data agreement or supported API exists, Alchemy should not scrape or reproduce COTSignal's proprietary output as its own dataset.

The acceptable uses are:

- methodology reference;
- interface inspiration;
- external interpretation check;
- external link for manual comparison.

Alchemy should calculate its own figures from official CFTC records.

When an analyst manually cites a COTSignal reading, store:

- capture time;
- report date;
- market;
- trader group;
- displayed score;
- whether the commercial score is inverted;
- source URL;
- analyst note;
- matching official CFTC record.

## Story-filter integration

The COTSignal-style perspective remains one layer in a wider Story decision.

For a covered Story, the desk records:

- selected-window range score (or a separately labelled Alchemy percentile rank);
- week-over-week change;
- trader group;
- five-year net position as percentage of open interest;
- price relationship;
- whether the perspective supports, contradicts, amplifies or is neutral;
- whether the report predates the decisive catalyst;
- next official CFTC release date.

COT positioning alone cannot promote a Story to Today's Lead.

## Acceptance tests

### Heatmap test

The COTSignal-style heatmap uses the declared selected 52–260 week min/max range score and Legacy groups. Alchemy’s existing 52-week percentile-ranking UI is separately labelled, not represented as numerically identical.

### Commercial test

Commercial values show both raw and inverted values in the audit record. The visible tile states that inversion is applied.

### Detail test

Opening a market shows:

- trader-group toggle;
- barometer score;
- five-year net position as percentage of open interest;
- explicitly labelled selected-window range score beside price;
- Story link;
- lag warning.

### Language test

No COTSignal-style panel presents a positioning score as a directional forecast.

### Source test

Every Alchemy calculation links to the official CFTC record. COTSignal remains a secondary external reference.

## Final rule

> Use COTSignal to understand and present positioning context. Use official CFTC data to calculate, audit and preserve it.