# Work High evidence handoff

## Mission

Populate the exposure registry with current, source-backed facts. Do not perform the final stress calculations here.

## Required source order

Prefer:

1. company/regulatory filings;
2. central-bank / Treasury / official data;
3. company investor relations;
4. Reuters / FT / equivalent high-quality reporting;
5. other sources only when necessary and clearly labelled.

## Required fields per row

At minimum:

- exposure_id
- research_block
- institution
- counterparty where known
- instrument
- amount and currency where disclosed
- as_of_date
- maturity where relevant
- seniority
- recourse
- collateral
- liquidity/maturity risk
- evidence_type
- source_url
- source_date
- source_locator
- scenario_eligible
- double-count fields
- review_status

## Classification rules

Use `DISCLOSED` only for direct source disclosures.
Use `REPORTED` for credible secondary reporting.
Use `INFERRED` for analyst interpretation and do not make it a Jules sourced input.
Use `MODELLED` only for already-computed scenario values and keep them out of the sourced registry.

## Before MODEL_READY

Confirm:

- amount and date refer to the same exposure;
- legal borrower/issuer is identified;
- parent guarantee is separate from project debt;
- total commitment is separate from funded amount;
- the row is not duplicated elsewhere;
- source is still current enough for the dossier;
- scenario_eligible is appropriate.

Work High is the final authority on these facts and later owns publication to the Google Doc.
