# Alchemy Live + Hybrid Repair Execution Brief

> **Purpose:** Shared execution specification for the current Live Market Desk / Hybrid Market Desk repair phase.
>
> **Status:** Supplemental to `ALCHEMY_PROJECT_OPERATING_MANUAL.md`. It does **not** replace the operating manual. If this file conflicts with the canonical operating manual or a newer explicit user instruction, the operating manual / newer instruction wins.
>
> **Primary goal:** Restore and prove one reliable end-to-end canonical research pipeline from scheduled Live run → acquisition → evidence → intelligence → persisted Story state → canonical snapshot → Hybrid consumption.

---

## 1. What success means

The repair phase is complete only when an actual Live production cycle can be traced through the full chain and results in a fresh canonical snapshot consumed by Hybrid.

The project-level acceptance condition is:

```text
09:15 / 21:15 MYT scheduled Live cycle
→ acquisition completes with graceful provider degradation
→ evidence is normalised, provenance-preserved and persisted
→ material change / Story candidates are determined
→ canonical intelligence runtime executes
→ intelligence stages are recorded
→ structurally valid Story versions are persisted
→ research state is descriptive, never a completeness permission gate
→ canonical Live snapshot is published
→ Hybrid consumes the same canonical snapshot read-only
→ run health/freshness can be inspected without guessing
```

A component passing its own unit tests is **not** sufficient project completion.

---

## 2. Required source hierarchy

Before any substantial task, inspect the smallest relevant source set in this order:

1. Task-specific supplied material / explicit user instruction
2. This repair execution brief
3. `ALCHEMY_PROJECT_OPERATING_MANUAL.md`
4. Exact source chat where the task originated or was materially changed
5. Actual GitHub repository / branch / PR / diff / tests / CI
6. Supabase / production database state when relevant
7. Vercel / production runtime state when relevant
8. Current chat
9. Other project conversations
10. External sources / general model knowledge

Do not reconstruct project decisions from memory when a durable source can be inspected.

---

## 3. Non-negotiable architecture

### 3.1 Live owns canonical state

The Live Market Desk is the canonical research runtime and state owner.

Hybrid is a **read-only canonical consumer**. It must not create a parallel Story engine, fallback intelligence state, duplicate reasoning path, or locally manufactured market monitor when Live canonical output is unavailable.

### 3.2 Publication is state, not a research-completeness gate

Research quality is described using states such as:

- `SUPPORTED`
- `DEVELOPING`
- `CONTESTED`
- `EARLY`

Missing evidence, Challenger objections, incomplete requirements and source-depth weaknesses must remain visible diagnostics/research debt.

They must **not** block an otherwise structurally valid and materially new Story solely because of a percentage threshold or research-completeness score.

Structural validity may still require canonical traceable evidence and material novelty / non-duplication.

### 3.3 Deterministic data first

Use deterministic code for:

- official APIs
- structured economic data
- EIA / other canonical series
- source IDs / provenance
- normalisation
- unit conversion
- deduplication primitives
- run state
- persistence
- timestamps / freshness

Use LLM reasoning where it adds judgement:

- Story discovery
- accepted-view identification
- contradiction analysis
- causal mechanism
- Challenger / countercase
- scenario synthesis
- implications
- catalyst / invalidation / next test

### 3.4 Acquisition fallback order

Preferred acquisition order:

```text
official / first-party API
→ RSS / Atom / deterministic direct HTTP
→ supported extraction fallback such as Firecrawl when the public direct source is blocked
→ explicit diagnostic / research debt if still unavailable
```

Firecrawl must not become a second canonical evidence path or reasoning system. Preserve the original publisher, article URL, timestamps and provenance.

Do not use Firecrawl where a reliable structured API is the appropriate source.

### 3.5 Provider failure is usually diagnostic, not edition-wide suppression

One provider failing should not suppress unrelated valid Stories.

If an acquisition/runtime stage catastrophically fails such that no valid canonical output can be produced, record that as a run failure rather than disguising it as a research-completeness/publication-gate failure.

---

## 4. Current verified baseline before this repair sequence

Treat the following as the starting point, but **re-check current state before acting** because GitHub/production may have changed.

### Publication-state change

- Live PR #44: `Replace publication gate with descriptive research state`
- Verified merged into `main`
- This removed completeness thresholds / Challenger-as-bouncer behaviour from Story publication policy.

### Firecrawl

- Live PR #45: `Add Firecrawl acquisition fallback`
- Last verified state: OPEN, mergeable, preview/tests/build passed
- Last verified state was **not merged into production**
- Re-check before review or integration.

### EIA / canonical primary data adapters

- Known implementation branch: `feature/canonical-primary-data-adapters`
- EIA v2 work has previously produced READY preview builds
- Last verified state did **not** prove a merged production integration or non-empty production canonical flow output
- Re-check branch / PR / current main before acting.

### End-to-end runtime

The critical unresolved symptom is not merely publication policy.

Previous production inspection showed research/scheduler activity while the canonical OpenAI intelligence runtime had not recorded a completed intelligence run, leaving canonical Story output / fresh Hybrid consumption incomplete or stale.

The first repair task must therefore locate the **first broken hand-off in the actual runtime chain**.

---

## 5. Canonical pipeline to trace

Every production repair should reason through these layers explicitly:

| # | Layer | Responsibility |
|---|---|---|
| 1 | Schedule | Trigger 09:15 / 21:15 MYT canonical Live cycle |
| 2 | Acquisition | Fetch official APIs, RSS/direct sources and allowed fallbacks |
| 3 | Normalisation | Canonicalise timestamps, units, source identity and evidence schema |
| 4 | Provenance | Preserve publisher, URL, source record, retrieval state |
| 5 | Persistence | Store run/evidence/provider state in canonical persistence |
| 6 | Change detection | Determine material novelty and Story update/new Story relationships |
| 7 | Intelligence invocation | Invoke canonical AI runtime when required |
| 8 | Intelligence stages | Record Story/reasoning stage execution |
| 9 | Story persistence | Persist canonical Story versions + descriptive research state |
| 10 | Snapshot publication | Produce immutable/versioned Live canonical snapshot |
| 11 | Hybrid consumption | Hybrid consumes exact canonical snapshot read-only |
| 12 | Observability | Health shows stage status, freshness, failure and lineage |

Do not diagnose a downstream UI symptom without tracing upstream layers first.

---

## 6. Repair task sequence

Work in this order unless the actual root-cause evidence requires a justified change.

### TASK 1 — End-to-end runtime trace / root cause

**Preferred owner:** Codex

**Purpose:** Identify the first broken hand-off that prevents a production scheduled Live cycle from producing fresh canonical intelligence Stories and a fresh Hybrid snapshot.

**Required inspection:**

- exact source chat for current repair phase
- this execution brief
- operating manual
- current Live `main`
- relevant cron routes
- research run orchestration
- acquisition → persistence path
- OpenAI/intelligence invocation path
- intelligence run/stage persistence
- Story persistence
- canonical publication/snapshot path
- current production environment/health evidence available through Vercel/Supabase

**Required output:**

1. A stage-by-stage trace of one recent scheduled or safely reproducible run.
2. For each stage: entered/not entered, input, output, persistence side effect, failure/return condition.
3. The **first broken edge**, not a list of speculative possible causes.
4. Evidence supporting that diagnosis: code path, logs/runtime state, DB state and/or test reproduction.
5. A minimal proposed repair boundary.

**Do not:**

- redesign Hybrid
- rewrite publication policy
- add new providers
- merge Firecrawl/EIA opportunistically
- change Story reasoning unless it is proven to be the broken edge
- merge/deploy

**Exit condition:** Root cause is demonstrated well enough that a separate repair task can be narrowly scoped.

---

### TASK 2 — Repair the first broken runtime hand-off

**Preferred owner:** Codex for a narrow code-path fix; Jules if root cause spans several modules/subsystems.

**Purpose:** Fix only the root cause demonstrated by Task 1.

**Required instructions:**

- reproduce the failure before changing code where practical
- make the smallest coherent repair
- preserve canonical Live ownership
- preserve Hybrid read-only consumption
- preserve descriptive research-state semantics
- add deterministic regression test(s)
- do not hide failure by weakening health checks
- do not manufacture Story/snapshot data to make UI appear healthy

**Exit condition:**

A controlled run passes the repaired edge and reaches the next expected canonical stage; tests/build/CI pass; actual changed files and behaviour match the Task 1 diagnosis.

**No merge/deploy without explicit user authorisation.**

---

### TASK 3 — Firecrawl PR #45 integration review

**Preferred owner:** Codex

**Purpose:** Determine whether PR #45 remains correct against current `main`, then prepare it for integration if appropriate.

**Required inspection:**

- current PR #45 metadata and diff
- current `main`
- conflicts/rebase delta since its original base
- tests/CI/preview
- fallback source allowlist
- provenance behaviour
- timeout/retry/credit controls
- system-health reporting

**Required behaviour:**

- direct/official/RSS remains primary
- Firecrawl called only for supported public direct-source blockage
- original publisher/URL preserved
- Firecrawl failure remains diagnostic
- no fabricated evidence
- no video/transcript rerouting unless separately authorised
- no duplicate canonical evidence/reasoning path

**Exit condition:**

PR is either:

- `APPROVE FOR USER MERGE` with evidence, or
- `CORRECTION REQUIRED` with a targeted patch request.

Review approval does not merge.

---

### TASK 4 — EIA v2 / canonical primary-data adapter integration

**Preferred owner:** Jules for multi-file integration; Codex for focused branch review/test repair.

**Purpose:** Move the existing EIA implementation from isolated branch/preview state into a reviewable canonical adapter change.

**Required inspection:**

- `feature/canonical-primary-data-adapters`
- current `main`
- all EIA provider files
- global-flow monitor integration
- deterministic tests
- canonical units / dates / series identity
- error/degradation behaviour
- docs / env requirements

**Required behaviour:**

- EIA API is deterministic structured acquisition
- explicit canonical series IDs
- explicit units and conversions
- explicit period/release timestamps
- graceful unavailable/error state
- no LLM retrieval of raw EIA data
- no fabricated replacement values
- canonical monitor can consume output

**Exit condition:**

A proper PR exists against current `main`; tests/build pass; controlled output proves the adapter returns correctly normalised data or an honest diagnostic state.

Review approval does not merge.

---

### TASK 5 — Canonical run ledger / observability

**Preferred owner:** Codex

**Purpose:** Make end-to-end failures attributable to a precise stage instead of inferring health from scattered subsystem indicators.

**Required design:**

Every canonical cycle should have one run identity, for example:

`run_2026-08-15_morning`

Each stage should record at minimum:

- run ID
- stage name
- state: pending / running / completed / degraded / failed / skipped
- start time
- finish time
- input/reference counts where useful
- output counts where useful
- deterministic error/failure code
- concise failure detail
- upstream dependency / reason if skipped

Suggested stages:

- trigger
- official/direct acquisition
- Firecrawl fallback
- structured primary data / EIA
- normalisation
- evidence persistence
- change detection
- intelligence invocation
- intelligence stages
- Story persistence
- canonical snapshot
- Hybrid availability

**Health semantics must include freshness.**

An old snapshot should not be labelled healthy merely because `snapshots.length > 0`.

Suggested top-level states:

- `healthy`: latest expected cycle completed within SLA
- `degraded`: latest cycle completed but non-fatal provider/research debt exists
- `stale`: latest valid snapshot is older than the expected schedule tolerance
- `failed`: latest scheduled cycle failed before canonical publication
- `not_configured`: genuinely unavailable/unconfigured capability

**Do not:** change the research thesis engine merely to implement observability.

**Exit condition:** One run can be followed stage-by-stage from trigger to Hybrid from production-safe/read-only health output.

---

### TASK 6 — End-to-end acceptance validation

**Preferred owner:** ChatGPT as reviewer/orchestrator, using actual GitHub + CI + Vercel + Supabase/runtime evidence. A coding agent may add a deterministic integration test where appropriate.

**Purpose:** Prove that the project-level goal is met after the approved fixes are integrated/deployed by the user.

**Acceptance checklist:**

- latest canonical schedule triggered as expected
- acquisition produced usable evidence and explicit provider diagnostics
- Firecrawl fallback recovered only eligible blocked sources, if invoked
- EIA path returned canonical data or honest diagnostic state
- evidence persisted with provenance
- material novelty/change detection completed
- canonical intelligence run exists
- intelligence stages exist
- Story versions exist
- research states are descriptive rather than completeness gates
- missing evidence remains visible
- canonical snapshot timestamp is fresh
- Hybrid references the same canonical snapshot/state
- no parallel Hybrid reasoning/state generation exists
- health reports actual stage freshness/failures
- no fabricated local readings are shown to conceal upstream failure

**Exit condition:** Evidence demonstrates one complete canonical cycle from Live trigger to Hybrid consumption.

---

## 7. Task ownership table

| Order | Task | Preferred model/agent | Main deliverable | Must not do | Done when |
|---:|---|---|---|---|---|
| 1 | End-to-end runtime trace | Codex | First broken edge + evidence | No speculative redesign/fixes | Root cause demonstrated |
| 2 | Fix broken hand-off | Codex or Jules | Small regression-tested repair | No unrelated provider/UI work | Controlled run crosses repaired edge |
| 3 | Firecrawl #45 review | Codex | Approve/correct current PR | No silent merge/deploy | Current-main compatibility proven |
| 4 | EIA adapter integration | Jules / Codex review | Proper PR + deterministic data tests | No LLM raw-data retrieval | Canonical output/diagnostic proven |
| 5 | Run ledger / health freshness | Codex | Stage-level observable run state | No research-engine rewrite | One run traceable end-to-end |
| 6 | E2E acceptance | ChatGPT reviewer/orchestrator | Production evidence against checklist | No agent-summary-only approval | Fresh Live → Hybrid cycle proven |
| 7 | Research-quality expansion | Later, after plumbing works | Better intelligence/coverage | No premature feature pile-up | Core pipeline remains stable |

---

## 8. Mandatory agent task record

Every delegated task must retain:

```text
Agent:
Task:
Exact source chat:
Relevant source files:
Repository:
Base branch:
Issue/PR:
Agent session/task ID:
Acceptance tests:
Safety limits:
ABC cycle:
Status:
```

The Agent Monitor is a status/control room only. The exact source chat and durable project files remain the task specification.

---

## 9. Review protocol

Never approve code from an agent completion message alone.

Before approval:

1. Re-read exact source chat.
2. Read relevant project MD/spec.
3. Inspect actual GitHub PR/branch/diff.
4. Inspect changed files.
5. Inspect tests and CI.
6. Inspect preview/runtime evidence where relevant.
7. Inspect Supabase/production state where relevant.
8. Compare the result against this task's acceptance tests.
9. Check scope creep and architecture regressions.

Verdict must be one of:

- ✅ Approved for user decision
- 🟡 In progress / evidence incomplete
- ❌ Disapproved — targeted correction required

Approval does **not** mean merge or deployment.

---

## 10. ABC monitoring protocol

After a successful asynchronous coding-agent dispatch, unless the user explicitly opts out:

- A: +10 minutes
- B: +20 minutes
- C: +30 minutes

At each check inspect the actual agent/session state.

If still working: report only; do not interrupt.

If awaiting plan approval: compare plan against source chat/files before approving.

If completed: inspect actual code/PR/tests/CI before approval.

If correction is issued: cancel unused old checks and begin a fresh A/B/C cycle.

If still working at C: report `🟡 In progress` and end that cycle without endless polling.

---

## 11. Safety limits

Unless the user explicitly authorises the specific action:

- DO NOT merge PRs
- DO NOT deploy production
- DO NOT perform destructive database writes
- DO NOT delete production data
- DO NOT replace canonical architecture with a parallel implementation
- DO NOT disable health/error reporting to make the system appear functional
- DO NOT manufacture evidence, market readings, Story state or snapshots
- DO NOT expose secrets

Read-only inspection is preferred during diagnosis.

---

## 12. Rules for prompts issued from this brief

Every model-specific coding prompt should contain:

1. **Role** — diagnostic / implementation / review.
2. **Exact task** — one bounded responsibility.
3. **Source chat** — exact title.
4. **Required files/sources** — this brief + operating manual + relevant code/spec.
5. **Known state** — only facts re-verified for that task.
6. **Required trace/implementation steps.**
7. **Non-goals** — neighbouring layers it must not touch.
8. **Acceptance tests.**
9. **Required final report** — files changed, tests, remaining limitations, PR/session ID.
10. **Safety** — no merge/deploy/destructive writes unless explicitly authorised.

Do not issue a giant prompt that asks one model to simultaneously diagnose runtime, integrate Firecrawl, integrate EIA, redesign health, and repair Hybrid. Preserve attribution and reviewability.

---

## 13. Repair-phase decision rule

When a symptom appears downstream, ask:

> **What is the first upstream stage that failed to produce the canonical output required by the next stage?**

Fix that edge first.

Do not infer:

```text
Hybrid empty = Hybrid bug
```

Instead trace:

```text
schedule
→ acquisition
→ persistence
→ intelligence invocation
→ intelligence stages
→ Story persistence
→ snapshot
→ Hybrid consumption
```

This is the default reasoning flow for the repair phase.

---

## 14. Final completion definition

The Live/Hybrid repair programme is **not complete** because individual PRs are green.

It is complete when:

1. A real canonical Live run completes on schedule or through an explicitly safe production-equivalent trigger.
2. Canonical evidence and intelligence stages are persisted.
3. Material Story versions are persisted without research-completeness gating.
4. Missing evidence/provider degradation remains visible.
5. A fresh canonical snapshot is produced.
6. Hybrid consumes that exact state read-only.
7. The run ledger/health system makes freshness and failures immediately inspectable.
8. Regression tests protect the repaired hand-offs.
9. GitHub/CI/runtime evidence confirms the result.

After this point, resume expansion of source coverage, research quality, Evidence Rooms, Story intelligence and UI features.
