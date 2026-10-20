# Research Gap Plan + Verdict Gate

This stage sits between durable Gap claiming and the existing automatic Live handoff.

```text
Dossier
  -> priority queue
  -> durable case
  -> claim
  -> deterministic Research Plan
  -> external evidence collection
  -> deterministic verdict gate
  -> COMPLETED
  -> existing /api/research-gap/handoff
  -> canonical /api/research-update
```

## Contract

The plan contract is:

`research-gap-plan/1`

It preserves:

- canonical Gap identity;
- research question / action;
- linked Story and Investigation IDs;
- explicit missing-evidence branches;
- frozen source provenance for new plans;
- a bounded source budget;
- a bounded branch budget.

New plans load the exact persisted Gap occurrence and the current Dossier named by the case. They may also retain up to two exact predecessors reached through `previous_dossier_id`. Only the current Dossier is analytical authority: exact linked investigations may supply the question, prior expectation, missing evidence and next research. Older Dossiers and MacroPulse are context-only and cannot override those fields.

The optional plan `context` contains the work ID, authoritative Dossier ID, ordered Dossier lineage IDs and source provenance. Existing persisted `research-gap-plan/1` records without `context` remain valid and replayable.

MacroPulse has a validated context adapter boundary, but no live reader yet because this repository has no canonical machine-readable MacroPulse storage contract. MacroPulse prose is not scraped or treated as evidence.

## Default research budget

- max sources: 8
- max branches: 3
- max evidence requirements: 6
- minimum admissible source quality: 65
- strong direct source threshold: 80
- authoritative direct source threshold: 90
- two independent strong sources can establish one-sided support

These are stop-policy thresholds, not source-quality facts. The executor must still provide the assessment and provenance.

## Verdicts

The verdict contract is:

`research-gap-verdict/1`

Every newly evaluated verdict also embeds a sanitised evidence packet under:

- `evidenceSnapshotVersion: "research-gap-evidence-snapshot/1"`
- `evidenceSnapshot`

This preserves the exact source URL, source class, independence key, requirement mapping, direction, directness, quality, traceability and claim that produced the verdict. Older persisted v1 verdicts without this snapshot remain readable; new executor work must use the embedded packet so a failed handoff can be retried without reconstructing research from memory.

Allowed outcomes reuse the existing Live vocabulary:

- `CONFIRMING`
- `CONTRADICTING`
- `UNRESOLVED`
- `NO_CHANGE`

The evaluator does not choose a causal explanation. It only decides whether the supplied, traceable evidence is sufficient to stop bounded research and which existing outcome label the evidence relationship supports.

## Machine endpoint

`POST /api/research-gap/execution`

### Start

```json
{
  "action": "start",
  "caseId": "<uuid>",
  "claimToken": "<uuid>"
}
```

Requires an owned, unexpired `CLAIMED` case. The route freezes the exact context, builds the deterministic plan and transitions the case to `RESEARCHING`.

The transition is fenced in the database: a context-aware plan starts only when its case, gap, work and authoritative Dossier identities still match the current durable case. If a newer Dossier refreshes the case while the plan is being built, the transition returns no row and the route reports a conflict instead of persisting stale work.

### Evaluate

```json
{
  "action": "evaluate",
  "caseId": "<uuid>",
  "claimToken": "<uuid>",
  "branchCount": 2,
  "evidence": [
    {
      "evidenceId": "source:ust-curve",
      "independenceKey": "us-treasury",
      "sourceClass": "official",
      "sourceUrl": "https://example.com/source",
      "requirementIds": ["req:1:..."],
      "direction": "CONFIRMING",
      "directness": "DIRECT",
      "quality": 95,
      "traceable": true,
      "claim": "Observed evidence relevant to the research requirement."
    }
  ]
}
```

If the stop gate is not met, the case remains `RESEARCHING` and the response names the missing evidence branches.

If the stop gate is met, the case becomes `COMPLETED`, claim ownership is cleared, and the verdict is persisted.

## Boundary

This stage is not a research model and not a second analytical brain.

It does not:

- browse the web;
- invent source-quality scores;
- decide Story or Regime truth;
- mutate Stories;
- call `recalibrate_story`;
- send evidence to Live by itself.

The existing automatic Gap handoff remains the only admission route from completed Gap evidence into canonical Live.


## Scheduled one-case cycle

Research Gap scheduled ownership is Vercel-primary because GitHub Actions scheduled events were observed starting roughly 4–7 hours after their configured cron times on 6–7 October 2026. GitHub retains the audited `research_gap_cycle` workflow-dispatch mode for manual recovery, but it no longer owns Research Gap cron scheduling.

Current Vercel schedule:

- `03:15 UTC` — 11:15 MYT: retry/close one completed case first, then research at most one queued case.
- `03:30 UTC` and `03:45 UTC`: handoff-only retries.
- `15:15 UTC` — 23:15 MYT: retry/close one completed case first, then research at most one queued case.
- `15:30 UTC` and `15:45 UTC`: handoff-only retries.

Before either cycle or handoff work begins, the cron checks the existing `research_slot_runs` ledger. A recent unfinished morning/evening Live sweep causes Research Gap to return `deferred` instead of overlapping canonical Live work.

The Vercel cycle is intentionally one-case maximum:

1. Attempt one persisted `COMPLETED` → canonical handoff first.
2. If a completed case was handed off, stop.
3. If the completed case was closed as superseded, or no completed case awaits admission, claim and research one queued case.
4. If no queued case is available, exit successfully with no work.
5. Persist the researched case as `COMPLETED`.
6. Stop. A later handoff-only cron admits the durable snapshot.

Separating web research from final handoff keeps the web-search invocation inside the existing bounded function duration while preserving the durable retry boundary. If canonical Live is unavailable, the case stays `COMPLETED`; later handoff-only cron invocations retry it before another scheduled web cycle.

Legacy Dossier→Story D7 synchronization rows are not valid web-research obligations. Completed legacy rows close through the exact Story-review preflight, and queued legacy rows are closed before ordinary web claims. Dossier→Story synchronization remains owned by A3 Story review.

The scheduler does not change Research Gap authority. Canonical Live still decides what admitted evidence does to Stories, Regimes, Journey and Dossier state.

## Optional external retrieval support (research process; not deployed worker) — 12 October 2026

The **ChatGPT Notion pre-live Research Gap Gate** may use Exa or Parallel Search for source discovery, Firecrawl for extracting readable original pages/documents, and TinyFish or an authorised Opera Browser Connector session to inspect a specific interactive page. Tavily is an optional alternative only once separately connected and tested. Consult [Macro research pipeline](MACRO_RESEARCH_PIPELINE.md) and the [Notion Gate operating page](https://app.notion.com/p/3ea519b67a9481f9aa03d9767069487e).

This list **does not change or instrument** the Vercel Dossier-owned Gap executor shown above. The executor's code and actual source adapter remain authoritative; ChatGPT plugin installation does not make a service available in a deployment. Any production integration needs its own reviewed implementation, secret/cost controls, tests and runtime proof.

For every candidate evidence packet:
- Identify the original publisher, URL, publication and observation times, measurement period, revision and independence key; preserve requirement mapping and the exact frozen Gap/Dossier/Story references.
- Check source text or official data rather than relying on a search excerpt, tool-generated synthesis, secondary repost or creator opinion. Different extraction providers returning the *same underlying article* do not supply independent sources.
- Budget and stop conditions in this document remain unchanged. A retrieval failure is a missing requirement or `UNRESOLVED` finding, not a licence to invent quality scores or mark the case `COMPLETED`.
- Never scrape Notion MacroPulse prose as if it were a canonical machine-readable input; never bypass the existing evidence snapshot, verdict, handoff and Dossier/System 2 route.

This is documentation and research guidance only, with **no** new cron, production source, table, pipeline state, API or direct Hybrid write.

## Automated original-source recovery and publication safety (P3)

The Vercel-primary Research Gap cycle already runs 03:15 and 15:15 UTC (11:15 / 23:15 MYT), plus handoff-only retries at +15 and +30 minutes. Reuse its case ownership, fencing and retries. Do not add an uncoordinated cron or another reasoning engine.

The Dossier's system1_energy_source_coverage and output validator run automatically during its existing scheduled handoff. They are publication **stop gates**, not source-fetching agents.

1. **Fetch original data:** Prefer dated original BLS, Treasury, EIA, CME, ICE or CBP publications, not search extracts. Classify blocked publisher access, restricted exchange data and rotating current URLs as UNRESOLVED; never evade licensing/access controls.
2. **Preserve exact identity:** Capture exchange, contract code, front/next expiry, trade date, actual FINAL flag, unit, publication and observation timestamps, stable original URL, and an immutable byte hash computed by the source collector. An arbitrary supplied hash string is not enough.
3. **Verify market semantics:** Two futures settles must be the same original exchange and trade date. Verify roll/expiry and consecutive eligible F1/F2 months. Do not confuse ICE Brent with CME BZ or a continuous front-month quote with an exchange calendar spread. OFAC licence does not prove a US Russian-diesel cargo arrival; require dated first-party customs/port/vessel records.
4. **Retry using existing Research Gap:** Preserve the exact missing source request in evidence-needed; leave unresolved cases durable and let the existing cycle/handoff cron retry. An HTTP 200, a secondary transcription or a rolling document is not a fulfilled source requirement.
5. **Admit canonical evidence:** Only the existing authenticated canonical intake may create a new Evidence UUID, with full source lineage, verified hash, unit, date and new actual available_at. Old immutable published editions must not be rewritten.
6. **Re-adjudicate:** After verified admission, run read-only Dossier V2 first and permit System 2/Story updates only through the current canonical thesis-version path. Unsupported publication prose takes the existing one-repair/fail-closed route.

Every scheduled source check should distinguish provider_retrieval, original_source_final, same_day_F1_F2, source_hash_verified, canonical_ingested, dossier_visible and story_adjudicated. A successful cron response means the worker ran, **not** that all evidence/Story work is complete.

**Next implementation partition:** publisher-specific original-source acquisition adapters with verifiable archived bulletin identity and idempotent canonical handoff, reusing the existing Research Gap cycle. This runbook does not assert that licensed CME/ICE original settlement values or automated acquisition are already live.

## Private archival handoff for verified original oil documents

Existing scheduled Research Gap `evaluate` and GitHub fallback call the strict original-file capture probe. No new cron, reasoning engine or database table is required.

By default, original CME and ICE response bytes **are not archived**. Before enabling retention, the operator must confirm publisher data licensing and permitted storage/use of these specific historical documents. Enable only the corresponding *server-side* setting after this review: `OIL_CME_ARCHIVE_RETENTION_APPROVED=true` and/or `OIL_ICE_ARCHIVE_RETENTION_APPROVED=true`. Never prefix these variables with `NEXT_PUBLIC_`. The flags are independent, allowing ICE to remain blocked while CME is approved.

When enabled, the existing Research Gap cycle preserves allowlisted dated original bytes to a **private** Supabase Storage bucket `alchemy-oil-originals-private`, created on first approved write with PDF/CSV MIME and 1.8 MB limits. Storage is service-role only; no public or authenticated user policy, public asset URL or signed link is created. Object keys are `EXCHANGE/YYYY-MM-DD/<sha256>.pdf|csv` and cannot be upserted. Every retry downloads the stored object and verifies the SHA-256 against the actually captured publisher bytes. Only then append or reuse a record in the existing `raw_source_records` with exact publisher URL, archive key, original-byte hash and actual ingestion clock.

Source results remain clearly separated: `RETRIEVED_UNARCHIVED` means the original was downloaded and hashed in memory but not durably saved; `ARCHIVED_UNVERIFIED` means bytes were durably stored and rehashed, **not** that the bulletin was FINAL or a valid F1/F2 pair. `ARCHIVE_FAILED` retains the unmet research requirement; do not resolve it from an HTTP 200. Approval flags do not grant an exchange data subscription or circumvent access restrictions.

This archive stage does **not** create `intelligence_evidence` or a Story. Next partition is publisher-specific FINAL bulletin parsing, settlement-leg unit/date/contract validation, and canonical Evidence admission with the existing #886 server-side proof. The separate original-source retention and operator licence review must stay explicit.

## Parsing archived original exchange CSV — candidate-only stage

`lib/research-gap-oil-csv-settlements.ts` is a pure deterministic reader for **already retained** private publisher CSV bytes. It does not fetch, subscribe to, authorise or ingest exchange data. No exchange format is accepted by default. Never enable a column profile by guessing the current ICE/CME CSV structure from a third-party transcription.

A reviewed `ReviewedOilCsvProfile` must name the exact original header columns for trading date, contract, numerical settlement, FINAL status, exchange and price units; record its review ID/time and applicable benchmark. A caller must supply the verified original hash, private bucket receipt/raw-source UUID, trade date, exchange-specific known F1/F2 symbols and the source bytes read back from private Storage.

The parser validates UTF-8/CSV structure, original byte SHA-256 and content-addressed object path, date in original file URL and rows, identical trading day, FINAL exchange/unit token, exactly one observation per leg and consecutive contract months. It returns `PARSED_UNADMITTED` with the computed F1-minus-F2 arithmetic and `canonicalAdmitted=false`, not Evidence or a new Story. A single unverified schema match or readable PDF cannot change Research Gap outcome.

**Next bridge:** inspect the genuinely archived publisher's format and confirm legal data use before defining any approved production profile; for CME PDFs a separate reviewed Section 61 FINAL parser is required. After that, attach candidate evidence to the existing authenticated intake and verify existing `raw_source_records` → `normalised_observations` → `intelligence_evidence` links, including actual receipt time, before #886 can close a settlement gap. No new background scheduler, data table or thesis writer.
