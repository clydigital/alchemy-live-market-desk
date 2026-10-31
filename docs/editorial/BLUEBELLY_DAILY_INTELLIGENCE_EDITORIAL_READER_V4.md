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
- A material creator claim from a retrieved transcript is either included as an **attributed argument** or excluded with explicit reason. Repair `video_analysis_status=failed/not_attempted` separately; do not claim the 07:00 Creator job provides completed deeper analysis.
- A failed embed or missing source does not silently delete narrative or turn attributed speculation into a fact.
- No sixth automation, new research engine, public self-publisher, private-content public route or premature replacement of existing PDF history.
- Maintain existing manual editorial approval boundary. Do not merge until tests, build, owner security and production readback are demonstrated.

## Implementation sequence

1. Commit this locked standard and a **pure, side-effect-free editorial reader renderer** using typed, already assembled source data; write validation/tests for provenance, X links, spacing and privacy-safe fallbacks.
2. Connect existing source-frozen packet assembly and source-gated creator reasoning; keep the existing PDF system as legacy until the new edition path is complete.
3. Add owner-only HTML edition storage/readback and A4 PDF export **from the same snapshot**; idempotence, hash and historical editions required.
4. Run tests/build and desktop/mobile/PDF QA; manual owner approval, then production deployment and readback.

**Never call this step-one contract a completed automatic Daily Intelligence pipeline.**
