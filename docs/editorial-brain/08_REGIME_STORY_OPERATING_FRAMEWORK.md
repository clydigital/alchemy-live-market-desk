# Regime / Story Operating Framework

## Decision

The Live Desk should organise persistent market understanding around a small, governed set of **Regimes**.

Implementation must also satisfy the binding failure-mode and rollout constraints in [Regime Implementation Hardening & Failure Modes](09_REGIME_IMPLEMENTATION_HARDENING.md). Where this framework describes the product model and the hardening document adds a stricter safety/integrity rule, the hardening rule wins.

A Regime is the durable market environment. A Story is the current living interpretation of one branch inside that Regime. **What's New** is the dated delta that caused a Story or Regime state to change. Hybrid is the presentation and learning layer that explains the causal chain without becoming a second research brain.

For Market Motion, Dossier reasoning is the analytical handoff before canonical Story mutation. An evidence-backed Dossier `ACCEPT` or `REFINE` with an exact Story identity must queue that exact Story for canonical re-evaluation using the exact packet evidence; lexical Story matching is fallback only. Regime-only acceptance must not invent a Story link. Canonical Story acceptance remains the boundary consumed by the Regime projector.

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


## System 1 / System 2 operating model

The Regime architecture must use the existing two-speed research pattern rather than send every update through the same reasoning path.

### System 1 — deterministic sensing and triage

System 1 is always-on, cheap, reproducible and bounded.

It may:

- normalise and deduplicate canonical evidence;
- apply freshness and source-verification rules;
- calculate direct market/statistical readings;
- compare observations with explicit deterministic thresholds;
- maintain structured subgroup telemetry;
- apply documented conventional directional priors;
- detect deterministic expected-versus-observed mismatch candidates;
- identify stale or expired next tests;
- map an observation to candidate Regime/sub-regime destinations using governed rules;
- create a factual What's New delta;
- decide whether the item needs System 2 attention.

System 1 must not:

- invent a causal explanation;
- declare a headline's motive;
- rewrite a Story thesis or headline;
- create a new Regime;
- decide that two coexisting levels prove a causal divergence;
- convert a creator/news claim into a canonical fact without verification;
- strengthen a Regime merely because several duplicated sources repeat the same claim.

The current Dossier V2 rates implementation is the model for this layer. It already deterministically evaluates policy impulse, front-end pricing, real yields, breakevens and the long end, and it already creates bounded divergence candidates. Dollar-liquidity classification is another existing System 1 sensor.

### System 2 — causal interpretation and revision

System 2 is selective, slower and evidence-bounded.

The existing Market Belief → Divergence → Hypothesis → Challenger → Scenario → Story Synthesis path is the canonical System 2 reasoning chain.

System 2 activates when System 1 or the existing Story-maintenance queue identifies a material question, including:

- a high-materiality verified event;
- a deterministic divergence candidate;
- a contradiction to an active Story;
- a deciding monitor crossing a meaningful threshold;
- a Story's next test resolving;
- evidence that may reframe a causal mechanism;
- evidence that may require a current Story headline change;
- a possible cross-Regime bridge;
- a candidate material Regime-state change;
- a high-impact item that cannot be safely classified by deterministic rules.

System 2 owns:

- causal explanation;
- competing mechanisms;
- hypothesis formation;
- Challenger/countercase;
- confirmation and invalidation;
- current Story thesis;
- current visible Story headline;
- Story-versus-new-Story decision;
- Story-to-Regime role when deterministic routing is insufficient;
- Regime interpretation from the aggregate of current Story reasoning;
- "why this matters" explanation;
- causal mechanism presentation supplied to Hybrid.

System 2 must remain evidence-bounded. It may interpret supplied canonical evidence but may not manufacture a missing observation, probability, price move or source.

### Activation rule

Do not run System 2 on every What's New item.

Use:

```text
canonical evidence
      ↓
SYSTEM 1
observe / classify / measure / triage
      ↓
is there a material unresolved question?
      ├── NO
      │    ↓
      │  What's New factual delta / context only
      │  telemetry updates if directly measurable
      │
      └── YES
           ↓
        SYSTEM 2
        hypothesis → challenger → Story synthesis
           ↓
        accepted Story version
           ↓
        Regime projection
```

This preserves budget and prevents the slower reasoning layer from rewriting stable conclusions because of routine noise.

### Two-state presentation rule

Regime and sub-regime UI must distinguish:

1. **Observed telemetry** — deterministic System 1 readings.
2. **Interpreted state** — System 2's current evidence-backed explanation.

Example:

```text
LONG END / TERM PREMIUM

Observed telemetry — System 1
US10Y: 5.18%
5D: +11 bp
US30Y: 5.42%
State: restrictive / higher

Interpreted state — System 2
"Long-end pressure is increasingly being sustained by
fiscal/debt-supply and global-duration forces rather than
the immediate oil impulse alone."

Confidence: 78%
```

If a Regime lacks adequate deterministic sensors, the observed layer must say **UNRESOLVED / COVERAGE GAP**. System 2 interpretation must not be presented as if it were a deterministic measurement.

## Exact integration and update contract

The following is the required end-to-end behaviour for Regimes, Stories, What's New and Hybrid.

### Step 1 — acquisition and canonical evidence

News, releases, market data, filings, creator material and specialist data enter the existing acquisition path.

Only canonical, provenance-linked evidence can alter Story or Regime reasoning. Discovery-only material may recruit research but cannot prove a mutation by itself.

### Step 2 — System 1 observation

System 1 evaluates what can be known deterministically:

- what changed;
- when it changed;
- source/freshness state;
- direct market/statistical reading;
- candidate Regime/sub-regime routing;
- relevant existing Story monitors;
- conventional expected reaction where a governed rule exists;
- mismatch/divergence candidate where both trigger and observed evidence exist.

### Step 3 — What's New appears immediately

A verified material delta may appear in What's New before System 2 finishes interpreting it.

It has one of two states:

- **OBSERVED / INTERPRETATION PENDING** — fact is verified, causal Story impact not yet accepted;
- **INTERPRETED** — System 2 has linked it to an accepted Story/Regime mechanism.

Before interpretation, the UI may show candidate destinations but must not say the item strengthened or weakened a thesis unless that relationship is deterministic and explicitly governed.

### Step 4 — System 2 escalation

Items that clear the activation rule enter the existing reasoning path.

System 2 decides whether the evidence:

- reinforces the existing Story;
- weakens it;
- reframes it;
- invalidates it;
- opens a new Story;
- remains unresolved/context only.

### Step 5 — Story update

If materially changed:

- preserve canonical Story ID and slug;
- create a new immutable Story thesis version;
- update the visible current Story headline to describe what is actually happening now;
- append the exact triggering Story Event;
- update confirmation/invalidation/next test;
- preserve prior versions unchanged.

If not materially changed, the What's New item remains linked context and does not generate a new thesis version.

### Step 6 — Regime projector

The Regime projector consumes:

- current accepted Story versions;
- System 1 subgroup telemetry;
- Story lifecycle;
- canonical causal edges;
- support/contradiction;
- current monitors;
- evidence IDs and source ancestry;
- cross-Regime Story links.

It does not reread raw headlines independently.

For each affected sub-regime it updates a **current projection** containing:

- observed telemetry;
- interpreted state;
- direction;
- confidence;
- current Stories;
- contribution nodes;
- strongest support;
- strongest contradiction;
- next test;
- coverage gaps.

### Step 7 — Regime materiality gate

A new immutable Regime version is created only when at least one material condition is met:

- interpreted Regime state changes;
- dominant driver changes;
- a core Story is materially reframed/invalidated;
- a new core/bridge Story materially changes transmission;
- strongest support/contradiction changes the current explanation;
- confirmation/invalidation state materially changes;
- next decisive test changes because the prior test resolved.

Routine telemetry changes update the live current projection without creating unnecessary historical Regime versions.

### Step 8 — visual contribution nodes

Every interpreted What's New item that materially contributes to a Regime becomes a small contribution node under the relevant subgroup.

Node states:

- **supports**;
- **contradicts**;
- **unresolved**;
- **context**;
- **interpretation pending**.

A single evidence item may appear visually in several sub-regimes, but its canonical evidence ID and ancestry are counted once for evidence breadth.

### Step 9 — Hybrid handoff

After the accepted Story/Regime projection exists, Live publishes or exposes the exact canonical presentation snapshot used by Hybrid.

Live surfaces deep-link to the same target:

- Regime → Hybrid Regime explanation;
- Story → Hybrid Story explanation;
- What's New/Event → Hybrid explanation of why that event matters.

Hybrid may reorder and simplify the explanation but may not re-reason the underlying claim.

### Step 10 — downstream propagation

Only after the canonical Live state is accepted should Dossier, Journey and later Power Stack consume the new Regime references.

No downstream surface may independently mutate the Regime or Story.

## System 1 sensors by Regime

System 1 coverage should be built per Regime and explicitly versioned. Do not pretend all Regimes have equal deterministic coverage.

### Sovereign Funding & Global Cost of Capital

Existing / near-existing System 1 inputs:

- next-meeting policy impulse/pricing;
- US 2Y;
- effective fed funds;
- US 10Y nominal;
- US 30Y where verified;
- 10Y real yield;
- 10Y breakeven;
- curve spreads;
- dollar-liquidity plumbing;
- later: Treasury auction/supply and credit-spread sensors.

This Regime should have the richest deterministic subgroup strip first.

### US-China AI Industrial Competition

System 1 should initially be narrower:

- verified model cost/price observations where structured;
- model usage/adoption observations where comparable;
- semiconductor/memory pricing and capacity where canonical;
- company capex/guidance;
- credit spreads / issuance;
- power/data-centre capacity observations.

Claims such as "China is winning the AI price war" remain System 2 interpretations, not System 1 states.

### Global Energy Security & Inflation

System 1 candidates:

- WTI/Brent;
- refined-product prices/cracks;
- EIA inventories/utilisation;
- LNG benchmarks/flows where canonical;
- Hormuz/physical transit measures;
- freight/insurance where structured;
- energy CPI/PPI contribution.

Physical data outrank narrative headlines.

### Gold & Global Reserve Diversification

System 1 candidates:

- gold price;
- real yields;
- DXY;
- ETF flows where canonical;
- official central-bank reserve/purchase data;
- reserve-composition data when available.

"Gold is becoming a central-bank hedge" remains a System 2 structural interpretation supported by those observations.

### Equity Rally Quality & Earnings Breadth

System 1 candidates:

- SPY / QQQ / RSP / IWM;
- breadth measures;
- sector relative performance;
- earnings revisions;
- guidance changes;
- credit and volatility confirmation.

Whether breadth is sufficient to make the rally structurally healthier is a System 2 conclusion.

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

## Canonical sensor-source rule

Regime UI must never create a second deterministic calculator for a signal already owned elsewhere in Live. In particular, Rates must consume the existing Dossier V2 `rate-regime/1`, policy-outlook and System 1 dollar-liquidity contracts, or a tested byte-equivalent shared successor. The long-term target is one shared, versioned System 1 sensor library consumed by Regimes, Dossier, Research Brain and Hybrid.

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

### Phase 1.5 — shadow and parity gate

Before reader-facing Regime state:

- run Regime projection in shadow mode;
- pin Story-version and System 1 sensor manifests;
- compare Rates against the existing `rate-regime/1` output;
- verify no duplicate evidence counting;
- verify no new Story/Regime writes are produced by repeated identical inputs;
- expose interpretation lag and stale-state diagnostics.

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
