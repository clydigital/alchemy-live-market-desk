# Macro Pulse → Market Motion Bridge

Macro Pulse remains a surveillance and discovery layer. It may surface notable new macro events or divergences, but it is not canonical evidence and it is not required for the Live Desk to operate.

## Allowed flow

```text
Macro Pulse
  -> explicit notable candidate
  -> Market Motion LEAD
  -> unified Motion dedupe
  -> independent reporting / official evidence may corroborate
  -> exact canonical evidence may activate Dossier reasoning
  -> Dossier System 2 assesses the Motion framing against that evidence
  -> ACCEPT / REFINE with an exact Story implication queues that exact canonical Story for re-evaluation using the exact packet evidence
  -> accepted Story re-evaluation may update the canonical Story thesis/version
  -> the Regime projector then consumes canonical Story state
  -> ACCEPT may promote exact Story or exact Regime Motion context
  -> REFINE appends and promotes only the corrected evidence-bounded Motion version
  -> the persisted Dossier exposes the decision to Hybrid immediately
  -> the next immutable Journey edition freezes the promoted Motion normally
  -> Story-linked promoted Motion may enter Research Gap
  -> UNRESOLVED Motion may enter Research Gap directly from the persisted Dossier assessment without promotion
  -> regime-only accepted Motion remains context-only until a canonical Story or investigation owns the next test
```

The bridge never writes a Story, Regime, Dossier, confidence change or thesis.

Market Motion remains an attention layer, not evidence. Promotion authority belongs to validated Dossier reasoning: a Motion must resolve to exact canonical packet evidence and survive the freshness/materiality gates. `ACCEPT` can promote exact Story or exact Regime context. `REFINE` can promote only a new append-only version carrying explicit corrected headline, why-it-matters and bridge wording. `UNRESOLVED` never promotes, but may open a Research Gap branch when the exact Dossier snapshot lineage, evidence references and `investigation_next` are present. `REJECT` never promotes or opens research. A regime-only accepted decision explicitly clears the Story link rather than manufacturing one.

## Candidate types

The endpoint accepts only bounded, explicit candidate classes:

- `AUCTION_SHOCK`
- `RATES_MOVE`
- `OIL_PRODUCTS_DIVERGENCE`
- `POLICY_SURPRISE`
- `CROSS_ASSET_DIVERGENCE`

Every candidate must:

- be inside the 48-hour Motion window;
- pass the normal Motion materiality / relevance / novelty thresholds;
- include a concrete `nextTest`;
- remain `verification_state = LEAD`;
- use Macro Pulse and any carried URLs as discovery references only.

Primary, official or market-data links carried inside a Pulse do not become verified merely because Macro Pulse cited them. The normal research path must independently admit/corroborate them.

## Endpoint

`POST /api/market-motion/macro-pulse`

Machine auth uses the existing `RESEARCH_UPDATE_TOKEN` / `CRON_SECRET` policy.

Example:

```json
{
  "pulseId": "macro-pulse:2026-10-01:0800",
  "pulseUrl": "https://www.notion.so/example-macro-pulse",
  "pulseAsOf": "2026-10-01T08:00:00Z",
  "candidates": [
    {
      "candidateKey": "ust-10y-auction-tail",
      "kind": "AUCTION_SHOCK",
      "occurredAt": "2026-10-01T07:45:00Z",
      "headline": "Treasury auction tail lifts long-end yield pressure",
      "whatHappened": "A Treasury auction tailed while long-end yields stayed elevated.",
      "marketReaction": "10Y and 30Y yields moved higher after the auction.",
      "whyInteresting": "The move may test whether term-premium pressure is becoming the dominant rates channel.",
      "nextTest": "Verify the auction statistics, then compare 10Y/30Y real yields, DXY and growth equities.",
      "affectedStorySlugs": ["rates-duration-stress"],
      "tickers": ["US10Y", "US30Y", "DXY"],
      "materiality": 90,
      "relevance": 92,
      "novelty": 84,
      "references": [
        {
          "sourceName": "US Treasury",
          "sourceUrl": "https://home.treasury.gov/example-auction",
          "sourceKind": "official",
          "claim": "Underlying auction statistics to verify."
        }
      ]
    }
  ]
}
```

## Failure isolation

Macro Pulse is optional. The scheduled `/api/research-update` path does not call this endpoint and does not depend on its availability. A Macro Pulse bridge failure therefore cannot block ordinary Motion ingestion, canonical research, or Live publication.

## Deduplication

The bridge uses the same Motion event identity and persistence path as reporting and transcript inputs. When later Reuters/official evidence resolves to the same event key, the stronger source becomes the primary Motion representation while Macro Pulse remains an auditable discovery reference.

This preserves the boundary:

```text
Macro Pulse asks where to look.
Research decides what is supported.
Live decides what becomes canonical.
```
