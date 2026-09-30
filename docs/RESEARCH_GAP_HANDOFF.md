# Research Gap → Canonical Live Handoff

The Research Gap Gate is an investigation orchestrator, not a canonical evidence source.

## Flow

```text
MacroPulse / Dossier gap
        ↓
Research Gap investigation
        ↓
completed research result + underlying source evidence
        ↓
POST /api/research-gap/handoff
        ↓
automatic canonical run construction
        ↓
POST /api/research-update
        ↓
canonical Evidence → Story / Regime reasoning → Dossier → Hybrid
```

The automatic bridge removes manual payload assembly. A future Gap worker only needs to submit its completed result and traceable underlying sources to `/api/research-gap/handoff`.

The bridge:

- constructs the deterministic `gap-gate:<gateRunId>:<gapId>` identity;
- converts each underlying source into canonical research intake;
- always uses `collect_evidence` so the external researcher cannot force a Story mutation;
- rejects MacroPulse, Notion, ChatGPT and Research Gap carrier pages as evidence;
- requires a ready transcript before video evidence can enter Live;
- validates the generated run against the existing `/api/research-update` contract;
- forwards to the canonical Live publisher using the caller's already-authorised research credential;
- preserves canonical `200` / `202` replay and pending semantics.

No second research engine is created.

## Completed-result contract

```json
{
  "gateRunId": "2026-10-01T0100Z",
  "gapId": "rates-duration-confirmation",
  "investigationId": "inv-duration-01",
  "pulseRefs": ["pulse-2026-10-01-1"],
  "affectedStorySlugs": ["us-rates-duration"],
  "researchQuestion": "Has duration stress broadened beyond the next Fed meeting?",
  "priorExpectation": "A front-end-only repricing should leave the long end comparatively contained.",
  "finding": "The 20Y and 30Y remained elevated while the 2Y response was smaller.",
  "confidence": 82,
  "outcome": "CONFIRMING",
  "remainsUnknown": ["Term premium versus inflation compensation is not fully resolved."],
  "liveImplication": "Treat the move as broader duration stress.",
  "nextTest": "Compare real yields, breakevens and auction demand.",
  "completedAt": "2026-10-01T01:00:00.000Z",
  "evidence": [
    {
      "publisher": "U.S. Department of the Treasury",
      "title": "Daily Treasury Par Yield Curve Rates",
      "url": "https://home.treasury.gov/resource-center/data-chart-center/interest-rates",
      "publishedAt": "2026-09-30T20:00:00.000Z",
      "claim": "Long-end Treasury yields remained elevated relative to the front end.",
      "sourceQuality": 100,
      "relevance": 98,
      "novelty": 78,
      "materiality": 92
    }
  ]
}
```

Evidence scores remain explicit. The handoff layer does not invent source quality, relevance, novelty or materiality on behalf of the future research worker.

## Outcomes

- `CONFIRMING`
- `CONTRADICTING`
- `UNRESOLVED`
- `NO_CHANGE`

These outcomes describe the research finding. They do **not** authorise the Gap worker to recalibrate a Story directly. Canonical Live decides the effect of the admitted evidence.

## Idempotence

The deterministic canonical `runKey` remains `gap-gate:<gateRunId>:<gapId>`.

A replay of an already completed handoff returns the existing research run and does not re-run canonical intelligence. A recent in-progress replay returns `202`. Failed, blocked or stale-running runs may be retried with the same key.

## Provenance

Gap metadata is encoded into canonical Evidence `structured_payload.researchGapHandoff`. Reader-facing evidence prose continues to use the underlying source claim. Internal Gate IDs and provenance keys remain structured audit data rather than Story or Hybrid narrative.

## Manual canonical payloads

Direct `/api/research-update` Gap handoffs remain supported for audited recovery and tests. Normal autonomous Gap research should use `/api/research-gap/handoff` so run construction stays deterministic.
