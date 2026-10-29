# Bluebelly — Creator Story Summary Standard

**Version:** 1.1  
**Target:** Bluebelly → Creator Intelligence → Creator Summary  
**Status:** Editorial specification; production compiler and reader integration must be verified separately  
**Companion:** `BLUEBELLY_STORY_DRIVEN_DAILY_REPORTS(1).md`

## 1. Why this exists

Turn multiple eligible, previously unswept videos by **one creator** into one compelling, readable, evidence-conscious explanation of how their market thesis develops. The reader should feel that they have understood the full argument—not merely skimmed a list of video summaries.

**Canonical reference:** The Meet Kevin breakdown beginning *“The Bond Market Just Flashed a Warning”*. Preserve its approach: short story-like hook, **Act 1 / Act 2 / Act 3** progression, changing stakes, explanations placed where they become relevant, competing theories, and a final set of observable indicators.

### Different from Bluebelly Daily Reports

| Bluebelly daily narrative | Creator story summary |
|---|---|
| Protagonist: the market | Protagonist: the creator's argument |
| Chronology: verified events and market sessions | Chronology: video publication order and the evolution of the creator's thesis |
| Grounding: Research Gate verified market evidence | Grounding: original video/transcript, with independent verification clearly marked |
| End: market confirmations and upcoming catalysts | End: creator's current view, what's changed, what could invalidate it, and what Bluebelly should monitor |

Keep these editorial products separate. Do **not** replace the existing daily-report standard.

## 2. Source ingestion and sweep rules

1. Group videos by **creator_id**, never across creators in the primary narrative.
2. Load eligible published videos since that creator's last successful *transcript-consumed* sweep, plus explicitly requested videos. A discovery-only entry does not count as consumed.
3. Preserve per-video metadata: `video_id`, canonical URL, title, publish time, discovery time, transcript retrieval time, transcript provider, language, transcript completeness, and transcript text/timecodes when available.
4. Use source transcripts in this order where practical: YouTube-native → alternate free transcription → other free retrieval. Mark missing, partial, translated or unreliable transcripts. Do not manufacture a summary from a title alone.
5. Deduplicate using canonical video ID, transcript fingerprints, and already covered thesis points. Preserve a link to the original item even when its repeated argument is omitted from the prose.
6. One successful creator sweep may ingest several videos, but must not accidentally exclude late-arriving transcripts from older, discovered videos.
7. Track publication cutoff, successful content-consumption watermark, and individually processed video IDs. Only advance the watermark for content actually consumed and persist a retry queue for incomplete items.
8. Add newly surfaced creator videos to an ongoing historical story *only when useful*; distinguish a new edition from a retroactive factual correction. Never silently rewrite the original creator's position.
9. Never confuse a creator's asserted current prices, news or chart levels with verified live data. Market figures retain a source, date, instrument and timeframe; if those are missing, attribute the number to the creator.

## 3. Narrative recipe

### Title and orientation

Choose a short title that captures the creator's **main tension**, not the title of the most recent video. Include creator, coverage period, number of videos fully processed, and as-of time.

### Opening hook

Start with 2–4 sentences. Establish what the creator initially believed, what complicated it, and why the change matters. Avoid generic "this week's videos cover" openings.

### Acts — usually 3–6, flexible

- **Act 1 — The original setup:** What was the creator arguing and why?
- **Act 2 — The new clue:** Which later video, observation or disclosure adds information?
- **Act 3 — The complication:** What contradicts, threatens or complicates the original thesis?
- **Act 4 — The mechanism:** Explain only the finance concepts essential to understanding the shift.
- **Act 5 — The fork in the road:** Set out competing interpretations and the creator's preferred one.
- **Final act — Where the creator stands:** Capture their latest thesis, conviction *as expressed*, caveats and watchpoints.

These labels are examples, **not mandatory scene content**. Use the smallest number of acts necessary. When publication order is uncertain or videos discuss unrelated subjects, organise by story threads rather than inventing cause-and-effect.

### Learning moments

Intersperse short **The learning moment** / **Why this matters** passages at the precise point where a reader needs an explanation. Prefer clear worked examples (e.g. CDS insurance cost, dilution, financing pressure) over a glossary. Include the counterforce: how the mechanism could fail.

### Voice

- Story-like, thoughtful, mobile-friendly, British English.
- Grade-8 accessibility, paragraphs typically 1–3 sentences.
- Use vivid stakes but **never fabricate dialogue, motives, private access, price movements or causality**.
- Preserve the creator's distinctive reasoning and uncertainty without imitating their promotional copy or uncritically adopting their assertions.
- Make the relationship between successive videos explicit: **reinforces / extends / revises / contradicts / unrelated**.
- Detail is welcome when needed for comprehension; avoid clipping the story to fit a rigid word count.

## 4. Verification and epistemic labelling

Keep three distinguishable layers:

- **Creator said:** Faithfully summarise what the creator asserted, with the originating video URL and timestamp where feasible.
- **Independent check:** Reference primary sources (filings, central banks, company releases, pricing) where the claim is consequential and verification is available. Mark confirmed, disputed or not independently checked.
- **Bluebelly interpretation:** Explain how the argument fits existing macro themes, and label any inference as interpretation rather than a creator quote.

Do not ascribe a creator's speculation to an official source. Never turn a guess about advance knowledge, private government contacts, motives or secret negotiations into fact. Avoid causal statements based merely on adjacent news and price moves.

For each material claim, retain `claim_id`, `creator_id`, `source_video_ids`, transcript location if possible, claim type, assertion text, stance, verification state, evidence links, and observed timestamp. If two videos genuinely contradict, show both with dates rather than flattening the disagreement.

## 5. Combining videos without losing the narrative

**Process:**

1. Extract each video's key claims, motivations, evidence, tickers/assets, risks, price levels, suggested outcomes and uncertainties.
2. Cluster overlapping claims into named story threads (e.g. *AI funding → credit spreads → Fed expectations*).
3. Order each thread according to the **videos' publication dates** and recorded changes of position. Keep market-event chronology separate and verifiable.
4. Identify the dominant central tension across the batch. A video unrelated to that tension becomes a smaller separate story thread rather than being forcibly linked.
5. Deduplicate repeated background claims. Preserve each supporting video in a per-claim citation map, even when the prose mentions the point only once.
6. Flag **new**, **reinforced**, **changed**, **contradicted**, **unresolved**. Changed opinions take precedence over repetition.
7. Compose one continuous narrative per dominant thread. Integrate explanations directly into the acts.
8. Finish with the creator's most recent *documented* position and the evidence needed to test it, not with Bluebelly's unlabelled trading advice.

**Illustrative four-video arc:** bullish QQQ setup → new Anthropic/Meta fundraising → CDS and inflation concerns → Iran diplomacy as potential relief. This is illustrative structure, **not independent verification of those events**.

## 6. Required reading depths — summary, full report and discoveries

**Extensive does not mean repetitive.** Do not shorten a substantial transcript batch into three superficial bullets, but do not pad a single video to meet a word target. Preserve decision-changing evidence, quantitative comparisons, unique observations and changes of mind. Put repetition and exhaustive video metadata behind expandable source views.

### A. Executive summary — the useful first screen

Provide an approximately 200–350-word orientation **when the evidence warrants it**, including:

1. **Central argument:** what the creator believes and why.
2. **Key discoveries:** generally up to 5–7 differentiated findings, each explained in one or two sentences rather than cryptic headlines.
3. **What is new or changed:** distinguish a new claim from reinforcement and reversal, with dated video links.
4. **Strongest countercase:** what the creator may have overlooked and whether the creator addressed it.
5. **Market implications:** relevant instruments and channels, clearly attributed as hypotheses unless independently checked.
6. **What to watch next:** a short list of objective tests and catalysts.

The summary should make sense without reading every act. Do not call an unsourced opinion a verified discovery.

### B. Full creator report — substantive, coherent and expandable

After the summary, provide a multi-act narrative across **all fully consumed eligible videos**. Explain the creator's line of reasoning, numerical examples, comparisons with prior uploads, unresolved contradictions, and sources. Group repeat material without erasing source links. For each main thread identify: initial view, evidence introduced, change or reinforcement, counterevidence, current stance, confirmation and invalidation.

There is **no arbitrary maximum length** for the full report. Use headings and collapsible acts for mobile readability; detail should scale with the number and substance of transcripts. Unsupported material is omitted, not extrapolated.

### C. Discovery & research tips — explain how to learn from the creator

A meaningful discovery is an interesting, **source-attributed clue** that leads to a falsifiable research question. Each material entry should answer:

- **The clue:** the concrete observation or unusual relationship that caught attention, with original video/timecode.
- **Why it is surprising:** the conventional expectation and why this observation differs.
- **The mechanism:** plain-English explanation of how the proposed link could work; add a small worked example when it clarifies the concept.
- **How to find/check it yourself:** the specific ticker, dataset, filing, query, indicator, chart comparison or original source to open; include units, dates and timeframe where relevant.
- **What would confirm or refute it:** exact observable follow-up, not 'keep monitoring'.
- **What might mislead you:** lag, sample size, adjusted metrics, spurious correlation, positioning or alternative explanation.
- **Practical use:** presenter research angle, thesis watchpoint or potential decision input; **not** an unverified trading instruction.

Use three labels: **Creator discovery** (what the video actually argued), **Independent verification** (what primary sources confirm), and **Bluebelly research tip** (our method or inference). Never imply the creator personally performed a check not found in the transcript. If no worthwhile discovery exists, state that; don't manufacture a quota.

**Example, illustrative rather than live evidence:** A creator notices that equities are rallying while corporate credit spreads widen. Teach what the spread measures, ask whether the instruments and observation windows match, then show the reader how to compare issuer bond/credit benchmarks with the equity move. A sustained widening with worsening financing disclosures might strengthen the credit-risk interpretation; a stale or illiquid quote might refute it.

### D. Concept learning and glossary links

Explain jargon **in the act where readers first need it**, followed by an optional "Explore this concept" link to the public governed Bluebelly glossary (e.g. `/learn`). A glossary should not replace the narrative explanation. Link by exact concept key/alias; do not hallucinate an entry or expose private research.

## 7. Creator Summary tab: recommended UI

**Top of tab:** Creator selector, current story headline, coverage range, `X videos covered / Y eligible`, and a last-successful-transcript-sweep timestamp.

**Default view — Executive summary, then Story:** A readable article with opening hook and collapsible Act sections, inline **Why this matters**, links to source videos at each major claim, and an ending **What the creator thinks / What could change their mind**.

**Secondary view — Discoveries & how to check:** Source-anchored observations, explained mechanisms, reproducible research tips, caveats and links to governed glossary Concepts. Do not pad empty discoveries.\n\n**Secondary view — Video sources:** Chronological video list with title, date, URL, transcript status, and which act(s) cite each video. Distinguish *discovered but not yet transcribed* from *covered*.

**Secondary view — Thesis changes:** Compact change log with timestamps showing what was reiterated, revised, abandoned or contradicted. Link to original statements.

**Optional comparison:** A separate cross-creator comparison can surface agreements/disagreements, but must not merge creator voices inside the canonical single-creator narrative.

**Practical controls:** Expand/collapse acts; click a claim to inspect video/timecode and verification; manual **Sweep this creator**; retry failed transcription; previous edition history. These are implementation requirements, not claims that the controls already exist.

## 8. Data outputs and persistence

Persist both a human-readable Markdown story **and** a structured record. Suggested fields:

```yaml
creator_id: meet_kevin
edition_id: <stable_id>
coverage_start: <ISO8601>
coverage_end: <ISO8601>
compiled_at: <ISO8601>
input_videos: [<video_ids>]
fully_consumed_videos: [<video_ids>]
pending_transcripts: [<video_ids>]
headline: <text>
central_tension: <text>
acts: [<title, markdown, cited_video_ids, claim_ids>]
learning_moments: [<title, markdown, claim_ids>]
latest_creator_view: <text>
changes_since_previous: [<claim_ids>]
watchpoints: [<instrument, catalyst, timing, source>]
verification_status: <partial|checked|mixed>
```

Keep exact original transcripts and per-claim provenance available to the creator-intelligence ingestion layer. Version story editions; avoid overwriting past positions without an audit trail. If Notion is the configured knowledge store, link each published story edition to the creator intelligence/video log and Research Gate evidence, rather than creating an isolated second source of truth.

## 9. Canonical output Markdown template

```markdown
# [Creator]: [The conflict at the heart of their latest thesis]

**Coverage:** [date range] · [X fully covered videos] · [last update]
**Source status:** [complete/partial; outstanding videos]

[Hook: what was believed, what changed, what is at stake.]\n\n## Executive summary\n[Main thesis, 5–7 distinctive insights when warranted, change vs prior edition, strongest countercase and next tests.]

## Act 1 — [The original argument]
[Story, claims and video citations in natural order.]

## Act 2 — [The evidence changes]
[What a later video adds and whether it reinforces or revises Act 1.]

> **The learning moment — [reader's natural question]**
> [Simple explanation; a worked example if useful; what could undermine it.]

## Act 3 — [The problem nobody can ignore]
[Counterevidence, uncertainty and the creator's reaction.]

## Act 4 — [Two competing explanations]
[Creator's competing theories and supporting/weakening evidence.]

## Discoveries and how to check them\n[For each evidence-backed clue: observation + why surprising + mechanism + how to reproduce + counterexample + practical next check; original video citation.]\n\n## Where the creator stands
**Latest stated view:** [...]
**What changed from earlier videos:** [...]
**What could prove them right:** [...]
**What could challenge them:** [...]

## Bluebelly's evidence check
**Confirmed externally:** [...]
**Claims not independently verified:** [...]
**Bluebelly interpretation:** [...]

## Videos behind this story
- [Title](URL) — [published time] — [covered acts / transcript status]
```

## 10. Short production prompt

> You are Bluebelly's creator-intelligence story writer. For one creator at a time, turn all eligible newly consumed transcripts into a single flowing, act-based market story. Lead with a compact, substantial executive summary, then reconstruct how the creator's thesis developed as successive videos introduced claims, evidence and complications. Collapse repeated points; prominently retain changed or contradictory views with source videos and dates. Add plain-English finance learning moments exactly when needed. End with the creator's latest documented stance, confirm/challenge indicators and linked video sources. Separate the creator's assertions, independent verification and Bluebelly interpretation; never invent a bridge between unrelated videos or imply verification from a transcript alone. Add source-anchored discoveries, explained research methods, caveats and reproducible chart/data checks; do not invent a discovery quota. Explain jargon at first use and link existing governed glossary concepts where exact matches exist. Produce a persistent Markdown edition and structured source/claim mapping. Follow the Bluebelly Daily Report evidence and British-English style standards, but write about the **creator's evolving argument**, not the day's verified market chronology.

## 11. Publication acceptance checks

- [ ] All eligible newly consumed videos accounted for; partial/failed ones remain queued.
- [ ] Executive summary communicates the differentiated findings, thesis changes, countercase and next tests without requiring the full article.\n- [ ] Full report retains material quantitative details and reasoning without duplicate padding.\n- [ ] Discovery entries explain evidence, mechanism, reproducible research steps, traps and falsifiers; no invented discoveries or data.\n- [ ] At least one clear story thread; unrelated threads not forcibly merged.
- [ ] Publication chronology accurate and provenance clickable.
- [ ] Repetition removed without losing relevant source attribution.
- [ ] Thesis revisions and contradictions preserved.
- [ ] Every technical concept explained at point of use when necessary.
- [ ] Creator claims not represented as independent facts.
- [ ] Ends with a concrete most-recent stance and testable watchpoints.
- [ ] Edition and structured evidence persist and remain inspectable.
- [ ] Story is readable aloud and engaging without fictional details.
