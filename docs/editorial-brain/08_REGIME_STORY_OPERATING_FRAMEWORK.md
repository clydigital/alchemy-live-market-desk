# Regime / Story Operating Framework

## Decision

The Live Desk should organise persistent market understanding around a small, governed set of **Regimes**.

A Regime is the durable market environment. A Story is the current living interpretation of one branch inside that Regime. **What's New** is the dated delta that caused a Story or Regime state to change. Hybrid is the presentation and learning layer that explains the causal chain without becoming a second research brain.

The user-facing hierarchy is:

```text
REGIME
Major market environment
  ↓
SUB-REGIME / DRIVER
A recognisable mechanism inside the Regime
  ↓
STORY
What is actually happening now
  ↓
INVESTIGATION / HYPOTHESIS
What must be resolved
  ↓
EVENT / EVIDENCE
What changed and what proves it

CONCEPTS sit sideways and explain recurring mechanisms.
HYBRID explains the selected Regime, Story or Event using the canonical Live reasoning.
```

## Semantic contract

### Regime

Answers:

> What market environment are we operating in, why does it matter, and which forces are driving it?

A Regime should survive individual CPI prints, earnings releases, policy statements and daily price moves. New Regimes are governed and rare. The runtime must not freely invent them.

Each Regime carries:

- stable identity and title;
- core question;
- why it matters;
- current state and direction;
- confidence;
- sub-regimes / drivers;
- current Stories;
- mechanism map;
- strongest supporting and contradicting evidence;
- latest material change;
- next decisive test;
- affected assets;
- version history.

### Sub-regime / driver

A controlled visual and analytical grouping inside a Regime.

It answers:

> Which part of this Regime is currently doing the work?

Sub-regimes do not own a second evidence store. They aggregate canonical Story reasoning.

### Story

Answers:

> What is actually happening inside this Regime now?

The canonical Story ID, slug, historical thesis lineage and evidence relationships remain stable. The **visible Story headline may change** when the accepted current interpretation materially changes.

Do not use the display title as the identity.

For example, one durable energy-transmission Story may display successively as:

- "Diesel Tightness Persists Even as Crude Retreats";
- "Hormuz Risk Returns as LNG Flows Deteriorate";
- "Energy Inflation Is Finally Losing Its Grip on Rates".

The Story remains one canonical object if the unresolved market question and causal lineage remain substantially the same.

### What's New

Answers:

> What just happened, and what did it affect?

What's New is a delta feed, not a thesis registry.

Every material item should show:

- time;
- exact new fact;
- verification state;
- affected Story;
- affected Regime and sub-regime;
- direction of contribution: supports, contradicts, unresolved or context;
- one-line mechanism impact;
- direct Story link;
- direct Hybrid explanation link when a canonical Hybrid snapshot exists.

A headline that does not move a Story monitor, causal edge, confirmation condition, invalidation condition or material Regime driver remains context.

### Investigation / hypothesis

Answers:

> What needs to be resolved before the Story can be strengthened, weakened or reframed?

Use the existing hypothesis, Challenger, confirmation/invalidation and next-test machinery. Do not create a parallel investigation engine.

### Concept

Answers:

> What is this mechanism, and why does it matter here?

Concepts are not Stories. Examples include HBM, inference, term premium, Treasury buybacks, crack spreads, real yields, reserve diversification and carry trades.

Every Concept explainer should include:

- plain-English definition;
- why it matters to the current Regime/Story;
- what it affects;
- how it is observed;
- what would make it important now;
- canonical aliases so free-text mechanism nodes do not fragment.

## Initial governed Regime map

### 1. Sovereign Funding & Global Cost of Capital

Core question:

> Can governments and companies finance large capital needs cheaply when inflation, sovereign issuance and private investment demand keep required returns elevated?

Sub-regimes:

- Fed / Front End;
- Treasury / Fiscal;
- Long End / Term Premium;
- Global Rates / Japan;
- Credit / Financing;
- Housing / Real Economy.

### 2. US-China AI Industrial Competition

Core question:

> Which ecosystem captures the economics and physical infrastructure of AI as intelligence becomes cheaper and compute becomes strategically important?

Sub-regimes:

- Models / Price War;
- Chips / Accelerators;
- Memory / HBM;
- Cloud / Inference;
- Power / Data Centres;
- Financing / ROIC;
- Export Controls / Industrial Policy.

### 3. Global Energy Security & Inflation

Core question:

> Is marginal energy supply becoming structurally more expensive, fragile or politically constrained, and is that feeding inflation and rates?

Sub-regimes:

- Crude;
- Refining / Products;
- LNG / Gas;
- Shipping / Chokepoints;
- Power;
- Inflation Transmission.

### 4. Gold & Global Reserve Diversification

Core question:

> Is gold gaining a durable monetary and reserve role even when cyclical real-yield and dollar forces move against it?

Sub-regimes:

- Central Banks;
- USD / Reserve System;
- Real Yields;
- Geopolitics;
- ETF / Investor Demand.

### 5. Equity Rally Quality & Earnings Breadth

Core question:

> Is the equity advance becoming economically broader, or does it remain dependent on a narrow set of AI and large-cap earnings leaders?

Sub-regimes:

- AI Leadership;
- Breadth;
- Earnings;
- Consumer;
- Financials;
- Valuation / Rates.

A China domestic growth / credit-transmission Regime may be added later if it clears the Regime gate rather than being forced into the initial set.

## Regime gate

A new Regime should require all of the following:

1. **Persistence:** it can matter for months, not merely days.
2. **Market size:** it affects a systemically important asset class or sector.
3. **Transmission:** the causal path into earnings, inflation, rates, capital flows or risk premia can be stated.
4. **Cross-asset or cross-company reach:** it is larger than a single ticker.
5. **Investability / observability:** the Desk can attach monitors, charts or affected assets.
6. **Falsifiability:** the Desk can state what would weaken, reverse or end it.

The engine may suggest Story-to-Regime links. It must not autonomously create a new Regime in the first implementation.

## Visual design contract

### Regime board

The board should show a small number of Regime cards rather than a flat list of every Story.

Each card must surface immediately:

- **Why this matters**;
- current state and direction;
- compact mechanism summary;
- affected markets;
- active Story count;
- latest material change;
- direct Regime link;
- direct Hybrid explanation link when available.

### Sub-regime tabs

Complex Regimes must not be rendered as long row lists.

Use coloured, stable subgroup tabs or pills for recognition. Colour identifies the subgroup family, not bullish/bearish direction.

Example for rates:

- Fed / Front End;
- Treasury / Fiscal;
- Long End / Term Premium;
- Global Rates / Japan;
- Credit / Financing;
- Housing / Real Economy.

Each tab shows:

- current subgroup state;
- direction of change;
- confidence;
- current Stories;
- deciding monitors;
- latest contributing news/evidence nodes;
- next test.

The same pattern applies to AI, Energy, Gold and Equities, using their governed subgroup dictionaries.

### Contribution nodes

Small news/evidence nodes should surround or sit beneath the mechanism map.

A node must state:

- concise event/fact;
- date/time;
- verification/source tier;
- which causal edge or monitor it affects;
- contribution: strengthens, weakens, unresolved or context;
- linked Story;
- source/evidence record link.

Nodes are not decorative. They are projections of canonical evidence already evaluated through Story reasoning.

## Update path

Regimes must update from canonical Story reasoning, not directly from headlines.

```text
NEWS / DATA / CREATOR
        ↓
Canonical evidence
        ↓
Market belief / divergence
        ↓
Hypothesis + Challenger
        ↓
Story synthesis
        ↓
Immutable Story version
        ↓
Regime projector
        ↓
Story → Regime / subgroup links
        ↓
Aggregate current canonical Story reasoning
        ↓
Did the Regime materially change?
        ├── No: retain current Regime version
        └── Yes: create a new Regime version
```

A creator or news headline cannot directly flip a Regime state.

## Causal explanation contract

The Desk should explain every material conclusion as:

> **Fact → mechanism → market implication**

Preferred writing pattern:

> Because X changed → Y mechanism changed → therefore Z matters for markets.

The current canonical Story reasoning already owns causal edges, evidence states, countercases, next tests and visual plans. The Regime layer must reuse those objects rather than create a second causal graph.

### Understand / Live split

Every Regime page should support two reading modes on the same page:

**UNDERSTAND**

- why the Regime matters;
- how the system works;
- mechanism map;
- key Concepts;
- "you are here" breadcrumbs.

**LIVE**

- current state;
- what changed;
- active Stories;
- supporting and contradicting nodes;
- current monitors;
- next catalysts;
- affected assets.

Historical versions and exact evidence remain below those sections.

## Hybrid contract

Hybrid remains presentation and learning only.

Every relevant Live surface should deep-link into Hybrid when the exact target is available:

- Regime: `/hybrid-output?regime=<regime-slug>`
- Story: `/hybrid-output?story=<story-slug>`
- Event: `/hybrid-output?event=<event-id>`

Hybrid must consume the exact canonical Story/Regime snapshot and must not invent a new thesis, confidence, evidence state or causal conclusion.

The generic `/hybrid-output` route remains available as a fallback.

## Current Story headline rule

The existing persistence rule that freezes the Story title should evolve into:

> **Protect Story identity, not Story headline.**

A visible headline may change when:

- a material Story version is accepted;
- the underlying current interpretation has changed;
- the new headline remains inside the same durable Story identity.

The headline must not change merely because a new article uses different wording.

The append-only Event headline still records the exact new development.

## Lifecycle versus editorial status

Story lifecycle and article/editorial verdict are separate.

Never substitute one for the other in the UI.

Show, where relevant:

- lifecycle: detected / developing / confirmed / weakening / invalidated / archived;
- editorial action: publish / develop / monitor / no article.

## Confidence and evidence coverage

Do not treat confidence as evidence depth.

Show separately:

- thesis confidence;
- evidence coverage / room status;
- verification state;
- momentum.

A Story or Regime can have a coherent high-confidence interpretation but still have thin source coverage. That must remain visible.

## Regime aggregation safeguards

### Evidence deduplication

One canonical evidence item may support multiple Stories and sub-regimes. Do not count it as multiple independent confirmations.

Deduplicate by canonical evidence ID and source-ancestry group before presenting breadth or support counts.

### Many-to-many Story links

A Story may belong to more than one Regime.

Example: AI Financing Stress may be a core AI Story and a bridge into Global Cost of Capital.

Do not clone the Story.

Regime links should carry:

- role: core / supporting / bridge / countercase;
- confidence;
- assignment origin;
- effective-from;
- effective-to where historical membership changes.

### Catalyst expiry

A stale next catalyst must not remain displayed as "Next".

Use structured next-test status:

- upcoming;
- due;
- resolved;
- expired.

Expired tests create visible recalibration debt.

### Historical integrity

Regime versions must pin the Story versions and evidence IDs they were derived from. Later Story edits or changed Regime membership must not rewrite earlier Regime history.

## Known implementation risks

The design must explicitly guard against:

- duplicate Regime and Story objects for the same thesis;
- direct headline-to-Regime mutation;
- evidence double counting across multiple Stories;
- free-text Concept duplication;
- circular causal graphs being forced into false linear chains;
- stale catalysts;
- lifecycle/editorial-state conflation;
- retroactive history changes;
- automatic Regime proliferation;
- UI overload from rendering every causal edge;
- slow pages caused by joining the full evidence corpus on initial load;
- hard-coded Story-slug monitors being recreated unnecessarily at Regime level;
- Hybrid becoming a second source of truth.

## Compatibility rules

1. Existing Story synthesis, Story events, evidence lineage and immutable thesis versions remain canonical.
2. Existing Journey and Dossier selection continue to operate on Stories during the first Regime implementation.
3. Regime support is additive. With the Regime feature disabled, current Story synthesis and publication output must remain functionally identical.
4. Existing Story URLs remain valid.
5. What's New continues to point to exact event/evidence records.
6. Case monitors remain Story-owned and are aggregated upward for Regime display.
7. The Regime layer must reuse canonical causal chains and visual plans.
8. Downstream Power Stack integration comes after the read-only Regime layer is stable.

## Implementation sequence

### Phase 0 — framework and integrity repair

- establish these semantics;
- separate lifecycle from editorial verdict in presentation;
- repair stale next-test handling;
- reconcile taxonomy/migration drift before relying on old theme rows;
- preserve current Story and Hybrid contracts.

### Phase 1 — expose existing explanation machinery

On Story pages, surface:

- why this matters;
- causal chain;
- plain-English explanation;
- asset transmission;
- countercase;
- confirmation/invalidation;
- Concept links where available;
- Hybrid deep link.

No new reasoning stage is required.

### Phase 2 — read-only Regime layer

- create governed Regime definitions;
- create sub-regime dictionaries;
- map current Stories many-to-many;
- build Regime Board and Regime detail pages;
- aggregate existing Story monitors and evidence nodes;
- do not allow autonomous Regime creation.

### Phase 3 — Concept Library

- seed the most recurring concepts;
- assign canonical aliases;
- link causal nodes to Concepts;
- add "why it matters here" explanations.

### Phase 4 — automatic Regime projection

After canonical Story persistence:

- classify Regime and subgroup links;
- aggregate evidence-aware Story state;
- detect material Regime changes;
- version only when the Regime materially changes.

### Phase 5 — Hybrid and downstream integration

- add deep-linked Regime/Story/Event Hybrid views;
- add Regime references to Dossier and Journey without changing Story selection;
- integrate Regime state into Power Stack after stability and parity tests.

## Acceptance tests

### Story versus What's New

A material event can appear in What's New without creating a new Story. A Story headline changes only after a material accepted Story-version change.

### Rates visual test

The rates Regime renders as subgroup tabs/cards, not one long list. Each subgroup shows current state, current Stories, contributing nodes and next test.

### Contribution test

A news item cannot change a Regime unless it first clears canonical evidence and Story reasoning.

### Cross-Regime test

One canonical Story can appear under two Regimes without cloning evidence, events or thesis history.

### Causal-learning test

A user can move from a Regime card to a Story, inspect why it matters, follow the mechanism, open a Concept explanation, and return to the exact point in the causal chain.

### Hybrid parity test

A Live Story/Regime deep link opens the matching Hybrid explanation. Hybrid preserves the exact canonical confidence, evidence state, confirmation and invalidation.

### Historical test

Changing a current Story headline or Regime membership does not alter prior Story or Regime versions.

### Usefulness test

Within sixty seconds the user can answer:

1. Which Regimes matter now?
2. Which subgroup is driving each?
3. What Stories are active inside them?
4. What changed today?
5. Why does it matter?
6. What would change the view next?
