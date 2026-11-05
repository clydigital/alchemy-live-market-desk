# Alchemy Skills v0.3 — Shared Development Reference

**Status:** Proposed documentation, not a runtime feature. **Updated:** 13 October 2026 MYT.
**Human-facing Notion reference:** [Alchemy Skills v0.3 — Shared Reference & Integration Contract](https://app.notion.com/p/3f7519b67a9481b1b426eab63732fbd3).

This entrypoint helps an authorised developer or ChatGPT agent find **the same rules** while implementing the Alchemy Live Desk, Hybrid Journey, Research Gap, MacroPulse, AI capex and LY editorial workflows. It is not another research engine, Skill installer, evidence owner or scheduler.

## Reading order for a coding task

1. Read this README and [Implementation Checklist](./IMPLEMENTATION_CHECKLIST.md) for intended skill routing, current status and explicit non-goals.
2. Read the **existing owner contract** for the relevant feature. Do not replace it merely because a document is newer:
   - [Research Organiser Contract](../RESEARCH_ORGANISER_CONTRACT.md)
   - [Backend Research Gap Execution](../RESEARCH_GAP_EXECUTION.md)
   - [Editorial Brain and Regime operating framework](../editorial-brain/README.md)
   - [Research Rollout and owner responsibilities](../RESEARCH_ROLLOUT.md)
3. Inspect the actual current source code, data shape and deployment state. A Notion plan or Skill cannot prove a production feature exists.
4. Make only the smallest authorised change, then verify a focused acceptance test and exact persisted IDs where applicable.

## Nine Alchemy Skills — planned, not installed by this PR

| Purpose | Skill |
| --- | --- |
| Task owner/source selection | alchemy-research-router |
| Source and metric comparability | alchemy-source-and-measurement-audit |
| Material market change and gaps | alchemy-market-change-and-gap |
| Motion → persistent Story → Regime interpretation | alchemy-motion-story-regime-brief |
| Issuer financials and AI capex | alchemy-equity-research-adapter |
| Understandable Live/Hybrid narration | alchemy-ly-dashboard-narrator |
| Manual chart-led Chart of the Day | alchemy-ly-cotd-producer |
| Manual macro/physical Outlook Brief | alchemy-ly-ob-producer |
| LY voice, evidence, accessible HTML/DOCX | alchemy-publication-qc |

The nine importable Skill files were authored in the separate v0.3 package. **This docs-only change does not copy their installable ZIP bytes into the repository or install them account-wide.** Notion is a reference library; Skills execute only where separately installed/available. Verify invocation before relying on automatic routing.

## Core design contract

**News / Motion**: dated, source-specific developments, expected vs observed reaction and provenance. **Regional filter**: one primary Asia, Europe, US or Other; zero or more affected regions; one event may affect several markets without duplicated canonical records.

**Persistent Story**: continuing conflicts and market narratives, such as Iran War and US–China AI competition. A Motion may support, weaken or contradict an existing Story, rather than creating another hyper-specific title.

**Regime**: market's operating mindset—what participants currently reward, fear or disregard, their actual cross-asset sensitivity, and the measurable results that would change their behaviour. A transcript/creator may raise a hypothesis but cannot establish a canonical Regime reversal.

**System 1**: inexpensive deterministic clocks, source identity, dedupe, metric windows, units, region labels, threshold comparisons and no-change detection. **System 2**: *existing* Dossier source-admitted material-evidence adjudication (ACCEPT / REFINE / UNRESOLVED / REJECT) with immutable Story thesis lineage. No duplicate LLM adjudicator, table, scheduler or writer.

**Handoff**: primary originals and matched measurements → existing ChatGPT MacroPulse/Research Gate/issuer research (Notion, not canonical) → existing backend Research Gap and research-update → actual canonical Evidence UUID → Dossier System 2 → exact frozen Live/Hybrid display. Creator transcripts and ChatGPT Notion research do not become canonical proof automatically. Hybrid stays read-only. Unknown historical edition must never silently swap to current.

## Content and MVP

MVP minimises needless niche scenario testing, duplicated retrieval and unnecessary model/plugin calls. It **does not** reduce writing depth, substantive evidence, human-readable LY explanations, chart integrity, responsive UI, full OB/COTD, HTML/DOCX polish or editorial review. Missing optional evidence creates a claim-level qualification; independent useful work continues.

**LY articles are manual editorial assignments.** COTD: user chart, confluence, contradictions and conditions first. OB: physical mechanism, missing causal link, actual market reaction and credible countercase. Follow approved LY Style Guide and China/Brent revision where available. Writer / Avoid AI Writing / No AI Slop are optional voice-preservation helpers, not compulsory full rewrites or replacements for factual QC.

## Provider routing (conditional)

- Asian and US-adjacent themes: Codex Market Skills / DayTrading.monster discovery → original verification, proper regional market sessions.
- US macro: BEA, FRED/RainbowStats, BLS, Fed, Treasury, FactIQ.
- Issuers/AI capex: SEC and company IR originals, FMP, FactIQ, Alpha Vantage, Public Equity Investing specialists when appropriate.
- Scientific AI efficiency / compute / energy: OpenAlex where material; not a default two-hour MacroPulse call.
- Alternative explanations: Acumen/Talarion, Exa, Parallel Search; Pipeworx_BIS only for **currently connected and entitled tools**. Provider results can route or corroborate only when the underlying source is truly independent.
- Server keys reported by user: BEA_API_KEY, FRED_API_KEY, FMP_API, TALARION_API_KEY, OPENALEX_API_KEY. Record **names only**, never values. ChatGPT plugin access is not Vercel adapter proof.

## Change boundaries

This is **docs-only**. No scheduler, task prompt, key, migration, canonical evidence, Story history, production API, Live/Hybrid component or COTD publication is changed. Integration is intentionally staged in the linked checklist and requires actual acceptance evidence.
