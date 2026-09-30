# Research Gap Worker — Dossier Reader

This stage is the autonomous entry point for Research Gap work.

## Scope

It reads only the latest persisted `market_dossiers_v2` record and normalises work from three canonical surfaces:

1. top-level `research_gaps`;
2. `analytical_output.research_now`;
3. unresolved `analytical_output.investigations`.

Resolved and parked investigations are excluded.

The worker intentionally does **not** score, claim, research, resolve or mutate a gap yet. Those are separate lifecycle and prioritisation stages.

## Machine endpoint

`GET /api/research-gap/queue`

Authentication uses the same server-side research bearer credentials as the canonical research publisher.

The response uses:

`research-gap-work-queue/1`

Each work candidate has a deterministic `workId` tied to the Dossier ID, source kind and native source identity.

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

No database rows are written by this stage.
