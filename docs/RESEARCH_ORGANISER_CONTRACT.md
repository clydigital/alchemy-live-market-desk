# Research Organiser — reviewer-first handoff contract
Status: DESIGN ONLY. Organiser is a formatting, linking and routing pass, not a new reasoning engine.

## Inputs
**Primary baseline:** existing Market Intelligence Snapshot v1 (`GET /api/market-intelligence-snapshot`) when available, with its exact Dossier/Regime/Story IDs, timestamps, source health and canonical evidence references only where actually exposed. **Supplementary:** verified full MacroPulse Notion posts and logs, pre-live ChatGPT Research Gap Runs/Registry, and creator intelligence as leads only. Backend Dossier Research Gap is separate from the ChatGPT pre-live Gate. Record missing inputs explicitly. Do not infer snapshot fields or exact IDs before the API track confirms the live response contract.

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

## Snapshot-first gap-to-action decision contract (08 Oct design amendment)
The Organiser is a **read-only analytical coordinator**. It is not the canonical truth source, an obligatory Live Desk dependency, a second Research Gap queue, or a new provider adapter. Snapshot v1 is the first baseline; MacroPulse and ChatGPT Gate supply new discovery/research deltas. The backend Research Gap retains Dossier authority. The API/mobile track owns endpoint implementation and production integration.

### Classification and routing
Classify each distinct finding with one primary action, preserving supporting explanatory notes:
- `ALREADY_COVERED`: same source/event and conclusion already in current snapshot, prior Organiser run or completed Gate. Link existing research; no new request.
- `EXPLAIN_ONLY`: information exists but the causal implications or market reaction need clearer presentation. Produce prose, not a new research case.
- `MATERIAL_NEW_DELTA`: a new supported event or contradiction could affect an existing Regime/Story. Propose exact target and verification route; no direct canonical mutation.
- `TARGETED_RESEARCH`: an unresolved, decision-changing discriminator not already owned by a live/queued gap. Identify exact question, minimum source, affected decision and existing gap ID where known.
- `UNRESOLVED`: insufficient support or conflicting signals without a cost-justified discriminator. Label and retain without repeat requests.
- `NO_ACTION`: unchanged, stale, irrelevant, duplicated or below materiality. No artificial output quota.

### Execution sequence
1. Freeze as-of time, available Snapshot v1 identifier/freshness, last accepted Organiser handoff, and eligible MacroPulse/Gate window. Never wait indefinitely for an input.
2. Extract existing canonical thesis/Regime/Story state from snapshot; do not treat presentation labels as immutable IDs unless confirmed by API contract.
3. Deduplicate by actual source/event identity, not headline similarity alone. Compare with prior accepted findings and already researched/queued gap IDs.
4. Assign primary action, confidence/status and linked sources. Escalate only genuinely material discriminators; never requeue a previously investigated unchanged gap.
5. Publish the four-part reviewer briefing even on partial input. If snapshot unavailable/HTTP 503, mark `NON_CANONICAL_FALLBACK` and prohibit canonical-change proposals based solely on Notion prose.
6. Produce an optional **proposal-only** bounded handoff; canonical evidence admission and Dossier/System 2 adjudication stay on existing paths. Do not create or call a new ingestion endpoint until the API owner validates the existing contract.
7. Persist run identity, input references, findings and prior-run comparison so reruns are idempotent. A failed write must not block ordinary Live Desk operation.

### Pilot evidence and limitations
The 08 Oct morning ChatGPT Gate already investigated the Treasury 10Y auction, Fed minutes, five-point curve, product tightness, housing and small-cap transmission. Thus the initial two-pulse Organiser pilot would duplicate work if it independently re-researched these. The Gate reports missing 08:00 heartbeat and has no populated canonical Dossier ID. Its conclusions are source-derived research, not independently checked against live Snapshot v1. The exact snapshot schema, production availability, evidence IDs and live Story diff remain **unverified in this design track**.

### API track boundary
Do not edit backend routes, schemas, adapters, workers, scheduling or deployments in this branch. API/mobile track should supply a sanitised real Snapshot v1 response and field/health notes for contract validation. Only after that, map proposal targets to exact existing IDs and test idempotency and degraded mode. Keep PR design-only until reviewed with the production owner.

## Source-code field audit (08 Oct; main branch, static inspection)
Source files: `app/api/market-intelligence-snapshot/route.ts`, `lib/market-intelligence-snapshot.ts`, `lib/dossier-v2/presentation-adapter.ts`, `lib/dossier-v2/presentation-reader.ts`.

**Confirmed response fields:** `contractVersion`, `generatedAt`, `dossier.{status,dossierId,asOf,degraded}`, `regime.{headline,answer,regimeImplication,regimeFamily,whatWouldChangeMind,rateRegime}`, `dollarLiquidity`, `policyLiquidityInteraction`, `monetarySignals.{baseline,signals,confirming,contradicting,unresolved,summary}`, `marketState.{lenses,selectedRows,dailyAssetState}`, `stories`, `investigations`, `stockRadar`, `creatorVerification`, `marketMotion`, `sourceHealth`, `contradictions`, `researchGaps`, `guardrails`. Signals expose `key`, `asOf`, `sourceName`, `sourceUrl`, `evidenceRefs`, `metrics`, `confirmation` and `direction`. Market rows expose `id`, `symbol`, `last`, `change5d`, `asOf`, `sourceName`, `sourceUrl`.

**Important limits:** `researchGaps` is `string[]`, not case IDs. Snapshot `stories` comes from presentation `whatMattersNow.stories`, not the entire persistent Story registry. The full Dossier presentation has additional `evidenceIndex`, `thesisChanges`, `researchNow`, `investigationAudit`, `memory` and Motion adjudication context not exposed as top-level Snapshot v1 fields. Never invent missing canonical UUIDs. Snapshot `generatedAt` is not the same as `dossier.asOf` or individual market signal timestamps. `sourceHealth` is partial provider coverage, not a blanket freshness or verification guarantee. Exact nested Story IDs must be inspected in a real payload before routing.

**Failure path:** route returns HTTP 503 `status: unavailable` and `detail` if current presentation is absent or building fails. The presentation reader intentionally does not silently substitute a historical Dossier for an invalid latest record. Read-only fallback to Notion is presentation-only, not a new evidence path. No live HTTP response or production health test performed in this static audit.

**Contract implication:** a minimal Organiser can run on the current read-only snapshot and linked Notion research without backend changes. Exact canonical evidence linkage and Research Gap case-level dedupe may need existing Dossier/Registry lookups; do not demand new fields before demonstrating a real need. Keep API/mobile ownership separate.
