# Market News in Hybrid — Live authority and LY editorial gate

## Scope and implementation state

This add-on publishes **source-bound reading drafts**, not automatically approved LY articles. It uses the existing canonical Live Story reasoning and promotion-admitted Motion attached to an immutable Journey edition. It introduces no independent research or Regime decision inside Hybrid.

- **Implemented in this PR:** optional `journey.marketNews` (`market-news-editorial/v1`), exact promoted Motion corroboration, exact Story snapshot and thesis ID, original source, original Motion ID, Story evidence references, Regime routing labelled *context only*, and conservative prose composed from existing approved fields.
- **Not implemented:** human/editorial LY approval, a new model-based journalist, new Regime adjudication, full long-form rewriting, automatic citations per sentence, or synthesis across multiple events when their causal relationship has not been adjudicated.
- A historical edition freezes its packets; an unpinned current Hybrid may attach only a publication with an **exact matching Dossier ID and timestamp**. Missing or mismatched packets do not fall back to guessed headlines.

## What the words mean

| State | May assert | Must not assert |
|---|---|---|
| Motion LEAD / reported / partial | This is an item for verification | Verified event, Story change, Regime change |
| Motion PROMOTED | Canonical evidence corroborated this exact Motion origin | Promotion itself constitutes causal proof |
| Routed to Story | This Motion has an exact Story link | The Motion caused the Story thesis to change |
| Routed to Regime | This Motion is relevant to Regime investigation | Regime trend, score, confidence or direction changed |
| Dossier adjudication | Exact verdict and cited evidence as accepted by Live | New interpretation chosen by Hybrid |
| SOURCE_BOUND_DRAFT_NOT_LY_QC_APPROVED | These sentences come from Live records | The draft is a polished client-facing LY article |

## Source and data requirements for future LY-approved copy

Any later `market-news-editorial/v2` writing stage should accept *only* the immutable packet, its canonical fact/claim map and explicit Dossier adjudications. Its generated copy should retain:

1. Exact immutable `editionId`, `dossierId`, `dossierAsOf`, `storySnapshotId`, `thesisVersionId`, `motionIds`, promotion Evidence refs and source dates; the outer edition may provide the edition ID only after database publication.
2. Article-level trigger Motion identity, occurrence and observation time; distinguish source publication from publication to Hybrid.
3. Observed release values with units, consensus, previous, revisions and measurement period when referenced.
4. Hypothesis evidence states, accepted vs contested mechanisms, non-observed market tape, highest-materiality contradiction, and explicit next test.
5. Regime contribution verdict `ACCEPT/REFINE/UNRESOLVED/REJECT` only if that verdict was actually committed to the exact Dossier. Without it, use `ROUTED_CONTEXT_ONLY`.
6. A complete source and sentence-claim map capable of detecting unsupported new numbers, causality, certainty, unexplained source changes and revisions.
7. A material-change test preventing an unchanged persistent Story from being described as breaking news; content hashes for idempotent retries and expiry-aware editions.

## LY-style editorial checks

- British English; clear factual opening before interpretation; concise Grade 8 prose; generally no more than three sentences per paragraph.
- Explain the relevant mechanism step by step, then cross-check it against actual market observations when those exist.
- Use multiple substantial paragraphs **only when evidence is sufficient**; 200–400 words is a target, not a licence to pad or invent. Show fewer if coverage is sparse.
- Discuss the strongest evidenced countercase, alternatives and conditional paths fairly. Never force a contrarian stance.
- Avoid suspense hooks, hype, generic transitions, repeated headlines, rhetorical punchlines, stray evidence IDs, confidence inflation and model-process references.
- State the next observable falsification/confirmation and its timestamp when known.
- Output is **not `LY_APPROVED`** until factual/measurement audit, style audit, and a reviewed reading test succeed against the same immutable source packet.

## Integration order and release gate

1. Merge Live publication side after unit tests, database contracts, full build and source/frozen replay checks.
2. Merge Hybrid reader only after Live endpoint compatibility and current/historical exact-Dossier tests, and UX checks on desktop and mobile. Merge alone does not prove real published data exist.
3. Wait for a **new immutable edition** carrying valid `marketNews`; old editions do not get retrofitted.
4. Inspect at least three real outputs: material new Motion with changed Story; promoted Motion linked to a persistent but unchanged Story; Regime-only Motion. The last two must **not** be represented as an accepted Story/Regime change.
5. Only launch automated LY writing in a separate gated follow-up that preserves Live reasoning ownership and demonstrates source-level prose quality on real outputs.
