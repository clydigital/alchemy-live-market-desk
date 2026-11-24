# Bluebelly private research retrieval

Status 2026-11-24: DB migrations applied and keyword retrieval verified against existing records; edge worker deployed, real embeddings/backfill and caller integration not yet verified. Do not represent the worker as fully operational until real model vectors have been written and retrieved.

## Existing canonical evidence only

The private projection `public.bb_research_documents` covers evidence, creator, intake, motion, thesis, and X Wire. It is a search projection, not a second source of truth. It preserves record IDs, source URLs, dates, status, and ancestry where present. Never treat social leads or attributed opinions as verified merely because search returns them. Always open original source receipts for decisive claims.

## Immediate Chat/Work use
Use the authorized Supabase SQL connector when available, with bounded, lane-specific queries. Example:
```sql
select lane,record_id,kind,source_name,source_url,published_at,available_at,status,title,snippet
from public.bb_research_search('Nvidia OR CoreWeave',null,now()-interval '14 days',now(),20,null);
```
Use exact historical cutoff and separate historical thesis lookup without a short lookback. For major recaps still require the orchestration coverage manifest and full current market data, MacroPulse, Research Investigation, AI Regime, creator and Substack receipts. Search absence is not coverage. Keep cross-lane duplicates tied to original ancestry or URLs; manually verify original issuer/official sources. Do not use old creator roster items as current coverage.

## Semantic worker
Service-role-only Edge Function `bb-research-retrieval`: POST `{"action":"backfill","batch_size":5,"lanes":["evidence","creator","thesis","motion"]}` from an already authenticated server, not browser/client. Repeat bounded batches within existing collector execution budgets; no new schedule. POST `{"action":"search","query":"AI infrastructure financing risk","limit":20}` once real embeddings exist. Returns mode explicitly: keyword_only or hybrid. Built-in gte-small embeddings use no external model key; verify inference and REST permissions before enabling recurring backfill. Never send credentials to ChatGPT or client code. Default cache is private, disposable and hash-versioned. Keyword search is usable even without embeddings. Do not expose private corpus to existing broad OAuth MCP allowlist until a distinct owner authorization and response safety test exists.

## Release acceptance
- Actual nonzero 384-dimensional embeddings and cache growth from bounded real batch.
- Search returns a real semantic-only relevant match with source receipt, and lexical fallback if inference unavailable.
- Verify cache update after edited input and query as-of boundaries, permission denials, source deduplication, coverage per lane, latency and quotas.
- Existing test: synthetic vector returned one semantic match, rolled back; persisted vectors remained zero. Keyword tests and anon/authenticated grant checks passed. No new collection schedule or canonical data writes.
