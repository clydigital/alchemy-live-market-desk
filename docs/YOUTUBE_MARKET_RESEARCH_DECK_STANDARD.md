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

Each creator gets a separate tab after synthesis. Never merge their voice or analytical framework into another creator's section.

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
2. **Reveal TradingView Chart** — an expandable live TradingView embed mapped to the canonical symbol.

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

### Tab 1 — Cross-Creator Synthesis

Use a **two-column desktop layout** so the analyst can compare themes quickly without excessive scrolling. Collapse to one column on mobile.

Recommended modules:

1. **Market Regime** — one concise paragraph.
2. **Consensus / Divergence Cards** — each card shows what every creator said about one theme.
3. **Highest-Conviction Overlaps** — only where multiple independent creator frameworks converge.
4. **Important Disagreements** — preserve conflicting interpretations.
5. **Under-the-Hood Rotation** — sectors / breadth / rates / credit / flows.
6. **Event Risk** — next macro, earnings, regulatory or geopolitical catalysts.
7. **Macro Weave** — concise integrated market conclusion.

Do not add a separate Crypto tab just because a source mentions Bitcoin. Crypto commentary belongs inside the relevant creator tab unless the user explicitly requests a standalone crypto view for that batch.

### Tabs 2+ — Individual Creator Breakdowns

One creator per tab, in source order.

Use a **single-column layout** so there is enough horizontal room for technical-analysis copy, creator screenshots and live TradingView charts.

Each creator tab should begin with:

- **Central message** — 1–2 paragraphs explaining what the whole video is really arguing.
- **Core themes** — concise list of the major narratives / evidence categories used.

Then render the charts in source order. Each chart block should include:

- chart / instrument title
- approximate video timestamp
- creator screenshot when available
- **Their read** — what the creator is saying about the chart
- **How they framed the chart** — structure, levels, evidence, scenario logic and qualifiers
- independent verification note where relevant
- `Reveal TradingView Chart` control
- timestamped creator-video link / embed

Do not compress an individual creator's chart work into small multi-column cards. The chart block is the primary unit on creator tabs.

## Interaction requirements

- Navigation tabs: **Synthesis → Creator 1 → Creator 2 → Creator 3...**
- Section / creator navigation must work on desktop and mobile.
- `Reveal TradingView Chart` expands/collapses an embedded TradingView chart in place.
- TradingView embeds load lazily when revealed where practical.
- Timestamped creator-video controls open at the relevant approximate section.
- No placeholder cards, fake timestamps or fabricated screenshots.
- Macro Weave belongs on the synthesis tab for this research-deck format.

## Visual language

Use the existing Market Deck cyberpunk language as the base, but make video research feel more editorial and chart-led:

- `background.gif`
- Figtree
- neon cyan accent
- dark translucent panels
- restrained glow
- synthesis cards in a 2-column desktop grid
- creator tabs in a 1-column chart stack
- larger chart surfaces than text surfaces
- creator attribution as a small eyebrow / badge
- verification badge adjacent to the evidence label
- red / amber / green reserved for risk, uncertainty and verification state rather than decoration

The deck should feel like a **research terminal crossed with an editorial briefing**, not a social-media recap.

## Quality gate

Before publishing a batch, verify:

1. All videos used have transcript status ready.
2. Creator names are correct.
3. Cross-creator synthesis is the first tab and uses the 2-column desktop layout.
4. Each creator has a dedicated single-column tab.
5. Every creator tab begins with a central-message summary and core themes.
6. Every chart section explains what the creator was actually saying, not merely bullish / bearish direction.
7. Every screenshot is tied to the correct video and approximate timestamp.
8. Every tradable chart block has a valid TradingView symbol mapping when a live chart is available.
9. Creator opinion is not presented as verified fact.
10. Material factual claims are independently checked or explicitly marked unverified.
11. Disagreements are preserved.
12. Tabs, creator clips and TradingView reveals work without console errors.

## File naming

Daily standalone HTML output:

`Market Deck YY.MM.DD.html`

For research snapshots / structured source data, use ISO dates internally so daily batches remain deterministic and machine-readable.
