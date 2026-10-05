# Research Gap Worker — Dossier Reader

This stage is the autonomous entry point for Research Gap work.

## Scope

It reads only the latest persisted `market_dossiers_v2` record and normalises work from three canonical surfaces:

1. top-level `research_gaps`;
2. `analytical_output.research_now`;
3. unresolved `analytical_output.investigations`.

Resolved and parked investigations are excluded.

B3 removed the legacy direct `current_market_motion_items → Research Gap` producer. Raw Motion must first pass through canonical Dossier/System 2 and surface as Dossier `research_gaps`, `research_now`, or `investigations` before it can create new Research Gap work. Historical `market_motion` lifecycle cases remain readable and operational.

The worker intentionally does **not** score, claim, research, resolve or mutate a gap. Prioritisation and durable lifecycle are separate stages.

## Machine endpoint

`GET /api/research-gap/queue`

Authentication uses the same server-side research bearer credentials as the canonical research publisher.

The response uses:

`research-gap-work-queue/1`

Each work candidate has a deterministic `workId` tied to the Dossier occurrence plus a stable `gapKey` intended to survive across Dossiers.

## Preserved native signals

The reader carries forward rather than reinterprets:

- MATERIAL / INFORMATIONAL severity;
- BLOCKER / REFINEMENT class;
- top-level blocking refs;
- Research Now rank;
- expected information gain;
- linked Story IDs;
- linked investigation IDs;
- investigation status;
- divergence state;
- missing/blocking evidence.

This separation is deliberate. The next prioritisation stage can rank work using explicit policy without changing how Dossier state is read.

## Production behaviour

If no Dossier exists, the endpoint returns `404` with `status: empty`.

If a Dossier exists but has no eligible work, the queue is valid with `candidates: []`.

No database rows are written by this reader stage. The separate lifecycle sync persists only the prioritised maximum-three cases.

The queue contract remains `research-gap-work-queue/1`. `sourceCounts.marketMotion` is retained for backward compatibility but is always `0` for newly built queues.
