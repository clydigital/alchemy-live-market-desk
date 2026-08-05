# Original Variant C: Macro Operating System

## Thesis

The Original Live Desk becomes a persistent macro state machine. Releases and stories update a set of linked economic and market regimes rather than remaining isolated cards.

This variant is best when the main goal is to understand how multiple releases interact over time and how those interactions change the policy and asset backdrop.

The central question is:

> What state is the economy and market in, which evidence moved that state, and what would change it next?

## Core experience

The homepage begins with a Macro State Board containing a small number of persistent state variables:

- Growth;
- Inflation;
- Labour;
- Liquidity and credit;
- Central-bank stance;
- Oil and physical supply;
- Risk appetite;
- USD regime;
- Yen and carry regime;
- AI and capital-expenditure regime.

Every state has:

- current assessment;
- confidence;
- supporting evidence;
- contradicting evidence;
- latest material update;
- next catalyst;
- affected stories and assets;
- history trail.

## Homepage structure

### 1. State changes since last visit

Instead of listing all news, the page states which macro states changed and why.

Example:

- Growth moved from Stable to Softening after weaker New Orders, hours worked and freight volumes.
- Inflation remained Sticky because ISM Prices rose, but the signal was supply-led and did not yet broaden into services.
- Fed stance remained Hawkish Hold because the inflation signal outweighed softer activity in current pricing.

### 2. Dominant regime

The system produces one concise regime statement.

Example:

> Slowing growth, sticky inflation and firm front-end yields keep the dollar supported, but increase the risk that equities become more sensitive to weak labour data.

The statement is versioned and linked to the evidence that produced it.

### 3. Regime driver tree

The driver tree shows causal relationships.

Example:

- Oil disruption
  - higher goods-input costs;
  - firmer inflation expectations;
  - delayed easing;
  - stronger USD policy advantage;
  - pressure on duration-sensitive equities;
  - greater Japanese imported-cost pressure;
  - higher intervention sensitivity.

Each link carries a status:

- active;
- strengthening;
- weakening;
- unconfirmed;
- broken.

### 4. Release-to-state mapping

Each major release updates one or more states.

For ISM Manufacturing:

| Component | Primary state | Secondary state | Interpretation |
|---|---|---|---|
| New Orders | Growth | Risk appetite | Forward demand |
| Production | Growth | Earnings | Current activity |
| Employment | Labour | Fed | Hiring confirmation |
| Supplier Deliveries | Inflation | Physical supply | Demand or disruption |
| Inventories | Growth | Margins | Stock cycle |
| Prices | Inflation | Fed | Goods-input pipeline |
| Backlog | Growth | Inflation | Capacity pressure |
| New Export Orders | Global growth | FX | External demand |
| Imports | Domestic demand | Trade | Input and demand context |

A component may update a state only when the interpretation clears its evidence threshold.

### 5. Policy reaction function

The Fed page is not a single dovish or hawkish label. It shows a reaction function:

- inflation state;
- labour state;
- growth state;
- financial conditions;
- market pricing;
- risk-management asymmetry.

The output can be:

- Hawkish hold;
- Dovish hold;
- Inflation-constrained easing;
- Growth-constrained tightening;
- Two-sided uncertainty;
- Policy transition.

The system records which evidence moved the label.

### 6. Asset transmission board

Only high-relevance asset links are shown.

Example:

| State change | Asset | Mechanism | Horizon | Confirmation |
|---|---|---|---|---|
| Front-end repricing higher | DXY | Relative rate advantage | Immediate | US 2Y and broad USD |
| Growth softening | Nasdaq | Earnings and discount-rate conflict | Days | Breadth and guidance |
| Yen intervention risk rising | AUDJPY | Carry unwind | Immediate | Cross-yen breadth |

The board rejects weak or generic relationships.

### 7. Story layer

Stories become narratives explaining why one or more states may be changing.

A story contains:

- event;
- state affected;
- accepted view;
- overlooked variable;
- causal path;
- evidence for and against;
- asset implications;
- next state-changing catalyst.

## Data Releases workspace

The Latest Data Releases page remains detailed.

Each release has:

1. Headline and components.
2. Actual, consensus, prior and revisions.
3. What changed.
4. State variables updated.
5. Inflation check.
6. Fed check.
7. Other relevant assets.
8. Cross-release confirmation.
9. Story implications.
10. Cabinet history.

The distinguishing feature is the **state delta**.

Example:

> ISM Manufacturing did not change the broad Growth state because stronger Production was offset by weaker New Orders. It did raise the short-term goods-inflation state because Prices and Supplier Deliveries increased together, although the cause of slower deliveries remains under investigation.

## History Cabinet

The cabinet stores both releases and state histories.

### Release drawers

- raw and revised vintages;
- components;
- interpretation;
- reaction;
- linked stories;
- review outcome.

### State drawers

- state at each date;
- evidence added or removed;
- confidence changes;
- policy implication changes;
- asset transmission changes;
- later outcome.

### Regime episodes

The cabinet can group periods such as:

- disinflation with resilient growth;
- stagflation pressure;
- policy easing with weak labour;
- oil shock;
- yen carry unwind;
- AI capex optimism versus return concerns.

Historical episodes are used as context, not automatic analogues.

## Editorial brain

The editorial engine looks for:

- state conflicts;
- new evidence that breaks the regime;
- price action inconsistent with the state;
- one state moving while another remains stable;
- upcoming catalysts capable of changing the dominant regime.

Example angles:

- Manufacturing improves, but the forward-demand state still weakens.
- Inflation pressure rises without stronger demand.
- Labour softens, but the Fed remains constrained by oil.
- Equities rally even as the discount-rate state worsens.

These conflicts produce the story queue.

## Maintenance model

### Stable state dictionary

The system maintains a finite set of states with documented definitions. New states require governance rather than ad hoc creation.

### Evidence weighting

Each release component maps to eligible states through configuration. The analyst can override the mapping with a recorded reason.

### Versioned state summaries

State prose is generated from structured evidence and saved as a version. Analysts edit the interpretation, not the underlying observations.

### Reusable interactions

The same state object powers:

- homepage regime summary;
- policy page;
- story briefs;
- asset board;
- Hybrid journeys;
- History Cabinet.

## Strengths

- Best cross-release synthesis.
- Strongest framework for Inflation, Fed and asset interaction.
- Prevents single-release overreaction.
- Creates persistent macro memory.
- Supports quarterly outlooks and daily research from the same state.
- Makes it easier to understand why a new release did or did not change the view.

## Weaknesses

- More abstract than an event-first newsroom.
- Requires careful state definitions and evidence weighting.
- Can become model-heavy and slow if too many states are added.
- Risks hiding the human story inside a regime label.

## Best use

Use this variant as the Original's **persistent macro state and cross-release synthesis layer**. Pair it with Variant B's event-first homepage and Variant A's detailed Release Ledger.
