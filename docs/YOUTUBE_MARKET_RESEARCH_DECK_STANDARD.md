# YouTube Market Research Deck Standard

## Purpose

Turn transcript-ready market videos into an evidence-led daily research deck without flattening creators into one generic summary.

This standard extends `docs/research-video-intake.md`. The transcript gate remains authoritative: creator commentary is hypothesis-level evidence until material claims are independently checked.

## Core design philosophy

### 1. Synthesis first, creators second

Every daily batch opens with a **Cross-Creator Synthesis** before any individual creator summary.

The synthesis answers:

- What do multiple creators agree on?
- Where do they disagree?
- Which creator is adding a genuinely unique data point or setup?
- Which claims survive independent verification?
- What is the resulting market regime / watchlist, without converting research into a signal service?

Do not force consensus. Divergence is useful information and must remain visible.

### 2. Chart-first, not transcript-first

The deck is not a transcript dump. Each important thesis should be expressed as:

**Claim → creator chart → creator interpretation → independent check → actionable watch condition**

Prefer charts, levels, flows, breadth, positioning, earnings and macro evidence over commentary-only passages.

### 3. Preserve creator identity

Each creator gets a separate summary section after synthesis. Never merge their voice or analytical framework into another creator's section.

Every extracted thesis records:

- creator
- YouTube video ID and URL
- approximate timestamp
- transcript-derived thesis
- ticker / market / theme
- creator's key levels or conditions
- confidence / qualification language used by the creator
- independent verification status

### 4. Screenshot only when the frame carries evidence

Capture a video frame only when it shows useful evidence such as:

- price chart and annotated levels
- market internals
- breadth / volatility / positioning
- options / dark-pool / flow data
- earnings / macro table
- sector-rotation visual

Do not use talking-head frames merely as decoration.

The frame should be captured near the transcript passage that discusses it. Store the approximate timestamp with the screenshot so the analyst can jump back to context.

### 5. Creator chart + live chart are different evidence layers

For every tradable instrument with a useful creator chart, render:

1. **Creator Chart** — static screenshot from the video, preserving the creator's annotations and context.
2. **Reveal Live Chart** — an expandable TradingView embed mapped to the canonical symbol.

The live chart must not silently replace the creator chart because the creator's drawn levels and timeframe are part of the evidence.

TradingView mapping must be explicit and deterministic, for example:

- SPY → AMEX:SPY
- QQQ → NASDAQ:QQQ
- IWM → AMEX:IWM
- XLE → AMEX:XLE
- MU → NASDAQ:MU

Use the timeframe closest to the creator's stated analysis when available. If uncertain, default to Daily for swing / structural commentary and 60-minute for explicitly intraday commentary.

### 6. Verification is visible

Every material claim should have one of these statuses:

- **Verified** — independently supported by a primary / high-quality source or directly verified market data.
- **Creator view** — analysis/opinion that does not require factual verification.
- **Unverified** — factual claim could not yet be independently supported.
- **Conflicted** — high-quality evidence materially contradicts the claim.

Never rewrite an unverified creator claim as a fact.

### 7. Separate facts, interpretation and watch conditions

Each research card should visually distinguish:

- **What happened** — verified facts / data.
- **Creator read** — what the creator thinks it means.
- **Our read** — synthesis after comparing sources and market evidence.
- **Watch** — the level, event or condition that would strengthen / weaken the thesis.

The Watch field is educational market monitoring, not a trade instruction.

## Daily information architecture

### A. Cross-Creator Synthesis

Top of deck. Recommended modules:

1. **Market Regime** — one concise paragraph.
2. **Consensus Matrix** — themes × creators with Agree / Mixed / Disagree / Not covered.
3. **Highest-Conviction Overlaps** — only where multiple independent creator frameworks converge.
4. **Important Disagreements** — preserve conflicting interpretations.
5. **Under-the-Hood Rotation** — sectors / breadth / rates / credit / flows.
6. **Event Risk** — next macro, earnings, regulatory or geopolitical catalysts.
7. **Combined Watchlist** — ranked by evidence density, not hype.

### B. Creator Summaries

One section each, in source order. Each creator section should include:

- one-paragraph thesis
- 3–8 major evidence cards depending on materiality
- creator-chart screenshot when useful
- timestamp / source link
- Reveal Live Chart control for relevant tradable instruments
- verification badge
- concise takeaways rather than full transcript reproduction

### C. Crypto Insights & News

Maintain a separate Crypto section whenever the source set contains crypto-relevant material. Apply the same synthesis-first and creator-attribution rules.

## Interaction requirements

- Section / creator navigation must work on desktop and mobile.
- Every `.news-card` includes headline, concise summary and an info-dot for deeper context.
- Info-dot modals contain source, timestamp, verification note, deeper rationale and links.
- `Reveal Live Chart` expands/collapses an embedded TradingView chart in place.
- TradingView embeds load lazily when revealed where practical.
- Fear & Greed gauges update correctly.
- Macro Weave appears in both Market and Crypto sections.
- No placeholder cards, fake timestamps or fabricated screenshots.

## Visual language

Use the existing Market Deck cyberpunk language as the base, but make video research feel more editorial and chart-led:

- `background.gif`
- Figtree
- neon cyan accent
- dark translucent panels
- restrained glow
- larger chart surfaces than text surfaces
- creator attribution as a small eyebrow / badge
- verification badge adjacent to the evidence label
- red / amber / green reserved for risk, uncertainty and verification state rather than decoration

The deck should feel like a **research terminal crossed with an editorial briefing**, not a social-media recap.

## Quality gate

Before publishing a batch, verify:

1. All videos used have transcript status ready.
2. Creator names are correct.
3. Every screenshot is tied to the correct video and approximate timestamp.
4. Every tradable screenshot card has a valid TradingView symbol mapping when a live chart is available.
5. Creator opinion is not presented as verified fact.
6. Material factual claims are independently checked or explicitly marked unverified.
7. Cross-creator synthesis appears before creator summaries.
8. Disagreements are preserved.
9. Market and Crypto sections both include Macro Weave and Fear & Greed gauge.
10. Tabs, modals, chart reveals and gauges work without console errors.

## File naming

Daily standalone HTML output:

`Market Deck YY.MM.DD.html`

For research snapshots / structured source data, use ISO dates internally so daily batches remain deterministic and machine-readable.
