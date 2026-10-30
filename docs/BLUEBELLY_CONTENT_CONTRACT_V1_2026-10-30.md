# Bluebelly Content Contract v1 — architecture and audit (30 October 2026)

Status: **proposed read-model contract with executable runtime validation**. This change is intentionally non-invasive. It does **not** backfill, create a new table, approve research, deploy a new Newsroom design, change source admission, or alter canonical Story/Regime state.

## 1. Decision: one canonical fact, several independently gated projections

- **Newsroom owns event discovery and approved article navigation.** Organise by **event type first**, with additional topic/entity filters. The current seven-day feed is a *view*, not retention policy.
- **Regime Watch owns persistent interpretation and the reviewed historical argument.** Its nine editorial lens pages are not the five canonical regimes. A topic match may create only a `NAVIGATION_ONLY` link.
- **Markets owns dated observed prices and issuer financial measurements.** A company's financial statement is stored once with source and accounting-period basis; Newsroom and Regime Watch reference it.
- **Today and Daily Report own no canonical event facts.** They are selective projections and dated editions.
- **Owner research is private until separately approved.** Creator videos, X threads and attributed reporting can be research leads; their presence or attention score cannot elevate them to original-source verification, measured reaction or canonical regime confidence.

Do not automatically copy a full news story, financial statement or regime write-up into another section. Cross-link immutable IDs.

## 2. Single vocabulary

The machine-facing source of truth is `lib/bluebelly-content-contract.ts`; import its exported enums into new adapters instead of defining near-identical status lists in each component.

| Independent field | Controlled states | Meaning |
| --- | --- | --- |
| eventType | EARNINGS, ECONOMIC_RELEASE, POLICY_DECISION, COMPANY_DISCLOSURE, CORPORATE_ACTION, REGULATORY_CHANGE, SUPPLY_DISRUPTION, GEOPOLITICAL_DEVELOPMENT, MARKET_OBSERVATION, OTHER | What actually happened |
| topics | AI_TECHNOLOGY, RATES_BONDS, CREDIT_FINANCING, ENERGY, GEOPOLITICS, EQUITIES, ECONOMY, FX, METALS, OTHER | Multi-valued navigation, not truth |
| verification | UNVERIFIED, ATTRIBUTED_UNCONFIRMED, CORROBORATED_REPORT, ORIGINAL_VERIFIED, DISPUTED, SUPERSEDED | Source trust and claim provenance |
| publication.status | UNREGISTERED, DRAFT, IN_REVIEW, APPROVED, PUBLISHED, CORRECTED, RETRACTED, ARCHIVED | Editorial authorisation; separate from source verification |
| consensus | NOT_APPLICABLE, UNAVAILABLE, PENDING, SOURCE_VERIFIED | Whether a comparable, pre-release source snapshot exists |
| reaction | NOT_MEASURED, DATED_OBSERVATION_ONLY, EVENT_WINDOW_MEASURED | Evidence for measurements; **no enum asserts causation** |
| regimeLinks.relationship | NAVIGATION_ONLY, EVIDENCE_CANDIDATE, EVIDENCE_ACCEPTED, THESIS_UPDATED | Explicit relationship, with additional reviewed IDs for canonical status |
| eventTime.precision | INSTANT, DATE_ONLY | Date-only announcements never acquire an invented 00:00 UTC publication time |

Date-only reports retain an original date until a genuine instant is verified. Never use the current retrieval time as the event time. A source may verify a fact without verifying analyst consensus or the cause of a market move.

The exported `BLUEBELLY_CONTENT_JSON_SCHEMA` exposes common field and enum constraints for workflows. `validateContentRecord` is currently the authoritative cross-field validator: it additionally enforces original-source checks, publish receipts, consensus as-of time, dated observation windows and accepted regime evidence references. Do **not** treat running generic JSON Schema field checks alone as full acceptance.

## 3. Publication state transitions and auditability

```text
UNREGISTERED -> DRAFT -> IN_REVIEW -> APPROVED -> PUBLISHED
                    ^         |                   |
                    +---------+          CORRECTED / RETRACTED / ARCHIVED
                                                   |
                                         version and review receipt required
```

A retraction leaves a public notice and source-history record; it does not imply deleting underlying evidence. Corrected versions point to the superseded revision. Public index admission requires `PUBLISHED`, `CORRECTED` or `ARCHIVED`, plus article ID, revision ID, reviewed publication receipt, and safe internal permalink.

**Current reader URLs are not proof that a durable publication receipt exists.** Never fabricate revision IDs to make an existing article pass this gate. Backfill only from actual accepted provenance and authorised publication evidence.

## 4. Read-only production audit — why the surfaces disagree

Production schema was inspected through read-only metadata queries. Observed counts at this inspection: `research_intake_items` 5,288; `market_motion_items` 2,355; `intelligence_evidence` 3,728; `normalised_observations` 8,363; `stories` 40; `story_thesis_versions` 228; `market_regimes` 5; `market_regime_story_links` 57; `market_events` 85; `editorial_publications` 0; `news_threads` 0. Counts are **not** confirmed public-news totals or latest-event tallies.

| Reader / source code | Current behaviour | Problem and contract-aligned repair |
| --- | --- | --- |
| `app/blue-desk/newsroom/page.tsx` + `BluebellyNewsWire.tsx` | The category/search input sees only `combineQualifiedNews(selectVerifiedNewsBriefs(...),getOriginalPressNews(...))`. Bank decisions, published outcome recaps and briefable economic/earnings events render as **separate sibling components**. | An Amazon search can show a result elsewhere on the page while claiming zero matching news reports. Build a single approved article/event read index; filter that shared projection rather than only `NewsBriefV1`. |
| `lib/bluebelly-editorial-architecture.ts` | Classification relies on headline/summary regex; nine editorial lenses group Stories by text. | Topic match is navigation-only and must not become a canonical impact verdict. Map approved links to the five `market_regimes` explicitly. |
| `app/blue-desk/regime-watch/[lensId]/page.tsx` | Static workbooks, the 38 newest public Story snapshots and a bounded 48h source sample. | Helpful research guides, not full evidence history. Show reviewed change receipts and exact Story version IDs separately from topic-matched reading. |
| `app/blue-desk/markets/page.tsx` | `getMarketMonitor()` and `publicMarketObservations` supply the stable observed screener; optional `EarningsFundamentals` reads fixed company-investigation data. | Preserve the monitor. Connect specific issuer/economic-period records by ID rather than maintaining copy/pasted company facts across pages. Coordinate with open fundamentals PR #1202. |
| `lib/bluebelly-post-event-recap.ts` + `key-stories/page.tsx` | `findPostEventRecap` uses a rolling seven-day in-memory selection, even for already linked reader URLs. | **History risk:** a previously valid `?postEvent=` deep link can stop resolving when the seven-day window expires. Introduce persistent archive resolution using publication IDs before claiming durable story links. |
| `lib/blue-desk-original-press-news-server.ts` | Reads accepted `official-press:` intake receipts with strict original-RSS source checks, limited to seven days. | This is *source admission*, not a permanent published-article catalogue. Keep gate and source provenance; do not widen age/validation just to fill blank UI. |
| `lib/market-brief-news.ts` | `NEWS_BRIEF_EVENT_MAX_AGE_MS` is 48h and independent of the article publication state. | Freshness should control the latest feed, not archive retention. Separate `occurredAt` from `publishedAt`. |

## 5. Proposed storage mapping — reuse before creating anything

| Concept | Existing source of truth | Proposed treatment |
| --- | --- | --- |
| Raw source and creator/X lead | `research_intake_items` and existing owner-only lead stores | Preserve source IDs, restrictions and admission checks |
| Verified claims | `intelligence_evidence`, evidence provenance and `normalised_observations` | Never duplicate in article HTML |
| Official calendar and real events | `market_events` plus bounded source adapters | Match identities with explicit original receipts, not headline similarity |
| Dated market data | `market_series_observations`, `macro_series_observations`, current screener reader | Keep provider, units, period, observation dates and revisions |
| Long-lived Story and regime analysis | `stories`, `story_thesis_versions`, `market_regimes`, `market_regime_story_links` | Use versioned, reviewed evidence relationships, not string-category mutations |
| Published article and edition | `editorial_publications` plus existing publication/edition stores | **Audit which existing store actually records approved Bluebelly articles.** `editorial_publications` currently has zero rows and cannot be assumed to index existing HTML articles. Only then add the minimal read-only unifying index. |

Keep the private/public access boundary: validated IDs are not authorisation; a new index reader must allowlist public published records and never expose unpublished owner materials. No new scheduler is needed.

## 6. Next integration slices and acceptance gates

1. **P1 — this PR:** controlled vocabulary, runtime validator, JSON-schema descriptor, publication transitions and unit tests. No changed public routes or DB schema.
2. **P2 — source reconciliation:** identify exact existing publication/edition receipts for the eight recent homepage links and one older article. Produce a read-only candidate report: actual event IDs, source IDs, review receipts and which fields are missing. Mark missing fields **UNKNOWN**, not fabricated.
3. **P3 — public index:** implement a bounded, server-only approved-article projection using existing stores, exact primary/alternate URLs, immutable article IDs and page-safe statuses. Test a seven-day item that remains resolvable when older, one revised article and a rejected owner-only lead.
4. **P4 — Newsroom rewire:** category/search/sort operates on the *same* authorised public index used by homepage and Daily Report. Disambiguate event type, topic, entity, verification and freshness. Preserve short-title rows elsewhere; avoid a second news engine.
5. **P5 — regime/markets links:** connect explicit accepted evidence and the right market observation windows to each public article. Do not allow a topic match to write a regime version. Keep the Markets monitor unchanged.
6. **P6 — full audit:** tests + typecheck + production build + anonymous/owner read tests + historical link replay and mobile inspection before UI release.

### Conflicts / scope

Open PR #1110 provides a **private, unmounted** convergence prototype; do not conflate it with this public publication contract or merge it without reviewing overlapping ontology. Open PR #1202 owns a fundamentals quick view; no Markets page changes are included here.

This v1 does not replace the verified original-source NewsBrief gate, any existing Notion research store, the canonical regime writer, nor the five scheduled research tasks. Prior Live/Hybrid Dossier-first guidance is older than the later explicit Bluebelly-only routing and Research Gap-as-state decisions.
