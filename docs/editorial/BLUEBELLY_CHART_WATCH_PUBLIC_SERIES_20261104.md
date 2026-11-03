# Chart Watch — public series wiring and release gate (4 November 2026)

Related: [Chart Watch implementation issue #1326](https://github.com/clydigital/alchemy-live-market-desk/issues/1326), [existing chart rendering draft PR #1176](https://github.com/clydigital/alchemy-live-market-desk/pull/1176), [Notion editorial contract](https://app.notion.com/p/40d519b67a9481388c2afe3907c749b3).

## Editorial scope

Chart Watch is an **explicitly reviewed editorial series** within the existing public Newsroom, not a source, a new database, an issuer recommendation, a regime verdict, or a timed publication quota. The user-private semiconductor [pilot research](https://app.notion.com/p/40d519b67a9481d798dff05c29062718) is **not published**. Do not mention internal writing-slot labels on the public Chart Watch reader.

## Existing public Newsroom entry point

The same source-reviewed `publicNewsroomEditorials()` projection admits public reports. `applyChartWatchApprovals()` can attach chart metadata **only** to an already admitted public Newsroom editorial item whose exact ID, source URL, and approved `/key-stories` reader path match a version-controlled approval. The current `CHART_WATCH_PUBLIC_APPROVALS` list is **deliberately empty**. No previously approved article has yet passed a Chart Watch-specific visual and distribution-rights review. There is no fallback to guessing from headlines, ticker text, topic categories, issuer exposure, or an owner-private research post.

Newsroom `?category=chart-watch` filters **only** explicitly verified and rights-cleared reviewed items; ordinary wire alerts, old archive cards and private research are never auto-promoted. All existing topic filters and public/private routing remain intact.

## Onboarding an actual first public edition

1. Confirm there is a real **new and time-stamped catalyst** or a newsworthy observed market divergence, and a separately reviewed public Newsroom reader already exists with source identity, market consequence, countercase, and a falsifying next test.
2. Obtain a `bluebelly.visual.v1` `VisualPayload` from original issuer filings and/or licensed source-dated market observations. Preserve statement/segment basis, fiscal periods, currency, time zone, session, point timestamps, calculation formula, per-series labels and source URLs. A null provider field is **unknown**, not zero. Compare only like reporting bases.
3. Ensure `isPublicVisualEligible(visual)` is true based on independent factual admission; separately record explicit **public chart and underlying numeric data redistribution rights** and a stable owner/editor review receipt. A public URL alone is not a redistribution licence.
4. Add an exact `ChartWatchApproval` entry to `CHART_WATCH_PUBLIC_APPROVALS` with the **already-published** editorial `id`, exact `sourceUrl`, exact canonical `readerPath`, nonempty actual `reviewReceiptId`, `publicChartRights:true`, and source-qualified `visual`. The approval must be reviewed like any public source/content change; never invent a receipt.
5. Re-read the public Newsroom page and its article reader. Confirm the Chart Watch filter displays the correct article, no different article matches the approval, the chart source link resolves, and a source-period/data table fallback is legible. **Integration with the actual chart renderer/full article is pending PR #1176**, and that PR has its own build, preview and security gates. Do not claim a source figure is plotted in the full reader until the renderer is integrated and verified.
6. Test desktop and mobile, pagination and browser Back/Forward, archived editions and all owner-only routes. Missing data/rights/review => no series item, not an empty placeholder article.

## Source role division

- Distill Markets: SEC-derived US-domestic filer XBRL and reconciled segment revenues. A negative net-debt/EBITDA screen is a **candidate pool**, not a definitive strict cash > funded-debt check.
- Distilla Investment Research: dated consensus, company drivers and context with separate attribution.
- Longbridge: dated OHLCV, market comparison, technical and overseas issuer context; confirm reporting currency, market-data entitlement, completed candle and redistribution rights.
- Original issuer/SEC, central-bank and exchange sources remain the authority for independently verified facts and official event clocks.

## Why this is additive and safe

The legacy report publisher returns HTTP 410 and stays disabled. We do **not** reopen `/reports`, create a publishing endpoint, call a private table in public routes, or create a shadow schedule. Existing MacroPulse, Research Investigation and the three-idea Writing Brain remain sole upstream owners. The public renderer only shows evidence that is separately approved, and unknown market reactions are never assigned a direction.

**Current status:** Newsroom category/filter and strict editorial admission implemented on a separate draft branch. **No public article is asserted or newly published**. Production acceptance remains dependent on source-qualified first edition, existing visual-renderer PR #1176, successful TypeScript/tests/build, mobile QA, and deployment readback.
