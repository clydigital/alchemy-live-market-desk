# Bluebelly — Story-Driven Daily Report Standard

**Version:** 1.0  
**Applies to:** Bluebelly Daily Brief, MacroPulse-derived recaps, Research Gate syntheses, and Presenter Prep narrative views.  
**Purpose:** Explain *what happened, why it mattered, what the market did, and what could happen next* in a chronological story that teaches readers as it goes.

## 1. Why the Shark Tank breakdown worked

The Tia Lupita explanation was effective because it followed **discovery order**, not textbook order:

1. **A concrete opening dilemma:** an entrepreneur seeks capital; investors hesitate.
2. **Scene-by-scene chronology:** the viewer discovers sales, losses, objections, and revised terms in the order the story unfolds.
3. **Changing stakes:** each revelation changes how the original offer looks.
4. **Embedded learning moments:** technical concepts (valuation, dilution, debt versus equity) appear *exactly when they become necessary*.
5. **Worked numerical examples:** abstract contract terms become intuitive through simple share-count arithmetic.
6. **Two-sided incentives:** the account explains what each participant is trying to accomplish, without assuming their private motives.
7. **A final conditional judgement:** success depends on future outcomes, not merely a handshake.

**Transfer to markets:** Don't open with ten unrelated headlines. Open with the market's central tension, then reveal the catalysts and price reactions in sequence. Interject brief explanations when a mechanism becomes important. End with what would confirm, challenge, or invalidate the emerging interpretation.

## 2. Editorial contract

- **Story first, evidence always.** Only state an event, price, attribution, sequence, or motivation as fact when evidence supports it.
- **Chronology is real, not invented.** Use verified timestamps and market sessions; distinguish event time, publication time, and observation time. If sequence is unclear, say so and organise by theme rather than fabricating an order.
- **No hindsight theatre.** Do not imply a catalyst *caused* a move just because they happened near each other. Use 'coincided with', 'followed', or 'may have contributed' unless causality is well supported.
- **Price discipline.** Every price, yield, percentage and technical level must have instrument, units, as-of timestamp, timeframe and source. No invented live prices or chart signals.
- **Clear known/unknown separation.** Mark reported facts, reasonable interpretation, and scenarios distinctly.
- **Primary sources first:** central banks, economic releases, filings, official statistics and company statements. Supplement with reputable reporting and original social posts where appropriate; verify unconfirmed claims.
- **Readable aloud.** British English; approximately grade-8 reading level; paragraphs of 1–3 sentences. Introduce jargon only to explain it.
- **No performative drama, overclaiming, false precision or forced metaphors.** Emotion should come from the stakes, not invented dialogue.
- **Keep it actionable without presenting conditional trading setups as guaranteed outcomes.**

## 3. Narrative architecture

### A. Opening hook (2–4 sentences)
Begin with a contradiction or consequential question from the day's verified data.

> Oil was climbing, but equities tried to rebound. Why were investors willing to buy risk while energy costs were rising?

Then give a **one-sentence thesis** with a confidence label (high / medium / low) based on supporting evidence, not a numeric probability invented for effect.

### B. The day as 3–5 scenes
Use chronological beats *only when timestamps confirm them*:

**Scene 1 — The setup.** What was the market expecting at the start of the relevant session? Cite previous known conditions.

**Scene 2 — The catalyst.** What announcement, release, geopolitical development or company disclosure changed the information set? Include exact timestamp, timezone and link.

**Scene 3 — The reaction.** What changed in prices, yields, spreads, volume or positioning? Distinguish immediate reaction from the later session move.

**Scene 4 — The complication.** Which cross-asset move, subsequent report or positioning detail challenges the simple explanation?

**Scene 5 — Where it stands now (optional).** What has been confirmed, what has not, and what is the next meaningful test?

For quiet days, use only 2–3 scenes. **Never fabricate a scene to satisfy the template.**

### C. Learning-moment interjections
Insert a short **Why this matters** box after the specific event that needs explanation, rather than an up-front glossary.

Format:
- **Question:** e.g., 'Why can hotter inflation strengthen GBP?'
- **Mechanism:** one or two sentences explaining the rate-expectation channel.
- **Counterforce:** one sentence showing when that mechanism might fail.
- **Market tell:** one observable instrument to check (for example, UK 2-year gilt yield and EUR/GBP).

Maximum 2–3 per report. Prioritise mechanisms essential to understanding the day's story.

### D. Decision-ready ending
Finish with:
- **What changed today:** one factual sentence.
- **What would confirm the story:** observable level, release, policy comment or data point; source/timeframe attached.
- **What would challenge it:** specific contradictory evidence.
- **Watch next:** catalyst, date/time in ET (and MYT when operationally useful), and relevant assets.

Never end with an unconditional trade command.

## 4. Standard report Markdown template

```markdown
# [Specific headline: tension + asset, ≤63 characters]

**As of:** [YYYY-MM-DD HH:mm ET / MYT]  
**Main question:** [One concrete question]  
**Working interpretation:** [One sentence, confidence: high/medium/low]

## The story so far
[2–4 sentence opening: setup, contradiction, stakes.]

### Scene 1 — [Verified setup]
[What was known before the catalyst. Timestamp and link.]

### Scene 2 — [What changed]
[The new event, what the original source actually confirms, and the timing.]

> **Why this matters — [plain-language question]**  
> **Mechanism:** [Short explanation.]  
> **But:** [One important alternative or limitation.]  
> **Watch:** [Observable market tell.]

### Scene 3 — [How markets responded]
[Price or yield changes with instrument, source, timeframe, and as-of time.]

### Scene 4 — [The catch]
[Contradictory evidence, second-order effects, or unconfirmed interpretation. Omit if none.]

## What this means now
**Confirmed:** [What sources establish.]  
**Interpretation:** [What the evidence suggests, not proves.]  
**Not confirmed:** [Open question.]

## The next test
- **Confirms:** [Specific observation / release / threshold.]
- **Challenges:** [Specific counter-signal.]
- **Calendar:** [Next catalyst, date and time ET, MYT as appropriate.]

**Source ledger:**
1. [Primary source URL] — [event time; publication time; accessed time if needed].
2. [Price-data source] — [instrument/timeframe/as-of time].
```

## 5. Bluebelly pipeline: where this belongs

1. **MacroPulse discovery:** capture candidate catalysts, event times, original URLs, timestamps, and source reliability. Do *not* write the story yet.
2. **Research Gate:** verify facts, data vintages, causal claims, conflicting reports, and cross-asset moves; label confirmed / provisional / disputed.
3. **Narrative compiler (this standard):** choose *one central tension* and 3–5 chronological scenes; insert learning moments at the point of need.
4. **Bluebelly Daily Report:** publish a short story-led summary with expandable evidence and cross-asset charts. Preserve citations at paragraph or claim level.
5. **Presenter Prep:** reuse the same verified narrative as a natural spoken script plus technical checklist; do not invent chart-band breaks or levels.

**Storage recommendation:** Keep this Markdown as a version-controlled editorial rule, reference it from the daily-report generation prompt, and save both the generated narrative and its structured evidence ledger so edits can be traced to sources. Do not replace the existing MacroPulse or Research Gate evidence process.

## 6. Compact system prompt for the report writer

> You are Bluebelly's story-driven market explainer. Write the day's market report as a fact-checked chronological narrative, as if watching the trading session unfold with an informed colleague. Begin with the central tension, disclose verified events in their true order, and explain financial mechanisms precisely when readers encounter them. Use 3–5 scenes only when supported by actual timestamps; otherwise organise thematically. After key scenes, insert at most three compact 'Why this matters' interjections (mechanism, counterforce, market tell). Separate confirmed facts from interpretation and scenarios. Every market figure must retain instrument, source, timeframe and as-of timestamp. End with a concrete confirm/challenge/watch-next framework. Use British English, 1–3 sentence paragraphs, clear causal caution and direct language. Do not manufacture dialogue, breaking news, price levels or claims of causality. Draw exclusively from the verified Research Gate evidence packet and linked primary sources. If evidence is missing, explicitly say so.

## 7. Quality checklist before publishing

- [ ] Hook captures a genuine evidence-backed conflict or development.
- [ ] All scenes are chronologically accurate or clearly labelled thematic.
- [ ] News event timestamps differ clearly from publication/observation timestamps.
- [ ] Each pivotal factual claim has a direct source.
- [ ] Each price or technical claim includes instrument, timeframe and as-of time.
- [ ] No causal overstatement or invented motivation.
- [ ] Interjections answer real reader questions and don't derail the story.
- [ ] Both supporting and challenging evidence are included.
- [ ] Closing watchpoints are observable and decision-relevant.
- [ ] Presenter version can be read aloud in ordinary conversational language.

## 8. Example opening (illustrative only; not live market data)

> **Oil rose, but stocks refused to fall. What changed?**
>
> Going into the session, investors were watching whether higher energy prices would force bond yields up. Then an economic release arrived that complicated that picture. The first reaction in yields was one thing; the equity response was another.
>
> **Why this matters:** higher oil prices can raise inflation expectations, while weaker growth data can push rate expectations in the opposite direction. The next clue is whether short-dated yields follow the inflation story or the growth story.

This example is intentionally free of fabricated figures or events. Fill it only with verified daily evidence.
