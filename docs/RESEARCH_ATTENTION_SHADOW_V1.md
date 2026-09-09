# Research Attention Shadow V1

## Purpose

Research Attention Shadow V1 is a deterministic, non-authoritative layer between broad Live acquisition and later deep research. Its job is to answer one narrow question:

> Which small set of current developments deserves scarce research attention next?

It does **not** create canonical Evidence, mutate Stories, alter confidence, gate publication, invoke a model, call Google Drive, or change Hybrid output.

This is deliberately a shadow layer. Live must continue normally if attention composition fails.

## Runtime boundary

The scheduled Live acquisition path remains canonical:

1. Acquire and normalise news, data, Alchemy articles, video checkpoints and discovery-only watch inputs.
2. Persist and publish through the existing research path.
3. Separately compose a bounded Research Attention packet from the already-normalised intake.
4. Emit only a structured diagnostic log for comparison during the shadow period.

A failure in step 3 is caught and logged as `research_attention_shadow_failed`. It cannot change the returned `ResearchRunInput`.

## Eligibility

An attention cluster must contain at least one intake item whose `recommendedAction` is not `ignore` before it can consume research capacity.

Discovery-only inputs such as Power Stack may remain visible as watch context, but they cannot qualify a cluster by themselves. This preserves the existing rule that Power Stack is a lead generator rather than canonical evidence.

## Deterministic clustering

Items are processed in publication-time order. They join an existing cluster only when either:

- they share an explicit affected Story slug, or
- they share at least two meaningful normalised terms and the shared terms are at least 28% of the combined term set.

No embedding call, LLM call or fuzzy ID repair is used. The cluster ID is a SHA-256 digest of sorted canonical intake item keys.

## Priority

Each eligible cluster starts from the highest existing `candidateScore` among its eligible items. The shadow priority then adds bounded research-attention bonuses:

- up to +12 for additional independent source ancestries, at +4 each;
- +10 for an explicit `contradiction` divergence;
- +8 for a current material delta;
- +6 for a sufficiently novel emerging cluster.

Priority is capped at 100. These bonuses rank research attention only. They are not Story confidence, source verification weight or publication thresholds.

## Reservation-style allocation

The default packet has **8 slots**. Scarce functions are protected before the open ranking can consume the queue:

- Contradiction / disconfirmation: `floor(8 × 25%) = 2`
- Current material delta: `floor(8 × 25%) = 2`
- Emerging / novel theme: `max(1, floor(8 × 12.5%)) = 1`
- Open capacity: `8 - 2 - 2 - 1 = 3`

So the default reservation is **2 + 2 + 1 + 3 = 8**.

A candidate can consume only one reservation. Allocation order is contradiction, current delta, emerging, then open. If a reserved lane has fewer credible candidates than its capacity, the unused capacity spills into the open pool. Capacity is therefore protected without being wasted.

This is a reservation of **research slots**, not model tokens. Shadow V1 invokes no model, so its model-token reservation is exactly **0**.

## Why reserve by research function rather than market sector?

Hard-reserving slots for oil, rates, AI, Japan, China or any other named theme would encode a regime bias into the scheduler. Reserving contradiction, current change and novelty instead protects the analytical behaviours we want in every regime while letting the market determine the subjects.

## Safety invariants

Research Attention Shadow V1 must remain true to all of the following during Phase A:

- zero model calls;
- zero new database tables or migrations;
- zero canonical Evidence writes;
- zero Story mutations;
- zero confidence changes;
- zero publication gates;
- zero Google Drive dependencies;
- zero Hybrid request-path dependencies;
- discovery-only rows cannot independently qualify for research allocation;
- malformed or failed attention composition cannot fail the scheduled research input builder;
- logs never include transcript body text or credentials.

## Promotion criteria

Do not give this layer mutation authority during Phase A. Compare its selections with existing Live output across at least several normal and stressed research cycles. Before Phase B, review:

- missed material changes;
- false clusters;
- over-clustering and under-clustering;
- whether contradiction reservations actually surface useful disconfirmers;
- whether one ancestry is being mistaken for independent confirmation;
- queue stability under repeated/replayed input;
- production runtime overhead and log volume.

Only after those checks should targeted data retrieval be allowed to consume the packet. Canonical Story mutation remains a later, separately reviewed phase.
