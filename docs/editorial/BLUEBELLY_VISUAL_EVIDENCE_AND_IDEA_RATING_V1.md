# Bluebelly visual evidence, editorial scoring and publication handoff — v1

**Implementation contract:** issue #1181. Complements `docs/editorial/BLUEBELLY_HTML_DEEP_REPORT_V3.md` and `docs/bluebelly-alchemy-plugin-routing.md`; does not supersede their source, authentication or editorial gates.

## Goal
A chart or table useful enough to appear in a ChatGPT research answer must survive into the **Notion research edition** and, where eligible, the **Bluebelly public article or owner-only report**. Charts are evidence displays, not decorations. Do not manufacture values, inferred price reactions, consensus estimates or FedWatch odds.

## Single research-to-reader path
Existing scheduled research/plugin execution → original-source receipt → existing Notion/Supabase research record → verified publication projection → Bluebelly. A Notion table is readable for editors; the same values must be stored as a typed chart payload in an existing authorised publication artifact/field. Do not introduce a parallel canonical research ledger, scheduler, public private-data reader or automatic publish right.

### Visual payload v1
```json
{
  "schema_version": "bluebelly.visual.v1",
  "visual_id": "stable-edition-scoped-id",
  "kind": "table",
  "title": "Source-dated comparison",
  "description": "Why the comparison changes the investment decision",
  "unit": "percentage_points",
  "as_of_et": "2026-10-28T16:00:00-04:00",
  "retrieved_at": "2026-10-29T00:00:00Z",
  "period_basis": "same meeting / same source methodology",
  "columns": ["meeting", "previous", "current", "change_pp"],
  "rows": [],
  "series": [],
  "sources": [{"url": "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html", "publisher": "CME", "observed_at": "2026-10-28T16:00:00-04:00"}],
  "evidence_status": "RESEARCH_LEAD",
  "limitations": ["No numeric probabilities populated until source-vintage verification"]
}
```

Allowed kinds: `table`, `bar`, `line`, `comparison`. `rows` and `series` are populated only with source-supported typed numbers and labels. For every data point preserve the exact metric basis, date, unit, instrument, period and source vintage. `RESEARCH_LEAD` is not public-ready evidence. Public projection requires independent validation and existing source-admission rules. Notion should receive a native table for a tabular payload and a legible text fallback plus structured data for a chart; renderer failure must not hide the underlying figures.

### Chart selection
- FedWatch: before/after **same-source**, timestamp-aligned probabilities. Distinguish probability of a 50bp **single-meeting change** from the probability that the **cumulative target** is 50bp higher by a later meeting.
- Earnings: comparable actual/consensus with GAAP-adjusted basis, fiscal period and source vintage; otherwise say consensus unavailable.
- AI investment: capex, operating cash flow, free cash flow, debt and guidance with matching periods and currency. Show calculated FCF formula and any adjustments.
- Rates/equities: source-dated price/yield series with instrument, observation time and no unsupported causal attribution.
- Skip the chart if it does not materially clarify a decision, or if the underlying data cannot be checked.

## Ranked idea priority, not a trading forecast
Scoring is an **editorial triage** layer after the existing binary reasoning-integrity/evidence gate. It must never override canonical verification or mutate the exactly-three persisted Writing Brain slate.

| Criterion | Maximum |
| --- | ---: |
| Market impact / affected assets | 25 |
| Original-source evidence quality | 25 |
| Decision utility / falsifiable next test | 20 |
| Novelty against existing coverage | 15 |
| Timeliness / upcoming catalyst | 15 |

Total 0–100. Each score stores `criterion_scores`, `score_version`, `source_vintage`, `confidence`, `reason`, `editor_override` and `override_reason`. Score only qualified candidates. A high score never means a high expected investment return. Compare the strongest excluded contender separately without changing the canonical three ideas. Do not display fake precision or a numeric score if the necessary evidence is missing.

## Article depth and reading surfaces
**Home:** one decision-first preview with source status and link to full story.

**Daily Report:** up to five ranked *distinct* events; compact actual-versus-consensus and next-catalyst strips; no raw observation wall before editorial content.

**Key Story / front-desk full article:** chronology → actual source quote or numbers → what the market expected → fundamental economics / balance sheet / FCF / valuation when relevant → strongest counterargument → rates/Nasdaq/FX transmission → visual evidence → base case, challenge and dated next test. Preserve LY voice and original hyperlinks. No minimum word quota; avoid padded or repeated summaries.

**Owner reports:** may show unverified leads, with explicit labels, but must remain owner-only. Historical editions are immutable; corrections create versioned updates.

## Existing scheduled workflow ownership
- MacroPulse: primary-source event and macro data intake, vintage and source ledger.
- Research Investigation/Gap: check missing evidence, contradictions, source quality and next tests.
- AI Bubble: period-matched 16-company economics and quantified divergences.
- Creator Intelligence: attributed transcript claims, never source promotion without verification.
- Writing Brain: exactly three ranked editorial angles with source packet, visual specification and draft-ready gate.

Reuse existing five schedules. Do not create a sixth task or extra Vercel cron. Where task prompts are editable, append this contract **without replacing** their existing source rules, publication permissions, dates, creator roster or slate persistence. Plugin archives require separate tested release and installed-version readback; changing this repository file alone does **not** update installed plugins.

## Retirement decision gate
Audit every candidate page/component/report as `KEEP`, `MERGE`, `RETIRE_AFTER_CONSUMER_AUDIT` or `UNKNOWN`. A page is not obsolete merely because it is visually weak. Protect Market Monitor, original X references, historical editions, public source provenance, private presenter studio and owner authentication. Retire Live/Hybrid links only after dependent consumers are migrated and regression-tested.

## Verification requirements
1. Readback of real scheduled-run evidence and actual plugin execution, not configuration assertions.
2. Notion native table + structured payload with exact source date and units, read back after write.
3. Bluebelly renders identical values in desktop/mobile and historical editions, with graceful fallback.
4. Idea-score breakdown, evidence gate and human override tests.
5. TypeScript, regression, build, public/private access tests and production smoke before deployment claim.

**Current status:** contract only until implementation and production readback independently confirm each layer.
