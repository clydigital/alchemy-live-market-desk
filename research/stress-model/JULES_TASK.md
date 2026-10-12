# Jules task — Dossier stress-model engine

## Objective

Build and test the deterministic calculation layer for the dossier using the structured inputs in this directory.

Do not research market facts. Do not edit Google Docs. Do not write production database state.

## Inputs

- data/exposure_registry.csv
- config/stress_assumptions.yaml
- schema/exposure_registry.schema.json

Process only rows with:
- review_status = MODEL_READY
- scenario_eligible = true
- evidence_type = DISCLOSED or REPORTED

## Build

Use the repository's existing language/tooling where practical.

Implement:

1. registry validation;
2. duplicate/double-count detection;
3. +50/+100 bp duration stress;
4. -15%/-25% collateral-value / LTV stress;
5. utilisation and refinancing coverage sensitivities;
6. contract-defined loss-waterfall calculations;
7. deterministic exports.

## Hard rules

- Never invent a missing amount, duration, collateral value, seniority or recourse term.
- Missing required inputs must produce a clear skipped/error row.
- Proxy duration must be explicitly tagged PROXY.
- Fixed-rate debt does not immediately reprice; refinancing shocks are refinancing-equivalent sensitivities.
- Do not sum rows sharing a double_count_group unless an explicit safe aggregation rule exists.
- Do not sum contingent guarantees with funded debt.
- No generic loss waterfall if contractual seniority/recourse is missing.
- Preserve exposure_id in every output.
- Keep assumptions separate from sourced values.

## Required outputs

- output/duration_stress.csv
- output/collateral_stress.csv
- output/coverage_stress.csv
- output/loss_waterfalls.csv
- output/summary.md

Each output row must include:
- exposure_id
- calculation/model version
- assumption set/scenario
- input evidence type
- output metric/value
- warnings

## Tests

Cover at least:

- duplicate exposure_id rejection;
- unresolved do_not_double_count_with reference;
- forbidden aggregation within double_count_group;
- disclosed vs proxy duration labelling;
- +50/+100 bp duration math;
- -15/-25% collateral/LTV math;
- 90/70/50% utilisation cases;
- 0/100/200 bp refinancing cases;
- 1.5x acceleration and 1.0x severe coverage thresholds;
- missing seniority/recourse stops a loss-waterfall calculation;
- contingent guarantee is not added to funded debt.

## Safety

No merge.
No deploy.
No production DB writes.
No market-source research.
No Google Doc editing.

Return a plan first. The existing Jules workflow requires plan approval before execution.
