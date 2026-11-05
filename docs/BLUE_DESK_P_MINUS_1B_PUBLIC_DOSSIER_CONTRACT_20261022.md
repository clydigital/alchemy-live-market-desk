# Blue Desk P−1b — Public Dossier Contract (review-only)

**Date:** 22 October 2026 (MYT)  
**Gate:** P−1 STOP / NO GO for actual public publication, private API replacement, Blue Desk cutover or merger of the legacy reader.

## Purpose

This independent partition defines a deliberately fail-closed candidate shape. It does not add a route, edit an existing Live/Hybrid contract, grant a source licence, approve published claims, create a Story writer or change production security settings. The public Dossier route-enabled flag is hard-coded false.

## Exact output field allowlist

| Candidate output | Required source or validation |
|---|---|
| contractVersion, status, published=false | Static constants; REVIEWED_CANDIDATE is not PUBLISHED |
| dossier.dossierId, asOf | Exact valid Dossier UUID and explicit timezone timestamp; not an invented immutable edition ID |
| story.analyticalStoryId, persistentStoryId | One exact Dossier Story, persistent Story UUID only when present |
| story.title, whatChanged, whyItMatters | Exact reviewed text on all three fields; changes invalidate the candidate |
| story.sources | Exact UUID evidence refs including confirming/contradicting/unresolved/accelerating; validated source timing and explicitly cleared original HTTPS source URLs |
| story.marketReaction | Fixed UNVERIFIED; no inference from a published Story |

**Only the table above may enter the review DTO.** It cannot clone an entire Dossier, pass through unknown JSON properties, truncate claims, infer missing source times, or reuse a newer edition's evidence.

## Excluded fields

All legacy root selection fields other than dossier context; especially calibrationHistory, calibrationLineages, dailyAssetState and stockedUpEvidenceBrief. Also excluded: raw header, rateRegime, watchNext, investigations, policyOutlook, liquidity, charts, stockRadar, motion, creatorThemes, diagnostics, memory, health, thesisChanges, researchNow, evidenceGovernance, evidenceSufficiency, evidenceIndex, decisionPacket, longitudinalAdjudication, research/editorial operations and owner-only presenter or technical state. Claims from creator transcripts, secondary sources, unreviewed URL lineage or source rights are excluded.

## Clearance requirements and actual limitations

Every cited evidence ID must match exactly once and carry an *independently reviewed* original source URL, sourcePublishedAt, availableAt not after the frozen Dossier asOf, primary-original classification and PUBLIC_REDISTRIBUTION_CLEARED. Treat the latter label as a **human/workflow assertion requiring later validation**, not an automatic legal fact derived from source type, tier or link. The tests use synthetic text/approval records, not real verified source licences. Public release is explicitly not enabled in this partition.

Existing published Story editions and Dossier selections have distinct identities. This contract cannot replace the immutable editionId, thesisVersionId, original evidence URL joins and as-of checks required by P0/P1. No bare Dossier text becomes a public-approved market claim through this function alone.

## Verification and remaining gate

The tests cover default UNAVAILABLE/REVIEW_REQUIRED, minimal synthetic candidate fields, positive exact-match approval, rejection of changed wording or historical IDs, missing/extra/duplicate references, creator/secondary/uncleared provenance, credential-like URLs and late source availability. They also prove no existing legacy Dossier handlers call this new module.

Before any public endpoint or GPT bridge: (1) verify real canonical evidence-to-raw-source lineage and original source timestamps, (2) obtain actual editorial and licence approval, (3) bind approvals to the reviewer identity and immutable edition, (4) separately review authenticated server-to-server Live → Hybrid parity, and (5) resolve operational alias leakage and Supabase grants under issues #834 and #849. None of those gates is claimed complete.

**Decision:** P−1b contract implementation may be accepted as an offline reviewed candidate, but P−1 stays STOP. Draft PR only; no merge or deployment.