# Dossier stress-model workspace

This directory is the structured handoff surface for the Bond Market / AI Credit Regime dossier.

## Inputs

- `data/exposure_registry.csv` — Work-verified exposure rows.
- `config/stress_assumptions.yaml` — explicit scenario assumptions.

## Outputs Jules must build

Jules should create and test:

- `src/validate_registry.*`
- `src/dedupe.*`
- `src/duration_stress.*`
- `src/collateral_stress.*`
- `src/coverage_stress.*`
- `src/loss_waterfall.*`

and export:

- `output/duration_stress.csv`
- `output/collateral_stress.csv`
- `output/coverage_stress.csv`
- `output/loss_waterfalls.csv`
- `output/summary.md`

Use the repository's existing language/tooling where practical. Do not add an unnecessary runtime.

## Boundary

This workspace is not a second canonical research database.

Work High remains responsible for source truth and publication. Jules transforms verified inputs only. Chat High reviews the reasoning and modelling for errors before Work publishes.
