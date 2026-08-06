# Live Market Desk V8 Reference Pack

## Status

This directory is the approved design and implementation reference for adapting the production Alchemy Live Market Desk to the V8 format.

The static files under `reference/` are a mockup, not production code. They define the intended information architecture, panel hierarchy, navigation, interaction patterns and visual density. Production implementation should reuse the existing Next.js data loaders, research records and runtime components rather than copying static illustrative data.

## Product role

The Live Market Desk is Alchemy's canonical research, data and memory engine.

It owns:

- source ingestion and verification;
- What's New intake and material-delta detection;
- persistent Stories and event logs;
- article memory and comparison;
- macro releases, components, revisions and interpretations;
- market-state heatmaps;
- CFTC positioning and COTSignal-style presentation;
- lightweight Story-linked charts;
- append-only History Cabinet records;
- the approved snapshot sent to Hybrid.

Hybrid remains the selective interpretative and learning layer. It does not create a second factual record.

## V8 navigation

### Desk

- Overview
- What's New
- Stories
- Articles
- Hybrid Output

### Data and tools

- Macro Data
- Heatmaps
- Positioning
- Charts
- History

Every destination remains visible. The navigation may wrap or scroll on smaller screens, but it must not become a long hidden dropdown hierarchy.

## Reference files

- `DESIGN_PHILOSOPHY.md`: non-negotiable product and interface principles.
- `CURRENT_STATE_SNAPSHOT.md`: inspected production and repository state at the time this pack was created.
- `IMPLEMENTATION_GAP_ANALYSIS.md`: what must change from the current application to reach V8.
- `MIGRATION_PLAN.md`: staged implementation order and acceptance gates.
- `NAVIGATION_AND_INFORMATION_ARCHITECTURE.md`: route ownership and retained-module mapping.
- `MACRO_STORAGE_MODEL.md`: release, component and vintage storage model.
- `FINAL_AUDIT.md`: final feature and operational checklist.
- `reference/`: static V8 HTML, CSS, JavaScript and illustrative JSON.

## Authority order

When future instructions conflict, use this order:

1. explicit current user instruction;
2. production data integrity and source truth;
3. this V8 design philosophy;
4. the static mockup details;
5. older visual or tab structures.

The V8 mockup is an adaptation target. It must not remove proven research functions merely because they are not visible in a static page.
