# Alchemy Mixed Research Voice Method v2
## Dossier-First Research Brain

**Status:** Canonical research/composition method for Alchemy market dossiers and the Hybrid learning layer.

**Supersedes:** The presentation/composition sections of `Alchemy_Mixed_Research_Voice_Method.md`.

**Preserves:** The earlier method's source hierarchy, Mark Malek contradiction-first research, ClearValue linear explanation, Stocked Up session compression, evidence labels, countercase discipline, confirmation/invalidation, and forward-calendar requirements.

---

# 0. The core idea

The Alchemy research system should no longer think of the Hybrid output as a stack of story cards.

It should think in four stages:

> **SKELETON → BRAIN → CRANIUM → DOSSIER**

- **Skeleton** = canonical Live pipeline, evidence objects, Story state, history, timestamps, market data and event horizon.
- **Brain** = the automatic Alchemy research method. It discovers, verifies, challenges and connects stories without requiring analyst input.
- **Cranium** = optional analyst-supplied ideas, questions, observations, source leads and hypotheses. It can redirect attention but cannot become truth by assertion.
- **Dossier** = the pedagogical presentation of the latest canonical state. It explains the market machine in a way that is easy to understand, remember and read aloud.

The governing research question becomes:

> **What is the smallest causal model that makes today's important market moves make sense?**

The governing presentation question becomes:

> **Can a non-specialist understand every arrow without losing the caveat that could break the chain?**

---

# 1. Division of labour

## 1.1 Mark Malek layer — discovery and challenge

Owns contradiction-first story discovery, accepted market explanation, overlooked measurable variable, causal mechanism, second-order effects, market-may-be-right pass, strongest countercase, confirmation, invalidation, next catalyst and evidence quality.

## 1.2 ClearValue / BabyPips-style explanation layer — comprehension

Owns one question per lesson, define-before-analyse, one-arrow-at-a-time explanation, contextualised numbers, obvious-question handling, market translation and competing-condition visibility.

This is an **Alchemy explainer style**, not an imitation of another publisher's branding or prose.

## 1.3 Stocked Up layer — session utility

Owns what changed since the prior edition, broad tape orientation, relevant names/themes, positioning anomalies, upcoming releases, earnings, geopolitical clock and what to watch next.

---

# 2. New mandatory stage: Causal Storyline Composer

The system must test whether several Stories are better understood as one causal storyline.

Example:

`Iran / Hormuz risk → oil inflation → Fed repricing → front-end Treasury yields → long-end / fiscal stress → USD, mortgages, Japan, gold and rate-sensitive equities`

A storyline may group Stories only when there is a plausible causal or transmission relationship, the links are evidence-labelled, grouping improves comprehension, contradictory evidence remains visible and Story lineage is preserved.

If the day is genuinely fragmented, use multiple smaller storylines rather than forcing one narrative.

Suggested output:

```yaml
storyline:
  id: string
  title: string
  central_question: string
  summary: string
  story_ids: [string]
  nodes:
    - id: string
      label: string
      type: event|macro|policy|rates|fx|commodity|equity|credit|positioning
  links:
    - from: string
      to: string
      relationship: string
      evidence_status: observed|strongly_supported|inferred|speculative
  strongest_break_condition: string
```

---

# 3. Source discipline

Prefer official / primary data, filings/transcripts, direct market data, specialist physical/flow data, reputable reporting, then commentary/social.

ZeroHedge, The Market Ear, creator transcripts and analyst notes are useful for discovery, positioning context, competing narratives and source leads. They are not automatically authoritative evidence. Dossier rendering must label them as commentary context unless the underlying factual claim is separately verified.

---

# 4. Automatic run must remain independent of analyst input

The regular Live run must work without the analyst.

It should perform the normal source/video/data sweep, identify material changes, update persistent Stories, perform contradiction/countercase research, compose causal storylines, update the event horizon and publish a canonical baseline edition.

The Cranium is an optional enrichment pass, never a gate.

---

# 5. Cranium-aware research pass

If a Cranium is supplied, run an Analyst Overlay Refresh rather than appending it directly.

For every Cranium item:

1. classify observation/question/hypothesis/source lead/chart lead/must-check/editorial preference;
2. map it to existing Stories/candidates;
3. search supporting evidence;
4. deliberately search disconfirming evidence;
5. label supported / partly supported / contradicted / unresolved / duplicate;
6. update only affected canonical Story objects and storyline composition;
7. refresh market data and event horizon where freshness matters;
8. publish a new immutable analyst-enriched edition linked to the baseline.

The Cranium can change research priority. It cannot directly change canonical facts, evidence status or confidence.

---

# 6. Dossier-first composition

After research, build structured content before prose:

- Opening: title, explanatory lede, topic chips, freshness, baseline/enriched status.
- 60-second version: no more than five numbered points.
- Story map: strongest evidence-labelled causal chain.
- Lessons: normally 4–9 question-led sections with current state, plain-English explanation, evidence/comparison, cause/effect, trader relevance, correction/caveat, confirmation and invalidation as relevant.
- What to watch: variables, not predictions.
- What could move markets next: economic calendar, earnings, geopolitical/policy clock.
- Source discipline: distinguish primary, reputable reporting, commentary and interpretation.

No COTD/OB editorial notes belong in the Dossier.

---

# 7. Writing rules

Use British English, grade-8 readability, spoken-language clarity, short paragraphs, exact comparisons, definitions at first use, calm uncertainty and one-arrow-at-a-time causal chains.

The style should be easy to understand without becoming childish. Emoji are navigation signs, not decoration.

Suggested semantic icon set: oil/energy, central banks/policy, bonds/yields, country macro, gold, plain English, why traders care, caveat, confirmation, invalidation, commentary context and what to watch.

---

# 8. Read-aloud mode

Every Dossier must be convertible into a driving/voice version from the same canonical content.

Read-aloud mode removes tables, turns comparisons into sentences, reads causal chains in order, strips internal IDs/UI labels, preserves corrections/caveats and ends with monitoring variables. It must not introduce a new thesis.

---

# 9. What the Dossier is not

It is not a COTD draft, Opening Bell draft, article-idea list, internal analyst memo, dashboard wall, chronological news dump, generic recap or second Hybrid research engine.

It is the best current explanation of today's market state built from canonical Live research.

---

# 10. Hybrid integration principle

Live remains the canonical owner. Hybrid renders the persisted Dossier object read-only.

Hybrid may simplify wording, order lessons, display the causal map, provide read-aloud/history/Ahead views and render fixed components. It may not rerun research, change Story membership, create a parallel thesis, silently fill evidence gaps or use mutable current Story state when replaying an old edition.

---

# 11. Recommended pipeline

```text
Scheduled Live baseline
→ canonical evidence + Story updates
→ causal storyline composition
→ baseline dossier snapshot
→ optional Cranium upload
→ analyst-overlay challenge / targeted rescan
→ affected Story versions updated
→ causal storyline recomposed
→ event horizon refreshed
→ analyst-enriched dossier snapshot
→ Hybrid renders exact immutable snapshot
→ read-aloud / history / Ahead derive from same object
```

---

# 12. Success test

A good Dossier lets the user answer what changed, the main causal chain, key terms, why assets are moving, the easy-to-misunderstand claim, confirmation/invalidation, what to watch next, scheduled catalysts, source-status distinctions and whether they could explain the day to someone else after one pass.
