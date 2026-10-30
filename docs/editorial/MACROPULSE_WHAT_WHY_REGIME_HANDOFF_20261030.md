# MacroPulse What → Why → Regime → Daily Report handoff
**Adopted:** 30 October 2026 · **Owner:** existing MacroPulse Market Watch and Bluebelly editorial paths

## Decision
MacroPulse does not stop at *what* a source says or *why it matters*. For material market moves it must attempt the narrower and distinct question: **why did the observed price or market behaviour change at that time?** Some explanations can fit in one sentence; contested moves need bounded investigation. No new scanner, agent, task, automatic canon promotion, user-facing publication route or privileged public API is authorised.

**Authorities:** X, creators and social-market claims are discovery only. Original exchange/issuer/agency records establish the factual catalyst; timestamped provider or independently attributed reporting establishes the *observed* move; contemporaneous reporting can *attribute* a cause, but correlation is not an experimentally proven causal relationship. Accepted Story or regime changes use only the existing evidence/System-2 owner, while nine editorial Regime Watch judgements require separately reviewed dated evidence.

## Source handoff (one event / one record)
- `eventId`, topic, affected instruments/sectors, candidate source IDs and original links.
- `eventAt`, `sourcePublishedAt`, `marketObservedAt`, `retrievedAt`, and expected-versus-actual or prior baseline with exact comparable unit, fiscal period, exchange session and timezone (ET first, MYT for desk usability).
- **WHAT:** concise verified announcement or asset movement, including when the move preceded the announcement. A reported post-close decline is not a regular-session decline.
- **WHY IT MOVED:** one leading *proximate* explanation and the particular evidence supporting it. Rank a bounded set of competing explanations when warranted. Separate from **WHY IT MATTERS**, which states the future effects on yields, spending, capital allocation, revenue, inflation or asset exposure.
- `whyGrade`: `DIRECTLY_EVIDENCED_MECHANISM` only for unusual genuinely direct evidence; `ATTRIBUTED_REPORTED_EXPLANATION` for a dated qualified reporter/interview; `PLAUSIBLE_INFERENCE` for the analyst's interpretation; `UNRESOLVED` where genuinely competing or missing sources prevent a conclusion. Neither an issuer result nor stock/sector co-movement automatically proves the cause.
- `countercase`, `missingEvidence`, `nextDiscriminator`, `regimeLensIds` and whether the five canonical / nine editorial interpretations are `review_pending`, `reaffirmed`, `weakened` or `not_affected`. This is a *review candidate*, never a canonical mutation.
- `editorialPriority`, `decision` (`selected` / `pending` / `excluded`), `reason`, and exact Notion MacroPulse Post + Log URLs/readback. Keep uncapped *material event* coverage even when Daily Report features 3–5.

## Research procedure — bounded, not a second reasoning engine
1. Detect a material actual market move or a verified event with potentially material consequences. Check source, timing, price basis and cross-market comparability; source text announcing a move may be wrong.
2. Compare pre-catalyst versus post-catalyst observations and earlier developments. A company can fall before reporting excellent earnings because its sector was already derating; do not invent an earnings miss to explain the pre-release decline.
3. Check **issuer/official release, guidance, cash flow, capex and directly relevant disclosure**, then contemporaneous reporting and peer/sector, yields, ETF and FX evidence where feasible. Prior positioning and valuation are context only if sourced. Cap deeper analysis to the material leads already allowed in MacroPulse.
4. Write the simplest supported proximate explanation. Assign its grade and one strongest counterexplanation. If uncertain, make one additional targeted source attempt, then keep `UNRESOLVED` with named missing data; a flat `WHY UNKNOWN` alone is not a completed material event.
5. Separate observed reaction from causal theory and regime implications. Route a source-qualified editorial candidate through the established Notion Post → Log → Gap/owner review; no auto-publication, Story mutation, or additional scheduler.
6. Rank the day's **top three to five** materially distinct events by novelty/surprise, independently observed repricing, capital-flow relevance, cross-asset transmission and regime consequence. Do not rank by virality, likes, mere publication recency or number of social-account echoes. Short quiet-day reports and a broad uncapped coverage ledger are valid.

## Example: source claim versus investable explanation
The user-supplied [The Macro Paper X post](https://x.com/macropaperr/status/2116114383520845885), 30 Oct 2026 10:25 UTC, claims approximately $700bn lost across gold and silver, $500bn in Asian shares, $150bn in crypto and a **prospective** $800bn US-open decline, attributing the crypto move to a Binance “hack” and describing a roughly $2.2tn global loss. It is recorded as **UNVERIFIED_SOCIAL_LEAD**, not a verified dataset or actual US cash-session loss.

Appropriate WHAT: *an attributed post lists dramatic multi-asset declines and a forecast*. Before repeating numbers, verify source, exact asset universe, spot/futures/index measurement, reference prices, market-cap calculation and overlapping valuations. Do **not** sum completed regional observations with speculative US-open losses, or treat initial Binance security-investigation reports as a confirmed hack without primary incident evidence.

Potential WHY hypotheses: simultaneous liquidity/risk reduction, AI/semiconductor de-risking after earnings, rates/PCE repricing and exchange-specific crypto stress. Test with matching market windows, source-dated sector breadth, 2Y/10Y rates, USD/JPY, spot gold and provider crypto prices. They are **hypotheses**, not claims validated by this X post. If confirmed sector selloff is the most proximate observed explanation, explain in plain English: *semiconductor shares weakened with broader AI risk appetite; investors were questioning valuations and funding even as chip demand remained robust.* Do not assert that SK hynix individually missed expectations without source-checked issuer results.

## Output and cross-surface acceptance
- Even-hour full MacroPulse and odd-hour delta MacroPulse use the **same** What/Why contract, with proportionate depth. An uneventful hourly run retains the truthful heartbeat.
- The existing owner Daily Report research packet presents top verified facts, separate `WHY IT MOVED` interpretation and `WHY IT MATTERS` transmission. A current Regime Watch judgement is never overwritten by merely processing one unverified source.
- High-priority events missing attribution or price evidence remain `REACTION_ANALYSIS_INCOMPLETE` / `WHY_UNRESOLVED` with exact next check. They are not silently marked fully reviewed.
- Passing tests: one completed issuer release with post-close move; one peer/sector selloff predating the print; one same-session divergence across gold/yields/FX; one viral social post with incorrect aggregation; one straightforward central-bank decision with concise conditional explanation; one model/provider failure with honest partial status.
- Verify fresh Notion full Post and matching Log row, later research receipt, private writer intake and published Bluebelly edition separately. A successful scheduled task or a social post row alone is not proof that any downstream public page changed.
