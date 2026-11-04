# Bluebelly Daily Intelligence — Editorial Reader v4 (owner-approved)

**Decision date:** 31 October 2026 (MYT)  
**Design status:** **APPROVED / LOCKED**. **Build status:** incremental implementation, **NOT production deployed or scheduled**.  
**Canonical destination:** private My Desk → Daily Intelligence.  
**Supersedes:** the experimental 3-page decision brief as a default reader.  
**Retains:** the evidence-first, source-frozen, longform private Daily Intelligence blueprint, all existing research jobs and historical privacy boundaries.

## What the user approved

One substantial **full-length analytical essay**, with an accessible five-minute executive opening, then actual chronological explanation, original research, creator transcript debate, financing and cross-market mechanics, competing scenarios, explicit unknowns and source appendix. Preserve length when evidence justifies it. **Do not shorten the report to make it readable. Fix typography and visual distribution.** A 22-page manual prototype was approved; length is *not* a quota.

- HTML main reading measure: approximately **750–800 CSS px**; body about **18px / 1.7–1.8** leading; lead 20–22px; subheading ~24px; section headings 30–34px. Use a sticky desktop section index, not one on 390px mobile.
- PDF: **A4**, approximate 15px body with 1.6 line-height. Keep narrative and figures together, avoid blank/orphan pages. Use the HTML version as the master and derive the PDF from the **same immutable edition**.
- Restrained white/warm-grey, navy/teal and one accent; clean bars, comparisons and labelled hypotheses, **not** decorative or speculative illustration.
- Visual pacing matters: distribute relevant figures/primary-source tables/creator chronology/tweet embeds throughout the report, especially in the latter half. No early-only figure cluster. **No fixed visuals-per-section quota.**
- Tweet posts: exact original X post, handle, observation/publication time and verified/attributed state. Prefer real click-to-load X widget for the **private HTML** with explicit consent, and original-linked text fallback for print/PDF. Posts in `x_wire_posts` with `original_verified=false` remain **attributed/unverified**; their numerical claims must not migrate into a chart without an independent primary receipt.
- Creator transcripts: source name and YouTube URL/video ID, original publication clock, original timed segment when available, previous stance, mechanism, independent checks, strongest rival, why now, falsifier and outcome later. `transcript_status=ready` plus `video_review_status=reviewed` does NOT imply separate `video_analysis_status=completed`.
- Causal logic: solid relations mean documented; dashed relations mean hypothesis. Do not jump from an AI/semiconductor decline to verified GPU collateral calls, yen-funded forced selling, or a specific market-maker action without evidence.

## Stable article order

1. Five-minute executive opening (core tension, observed change, unresolved dispute, next test).
2. What markets actually did, using dated/session-matched observations and one compact visual.
3. Issuer economics: operating cash flows, capex, residual FCF, debt/leases and valuation assumptions, where original sources support them.
4. The critical countercase and what an investor may be overlooking.
5. Macro/policy/energy and cross-asset transmission, showing event times and units.
6. Material creator transcript arguments in *publication order*; show what changed from prior episodes. Attach event-linked original X posts and relevant visuals beside the explanation.
7. What the evidence cannot prove — concise cause-chain and strongest rival theory.
8. Conditional base, alternative, stress paths, with confirmation, invalidation and next dated catalysts.
9. Original-source and claim provenance ledger, changes/errata and separate **research-process QA appendix**.

Quiet days may be shorter. The normal 5,000–8,000-word and major-day 10,000–15,000-word ranges in the private blueprint are **contextual expectations, not a command to invent filler**. Prefer readable narrative, not serial panels.

## Contract and safety

One incremental **source-frozen private evidence packet** → one HTML reading master → PDF generated from the same exact snapshot. Persist **edition ID + hash + UTC/MYT dates + source IDs**. Preserve historical editions and explicit errata; no overwrites.

Source joins must fail closed. Chart numbers need an original source URI, observed/published timestamps, period, units, methodological description; do not conflate ETF creations, share trading and beneficial ownership. All text from external feeds is untrusted: escape HTML; never execute transcript or X content. No server-side remote script access or unauthorised posting. Owner-only routes must independently check access to raw HTML and its PDF.

## Release/acceptance

- Typed, source-linked reader assembly can generate a substantial article from a **pre-existing** verified and attributed packet (not independent daily research).
- The rendered HTML is legible at desktop ~1440px and **390px without horizontal overflow**, with clear 18px body type.
- Print/PDF version comes from the exact HTML snapshot with useful source-linked fallback for X cards; inspect every page for clipping/empty leaves.
- A material creator claim from a retrieved transcript is either included as an **attributed argument** or excluded with explicit reason. The 14-video source audit actually showed 14 ready transcripts, 14 reviewed records, 14 `transcript_interpreted_at` receipts and 14 evidence IDs. `video_analysis_status` is the separate Gemini fallback after transcript transport failure, **not** a deep-transcript-review stage; its `failed/not_attempted` values do not invalidate completed regular reviews. Deeper **novelty, independent source checking and downstream report handoff** still need separate acceptance proof, rather than an invented failure count.
- A failed embed or missing source does not silently delete narrative or turn attributed speculation into a fact.
- No sixth automation, new research engine, public self-publisher, private-content public route or premature replacement of existing PDF history.
- Maintain existing manual editorial approval boundary. Do not merge until tests, build, owner security and production readback are demonstrated.

## Implementation sequence

1. Commit this locked standard and a **pure, side-effect-free editorial reader renderer** using typed, already assembled source data; write validation/tests for provenance, X links, spacing and privacy-safe fallbacks.
2. Connect existing source-frozen packet assembly and source-gated creator reasoning; keep the existing PDF system as legacy until the new edition path is complete.
3. Add owner-only HTML edition storage/readback and A4 PDF export **from the same snapshot**; idempotence, hash and historical editions required.
4. Run tests/build and desktop/mobile/PDF QA; manual owner approval, then production deployment and readback.

**Never call this step-one contract a completed automatic Daily Intelligence pipeline.**


## Addendum · 4 November 2026 — Daily watchlists, divergences and forward clues

**Standing editorial rule:** Each complete owner-private Daily Intelligence edition must answer not only *what happened*, but **what deserves attention now, why it is on the radar, what does not fit, and which next observation could change the assessment**. This is an editorial selection layer within the approved long-form report, **not** a sixth main story, a fresh data engine or a separate public dashboard. Use the existing maximum of five consequential market questions and the existing source-frozen edition.

### Six recurring lenses

1. **Key stocks to watch.** Name the most consequential companies/tickers *for the current session*, not a permanent generic favourites list. Include material earnings, guidance, cash-flow/capex and balance-sheet questions; large moves, revisions, leadership changes, or meaningful chart levels when dated observations support them. For each selected name: **why now; verified evidence; what price is implying; strongest countercase; the next confirm/invalidate test**. Include relevant issuer/sector peers only where the comparison changes the interpretation.
2. **Key assets to watch.** Select the cross-asset instruments that diagnose the regime: equity indices and breadth; DXY/JXY and major FX; Treasury 2Y/10Y/30Y, curve and real yields; gold; oil, refined products and energy spreads; credit and volatility where supported. Do not list them mechanically. Explain what each chosen asset is signalling, its dated source/timeframe, whether it confirms or contradicts the leading thesis, and the next observable trigger.
3. **Key news worth mentioning.** Prioritise verified policy, economic, geopolitical, company and market-structure events by **capacity to change an investment decision or market regime**, not volume of headlines. Say *what happened*, *what was expected beforehand (or not verified)*, *the evidenced market reaction (or unmeasured)*, and *why it matters next*. Link original releases and preserve exact event and observation clocks. Distinguish an upcoming preview from an actual outcome.
4. **Key sectors and divergences.** Identify relative leaders, laggards and sector rotation, including surprising non-confirmations. Useful comparisons include equal-weight versus cap-weight indices, semiconductors versus broad equities, AI suppliers versus software, cyclicals versus defensives, energy equities/refiners versus crude/diesel, miners versus gold, and sector ETFs versus SPX. Apply **expected reaction → actual dated reaction → divergence → rival explanations → evidence for/against → next discriminating test**. Do not infer short covering, hidden leverage or dealer flow without qualified evidence.
5. **Key speculations and unanswered questions.** Preserve the interesting possibilities the evidence has not resolved: positioning, profit-taking, financing pressure, geopolitical transmission, earnings quality, policy surprises or emerging second-order effects. Frame them as **questions or explicitly labelled hypotheses**, never as established facts or unattributed rumours. Rank the leading explanation and at least one credible alternative when material; identify the missing data that would settle the dispute. It is acceptable to conclude **mechanism not established**.
6. **Forward-looking clues.** Surface the next scheduled releases, earnings, guidance, auctions, central-bank statements, sector/credit developments or technically observable levels that could move the thesis. Each clue needs **event or instrument, ET date/time (MYT when useful), source or source-status, constructive/adverse conditional outcomes, affected assets and a confirmation/invalidation test**. If the timestamp, forecast or price level cannot be verified, show **DATE ONLY**, **NOT VERIFIED** or **UNAVAILABLE**, not an invented precision.

### How to select and present

- Open the existing five-minute executive section with the central tension and a **brief ranked "Today’s watch radar"**: the most material stock(s), asset(s), sector divergence, headline, unresolved question and next catalyst, only where supported. Then weave the evidence and reasoning naturally through the existing nine-part article order; avoid six repetitive standalone chapters or a wall of tickers. Put the detailed watch matrix and supporting charts near the related narrative, including the latter half.
- Rank candidates by **new information, decision impact, unusual/contradictory price behaviour, verifiability and imminence**. Do not impose a fixed count in each category; omit empty categories honestly. Track **new / changed / still open / resolved** versus the prior source-frozen edition to prevent the same evergreen watches being recycled as new.
- Every actionable watchpoint should be expressible as: **[stock/asset/sector] — why now — observed evidence and as-of — what is unusual — base hypothesis vs rival — next catalyst or level — what confirms / invalidates**. Cross-reference company, sector and asset entries instead of duplicating the same underlying catalyst.
- **Time discipline:** anchor the report to the latest *completed US equity session*; label new Asia/pre-release developments as later, separately time-stamped additions. Do not use closing quotes as if they were event-window reactions. Preserve source provenance, units, timeframe and availability of every market measurement.
- **Quality gate:** a report that only recites headline news, prices or a generic watchlist is incomplete. A successful edition gives its reader a **reason to pay attention, a specific unresolved question and a dated observable test** for each material selection. No forced signals, fabricated probabilities, speculative certainty, unverified technical levels, automatic trades, public publication or new automation.

**Research ownership:** Existing MacroPulse discovers candidates; existing Research Investigation verifies and ranks the watch radar and assembles the private long-form edition; Writing Brain can derive editorial ideas from the same edition. This addendum does not itself change scheduled prompts or prove production adoption.
