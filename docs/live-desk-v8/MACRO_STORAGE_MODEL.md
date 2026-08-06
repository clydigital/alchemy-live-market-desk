# Macro Data Storage Model

## Component Laboratory

The Component Laboratory is not stored as page prose. It is generated from reusable component definitions plus release-specific observations.

### `macro_release_definitions`
One stable record for each release family, such as ISM Manufacturing, CPI, Nonfarm Payrolls or Retail Sales.

### `macro_component_definitions`
One stable record for each component. It stores the name, unit, display order, cycle role, leading/coincident/lagging classification, inflation relevance, Fed relevance and caveats.

### `macro_release_events`
One record for each publication event. It stores the release family, observation period, scheduled time, actual publication time, official source and source health.

### `macro_release_vintages`
Append-only headline values. It preserves actual, consensus, previous, revised previous, capture time and vintage number.

### `macro_component_observations`
The values shown in Component Laboratory. Each row is keyed by release event, component and vintage.

### `macro_release_interpretations`
Versioned Inflation, Fed, growth and relevant-asset checks, plus the central question and next test.

### `macro_release_batches`
Groups several releases from one day or session. This stores the combined inflation, labour, growth and policy interpretation without overwriting any individual release.

## Multiple releases on one day

The page has four separate layers:

1. Release stack
2. Selected-release interpretation
3. Fixed day synthesis
4. Selected release's Component Laboratory and history

Later releases never overwrite earlier releases.

## History

Store all available history. The interface defaults to:

- 12 months for monthly data
- 12 quarters for quarterly data
- 52 weeks for weekly data

Three-year, five-year, ten-year and maximum views use the same observation store. Revisions are append-only and remain available in History Cabinet.
