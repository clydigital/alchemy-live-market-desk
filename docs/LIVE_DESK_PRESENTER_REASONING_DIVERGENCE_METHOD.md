# Live Desk Presenter Reasoning & Divergence Method

> **Status:** Governing research-method supplement for the existing Live Market Desk reasoning path.  
> **Implementation review:** checked against current `main` at commit `55da2705` on 18 Sep 2026.  
> **Key decision:** do **not** build a second Divergence Engine. The existing Market Belief → Divergence → Hypothesis → Scenario → Story Synthesis path already owns this reasoning.

## 1. Objective

The Live Desk should not merely summarise a catalyst and describe the resulting price move.

For every material event, it should ask:

> **What did the market expect? What actually happened? If price diverged from the expected reaction, what observable mechanism best explains the gap?**

The reasoning sequence is:

**prior expectation → catalyst → actual reaction → divergence → competing mechanisms → evidence test → provisional explanation → confirmation/invalidation → later post-mortem**

This method should feed the same canonical Story reasoning used by Live, Hybrid and Dossier. It must not create a parallel reasoning path.

---

## 2. Current architecture already supports most of this

The present runtime already contains the important primitives.

### Market Belief
Captures what appears priced or broadly expected.

### Divergence
The existing schema already records:

- expected change;
- observed change;
- magnitude;
- persistence;
- decisive evidence.

### Hypothesis
The existing schema already asks for:

- a causal statement;
- causal mechanism;
- affected assets;
- evidence for;
- evidence against;
- bounded causal chain;
- confirmation;
- invalidation;
- next catalyst;
- confidence.

The current runtime mandate explicitly says that Hypothesis should formulate testable causal mechanisms explaining why a material divergence occurred.

### Story Synthesis
The canonical reasoning output already includes:

- what changed;
- previous state;
- current state;
- market reaction;
- accepted explanation;
- overlooked variable;
- strongest countercase / why the market may still be right;
- evidence-labelled mechanism steps;
- confirmation;
- invalidation;
- next test;
- asset implications.

### Hybrid and Dossier
Both already consume the canonical Story reasoning snapshot. The correct upgrade is therefore to improve what enters that snapshot and how it is presented, not to invent another brain.

---

## 3. What the presenter is doing under the surface

The useful habit is not “having more statistics”. It is using each statistic to test a specific explanation.

### A. Establish the baseline expectation

Examples:

- hawkish Fed → front-end yields higher;
- higher real yields + stronger USD → normally pressure gold;
- lower yields → usually help duration-sensitive equities;
- geopolitical escalation → normally raises oil / freight risk;
- softer crude → normally lowers immediate inflation pressure.

This gives the desk an expected reaction that can be compared with reality.

### B. Compare the expectation with the tape

Examples:

**Hawkish Fed → long yields fall**

Possible mechanisms:
- hike already priced;
- forward path less hawkish than feared;
- energy inflation risk eased;
- term premium fell;
- positioning unwound.

**Crude falls → refiners / energy remain strong**

Possible mechanisms:
- diesel or product scarcity;
- crack-spread strength;
- unresolved logistics / insurance stress;
- physical market tighter than crude futures imply.

**Hawkish Fed → growth / AI rebounds**

Possible mechanisms:
- event risk already priced;
- yields reversed lower;
- short covering;
- oversold technical rebound;
- options / expiry mechanics.

Price itself is therefore evidence. A headline does not own the explanation.

---

## 4. Example: rate hike but gold rises

This is an illustrative reasoning framework.

### Event
Fed hikes and communicates a hawkish bias.

### Textbook expectation
Higher policy rate → higher real yields / stronger USD → gold lower.

### Actual reaction
Gold rises.

Do not jump directly to “gold ignored the Fed”.

Test several plausible mechanisms.

### Short covering
Check:
- pre-event gold selling;
- reversal volume;
- futures open interest;
- options positioning;
- miner confirmation;
- whether the rally fades after the initial covering impulse.

### Hike already priced
Check:
- meeting pricing before vs after;
- US02Y reaction;
- next-meeting pricing;
- DXY.

### Real yields fell
Check:
- 5Y / 10Y real yields;
- nominal yields;
- breakevens.

### USD weakness dominated
Check:
- DXY;
- EURUSD / USDJPY;
- gold in non-USD terms.

### Safe-haven demand
Check:
- VIX;
- credit;
- CHF / JPY;
- geopolitical or financial-risk headlines.

### Options / mechanical flows
Check:
- major expiry;
- gamma estimates where available;
- reversal timing;
- persistence after expiry.

A better conclusion is:

> **Gold rose despite the hawkish policy action. That is not yet evidence that gold has stopped responding to rates; real yields, DXY, pre-event positioning and event-related flows should be checked before accepting a mechanism.**

---

## 5. Under-the-surface evidence buckets

The research system should recruit these only when they are relevant to the detected divergence. This is not a requirement to fetch every bucket on every run.

### 5.1 Surprise vs expectation
Observe:
- consensus expectation;
- market-implied expectation;
- actual decision / release;
- surprise size;
- change in next-event pricing.

Why: markets trade the difference between reality and expectations, not the headline in isolation.

### 5.2 Historical base rates
Use when it helps answer whether the move or level is unusual.

Record when available:
- sample window;
- sample size;
- mean / median;
- range;
- current-cycle differences.

Historical statistics are context, not forecasts.

### 5.3 Positioning / market structure
Where available:
- options expiry;
- gamma;
- open interest;
- put/call skew;
- futures positioning;
- short interest;
- systematic thresholds;
- unusual options flow;
- auction imbalance.

Why: short covering, long liquidation and dealer hedging cannot be treated as established explanations without positioning evidence.

### 5.4 Cross-asset confirmation
Example for a hawkish Fed:
- US02Y;
- DXY;
- real yields;
- growth vs defensives;
- gold.

If several companion assets reject the textbook relationship, escalate the divergence investigation.

### 5.5 Relative strength / breadth
Examples:
- equal-weight vs cap-weight;
- growth vs value;
- semiconductors vs SPX;
- XLE vs SPX;
- refiners vs crude;
- miners vs gold;
- advance/decline;
- percentage above relevant moving averages.

Leadership can reveal what the market is pricing before the headline index does.

### 5.6 Physical vs financial markets
For energy, compare:
- WTI / Brent;
- diesel / ULSD;
- gasoline;
- crack spreads;
- tanker rates;
- insurance;
- shipping flows;
- inventories;
- refinery utilisation.

Lower crude does not prove the physical energy shock has disappeared.

### 5.7 Timing / sequencing
Preserve the order of:
1. catalyst;
2. statement / press conference;
3. initial asset move;
4. follow-up headline;
5. rates / FX reversal;
6. equity / commodity response.

Timing is one of the best ways to discriminate between plausible causal stories.

---

## 6. Automation placement: Git first, ChatGPT second

### Git is the canonical home

Durable rules that must run repeatedly belong in the repository.

The hierarchy should be:

1. **Canonical research method:** this document + `Alchemy_Mixed_Research_Voice_Method.md`.
2. **Automated research/acquisition mandate:** `RESEARCH_UPDATE_ENGINE.md` and the acquisition/research-plan code.
3. **Machine-enforced reasoning mandate:** the existing stage instructions in `lib/intelligence/runtime.ts` and/or the versioned prompt registry.
4. **Canonical persistence:** existing Story reasoning contracts and immutable Story versions.
5. **Presentation:** Hybrid and Dossier consume the same canonical reasoning.

### ChatGPT is the manual / exploratory interface

ChatGPT, Work or a Cranium research chat should be instructed to read the canonical Git method when doing manual deep research.

Do **not** maintain a second long copy of this method only inside a chat prompt. Chat prompts are useful wrappers, but Git is the durable source of truth.

A manual research wrapper only needs to say, in substance:

> Read the canonical Live Desk research-method documents from the repository. When a material price/news divergence appears, apply the expectation → actual reaction → competing mechanisms → evidence-test method and return the result in the current report template.

---

## 7. Recommended automated behaviour

Do not add a new model stage.

Strengthen the existing stage mandates so that when a material divergence exists:

1. **Divergence** identifies the expected-vs-observed mismatch.
2. **Hypothesis** forms the strongest causal explanation and, only when genuinely distinct, one competing mechanism.
3. **Research acquisition** recruits the specific missing evidence needed to discriminate between those mechanisms.
4. **Story Synthesis** records the accepted explanation, overlooked variable, countercase and next test with evidence status.
5. **Hybrid / Dossier** expose the reasoning without reinterpreting it.

Suggested compact runtime rule:

> When observed price behaviour materially differs from the reaction implied by the market belief, investigate why. Consider expectation/pricing, rates and real yields, FX, positioning/short covering, options or mechanical flows, technical conditions, cross-asset transmission, safe-haven demand and physical-vs-financial market differences only where relevant. Treat any mechanism as inferred or speculative until supplied evidence supports it; prefer the mechanism best supported by timing, direct-market and cross-asset evidence.

---

## 8. Research recruitment matrix

The automated research pass should be bounded by the divergence.

| Divergence family | First checks | Secondary checks |
|---|---|---|
| Fed / rates | US02Y, US10Y, meeting pricing, DXY | real yields, breakevens, curve / term premium |
| Gold | real yields, DXY, gold reaction timing | OI/positioning, miners, safe-haven confirmation |
| Equity index | yields, DXY, VIX, breadth | equal-weight, sector leadership, options/expiry |
| Growth / AI | long yields, real yields, breadth | semis, high-beta basket, positioning |
| Oil / energy | WTI/Brent, products, XLE | cracks, diesel, tanker/insurance, inventories |
| FX | rate differential, policy repricing | risk sentiment, positioning, commodity linkage |
| Credit | spreads, yields, funding stress | equity confirmation, issuance, refinancing |

Do not fetch every secondary variable by default. Escalate only when the initial evidence cannot resolve the divergence.

---

## 9. Report template integration

Add an explicit expected-vs-actual section near the top.

### 01 — Executive Thesis
Regime, what changed, biggest unresolved contradiction.

### 02 — Expected vs Actual
For each major catalyst:

| Catalyst | Expected reaction | Actual reaction | Divergence | Status |
|---|---|---|---|---|
| Fed hike | yields ↑ / growth ↓ | long yields ↓ / growth ↑ | material | investigate |
| Crude easing | energy equities ↓ | refiners remain strong | material | physical-market check |

### 03 — Main News
Rank by ability to alter the regime.

### 04 — Reaction Map
Direction, magnitude, timing and whether each asset confirms the story.

### 05 — Divergence Lab
For each material mismatch:
- observed divergence;
- candidate mechanisms;
- evidence for / against;
- missing evidence;
- leading explanation;
- evidence status;
- falsification / next test.

### 06 — Under the Surface
Only relevant:
- positioning;
- options;
- breadth;
- historical orientation;
- relative strength;
- physical-market data.

### 07 — Causal Map
Each arrow labelled observed, strongly supported, inferred or speculative.

### 08 — Market Verdict
What price is currently endorsing.

### 09 — What Would Change the View
Explicit confirmation and invalidation.

### 10 — Investigation Queue
Specific charts / datasets and the question each chart is meant to answer.

### 11 — Opportunity / Creator Intelligence
Keep tactical setups downstream of the regime work.

### 12 — Evidence Ledger
Source, timestamp, evidence type, confidence/status and next verification.

---

## 10. Dossier

The Dossier should remain the persistent analytical memory.

For important catalysts preserve:

- pre-event expectation;
- actual reaction;
- initial divergence explanation;
- later evidence;
- revised/accepted explanation;
- what was learned after 1–3 sessions.

This prevents hindsight rewriting and creates comparable historical cases for later research.

Do not create a second Dossier reasoning system. Dossier should render the canonical Story reasoning plus its history.

---

## 11. Hybrid Journey

Hybrid should remain a read-only guided investigation interface.

A useful Journey sequence is:

1. catalyst;
2. prior expectation;
3. actual tape;
4. divergence;
5. possible mechanism(s);
6. evidence that tests them;
7. accepted explanation / unresolved status;
8. confirmation and invalidation;
9. implications and next test.

Hybrid must not independently invent an explanation when Live does not have one.

---

## 12. Live Desk data recording

The current contracts already capture enough to implement the first version:

- expected change;
- observed change;
- divergence magnitude / persistence;
- market reaction;
- hypothesis;
- evidence for / against;
- causal chain;
- accepted explanation;
- overlooked variable;
- countercase;
- confirmation;
- invalidation;
- next test.

### Do not add the following yet

Do not immediately add mandatory fields for:
- 5-minute reaction;
- 30-minute reaction;
- 4-hour reaction;
- close;
- next session;
- a fixed taxonomy of every possible reason code.

Those may become useful later, but they create more acquisition, persistence and failure surface than is justified now.

Add them only after production evidence shows the existing reaction/persistence fields are insufficient.

---

## 13. Important architecture note

At the reviewed commit, Challenger is not part of the canonical required-stage order and is retained as a compatibility checkpoint while the old shape is retired.

Therefore competing-mechanism logic must not depend on Challenger.

Use:
- Divergence to identify the mismatch;
- Hypothesis to explain it;
- Story Synthesis to preserve the accepted explanation, overlooked variable and market-may-be-right case.

---

## 14. Implementation phases

### Phase 1 — Documentation and prompt discipline
- Add this method to Git.
- Link it from the canonical intelligence and mixed-research docs.
- Add the bounded divergence-evidence recruitment rule to the research-update specification.

### Phase 2 — Runtime reasoning refinement
- Strengthen existing Divergence/Hypothesis/Story Synthesis instructions.
- Do not create a new stage or schema unless the current contract proves insufficient.
- Add tests for a few known cases, such as:
  - hawkish event + falling long yields;
  - hawkish event + rising gold;
  - crude lower + refiners stronger.

### Phase 3 — Acquisition refinement
Add only the evidence providers/derived metrics needed to test recurring unresolved mechanisms, prioritising:
- real yields / breakevens;
- breadth / relative strength;
- refined-products / physical-energy data;
- positioning/options only where a reliable source exists.

### Phase 4 — Presentation
Expose expected-vs-actual, accepted explanation, evidence status and next test more clearly in Hybrid and Dossier.

---

## 15. Acceptance criteria

The upgrade is working when a material divergence can be traced as:

**market belief → expected reaction → observed reaction → divergence → hypothesis → evidence for/against → accepted or unresolved explanation → next test**

and the same canonical reasoning can be consumed by:

- Live;
- Hybrid;
- Dossier;

without any of them creating a separate interpretation.

The quality target is not “always explain the move”.

The quality target is:

> **Explain it when evidence permits; otherwise identify the divergence, show the competing mechanisms, and state what evidence is still missing.**
