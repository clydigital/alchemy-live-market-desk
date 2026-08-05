# Original Variant A: Release Ledger First

## Thesis

The Original Live Desk becomes the most complete, persistent release-analysis system in the product family. The homepage is organised around the latest material releases and the stories they update.

This variant is best when the primary problem is:

- economic releases are noticed but not decomposed;
- the calendar does not explain market consequences;
- prior vintages and revisions are difficult to retrieve;
- the user repeatedly researches the same release structure from scratch.

## Core experience

The primary screen is **Latest Data Releases**.

At the top sits one Hero Release selected by market impact, surprise, proximity and interaction with active stories. Under it sit the remaining recent releases, followed by the History Cabinet.

The system remains story-aware, but releases are the main entry point.

## Homepage structure

### 1. Hero Release

Example structure for ISM Manufacturing:

- Release name and exact timestamp.
- Actual, consensus, prior and revision.
- One-sentence verdict.
- What changed from the previous release.
- What the market expected.
- Immediate market reaction.
- Inflation check.
- Fed check.
- Relevant assets only.
- Main component table.
- Deciding question.
- Next catalyst.
- Linked stories and articles.

### 2. Release component waterfall

A visual table or waterfall shows which components explain the headline change.

For ISM Manufacturing:

| Component | Latest | Prior | Direction | Role | Interpretation |
|---|---:|---:|---|---|---|
| New Orders | | | | Leading demand | Is future demand improving? |
| Production | | | | Current activity | Is output confirming orders? |
| Employment | | | | Labour confirmation | Is hiring matching activity? |
| Supplier Deliveries | | | | Supply timing | Demand strength or disruption? |
| Inventories | | | | Cycle inventory | Restocking or unwanted build? |
| Prices | | | | Input-price pipeline | Persistent pressure or temporary shock? |
| Backlog | | | | Capacity pressure | Is unfilled demand accumulating? |
| New Export Orders | | | | External demand | Is global demand helping? |
| Imports | | | | Trade input | Domestic demand or supply adjustment? |

The page does not treat every component as equally important. It highlights the two or three components that changed the interpretation.

### 3. Three editorial checks

#### Inflation

The page answers:

- Is the release inflationary, disinflationary, mixed or not informative?
- Is the signal about goods inputs, output prices or supply disruption?
- Is it leading pipeline pressure or coincident realised inflation?
- Is breadth increasing?
- Does the signal agree with CPI, PPI, wages and market inflation expectations?

#### Fed

The page answers:

- Is the release hawkish or dovish relative to current pricing?
- Does inflation or growth dominate the interpretation?
- Are revisions changing the picture?
- Does the release change the expected next meeting, the terminal path or only the risk distribution?
- Which Treasury maturity best reflects the change?

#### Other relevant assets

The page only displays assets where the mechanism is direct and current.

Example:

| Asset | Pressure | Why it matters now | Confirmation |
|---|---|---|---|
| US 2-year yield | Higher / lower | Fed-path repricing | Yield move after release |
| DXY | Higher / lower | Relative policy path | Broad USD confirmation |
| Nasdaq | Higher / lower | Discount-rate sensitivity | Breadth and semis |

Gold, oil, yen crosses or credit are shown only when the release has a direct mechanism into them.

### 4. Release interaction panel

A release is never interpreted alone. The page shows the relevant data cluster.

Examples:

- ISM New Orders + Production + regional surveys.
- ISM Employment + NFP + claims + JOLTS.
- ISM Prices + PPI + CPI goods + inflation expectations.
- NFP + wages + hours + revisions + unemployment.
- CPI + PPI + import prices + wages + rents.

The page states whether the latest release:

- confirms the cluster;
- contradicts it;
- leads it;
- lags it;
- is too noisy to change the view.

### 5. Recent release strip

The latest high-impact releases appear as compact records:

- release;
- surprise;
- most important component;
- inflation verdict;
- Fed verdict;
- main relevant asset;
- linked active story;
- last verified time.

### 6. History Cabinet

The cabinet is a first-class feature, not a hidden archive.

Filters include:

- release family;
- country;
- date;
- vintage;
- revision status;
- inflation verdict;
- Fed verdict;
- asset;
- story;
- article;
- thesis outcome.

Each cabinet drawer opens:

1. Original release values.
2. Revised values.
3. Component table.
4. Interpretation at publication time.
5. Market reaction at 5 minutes, 1 hour, session close and later review window where data is available.
6. Stories updated.
7. Articles published.
8. Confirmation or invalidation outcome.
9. Analyst notes and lessons.

## Processing model

### Before release

The system creates a pre-release card:

- scheduled time;
- consensus;
- prior and revision risk;
- key components to watch;
- surprise thresholds;
- active stories affected;
- assets with the clearest sensitivity;
- current market pricing.

### At release

The raw release is ingested and locked.

The system calculates:

- headline surprise;
- component changes;
- revision effect;
- three-month trend;
- percentile or historical context where valid;
- initial market reaction.

### After release

The editorial engine produces:

- accepted interpretation;
- overlooked component;
- causal chain;
- strongest counterargument;
- inflation, Fed and relevant-asset checks;
- story updates;
- next catalyst;
- confidence and evidence gaps.

### Later review

The system checks whether the initial interpretation held after:

- the first hour;
- the session close;
- the next related release;
- later revisions.

## How this supports the editorial brain

The editorial brain searches the release ledger for tension.

Examples:

- Headline improves, but New Orders and Employment deteriorate.
- Prices rise because Supplier Deliveries slow during a disruption rather than because demand strengthens.
- Payrolls beat, but hours and prior revisions weaken the labour-income signal.
- CPI misses, but sticky services and wages keep the policy path unchanged.

These tensions become story candidates.

The release page therefore produces more than a verdict. It produces possible OB and COTD angles.

## Story integration

Every release can:

- create a new candidate;
- update an active story;
- strengthen or weaken a causal link;
- change the next catalyst;
- alter an editorial decision;
- close or reopen a story.

The story record shows the release delta rather than copying the entire release page.

## Maintenance model

This variant is easy to maintain because release families use stable templates.

### Stable configuration

Each release family stores:

- component definitions;
- standard comparison periods;
- relevant cross-checks;
- typical policy channels;
- known caveats;
- eligible assets.

### Automated work

The system can automate:

- ingestion;
- actual-consensus-prior table;
- revisions;
- component deltas;
- trend calculations;
- reaction windows;
- cabinet storage;
- linked-story notifications.

### Analyst work

The analyst focuses on:

- identifying the decisive component;
- challenging the default interpretation;
- verifying the causal chain;
- choosing relevant assets;
- deciding whether the release deserves an article.

## Strengths

- Best component-level macro detail.
- Strongest historical retrieval.
- Most useful for ISM, CPI, NFP and Fed-linked work.
- Reduces repeated manual release research.
- Creates an auditable data and interpretation record.
- Makes revisions visible.

## Weaknesses

- Can become data-led rather than story-led.
- Geopolitical and company stories require parallel entry points.
- The homepage may feel less urgent when the main story is not a scheduled release.
- Requires disciplined relevance filters to prevent component overload.

## Best use

Use this variant as the Original's **Data Releases and History Cabinet system**, even if another variant becomes the default homepage.
