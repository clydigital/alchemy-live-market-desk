# Blueberry, canonical Dossier, Motion, COTD and OB

2026-10-23. Review-only reliability and publishing design. No new writer, database table, scheduler, auth bypass or automatic publishing approval.

## Ownership and reading order

1. Blueberry begins with independent source-verified factual Motion/news: event time and original deep link. Verification is necessary for public reporting, but does not automatically confer canonical Evidence, causal certainty, or Story/Regime status.
2. Existing bounded public market monitor builds eight source-dated angles: rates, equities, breadth, energy, FX, credit, metals, AI. An unavailable or stale source is never replaced with a recent estimate.
3. Accepted Stories and the analytical Dossier supply a deeper model of mechanisms, competing hypotheses, regime changes and invalidation criteria. Dossier health cannot suppress unrelated verified news or public market observations.
4. Calendar, COTD, OB, research archive and private Presenter prepare their own appropriately bounded outputs.

The native owner-only Blueberry Dossier route reads existing immutable market_dossiers_v2 through getDossierV2PresentationSelection and getDossierV2PresentationSelectionById. It lists up to 18 recent immutable editions; exact older UUID access is independent of that index. An unavailable or invalid historical ID must not silently fall back to latest. Do not fork archive state, create a third thesis writer or expose raw Dossier content on Bluebelly public hosts.

## Reliability decision: AUTOMATED EVIDENCE + SELECTIVE HUMAN ADJUDICATION

Fully manual Dossier updates are not recommended. They reduce coverage, freshness, reproducibility and source logging. Fully automatic acceptance of a regime flip, intraday causal explanation or public market call is equally undesirable.

Maintain the existing MacroPulse/Research Gate schedule and production source acquisition. Provider observations, official publication times, source URLs, instruments, units, vintage and licence status must be independently inspectable. Record the clock of the event, the clock of its observation and the clock of retrieval separately.

System 1 must calculate from genuine canonical evidence. If daily FRED yields exist but exact CPI 5m/30m windows are missing, the Dossier must not infer that reaction; report an incomplete intraday test while maintaining legitimate daily observations. System 2 keeps the current ACCEPT/REFINE/UNRESOLVED/REJECT path. Motion is bounded NON-EVIDENTIARY context, and only canonical evidence UUIDs can justify a Story or Regime mutation. The sole thesis-version creation path remains story_thesis_versions.

**Suggested editorial modes, not new database enum values:** auto factual, automated provisional/degraded Dossier, review required, editorial approved. Require presenter/human sign-off on material new thesis, regime reversal, contested causal mechanism, unresolved source contradictions or external publication. A normal source refresh with no change needs no manual rewriting; stale sources cannot become healthy because the job ran successfully. Frozen records stay frozen and corrections produce new vintages.

## COTD and OB production implications

COTD is the fast, client-facing catalyst story (usually 600–800 words and never over 1,000). It can be drafted from a verified original event and measured market reaction *without a new accepted Dossier verdict*. Preserve LY voice: British English, short paragraphs, concrete mechanism, real countercase, invalidation test, original deep links and at most three appropriate charts. No automatic sending; require editorial QC and approval.

OB is the deeper, multi-angle market investigation using the exact Dossier and persistent Story histories as research context. Reverify every present-tense quote, FRED/Treasury measurement, oil contract/spread and original regulatory filing; use correct event clocks and a clearly argued alternative scenario. Owner approval and publication QC. A frozen Dossier vintage does not grant a current price.

COTD and OB may generate leads for subsequent Research Gate investigation, but their prose and creator-transcript assertions must not re-enter the system as original evidence. Both output objects should retain exact canonical ID, the snapshot they considered, original source receipts and approved publication timestamp.

## Existing gaps and acceptance

Latest persisted 22 October Dossier has twelve research gaps, only one marked MATERIAL: canonical intraday Fed-funds futures, timestamped 5m/30m UST 2Y/10Y and MOVE series necessary for same-session transmission claims. Keep that historical Dossier degraded; fix prospective feed entitlement, observation provenance and same-session measurement rather than papering over it. Economic calendar future-event persistence (#951) also remains incomplete; static scheduled backstops must not be misreported as live actuals or captured consensus.

Test: current Dossier, an exact ID older than the recent 18, malformed UUID, missing UUID, current and historical immutable source sets; public Bluebelly deny, canonical Live reader deny, valid SSO owner read, unapproved owner deny; market monitor missing, Motion unverified, no-change versus breaking day, error and stale provider. Test COTD source-only event and OB competing evidence. Never merge this branch-specific Vercel preview exemption to production. Only cut over once exact browser session, mobile 360/768/1440, and production security tests pass.
