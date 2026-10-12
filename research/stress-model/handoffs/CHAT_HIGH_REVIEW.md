# Chat High adversarial review

Run after Jules exports results and before Work publication.

## Double-count audit

- Is parent debt being added to subsidiary debt that it already consolidates?
- Is project debt being summed with a contingent guarantee?
- Is asset value being added to debt exposure?
- Is the same loan/bond represented through both lender and borrower views in one aggregate?
- Do all double_count_group and do_not_double_count_with references resolve?

## Time-basis audit

- Are quarterly and annual figures mixed?
- Are balance-sheet dates aligned?
- Are market prices/yields current to the scenario date?
- Does a later filing supersede the current row?

## Duration audit

- Is duration disclosed or proxied?
- Is proxy duration labelled?
- Has fixed-rate debt been treated as if it reprices immediately?
- Are convexity/hedges omitted and, if so, disclosed?

## Collateral audit

- Does the asset actually secure the debt?
- Is the collateral value sourced or inferred?
- Is a 15%/25% shock meaningful for that asset class?
- Does stressed LTV imply refinancing pressure rather than automatic principal loss?

## Coverage audit

- Is EBITDA/OCF scaling with utilisation an explicit assumption?
- Are customer prepayments being treated as financing support rather than revenue?
- Are contract protections, hedges or variable-cost offsets omitted?
- Is a stress result described as a scenario rather than a prediction?

## Loss-migration audit

- Who absorbs first loss?
- What contractual seniority applies?
- Where does recourse stop?
- What condition makes the next holder a forced seller?
- Is there a missing bank, insurer, fund, pension or parent-company step?

## Publication decision

For each finding mark:

- PASS
- REVIEW_FLAGGED — factual/source problem
- REVIEW_FLAGGED — calculation problem
- REVIEW_FLAGGED — causal/interpretation problem

Work resolves factual flags. Jules resolves calculation bugs. Chat re-reviews causal logic after corrections.
