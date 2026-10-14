# LIVE × HYBRID — Market Brief & Coming Up contracts
**Frozen implementation interface — 15 October 2026.** Read alongside the existing canonical Dossier, Journey, Event Horizon, and LY editorial conventions. This is an integration contract, not a new analytical pipeline.

## Non-negotiable ownership
- LIVE/Dossier System 2 remains the **only** owner of Regime/Story conclusions, accepted canonical evidence, and immutable thesis versions. A Market Brief is a source-grounded *presentation* of supported decisions; it does not produce another regime verdict.
- Source-admitted economic/earnings events are separate from canonical Dossier conclusions. Calendar entries **never** justify Story mutation on their own.
- Current HYBRID may read fresh LIVE calendar data. Historical editions read **only frozen event data attached to the selected exact edition**, never current API data. Unknown historical calendar fields remain unavailable; do not invent them.
- No changes to the four-major-story Dossier attention cap. Market Brief article count/category diversity is **not** bound to four or category quotas.
- Distinct writers/PRs: ChatGPT owns calendar read API and data-selection tests; Jules LIVE owns Market Brief article/reader work; Jules HYBRID owns Coming Up presentation. Do not modify each other's branches.

## 1. Market Brief article contract — `market-brief-article/1`
Treat this as an *outbound projection* of the existing canonical publishing/edition path, not authorisation to add storage tables. Discover and reuse the canonical publisher and edition identity before committing implementation.

```ts
type MarketBriefArticleV1 = {
  contractVersion: "market-brief-article/1";
  articleId: string;                  // stable and unique within edition
  editionId: string;                  // exact published edition identity
  dossierId: string | null;           // exact selected canonical Dossier, no guessed fallback
  dossierAsOf: string | null;
  generatedAt: string;                // valid ISO timestamp
  title: string;                      // concise <=63 characters where feasible
  deck: string;                       // concise one-sentence introduction
  category: string;                   // descriptive, not a quota/bucket gate
  paragraphs: Array<{
    role: "opening" | "mechanism" | "reaction" | "contradiction" | "outlook" | "context";
    text: string;
    sourceRefs: string[];             // exact provenance for externally sourced claims
    canonicalEvidenceIds: string[];   // exact canonical UUIDs for System 2-derived claims
  }>;
  sourceLinks: Array<{ title: string; url: string; accessedAt?: string | null }>;
  interpretationStatus: "SUPPORTED" | "MIXED" | "UNRESOLVED";
  conditionalOutlook: string;         // explicit confirmation + invalidation
};
```

- A normal full article has 6–10+ short paragraphs *where evidence supports the depth*, not filler or arbitrary length quotas. Include opening, plain-English causal mechanism, actual market reaction, a genuine contradiction, and a conditional conclusion. Preserve truthful unresolved states.
- LY style: start with chart/market event; explain what physically happens before macro jargon; one causal step per sentence; short paragraphs; British English; layman-facing explanation; no generic AI preamble; no unsupported forecasts.
- Each analytical assertion must map to its own source record or canonical Evidence UUID. Story linkage must be exact, not guessed from ticker coincidence. Treat Creator content, Motion, and presenter technical checks as non-canonical context unless separately source-admitted.
- Reader: one article at a time, visible title/category/source status, `‹` previous and `›` next, keyboard accessibility, wraparound or disabled-end behaviour labelled and tested, stable article IDs, changing article updates URL/state accessibly. No four-story cap and no category quota; unrelated stories/articles remain distinct.
- Start with existing publisher and available data. If production evidence is insufficient for a long-form article, clearly display insufficiency rather than synthesising invented text. No speculative parallel database or new reasoning engine.

## 2. LIVE → HYBRID calendar read contract — `presenter-calendar/1`
**Endpoint:** `GET /api/presenter-calendar` on LIVE; JSON; `Cache-Control: no-store`. Existing `getEconomicCalendar()` and `getForwardEarningsEvents()` are sole first-pass provider adapters. Do not add another upstream provider or reasoning component in this slice.

```ts
type PresenterCalendarV1 = {
  contractVersion: "presenter-calendar/1";
  asOf: string;                       // LIVE response generation time, UTC ISO
  timezone: "Asia/Kuala_Lumpur";
  tradingWeekStart: string;           // Monday 00:00 MYT, ISO with +08:00 offset
  tradingWeekEndExclusive: string;    // next Monday 00:00 MYT
  sourceHealth: {
    macro: "unknown" | "partial" | "unavailable";
    earnings: "official_only" | "official_and_provider" | "provider_only" | "unavailable";
    warnings: string[];
  };
  events: PresenterCalendarEventV1[];
  windows: {
    next24h: string[];                // event IDs, chronological
    next7d: string[];
    released: string[];               // this trading week (MYT)
  };
};
type PresenterCalendarEventV1 = {
  id: string;                         // stable, prefix `macro:` or `earnings:`
  kind: "economic" | "earnings";
  title: string;
  status: "scheduled" | "released" | "cancelled" | "postponed" | "unknown";
  localDate: string;                  // YYYY-MM-DD MYT if provable
  scheduledAt: string | null;         // ISO UTC instant *only* if exact clock is grounded
  timeLabel: string;                  // honest original or MYT-presented label
  timePrecision: "exact" | "date" | "tbc";
  actual: string | null;
  consensus: string | null;
  previous: string | null;
  revisedPrevious: string | null;
  releasedAt: string | null;          // source-verified timestamp only, NEVER scheduledAt
  sourceName: string;
  sourceUrl: string;                  // safe HTTPS source link
  sourceRecordRefs: string[];
  verificationState: "official" | "desk_record" | "reported" | "unverified";
  affectedAssets: string[];
  decidingQuestion: string;
};
```

### Calendar semantics
1. Windows are computed in LIVE, not inferred independently by HYBRID. `next24h`: `[now, now+24h)` **exact-time** scheduled events only; unknown-time/date-only events go into 7 Days with honest time labels. `next7d`: MYT dates from current local calendar day through the 7-day lookahead (exclude already verified released items). `released`: Monday 00:00 MYT through `now` for the *current MYT trading week*, retaining releases over the weekend until the next Monday.
2. Never infer `released` from `scheduledAt < now` or stale calendar entries. Release status requires an actual reported value or a trustworthy independently recorded completed release state. A source's `release_date` is **not** its `releasedAt` timestamp; absent separately verified release time, return `null`.
3. Keep `actual`, `consensus`, `previous`, `revisedPrevious` and units as sourced. Do not imply numeric equality/difference if unit comparability isn't proven. Never fill a missing field by guess.
4. Exact timestamps require a documented timezone (offset or supported ET conversion with correct DST). Do not convert date-only values to midnight, or confuse US event date with MYT event day when conversion crosses midnight.
5. Source failure is not an empty successful release. The endpoint must expose partial/unavailable coverage and carry any warnings from provider adapters. A gracefully degraded feed must remain valid JSON. Never expose private provider keys.
6. Only one card per unique source occurrence; preserve separate releases where metrics differ. Do not collapse distinct CPI/PPI components or separate company earnings.

## 3. HYBRID Chapter 02 — *Coming Up* (new section)
- **This is explicitly a NEW Journey section**, not a replacement for Expected vs Actual, Divergence Lab, Dossier, or the current Event Horizon context. Match existing HYBRID typography, kinetic environment, scene rail, spacing, cards, motion/accessibility, mobile and readable-view treatment.
- Immersive Brain mode: add a second scene after the opening, labelled `02 · COMING UP` and shift subsequent scene IDs/indexes consistently. Check `components/BrainJourney.jsx` (currently scenes 0–4) and accompanying CSS/tests. Current Journey `app/journey/page.jsx` has a distinct read-mode hierarchy: add matching second section immediately after its opening, and renumber later human-facing headings.
- Tabs: `Next 24H`, `7 Days`, `Released`. Show economic data and earnings mixed by actual time, with kind/source/time/actual–consensus–previous and relevant assets. Show release times in MYT. Visible source links; no invented figures or event outcomes.
- Current: render validated LIVE `presenter-calendar/1` response. Empty, timeout, schema mismatch, provider outage, or network failure gets a distinct honest fallback (do not substitute archived data or show fabricated empty release week).
- Historical: **never fetch current API** for historical display; reuse exact `edition.payload.upcoming`/frozen horizon if available. If frozen data lacks values, show unavailable; do not annotate history with present-day releases.
- Preserve the exact `?edition=` mismatch guard in `app/journey/page.jsx`. The existing `/dossier` is separate.
- Display priority can be source-backed timing/impact relevance; do not reorder canonical Story reasoning or generate independent Motion scores.
- Tests: 24H boundary, Monday rollover and weekend retention, exact MYT/DST, verified released vs overdue scheduled, source unavailable, historical replay and invalid edition ID; keyboard-accessible tabs/next-prev if relevant.

## 4. Parallel branches & acceptance
- ChatGPT (LIVE): `lib/presenter-calendar.ts`, `app/api/presenter-calendar/route.ts`, `tests/presenter-calendar.test.ts` only (new paths). May fix an existing adapter only as a separately reviewed small PR, never silently.
- Jules LIVE (separate branch): inspect canonical article publishing path before fixing file boundaries; implement one bounded PR for projection/long-form editorial then separate reader PR if necessary. Do **not** edit Chat-owned calendar paths, `app/page.tsx` cleanup, or `lib/dossier-v2/**`.
- Jules HYBRID (separate branch): `components/BrainJourney.jsx`, dedicated new `components/ComingUp*.jsx`, dedicated styling, `app/journey/page.jsx`, tests and bounded `lib/live-desk-feed.js` calendar adapter. **Do not** modify canonical `lib/dossier-v2-handoff`, Dossier or published edition writers.
- No auto-merge by Jules. ChatGPT reviews contracts/fixtures/CI, then checks actual LIVE/HYBRID Vercel deployments and rendered output. Respect the production vs preview deployment policy.
