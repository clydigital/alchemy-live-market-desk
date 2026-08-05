# Judge 02: Systems Architect

## Persona

A staff-level product engineer responsible for keeping both desks maintainable, fast and internally consistent.

The judge values:

- canonical data ownership;
- low duplication;
- reusable components;
- schema-driven rendering;
- predictable invalidation;
- low operational burden;
- strong revision history;
- clear separation between research and presentation.

The judge does not reward a rich interface if it requires repeated manual content assembly.

## Scoring method

Each design is scored from 1 to 10 on:

- Data-model clarity
- Component reuse
- Performance
- Ease of maintenance
- Timely update support
- Historical integrity
- Extensibility
- Implementation risk

A higher Implementation Risk score means lower risk and easier delivery.

## Live Market Desk scores

| Criterion | Variant A: Editorial Triage Grid | Variant B: Release Operating System | Variant C: Story Command Graph |
|---|---:|---:|---:|
| Data-model clarity | 9 | 10 | 8 |
| Component reuse | 9 | 10 | 8 |
| Performance | 9 | 9 | 6 |
| Ease of maintenance | 9 | 10 | 6 |
| Timely update support | 10 | 9 | 8 |
| Historical integrity | 8 | 10 | 10 |
| Extensibility | 9 | 10 | 9 |
| Implementation risk | 8 | 9 | 5 |
| **Total** | **71** | **77** | **60** |

## Live winner

# Variant B: Release Operating System

## Why it wins

Variant B is the cleanest recurring-data architecture.

Its key advantage is the schema-driven release template model. Once the desk supports ISM, CPI, PPI, NFP, retail sales, GDP, FOMC and earnings sensors through templates, new releases do not require new bespoke pages.

The design also has the strongest revision model:

- original vintage;
- revised vintage;
- pre-release consensus;
- reaction windows;
- later interpretation;
- immutable history.

That structure reduces future technical debt.

Variant B can support timely updates because the processing phases are explicit at T-24 hours, T-60 minutes, T+0, T+5 minutes, T+60 minutes, close and T+24 hours.

## Why Variant A does not win

Variant A is highly maintainable and has a strong view-model strategy.

Its weakness is that the event and editorial queue logic will need more judgement rules, ranking tests and exception handling across geopolitical stories, earnings, data releases and market moves.

It remains a good design, but the long-term release template system is more deterministic and easier to validate.

## Why Variant C does not win

Variant C has the richest model but also the highest implementation risk.

The graph needs:

- event clustering;
- duplicate detection;
- evidence classification;
- edge strength;
- graph filtering;
- causal-link versioning;
- interactive rendering.

A relational graph view is possible, but the surface area is larger and the performance path is less predictable.

## Hybrid Market Desk scores

| Criterion | Variant A: Market Morning Show | Variant B: Interactive Casefile | Variant C: Session Mission Board |
|---|---:|---:|---:|
| Data-model clarity | 10 | 9 | 8 |
| Component reuse | 10 | 9 | 8 |
| Performance | 10 | 8 | 8 |
| Ease of maintenance | 10 | 8 | 7 |
| Timely update support | 10 | 9 | 9 |
| Historical integrity | 8 | 10 | 9 |
| Extensibility | 9 | 9 | 8 |
| Implementation risk | 10 | 7 | 6 |
| **Total** | **77** | **69** | **63** |

## Hybrid winner

# Variant A: Market Morning Show

## Why it wins

Variant A has the clearest presentation contract and the lowest content duplication.

A single page template can render:

- Overnight Edition;
- Asia Edition;
- Europe Setup;
- US Setup;
- Evening Wrap.

The server controls segment ordering and the Hybrid renders reusable components.

That makes the page fast, easy to cache and easy to update when the Original changes.

It also avoids a second factual workflow. The Hybrid receives approved view models rather than reading raw research tables.

## Why Variant B does not win

Variant B is architecturally sound, but the interaction surface is larger.

Version compare, evidence filters, causal routes and chapter state create more components and more quality-assurance work.

## Why Variant C does not win

Variant C introduces user progress, session selection, reward state, mission generation and more conditional UI paths.

Those systems are maintainable, but they are additional products layered on top of the research presentation problem.

## Final engineering decision

- **Live Market Desk:** Variant B, Release Operating System
- **Hybrid Market Desk:** Variant A, Market Morning Show

These selections are based on maintainability and delivery risk, not on editorial preference.
