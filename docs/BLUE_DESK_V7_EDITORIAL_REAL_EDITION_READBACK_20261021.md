# Blue Desk V7 — real-edition editorial readback (21 October 2026)

**Status:** read-only verification of the production source plus an owner-only staged interface. **Not a Newsroom cutover, approved public contract, new canonical Evidence, or successful production user-session test.**

## Source of truth and query

Read-only Supabase SQL against the existing project `qdtlrfgxpsnxajiptrno`, `public.hybrid_publication_snapshots` scoped to `snapshot_type='daily_brief'`; evidence references joined by exact canonical UUID to `intelligence_evidence` and `intelligence_evidence_sources`. No keys, raw Story payloads, private Dossier fields, creator material or person-identifying records are included in this report.

| Exact frozen edition | Published UTC | Manifest Story entries | Dossier lessons | Lesson evidence refs | Dossier ID | Explicit lesson interpretation |
| --- | --- | ---: | ---: | ---: | --- | ---: |
| `88ea836a-8081-44e8-8af0-06fd860b0367` | 2026-10-21 04:07:12.602 | 0 | 6 | 29 | absent | 0 |
| `fcea17ef-f575-4283-a363-7d5fa9c918c7` | 2026-10-19 16:19:19.317 | 0 | 6 | 29 | absent | 0 |

The `canonicalStoryManifest` field exists but is the **empty array** in both checked frozen editions. The existing `market-brief-article/1` projection therefore uses the older Dossier lesson fallback. Lesson-level `evidenceRefs` are **not** itemised canonical factual/interpretive claims and may not be assigned to arbitrary narrative paragraphs.

### Exact evidence-resolution comparison

The original-source candidate counts below are a deliberately bounded SQL screen: Tier 1–2, designated primary class, `created_at` and `available_at` not later than the edition publication, and a source HTTPS URL. This does **not** independently verify article-specific deep-link quality, publisher licence, price-release event window or editorial paragraph attribution. The run-time editor additionally checks direct URLs and claim style.

| Existing Story identity | 21 Oct matched Evidence IDs | 21 Oct source-screened primary candidates | 19 Oct matched Evidence IDs | 19 Oct source-screened primary candidates |
| --- | ---: | ---: | ---: | ---: |
| US rates/CPI `26955788-e038-4e8a-abae-90cde0c17a90` | 6 | 0 | 6 | 0 |
| NYMEX/ICE crude curve `4ca089de-b3c7-4e4d-bb48-e124e84b3e9c` | 2 | 0 | 2 | 0 |
| AI capital investment `6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e` | 8 | 4 | 8 | 4 |
| Other three Story lessons combined | 13 | 3 | 13 | 3 |

**Real-edition verdict:** the independently maintained `tests/blue-desk-real-ai-edition.test.ts` frozen 19 Oct fixture supplies four individually qualified first-party issuer claims, but the article **must stay `FACTUAL_BRIEF`**. Both editions lack a canonical Dossier ID, so interpretations remain `UNRESOLVED`. A fully styled 3–5 reporting + 2–5 interpretation preview made from invented text would fail the evidence gate. Rates and oil source gaps remain unchanged; no fake CPI bond reaction or futures F1/F2 settlement may be generated.

## Partition E handoff and owner-only reader

- Upstream draft [PR #913](https://github.com/clydigital/alchemy-live-market-desk/pull/913) preserves **only exact itemised canonical claims** when present and derives an in-memory `article-sections/2` classification from sources and adjudication; it preserves `market-brief-article/1` and frozen IDs.
- The separate stacked Newsroom preview runs on `/blue-desk/newsroom` on the **authenticated owner/preview origin only**. It reuses `getLiveDeskHomepageDailyBrief({ fresh: true })`, `projectMarketBriefArticles`, and `loadEditorialMarketBrief`; no new data/decision endpoints or market inference.
- `blueDeskHostAccess('/blue-desk/newsroom','bluebelly-desk.vercel.app')` is **blocked** and returns **private** on the canonical Live host. Public `/newsroom` remains blocked and has no rewrite. Do not edit the host allowlist or add public nav until access and content approval.
- **Factual brief:** original-source evidence observations with exact deep links, explicitly **not** padded to three factual paragraphs. **Full article:** only source-linked itemised 3–5 factual reporting and 2–5 adjudicated interpretive paragraphs. **Research only:** unpublished eligibility state.
- Existing `/stories/article:edition:story?edition=...` immutable reader, Live/Hybrid machine APIs, private Presenter and existing News Brief ingestion are untouched.

## Outstanding release gates

1. Fix or separately prove why the live publication payload has an **empty canonical Story manifest**, or source separately authorised itemised canonical claims into **future** immutable editions through the existing canonical authoring route. Do not backfill old editions.
2. Finish public/private API schema, consumer and RLS/permission review [#834](https://github.com/clydigital/alchemy-live-market-desk/issues/834), [#849](https://github.com/clydigital/alchemy-live-market-desk/issues/849), and licence checks. Authenticated browser positive/negative and machine-token tests remain pending.
3. Pass CI for stacked PR, inspect the protected preview with an owner OAuth session, verify factual summaries against direct originals, check desktop/mobile and legacy replay. No production merge without these.
4. Independently verify verified News Brief coverage and editorial source admission for a public Newsroom; no Motion-to-Evidence promotion. Keep public launch blocked in the meantime.

**No SQL writes, API changes, auth toggles, publication re-editioning, cron jobs, backend reasoning paths or production deployments were made during this verification.**


## Follow-up — publication semantics verified against a material-change run

**Correction to the release investigation:** an empty `canonicalStoryManifest` is **intentional** in the established zero-change edition path. `lib/intelligence/canonical-journey-edition.ts` skips writing Story snapshots for `storiesPublished === 0`, and reuses prior *immutable* Story material as labelled Dossier context only. Dossier lessons are allowed to remain populated; that does not imply a Story was freshly changed. Do **not** solve the editorial problem by filling zero-change manifests with prior mutable or historical Story state.

A separate production read-only join of each daily brief with its research run confirms that the 21 Oct 04:07 UTC base publication and 19 Oct 16:19 UTC base publication both have `updates_published = 0` and a legitimately empty manifest. Meanwhile the **19 October 2026 04:06:33.773 UTC** material-change edition `b7c62bae-5203-48bd-8d0c-b8bc5271b98d` has `updates_published = 1` and **15** immutable manifest entries. Of those, **11** entries carry matching `canonical-story-reasoning/v1` and an itemised claims array, totalling **59** claims:

| Immutable claim type | Count | With evidence ID references |
| --- | ---: | ---: |
| fact | 36 | 36 |
| interpretation | 11 | 11 |
| thesis | 11 | 11 |
| speculation | 1 | 1 |

The claim-type count is **not** the number of primary-admitted source claims or full editorial paragraphs. The inspected manifest has **zero explicit Story `state.interpretationStatus` values of SUPPORTED/MIXED** for those claims. Thus, even an edition with 15 immutable Story snapshots cannot automatically qualify for V7 3–5 + 2–5 full-article treatment. Exact evidence UUID → direct original-source URL → `available_at` and `created_at` → edition-time checks still apply.

### Next safe integration choice

The owner-only Newsroom preview adds `?edition=<UUID>` exact-archive selection via existing `getHybridExactDailyBriefEdition`. An explicit unknown or malformed edition must produce 404 rather than silently fall back to the newest issue. `/blue-desk/newsroom` and `/newsroom` are **not** added to the public Bluebelly allowlist. The owner may examine the 19 Oct 04:06 material-change edition to assess the existing claim corpus; this does **not** publish or rewrite that issue.

**Revised engineering priority:** preserve zero-change semantics; separately improve adjudicated, claim-attributed *future* publication material only if the canonical reasoning authority supplies it. No duplicate reasoning engine or new thesis path.
