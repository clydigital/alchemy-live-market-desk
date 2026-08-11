# Alchemy Market Intelligence engine

This implementation follows `CODEX_MASTER_PROMPT.md` from the Alchemy Market Intelligence bootstrap. It is additive: the existing Live Desk and Hybrid product remain the compatibility and presentation layers, while Supabase owns canonical intelligence state.

## Runtime flow

1. A named provider adapter acquires a record. Adapter failures are written to `intelligence_acquisition_failures`; unavailable data is never returned as a fabricated success.
2. The normalizer creates one canonical Evidence Object with source ancestry, provenance, timing, assets/topics, uncertainty and a deterministic content hash.
3. Independent, versioned stages run in order: entity extraction, Market Belief, Divergence, competing Hypotheses, Challenger, asset Scenarios and Story Synthesis.
4. Semantic deduplication compares event, thesis, causal mechanism, affected assets, decisive evidence, source independence, catalysts, confirmation and invalidation.
5. A same-event Story is distinct only when mechanism, affected market, independent evidence and confirmation/invalidation are all separately proven.
6. Lifecycle evaluation persists DETECTED, DEVELOPING, CONFIRMED, WEAKENING, INVALIDATED or ARCHIVED.
7. Persistent publication selects qualified, semantically distinct Stories without padding and stops at 15. A separate recency-first view selects up to six featured Stories; qualification and confidence break timestamp ties. The complete registry remains available as `storyArchive`.
8. New Story/hypothesis evidence links enqueue only the affected object in `intelligence_reevaluation_queue`; workers claim queue rows atomically with `FOR UPDATE SKIP LOCKED`.
9. The existing scheduled `/api/research-update` path invokes the intelligence loop over validated real intake. Runs are idempotent, default to two high-scoring items per cycle, and continue with visible partial failures when a provider is unavailable.

## Compatibility boundaries

- `public.stories` and `public.evidence` remain intact for current screens and older clients.
- `intelligence_evidence` is the canonical Evidence Object. Legacy evidence is a UI compatibility projection, not the reasoning source of truth.
- Synthesized Story candidates are persisted in `intelligence_story_candidates`. Promotion either revisions the deduplicated canonical Story or creates an original `alchemy_research_engine` Story with an append-only event/thesis version; an external article URL is optional.
- Existing `story_events`, `story_thesis_versions`, `causal_edges`, `asset_impacts` and Hybrid snapshots remain reusable.
- New intelligence tables are RLS-enabled and service-role only. Live exposes curated data through `/api/intelligence` and the V2 feed; Hybrid does not query reasoning tables directly.
- Plane is not imported or required by any acquisition, reasoning, persistence or publication path.

## Internal facade

`GET /api/intelligence` returns the capability manifest. `POST /api/intelligence` accepts:

```json
{
  "tool": "searchEvidence",
  "arguments": { "query": "payroll", "limit": 20 }
}
```

Use `Authorization: Bearer <ALCHEMY_INTELLIGENCE_TOKEN>` or `x-alchemy-token`. If the dedicated token is absent, the existing `RESEARCH_UPDATE_TOKEN` is accepted. The endpoint returns 503 when neither token is configured.

Write/run capabilities include `acquireProviderData`, `runIntelligencePipeline`, `promoteStoryCandidate` and `runTargetedReevaluation`. Read capabilities cover canonical evidence, Evidence Rooms, entities/relationships, beliefs, divergences, hypotheses, live Stories, Story history/candidates and provider failures.

## Required rollout order

1. Apply `20260810204758_market_intelligence_foundation.sql` and the later macro lifecycle/metrics, hypothesis/scenario runtime and atomic queue-claim migrations in timestamp order.
2. Configure `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` and optionally `OPENAI_INTELLIGENCE_MODEL` in Live. The facade uses `ALCHEMY_INTELLIGENCE_TOKEN` when present and otherwise reuses the existing `RESEARCH_UPDATE_TOKEN`.
3. Call `GET /api/intelligence` and verify the manifest.
4. Send real validated intake through the existing research-update schedule or invoke the facade directly. Do not seed fake production evidence.
5. Monitor `intelligence_engine_runs`, `intelligence_acquisition_failures` and macro ingestion-gap state; missing FRED/OpenBB/Trading Economics credentials remain visible optional-provider gaps rather than fabricated values.
6. Keep the existing external scheduler pointed at `/api/research-update`; it now owns recurring intelligence orchestration. No Plane runtime dependency is required.

The migrations are recorded in Supabase migration history. This repository intentionally contains no production Supabase credential or OpenAI secret.
