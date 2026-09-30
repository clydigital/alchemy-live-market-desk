# Research Gap → Canonical Live Handoff

The Research Gap Gate is an investigation orchestrator, not a canonical evidence source.

## Flow

```text
MacroPulse / Dossier gap
        ↓
Research Gap investigation
        ↓
underlying source evidence
        ↓
POST /api/research-update
        ↓
canonical Evidence → Story / Regime reasoning → Dossier → Hybrid
```

The handoff uses the existing authenticated `/api/research-update` route. It does not create a second research engine. Gap handoffs are bounded manual evidence packets, so they do not impersonate or rerun the scheduled source sweep.

## Required handoff fields

```json
{
  "runKey": "gap-gate:<gateRunId>:<gapId>",
  "scheduleSlot": "manual",
  "scheduledFor": "2026-09-30T12:00:00.000Z",
  "sourceChecks": [],
  "handoff": {
    "kind": "research_gap_gate",
    "gateRunId": "2026-09-30T1200Z",
    "gapId": "rates-duration-confirmation",
    "investigationId": "inv-duration-01",
    "pulseRefs": ["pulse-2026-09-30-1"],
    "affectedStorySlugs": ["us-rates-duration"],
    "researchQuestion": "Has duration stress broadened beyond the next Fed meeting?",
    "priorExpectation": "A front-end-only repricing should leave the long end comparatively contained.",
    "finding": "The 20Y and 30Y remained elevated while the 2Y response was smaller.",
    "confidence": 78,
    "outcome": "CONFIRMING",
    "remainsUnknown": ["Term premium versus inflation-compensation decomposition remains incomplete."],
    "liveImplication": "Treat the move as broader duration stress rather than only next-meeting repricing.",
    "nextTest": "Compare real yields, breakevens and auction demand."
  },
  "items": []
}
```

`items` must contain at least one underlying source record. The Gate page, MacroPulse page, ChatGPT conversation or Notion page is not admissible as the canonical evidence source.

## Outcomes

- `CONFIRMING`
- `CONTRADICTING`
- `UNRESOLVED`
- `NO_CHANGE`

`NO_CHANGE` is explicit. It may still add new canonical evidence, but its intake items may not use `recalibrate_story`; the external Gate cannot force a Story mutation.

## Idempotence

The deterministic `runKey` is `gap-gate:<gateRunId>:<gapId>`.

A replay of an already completed handoff returns the existing research run and does not re-run canonical intelligence. A recent in-progress replay returns `202`. Failed, blocked or stale-running runs may be retried with the same key.

## Provenance

Gap metadata is encoded into the intake audit context and copied into canonical Evidence `structured_payload.researchGapHandoff`.

Reader-facing evidence prose continues to use the underlying source claim. Internal Gate IDs and provenance keys remain structured audit data rather than Story or Hybrid narrative.
