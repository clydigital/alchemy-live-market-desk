# Dossier research tool split

## Purpose

This workflow keeps factual research, quantitative processing, analytical review, and publication separate so the Bond Market / AI Credit Regime dossier can be updated without handoff drift.

The authority order is:

1. **Work High** owns current factual verification and the final published state.
2. **Jules** owns deterministic calculations over Work-verified structured inputs.
3. **Chat High** owns research design, adversarial review, causal challenge, and presentation architecture.

No tool may silently take over another tool's authority.

## Canonical handoff artifact

All three lanes use:

- `research/stress-model/data/exposure_registry.csv`
- `research/stress-model/config/stress_assumptions.yaml`

Every exposure must have one stable `exposure_id`.

The registry is the cross-tool evidence state. The Google Doc is the published research surface, not the calculation input.

## Evidence classes

- `DISCLOSED` — direct company filing, regulator, central bank, official data or company disclosure.
- `REPORTED` — credible secondary source reporting a specific current fact.
- `INFERRED` — analyst interpretation derived from sourced facts.
- `MODELLED` — scenario output or sensitivity calculation.

Only `DISCLOSED` and `REPORTED` values may become sourced quantitative inputs to Jules. `INFERRED` and `MODELLED` values stay in interpretation/model output fields.

## Review states

Rows move through this exact lifecycle:

`EVIDENCE_PENDING -> VERIFIED -> MODEL_READY -> CALCULATED -> REVIEW_FLAGGED | PUBLICATION_READY -> PUBLISHED`

Rules:

- Work High may move `EVIDENCE_PENDING -> VERIFIED -> MODEL_READY`.
- Jules may move `MODEL_READY -> CALCULATED` in generated outputs only; it does not rewrite the evidence registry's factual fields.
- Chat High may flag `CALCULATED -> REVIEW_FLAGGED` in review notes.
- Work High resolves flags and decides `PUBLICATION_READY` and `PUBLISHED`.
- Publication never upgrades an `INFERRED` or `MODELLED` item into factual evidence.

## Chat High

### Owns

- scope each research block;
- define the institution/counterparty universe;
- specify questions, table columns and stress assumptions;
- challenge assumptions and causal links;
- identify missing counterparties and loss-migration paths;
- review Jules outputs for double counting, date mismatch and unsupported causal claims;
- decide what belongs in Regime, Story, What's New, Research Gap and Dossier.

### Does not own

- current source reconciliation;
- source-heavy factual updates;
- live Google Doc editing;
- deciding that a reported value supersedes a filing;
- deterministic stress calculations that code can run.

### Required output before Work

A research brief must state:

- research block;
- hypothesis under test;
- institution list;
- counterparties to find;
- evidence required;
- invalidators;
- stress variables;
- expected Work output;
- missing-data risks.

### Required adversarial review after Jules

Check:

- duplicate economic exposure under different legal entities;
- parent debt plus guaranteed project debt counted twice;
- guarantees treated as funded liabilities;
- quarterly/annual or stale/current dates mixed;
- fixed-rate debt treated as immediately repricing;
- proxy duration presented as disclosed duration;
- collateral shocks applied to the wrong asset class;
- a loss waterfall that jumps over contractual seniority/recourse;
- modelled output presented as observed evidence;
- missing next-holder / forced-seller step.

## Work High

### Owns

- current filings and credible market-source research;
- source reconciliation;
- current dates and disclosed amounts;
- disclosed-vs-reported-vs-inferred classification;
- legal recourse, seniority, collateral and maturity mapping;
- final factual judgment;
- Google Doc publication and visual verification.

### Evidence collection rule

One registry row represents one economic exposure or one contingent obligation.

If two rows overlap, populate `double_count_group` and `do_not_double_count_with`.

Do not combine:

- project debt and parent guarantee;
- asset value and debt balance;
- total commitment and already-funded amount;
- SPV debt and parent debt;

unless the source explicitly establishes they are additive.

### Work publication gate

Before publication:

1. resolve every `REVIEW_FLAGGED` item;
2. confirm source URLs and as-of dates;
3. preserve evidence class labels;
4. import only reviewed calculation outputs;
5. label stress results as scenarios;
6. update Dossier/dashboard;
7. verify live document headings, links and tables.

Work High is the final factual authority.

## Jules

### Owns

- schema validation;
- exposure deduplication checks;
- duration calculations;
- collateral/LTV stress;
- coverage/refinancing sensitivities;
- contract-defined loss waterfalls;
- deterministic tests;
- clean CSV and Markdown exports.

### Does not own

- web research;
- deciding which market claim is true;
- choosing between conflicting filings/reports;
- changing sourced amount/date/recourse fields;
- editing the Google Doc;
- publishing to production;
- creating a new market thesis.

Jules must stop on an input needed for a calculation if it is missing or ambiguous rather than inventing it.

## Stress model contract

Jules reads only rows with:

- `review_status=MODEL_READY`;
- `scenario_eligible=true`;
- sourced quantitative values classified `DISCLOSED` or `REPORTED`.

Assumptions live only in `stress_assumptions.yaml`.

Outputs must include:

- `exposure_id`;
- input source classification;
- model version;
- assumption set;
- scenario name;
- output metric;
- output value;
- warnings.

## No-double-count rule

Before aggregate results are produced:

1. `exposure_id` must be unique.
2. Rows sharing a `double_count_group` cannot be summed unless a declared aggregation rule permits it.
3. `do_not_double_count_with` references must resolve to existing exposure IDs.
4. Contingent guarantees and funded debt are reported separately.
5. Parent and subsidiary exposures are not automatically additive.

## Dossier blocks

Current expected blocks include:

- Treasury holders / forced sellers;
- Japan repatriation;
- AI credit and SPV recourse;
- AI Monetisation Gap;
- CRE and regional banks;
- private credit;
- AI control/liability;
- private AI capital;
- Scenario A-E aggregation.

## Final authority

When lanes disagree:

- **fact/source dispute -> Work High**
- **calculation dispute -> Jules tests**
- **interpretation/architecture dispute -> Chat High challenges**
- **publication decision -> Work High after review**

This process does not change the canonical Live Desk evidence architecture. Model outputs are reasoning artifacts and must never masquerade as canonical evidence.


## Active research brief

Current first-pass Chat High brief: `research/stress-model/briefs/AI_CREDIT_MONETISATION_RECOURSE.md`.

Work High should complete this evidence block before Jules results are treated as useful market outputs. Jules may build/test the engine against fixtures while the live evidence registry remains empty.
