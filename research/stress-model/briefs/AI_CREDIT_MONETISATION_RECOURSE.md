# Chat High Research Brief — AI Credit / Monetisation / Recourse

## Research block

`ai_credit_monetisation_recourse_v1`

## Primary question

Can AI revenue and utilisation grow fast enough to service the infrastructure, debt, leases and project-finance commitments already being accumulated — and where does the loss migrate first if they do not?

## Hypothesis under test

The current AI cycle is not yet a broad credit crisis.

The leading risk is a widening **Monetisation Gap**:

AI revenue growth
vs
binding infrastructure-cost growth
vs
financing cost.

The cycle becomes materially more dangerous when stress migrates:

project/SPV
→ parent recourse
→ broad high yield
→ broad investment grade
→ financial institutions.

## Institutions / structures Work must research

### Core borrower / sponsor set

1. CoreWeave
2. Oracle
3. Meta
4. Anthropic
5. Amazon — only financing structures directly relevant to AI infrastructure/SPVs
6. Alphabet / Google
7. Microsoft
8. Broadcom — where vendor/customer financing creates credit exposure
9. Blue Owl / Beignet / Hyperion structure
10. PIMCO / disclosed Beignet institutional bond exposure where publicly supported

### Add only if current evidence shows a direct financing link

- major banks arranging or retaining AI project loans;
- private-credit funds providing AI infrastructure loans;
- insurers/pensions disclosed as direct holders of specific AI project debt;
- Nvidia financing/support structures;
- additional neocloud borrowers where leverage/recourse is material.

Do not broaden into a generic AI-company list.

## Required evidence per exposure

For each legal exposure, Work should identify:

- legal borrower / issuer;
- ultimate parent / sponsor;
- counterparty / customer;
- funded amount;
- total commitment where different;
- currency;
- as-of date;
- maturity;
- coupon / spread;
- secured vs unsecured;
- seniority;
- recourse classification;
- parent guarantee;
- collateral;
- customer contract tenor;
- debt tenor;
- cancellation rights;
- minimum-spend / take-or-pay terms;
- residual-value support;
- DSCR / covenant if disclosed;
- customer prepayment support;
- equity cushion / sponsor contribution;
- current rating / spread where observable;
- current liquidity / refinancing risk;
- source URL;
- evidence class.

## Mandatory distinctions

Work must explicitly separate:

- funded debt vs total commitment;
- operating lease vs finance lease;
- project debt vs parent debt;
- project debt vs contingent guarantee;
- parent guarantee vs actual funded liability;
- customer prepayment vs recognised revenue;
- collateral value vs debt principal;
- legal recourse vs economic dependence;
- disclosed figure vs reported figure;
- reported figure vs analyst inference.

## Core exposure IDs to create where supported

Use stable IDs of this form:

- `CRWV-DDTL4-2026`
- `CRWV-DDTL5-2026`
- `CRWV-DDTL55-2026`
- `META-BEIGNET-NOTES-2026`
- `META-HYPERION-RVG-2026`
- `ORCL-LTD-2026Q1`
- `ORCL-CUSTOMER-PREPAY-2026Q1`
- `ANTH-COMPUTE-COMMIT-2026`
- `AVGO-ANTH-FINANCE-2026`
- `AMZN-AI-SPV-PROPOSED-2026`

If a structure is proposed but not completed, mark it `REPORTED`, `scenario_eligible=false` unless the eventual contract becomes sufficiently defined.

## Key counterparties to find

### CoreWeave

Find:
- lender groups / agents;
- customers backing each facility;
- parent guarantee terms;
- collateral package;
- hedge requirements;
- DSCR / coverage terms;
- remaining customer contract life;
- whether facilities are fully drawn.

### Meta / Beignet / Hyperion

Find:
- exact issuer;
- project owner;
- Blue Owl equity entities;
- Meta ownership share;
- bondholder/institutional financing disclosures;
- lease commitments;
- residual-value guarantee;
- events that actually trigger Meta support;
- whether any guarantee is capped / declining;
- debt maturity and duration.

### Oracle

Find:
- total debt and maturities;
- current interest expense;
- current capex;
- customer prepayments with financing component;
- backlog / RPO;
- project-finance structures such as Jupiter where publicly documented;
- whether Oracle parent guarantees project obligations;
- debt/equity financing plans.

### Anthropic

Find:
- future compute/infrastructure commitments;
- cancellable vs non-cancellable share;
- minimum-spend / take-or-pay terms;
- Google / Amazon / Microsoft / Broadcom obligations;
- current revenue run rate;
- financing sources;
- whether vendor financing is direct debt, lease, purchase financing or another structure.

### Broadcom / Anthropic

Find:
- committed financing amount;
- borrower / lessee;
- purpose;
- recourse;
- conversion features;
- security / collateral;
- whether financing directly supports purchases from Broadcom;
- timing of drawdown.

## Work output columns

Populate `research/stress-model/data/exposure_registry.csv`.

Every row must complete, where available:

- exposure_id
- research_block
- institution
- counterparty
- instrument
- amount
- amount_currency
- as_of_date
- maturity_date
- coupon_pct
- spread_bps
- seniority
- recourse
- collateral_type
- liquidity_risk
- maturity_mismatch
- evidence_type
- source_url
- source_date
- source_locator
- scenario_eligible
- double_count_group
- do_not_double_count_with
- review_status
- notes

## Double-count controls

### Meta / Beignet

The project notes, Blue Owl project equity, Meta lease commitments and Meta residual-value guarantee must not be summed into one “Meta debt” figure.

Expected groups:

`META-HYPERION-ECONOMIC-EXPOSURE`

The funded Beignet debt can be modelled as project debt.

The residual-value guarantee is contingent support.

The Meta lease is an operating/economic obligation.

Keep each separate.

### CoreWeave

Do not sum total corporate debt with each DDTL facility if the total already includes those facilities.

Use:

`CRWV-TOTAL-DEBT-2026Q2`

as a parent aggregate row and individual facilities as components.

Tag components and aggregate into the same double-count group.

### Anthropic

Do not sum the total ~$518bn infrastructure commitment with Google/Amazon/Microsoft/Broadcom components unless the source proves the total excludes those components.

Default assumption:
components belong inside the total until reconciliation proves otherwise.

## Questions Work must resolve before MODEL_READY

1. Which CoreWeave facilities are genuinely non-recourse / limited recourse versus parent-guaranteed?
2. Which AI financing structures have migrated toward stronger parent recourse over time?
3. Which customer contracts expire before debt maturity?
4. Which commitments remain payable even if capacity is unused?
5. Which infrastructure commitments are cancellable?
6. Which customer prepayments act as a financing source?
7. Are current project-debt spreads widening because of supply indigestion or weakening expected cash flow?
8. Which lenders retain exposure that was originally intended for syndication/distribution?
9. Are any disclosed institutional holders themselves leveraged or liquidity-sensitive?
10. Which exposures would generate a forced capital raise rather than a default under a moderate stress?

## Stress variables for Jules

Jules should only run on MODEL_READY rows.

### Utilisation

- 90%
- 70%
- 50%

### Refinancing-equivalent spread

- 0 bp
- +100 bp
- +200 bp

### Coverage thresholds

- 1.50x = acceleration warning
- 1.00x = severe warning

### Collateral / project value

Where meaningful and sourced:

- -15%
- -25%

### Duration

Use disclosed duration where available.

If absent and the instrument is eligible:
- proxy duration must be tagged `PROXY`;
- never imply institutional duration is known.

## Required calculations

### CoreWeave

- adjusted EBITDA / contractual interest coverage;
- utilisation sensitivity;
- refinancing-equivalent sensitivity;
- stressed collateral/LTV where collateral values are available;
- facility-by-facility recourse migration;
- parent aggregate must not double count component facilities.

### Oracle

- operating-income / interest coverage;
- OCF minus capex;
- prepayment-adjusted OCF sensitivity;
- +100/+200 bp refinancing-equivalent cost;
- 6/12/24-month illustrative funding-gap sensitivity if current capex/OCF relationship persists.

The delay model must be explicitly labelled MODELLED and not treated as a forecast.

### Meta

- OCF minus capex;
- debt refinancing-equivalent cost;
- project/lease/guarantee obligations separate from parent debt;
- do not infer solvency stress from compressed FCF alone.

### Anthropic

- infrastructure commitment / revenue-run-rate intensity;
- binding/non-cancellable share;
- utilisation cost multiplier;
- 6/12/24-month monetisation-delay sensitivity where payment timing can be supported.

Do not fabricate a debt-service ratio if Anthropic debt-service data are not disclosed.

## Invalidators of the bearish Monetisation Gap thesis

Work should actively seek evidence that would weaken the thesis:

- AI revenue grows faster than infrastructure commitments;
- GPU/cloud rental prices remain firm;
- CoreWeave coverage improves;
- CoreWeave renews customer contracts at attractive economics;
- Oracle converts backlog into cash while prepayment support remains strong;
- hyperscaler FCF re-expands despite capex;
- AI spreads narrow relative to broad IG;
- new AI project debt needs less, not more, parent support;
- safety regulation increases security spend but does not delay deployment;
- excess capacity is readily reallocated because compute scarcity persists.

## Evidence that would accelerate the thesis

- CoreWeave-style interest coverage toward 1.5x;
- parent guarantees become more common in newer project financings;
- customer contract tenor shortens while debt tenor stays long;
- customer prepayment growth slows materially;
- AI cloud/GPU rental pricing weakens;
- AI project spreads widen while broad IG stays stable;
- later-stage AI equity becomes harder to raise;
- non-cancellable capacity remains while utilisation drops;
- safety/regulatory delays cause actual compute or project cancellations;
- AI-linked widening spreads begin spreading into broad HY / IG.

## Missing-data flags

The following are likely not fully public and should never be invented:

- true data-centre/GPU utilisation;
- private loan secondary prices;
- full lender allocation lists;
- private side-letter guarantees;
- precise hardware residual values;
- complete customer-level contract renewal schedules;
- exact private-company free cash flow.

Use `notes` and keep `review_status=EVIDENCE_PENDING` where a required fact is missing.

## Expected Work deliverable

1. Source-backed registry rows.
2. One short reconciliation note for every double-count group.
3. A list of missing/ambiguous fields.
4. A list of rows promoted to MODEL_READY.
5. No stress calculations beyond trivial source normalisation.
6. No Google Doc publication yet.

## Chat High adversarial review after Jules

The second Chat pass should answer:

- Are any outputs mechanically correct but economically misleading?
- Did utilisation stress assume costs scale too neatly?
- Did refinancing stress reprice fixed debt too aggressively?
- Are project-level and parent-level stresses being conflated?
- Are guarantees treated as if already funded?
- Is delayed revenue being confused with lost revenue?
- Does the loss actually migrate to the named next holder?
- What happens before default — capex cut, equity injection, covenant reset, asset sale, customer renegotiation?
- Which result materially changes Scenario A/B/C/D/E?
