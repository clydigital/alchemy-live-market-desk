# Work High Task — AI Credit / Monetisation / Recourse

## Source brief

Read first:

- `research/stress-model/briefs/AI_CREDIT_MONETISATION_RECOURSE.md`
- `docs/DOSSIER_TOOL_SPLIT.md`
- `research/stress-model/handoffs/WORK_HIGH_EVIDENCE.md`
- `research/stress-model/schema/exposure_registry.schema.json`

## Goal

Populate the live evidence registry for the first dossier block:

`research_block = ai_credit_monetisation_recourse_v1`

Do not calculate stress results yet.

## Required institutions / structures

Research current authoritative evidence for:

1. CoreWeave
   - DDTL 4.0
   - DDTL 5.0
   - DDTL 5.5
   - total corporate debt aggregate
   - current contractual interest expense
   - customer-contract tenor where disclosed

2. Meta / Hyperion / Beignet
   - Beignet senior secured notes
   - project ownership
   - Blue Owl sponsor equity
   - Meta project ownership
   - lease commitments
   - residual-value guarantee
   - support-trigger conditions

3. Oracle
   - long-term borrowings
   - interest expense
   - capex
   - operating cash flow
   - customer prepayments with financing component
   - RPO / backlog
   - material project-finance structures if publicly documented

4. Anthropic
   - total infrastructure / compute commitments
   - non-cancellable or usage-independent share
   - named counterparties
   - revenue run rate
   - current financing structures

5. Broadcom / Anthropic
   - committed financing amount
   - structure / legal borrower or lessee
   - recourse / security / conversion features
   - use of proceeds
   - whether financing supports Broadcom purchases or leases

6. Amazon
   - proposed AI-chip SPV only if still current and sufficiently documented
   - keep `scenario_eligible=false` while proposed / contract terms incomplete

7. Alphabet / Google and Microsoft
   - add rows only for direct disclosed/reported exposures relevant to Anthropic or material AI infrastructure financing
   - do not create generic capex rows unless they answer the recourse / financing question

## Source hierarchy

Use, in order:

1. SEC / regulatory filings
2. company IR / official company disclosures
3. official rating-agency transaction documents
4. Reuters / FT for current reported structures not yet fully filed
5. other sources only when necessary, explicitly labelled

## Registry-writing rules

Write to:

`research/stress-model/data/exposure_registry.csv`

### Allowed evidence types for sourced rows

- DISCLOSED
- REPORTED

Do not populate INFERRED or MODELLED facts into this source registry.

### Review status

Use:

- `EVIDENCE_PENDING` — missing a material field or source conflict
- `VERIFIED` — source reconciled but not yet ready for modelling
- `MODEL_READY` — all fields required for its intended calculation are present and double counting is resolved

## Required reconciliation notes

Create:

`research/stress-model/evidence/AI_CREDIT_RECONCILIATION.md`

It must contain:

### CoreWeave

- total debt vs facility components
- which facilities are limited/non-recourse vs parent-guaranteed
- whether individual facilities are fully included in the total corporate debt figure

### Meta / Hyperion

- funded project debt
- sponsor equity
- Meta lease obligations
- Meta residual-value guarantee
- explicit statement that these are not all additive as “Meta debt”

### Anthropic

- whether named counterparty commitments are components of the reported total
- any unresolved overlap
- what portion is fixed/non-cancellable

### Oracle

- customer prepayment inflow is financing support, not recognised revenue
- whether project-finance exposures are consolidated / guaranteed / separate

## MODEL_READY gates by calculation

### Duration stress

Must have:
- market value or principal amount suitable for the calculation;
- maturity / disclosed duration or explicit proxy eligibility;
- evidence type DISCLOSED or REPORTED;
- no unresolved double-count conflict.

### Collateral/LTV stress

Must have:
- debt amount;
- collateral value or a documented valuation base;
- clear collateral linkage;
- seniority/recourse;
- no unresolved double-count conflict.

If collateral value is not disclosed, do not invent one. Keep the row out of collateral stress.

### Coverage stress

Must have:
- income/EBITDA/OCF metric relevant to the borrower;
- interest expense or financing cost;
- matching or reconcilable period;
- notes on fixed vs variable cost limitations.

### Loss waterfall

Must have:
- seniority;
- legal recourse;
- collateral/support structure;
- enough contractual information to identify first-loss sequence.

If not, Jules must not run a generic waterfall.

## Work deliverables

Commit only:

1. populated `exposure_registry.csv`;
2. `evidence/AI_CREDIT_RECONCILIATION.md`;
3. optional `evidence/AI_CREDIT_MISSING_FIELDS.md` if unresolved items remain.

Do not modify:
- stress-model source code;
- Jules outputs;
- the Google Doc;
- production database;
- Live Desk / Hybrid production state.

## Completion checklist

Before marking complete:

- every exposure_id is unique;
- every source has an as-of date;
- parent/project/guarantee overlap is documented;
- every MODEL_READY row has enough inputs for its intended calculation;
- proposed structures are not treated as completed;
- no unsupported utilization values are inserted;
- no generic AI capex figures are added unless they connect to the financing/recourse question;
- missing private information is explicitly left missing rather than estimated.

After this Work task is complete, Jules may run its deterministic calculations on MODEL_READY rows, and Chat High performs the adversarial review before Work publication.
