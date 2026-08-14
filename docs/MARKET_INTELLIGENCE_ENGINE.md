# Alchemy Market Intelligence engine

Live Market Desk is the only canonical acquisition, research and reasoning owner. Hybrid reads the curated publication contract and never creates, ranks, deduplicates or reinterprets a Story.

## Runtime flow

1. Authenticated research intake is validated and persisted by `/api/research-update`.
2. The canonical runtime in `lib/intelligence/runtime.ts` normalizes usable intake into provenance-linked evidence.
3. Versioned OpenAI stages run in order: Market Belief, Divergence, Hypothesis, Challenger, Scenario, Story Synthesis, semantic deduplication and lifecycle.
4. The runtime derives a descriptive `SUPPORTED`, `DEVELOPING`, `CONTESTED` or `EARLY` research state. Completeness, missing requirements, source depth, confidence and Challenger verdict guide follow-up work but never decide publication. Only unusable evidence or no material new state suppresses a candidate.
5. A material update revises the matched canonical Story and appends a Story event plus thesis version. A genuinely distinct thesis creates one new Story.
6. The run key is idempotent. Replaying a completed run reuses its result instead of creating another Story version.
7. `/api/intelligence-feed`, `/api/hybrid-feed-v2` and the legacy compatibility alias all publish the same persisted canonical contract.
8. `/api/system-health` exposes redacted configuration presence, latest run state, provider evidence, calendar coverage and research debt.

## Mixed research voice integration

The governing specification is [Alchemy_Mixed_Research_Voice_Method.md](./Alchemy_Mixed_Research_Voice_Method.md).

- The existing Hypothesis, Challenger, Scenario and Story Synthesis stages remain the only reasoning path.
- Story Synthesis records the accepted explanation, contradiction, overlooked variable, evidence-labelled mechanism steps, market-may-be-right case and material change state.
- A deterministic composer packages promoted canonical Stories into the existing append-only `daily_brief` snapshot payload.
- The composer cannot change thesis, confidence, confirmation, invalidation or prohibited-claim locks.
- The minimum-four rule is a target, not padding. Updates sharing one parent Story count once, and unchanged recurring Stories do not count.
- Hybrid continues to read the existing canonical feed and performs no research or reasoning.

## Runtime boundaries

- `/api/intelligence-run` and `lib/intelligence/runtime.ts` are the only OpenAI reasoning entry point.
- `public.stories`, Story history, intelligence state and Hybrid snapshots remain the durable record.
- Hybrid receives canonical story state, featured order, material deltas, Live Desk Pulse, calendar, earnings, provider warnings and research debt.
- The model defaults to `gpt-5-mini` when no supported model override is configured.
- OpenBB requires a separately running Workspace/API bridge. When absent, health reports `not_configured`; official direct providers remain active.
- No Linear or other project-management service is part of runtime.

## Scheduling

Vercel Cron is intentionally disabled during coding. `NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED=false` records that state without treating missing scheduled runs as a failure. Before re-enabling unattended runs:

1. Confirm the production environment has the existing Supabase, OpenAI, YouTube, TranscriptAPI and research token variables.
2. Trigger one authenticated real intake run and verify `intelligence_engine_runs` plus `intelligence_stage_runs`.
3. Confirm the canonical feed and Hybrid display the same Story IDs, order, material deltas and Live Desk Pulse.
4. Add or enable the Vercel Cron schedule only after the manual proof passes.

Secrets are never returned by the health endpoint or stored in this repository.
