# Research Organiser — reviewer-first handoff contract
Status: DESIGN ONLY. Organiser is a formatting, linking and routing pass, not a new reasoning engine.

## Inputs
Verified full MacroPulse Notion posts and log rows; pre-live ChatGPT Research Gap Runs and Registry; independently confirmed canonical Dossier/Regime/Story snapshot; genuine creator transcript intelligence as leads only; canonical evidence UUIDs only where actually available. Record missing inputs explicitly.

## Output: one Notion Market Intelligence — Organiser session
Metadata: run ID, MYT as-of, research window, source pulse IDs/links, Gate run link, Dossier ID/version where available, verification status, last updated.
1. **60-second market brief**: 3–6 sentences answering what changed, why it matters, what markets did, what doesn't fit.
2. **Regime and Story delta map**: existing exact IDs/labels, previous thesis, observed new facts, candidate effect (STRENGTHEN/WEAKEN/CONTRADICT/NO CHANGE/UNKNOWN), invalidation and confidence limits. No mutation.
3. **Mechanism map**: event → physical/economic transmission → rates/credit/FX/earnings → asset reaction; competing explanations and independent tests.
4. **Motion leads**: type, timestamp, novelty, materiality, next test, routing suggestion; clearly NON-EVIDENTIARY until independently promoted through existing canonical path.
5. **Evidence and caveats**: claim-level source URL, timestamp, source class, verified/supported/provisional/unresolved, canonical evidence UUID only when present; explicit unsupported claims.
6. **Live Desk handoff**: update candidate for US Rate Regime / Oil / Gold / AI / Persistent Stories / What's New / Dossier / Watchlist, exact destination and priority; do-not-carry items; cross-market charts to inspect.
7. **Research queue**: minimum discriminator, preferred independent source, why now, what decision could change; targeted recheck only for material gaps.
8. **Reviewer notes**: ambiguity, duplication, stale assertions, missing contrary evidence, overload, readability and sources.

## Machine-readable shape (proposal; do not deploy until contracts audited)
```json
{
  "version": "research-organiser-proposal/1",
  "runId": "string",
  "asOf": "ISO-8601",
  "pulseIds": ["string"],
  "gateRunIds": ["string"],
  "dossierId": null,
  "brief": "string",
  "findings": [{
    "claim": "string",
    "status": "VERIFIED|SUPPORTED|PROVISIONAL|UNRESOLVED",
    "sourceUrls": ["string"],
    "canonicalEvidenceIds": [],
    "mechanism": "string",
    "counterEvidence": "string",
    "targets": [{"kind": "REGIME|STORY|MOTION|DOSSIER|WHATS_NEW|WATCHLIST", "id": "string", "proposedEffect": "STRENGTHEN|WEAKEN|CONTRADICT|NO_CHANGE|UNKNOWN"}],
    "nextTest": "string"
  }],
  "researchRequests": [],
  "doNotCarry": []
}
```

## Non-negotiable safety boundaries
Motion and creator transcripts are non-evidentiary. No Story/Regime change solely from Pulse, Gate prose or organiser judgement. Reuse canonical evidence and existing Dossier System 2 adjudication ACCEPT/REFINE/UNRESOLVED/REJECT. Never introduce new reasoning engine, table or thesis-version creation path; reuse story_thesis_versions. Preserve source timestamps, uncertainty and exact existing IDs. Unknown is not confirmation.

## Reviewer acceptance rubric
- Can a non-trader explain the main change and consequence after one minute?
- Is the most important change above background news?
- Does every material claim have traceable source and status?
- Does each proposed update name an existing destination, previous view and test?
- Are contrary evidence, caveats, and market reaction visible?
- Is the output shorter and more actionable than its source posts without losing important nuance?
- Can Live Desk safely ignore unsupported claims?
- Are there duplicate narratives or stale story/event titles?
- Is the next research request narrow and worth its cost?
- Can this be rendered as a useful briefing without a slide deck?

## Style
Internal research is evidence-first, plain British English, concise sections. LY_Style_Guide.md and the Brent/China style case study inform user-facing narrative only; they must not change factual/evidence status. Notion full research remains primary, slides optional derivative.

## Minimum viable reviewer output (review amendment)
The eight sections above are a **reference inventory**, not eight compulsory headings in every briefing.
1. **Top changes** (up to three): what happened, why it matters, observed market reaction, source.
2. **Regime/Story implications**: previous view versus current evidence, caveat and next test; no mutation.
3. **What remains unresolved**: contradictions, incomplete compartments and any narrow follow-up.
4. **Links to details**: original MacroPulse, Gate run, canonical evidence IDs if available.

Publish this compact briefing from available supported findings even when some partitions or external sources fail. If there is no material change, publish a brief no-change note or link to the existing heartbeat according to the existing cadence; never invent materiality to fill a template. Unverified claims may appear only clearly labelled as leads and must not trigger canonical mutation. Keep detailed mechanism maps and reviewer notes collapsible/linked rather than mandatory first-screen text.
