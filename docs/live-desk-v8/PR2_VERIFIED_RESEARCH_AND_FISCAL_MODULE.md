# PR 2: Verified Research Pipeline and Fiscal Supply Contract

## Purpose

This extension turns creator videos into research hypotheses rather than published conclusions.

The intended pipeline is:

```text
detect
→ transcribe
→ save
→ extract claims
→ verify claims
→ build causal edges
→ calculate asset impacts
→ challenge the market interpretation
→ publish to Live Desk
→ send a redacted state to Hybrid
```

The migration is additive and remains unapplied. Existing loaders and production behaviour are unchanged.

## Canonical research schedule

Four Asia/Kuala_Lumpur slots are first-class database records:

| Slot | Local time | Purpose |
|---|---:|---|
| `video_midnight` | 00:40 | Overnight video detection, transcript capture and initial claim extraction |
| `full_desk` | 08:30 | Full verification, Story recalibration and Live Desk publication |
| `video_refresh` | 11:30 | Late-morning video and market-reaction refresh |
| `evening_delta` | 22:00 | Evening delta, catalyst review and stale-state check |

`research_slot_runs` stores current operational health. `research_slot_events` preserves the append-only stage history.

A run is not healthy merely because a transcript or JSON object exists. Health is separated into ingestion, transcript, verification, Live Desk publication and Hybrid handoff states.

## Creator claim contract

### `creator_claims`

Every transcript claim is stored as an atomic immutable hypothesis linked to the raw transcript record.

The record preserves:

- the original wording;
- a normalised claim;
- claim type;
- subject and time horizon;
- extraction confidence;
- creator and research-run links;
- optional Story association.

Creator claims are authenticated-only records. They are not exposed to the public or copied directly into Hybrid.

### `claim_verifications`

Verification outcomes are append-only versions.

Supported verdicts are:

- verified;
- partially verified;
- contradicted;
- unverifiable;
- stale;
- pending.

Each outcome links the claim to primary source material, normalised observations and evidence. A later verification appends a new version rather than rewriting the earlier decision.

## Causal reasoning contract

### `causal_edges`

A causal edge stores:

- source node;
- relationship;
- destination node;
- direction;
- evidence state;
- confidence;
- expected horizon and lag;
- mechanism;
- linked verification, observation and evidence IDs;
- confirmation and invalidation conditions.

Evidence state is restricted to:

- observed;
- strongly supported;
- inferred;
- speculative.

This prevents a plausible economic chain from being presented as a completed chain.

### `asset_impacts`

Each asset conclusion carries:

- direction;
- time horizon;
- mechanism;
- confidence;
- evidence state;
- evidence;
- confirmation;
- invalidation;
- as-of and optional expiry timestamps.

A replacement impact points to the record it supersedes. The prior assessment remains queryable.

## Fiscal Supply and Treasury Liquidity

### `fiscal_supply_snapshots`

The Live Desk fiscal module can persist:

- quarterly borrowing estimate;
- revision versus the previous estimate;
- fiscal deficit;
- Treasury General Account balance;
- net interest outlays;
- debt held by the public;
- average interest cost;
- refinancing profile;
- net bill issuance;
- net coupon issuance;
- buybacks;
- TIPS issuance;
- FRN issuance;
- coupon auction sizes by tenor;
- interpretation, confidence and methodology version.

Snapshots are append-only and selected by quarter and latest as-of timestamp.

### `treasury_auction_results`

Auction records can persist:

- security type and tenor;
- CUSIP and reopening status;
- announcement, auction and settlement dates;
- offering amount;
- when-issued yield;
- stop yield;
- tail or through in basis points;
- bid-to-cover;
- indirect, direct and primary-dealer shares;
- five-minute, thirty-minute and closing yield reactions;
- demand assessment and interpretation.

The intended analysis is conditional. Higher borrowing does not automatically imply a long-bond crisis or immediate Federal Reserve intervention.

The Live Desk should test:

```text
Higher borrowing
     ↓
Bills or coupons?
     ↓
Auction demand and Treasury cash balance
     ↓
Nominal yields, real yields and liquidity
     ↓
USD, stocks and gold
```

## Hybrid handoff

### `hybrid_publication_snapshots`

Hybrid receives a redacted decision-ready snapshot from Live Desk.

The snapshot contains:

- public summary;
- structured asset and causal outputs;
- confidence;
- safe source references;
- redaction log;
- publication and expiry timestamps;
- optional Story and thesis-version links.

It must not include raw transcripts, private payloads, unsupported creator claims or internal analyst notes.

The fiscal Hybrid node is expected to expose outputs such as:

| Output | Example state |
|---|---|
| Long-end yield pressure | Rising |
| Liquidity drain | Contained |
| USD transmission | Supportive |
| Equity valuation pressure | Moderate |
| Gold fiscal hedge | Dormant / Activating |

## Access boundaries

Public presentation-safe records:

- causal edges;
- asset impacts;
- fiscal supply snapshots;
- Treasury auction results;
- redacted Hybrid publication snapshots;
- canonical schedule definitions.

Authenticated-only records:

- creator claims;
- claim verifications;
- slot-run health;
- stage-level run events.

Raw source records remain private under the original PR 2 contract.

## Migration files

1. `20260807010000_live_desk_v8_persistence.sql`
2. `20260807013000_research_claims_fiscal_and_hybrid_pipeline.sql`

Neither migration has been applied to the connected Supabase project.

## Validation

The read-only PR 2 test now checks:

- both sets of required tables;
- required current-state views;
- thesis backfill and Story pointers;
- immutable claim and Hybrid snapshot triggers;
- all four canonical schedule slots and times;
- first-class verification and Hybrid health fields;
- absence of public read access for creator claims;
- presence of a read policy for redacted Hybrid snapshots.

## Later implementation work

PR 2 defines storage and access contracts. Later PRs must still implement:

- transcript writers into `raw_source_records`;
- atomic claim extraction;
- primary-source verification workers;
- causal-edge and asset-impact calculation;
- fiscal and auction data ingestion;
- Live Desk fiscal interface;
- redacted snapshot publication;
- Hybrid consumption without re-running ingestion.
