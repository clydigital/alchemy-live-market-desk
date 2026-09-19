# Alchemy Explainer Dossier Method
## Canonical Content + Visual Rendering Contract

**Purpose:** Reproduce the 1 September 2026 Alchemy market-explainer experience consistently across future dossiers and the Hybrid Market Desk.

**Golden reference:** `Alchemy_Market_Dossier_BabyPips_2026-09-01.html`

**Research dependency:** `Alchemy_Mixed_Research_Voice_Method_v2.md`

---

# 1. Design objective

The Dossier should feel like a very good teacher explaining a complicated trading day on a clean research page.

The design reduces cognitive load and answers: where am I, what type of information is this, and what should I remember?

---

# 2. Deterministic UI, not prompt-generated design

The LLM outputs structured content. React/HTML components render that content using a fixed visual system.

The model chooses semantic types such as `plain_english`, `why_traders_care`, `confirmation`, `invalidation`, `warning`, and `commentary_context`.

The renderer owns colours, spacing, typography, borders, cards, responsive behaviour, icon treatment and table styling.

This is the main anti-drift rule.

---

# 3. Visual tokens

Use one fixed product palette for Dossier semantic states. Do not allow story-by-story colour invention.

Recommended initial tokens:

```css
--ink:#18202a; --muted:#657080; --line:#dce3ea; --bg:#f4f7fa; --paper:#fff;
--blue:#1f6feb; --blue-soft:#eaf3ff;
--green:#1f8f5f; --green-soft:#eaf8f1;
--amber:#b7791f; --amber-soft:#fff7df;
--red:#b33a3a; --red-soft:#fff0f0;
--purple:#6f42c1; --purple-soft:#f4efff;
--navy:#17324d;
```

---

# 4. Page structure

1. Hero: brand/date/edition, plain-language title, explanatory lede, 3–7 topic chips.
2. 60-second version: numbered summary plus causal story map.
3. Compact table of contents using question-led lesson titles.
4. Numbered lesson cards.
5. What should I watch? monitoring grid.
6. What could move markets next? economic data, earnings, geopolitical/policy clock.
7. Source-discipline close.
8. Optional read-aloud mode derived from the same Dossier object.

---

# 5. Lesson component

Each lesson is question-led, not category-led.

Good: `Why is the global bond selloff such a big deal?`

Avoid: `Bond Market Update`.

Each lesson may contain one or more of:

- KPI pair with context;
- concise comparison table;
- causal chain;
- plain-English callout;
- why-traders-care callout;
- confirmation callout;
- invalidation/common-mistake callout;
- commentary-context callout;
- watch variable.

Do not force every component into every lesson.

---

# 6. Semantic callouts

- Blue: **IN PLAIN ENGLISH** — definitions and jargon compression.
- Amber: **WHY TRADERS CARE** — market sensitivity, not trade instruction.
- Green: **WHAT CONFIRMS THIS?**
- Red: **WHAT WEAKENS THIS? / COMMON MISTAKE**
- Purple: **COMMENTARY CONTEXT** — ZeroHedge, The Market Ear, creator transcripts or analyst commentary not independently verified as primary fact.

---

# 7. Information-density rules

One visual idea per block. Prefer one decisive table, one causal chain, one KPI pair and one explanation callout rather than a dashboard wall.

Avoid repeating the same facts in prose and cards. Avoid long internal source IDs in the body.

---

# 8. Monitoring ending

Before the forward calendar, show the variables that tell the user which narrative is winning.

Each watch item contains:

- variable;
- why it matters;
- what direction/state would strengthen the active interpretation.

---

# 9. Ahead / Event Horizon

Preserve the useful Journey functionality as a clear section after the explanatory lessons:

## WHAT COULD MOVE MARKETS NEXT

### ECONOMIC DATA
Exact date/time, event, consensus/prior when available, and why it matters to today's storyline.

### EARNINGS
Only materially linked names.

### GEOPOLITICAL / POLICY CLOCK
Only known scheduled events. Never invent future events.

---

# 10. Read-aloud view

Read-aloud uses the same persisted Dossier object. It removes tables, linearises comparisons, turns arrows into spoken transitions, strips IDs/badges and preserves caveats.

No separate research pass.

---

# 11. Golden-reference behaviour

The 1 September 2026 dossier is a visual/explanation fixture, not a word-for-word template.

Stable behaviours: hero structure, 60-second summary, story map, question-led lessons, semantic callouts, simple comparison tables, monitoring grid, source-discipline close, generous spacing and plain language.

Variable behaviours: number of lessons, icons, whether a table/commentary block exists, number of causal storylines and chosen watch variables.

---

# 12. Rendering schema

```yaml
dossier:
  contract_version: dossier-briefing/v1
  generated_at: ISO-8601
  parent_edition_id: string|null
  edition_type: baseline|analyst_enriched
  freshness: fresh|degraded|stale
  opening:
    eyebrow: string
    title: string
    lede: string
    topic_chips: [string]
  quick_summary:
    - rank: integer
      text: string
  primary_storyline:
    title: string
    nodes: []
    links: []
  lessons:
    - number: integer
      icon: string|null
      title: string
      question: string|null
      body: [string]
      kpis: []
      comparison: null|object
      cause_effect: []
      callouts: []
      watch_items: []
      evidence_refs: [string]
  watch_now: []
  ahead:
    economic: []
    earnings: []
    geopolitical_policy: []
  source_discipline:
    primary: []
    reporting: []
    commentary: []
    interpretation_notes: []
  read_aloud:
    available: boolean
```

---

# 13. Acceptance test

Reject the render if it reads like an internal memo, contains COTD/OB notes, presents every Story independently without testing causal grouping, uses unexplained terminology, shows context-free numbers, promotes commentary as authoritative fact, changes styling arbitrarily, omits monitoring variables or cannot produce a coherent spoken version.
