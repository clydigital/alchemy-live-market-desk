# Bluebelly Key Stories — Evidence-First Deep Research Contract

**Date:** 29 October 2026
**Status:** Proposed adoption and implementation handoff; not a published canonical Story/Regime contract.
**Goal:** Stop treating a source-verified headline as a finished explanatory article. The investor must understand the actual change, its baseline, the expectation bar, the money mechanism, competing interpretations and the next deciding numbers.

## Problem demonstrated by a live example

Original public story: `/key-stories?news=e378d91d-deb9-4148-88c5-ab6bf5ef367f` (“Federal Reserve issues FOMC statement”).

The current `ShortNewsRecap` is derived from a `NewsBriefV1` of only headline, summary, issuer, permalink and clock. `recapFromNews()` then fills the rest from regex-based `projectLivingMarketTopics([news])`, so “what this means” becomes a generic paragraph about yields and financing regardless of what the Fed actually said.

**Already available elsewhere:** a rich, dated FOMC article at `?feature=fomc-october-2026`; original issuer vote and statement; a separate `BankDecisionSnapshot`; the MacroPulse 29 Oct 02:00 MYT Notion investigation with original September–October comparison, pre-decision expectation, named dissenters and missing intraday observations. None is automatically joined to the bare `?news` receipt.

## The reading order — vary the prose, keep the evidence contract

1. **The interesting contradiction:** A sentence saying exactly what changed relative to the market's *prior* view. Not “a verified announcement arrived”.
2. **The scene and stakes:** Who is making the decision, what was the real unresolved issue, who benefits and pays. Explain the relevant business or economic mechanism before ratios.
3. **Before / expected / actual / delta:** A 3–6-row comparison, with accounting basis, units, observation windows and attached sources. “Previous” is not “consensus”; “prior forecast” is not “revised forecast”.
4. **What the primary documents literally say:** The statement, votes, earnings segment breakdown, revisions, changes to policy text or contractual terms. Quote carefully and attribute. This is the story's factual engine.
5. **Why that change could move money:** Trace policy to front-end rates to yields/FX/earnings/FCF, or earnings to margins/capex/leverage/valuation. Mark mechanism as a hypothesis until supported by evidence.
6. **What market participants actually did and said:** Dated price/yield/credit spread windows; sourced management, named analysts and X opinions with provenance; don't claim consensus from one post.
7. **The objection:** The strongest plausible alternative, including why a “beat” may be priced in or why a yield move might be unrelated.
8. **The next discriminating test:** The exact metric, release time, baseline and conditional scenario that changes the interpretation. Keep missing evidence visible.
9. **Sources and historical edition:** Primary permalinks, published/observed time, as-of timestamp, data source and calculation basis. No silent overwriting.

The first screen should show the contradiction and the 3 most important numbers. Detailed explanations remain below in a readable narrative; tables and citation rails support the story without replacing it.

## Event-aware requirement matrix

| Story family | Critical previous / expected / actual fields | Other economic tests |
| --- | --- | --- |
| FOMC / central banks | Prior rate; market-implied meeting probability as of pre-release timestamp; rate actual; vote split; wording and projection revisions | 2Y, 10Y, real yields, DXY, gold and matched event timestamps; credit spreads only when issuer-specific |
| Corporate earnings | Prior-quarter and prior-year, pre-release *comparable* consensus, actual GAAP/non-GAAP, management prior/current guidance | Segment economics, CFO, cash capex and financed capex, FCF, balance sheet, share dilution, returns on investment, price reactions |
| CPI / employment | Previous and revised prior, seasonality, consensus by MoM and YoY basis, released actual, breadth/revisions | Futures-implied Fed path, bonds, USD and inflation expectations; distinguish release from later political/social claims |
| Oil / Hormuz | Pre-event physical volumes, export/shipping baseline, expected outage or policy change, measured actual disruption | Freight, refined-product cracks, storage, duration, source-qualified vessel counts and energy importer/exporter impacts |
| Corporate deals / policy | Status before (talks, proposal, signed, approval), official actual, economic terms, what remains conditional | Financing, concessions, break fees, regulatory timing, beneficiary/downside cash flows |
| Technology / AI regime | Existing company capex/contract guide, last-quarter spending, revised plans, actual cash sales and financing | Memory pricing pass-through, cloud margins, capacity utilisation, debt/lease commitments and valuation expectations |

## Versioned evidence schema (proposed `key_story_evidence.v1`)

```ts
type CitedDatum = {
  field: string;
  value: number|string|null; unit?: string;
  fiscal_or_event_period: string;
  basis: "official"|"company-defined"|"reported-estimate"|"derived"|"analyst-inference";
  source_url: string; published_at: string; observed_at: string;
  comparator_type?: "previous"|"consensus"|"prior-guidance"|"revised-previous";
  calculation?: string;
};
type StoryEvidencePacket = {
  id: string; parent_event_id: string; event_type: string;
  snapshot_at: string; authoring_cutoff: string;
  source_status: "original-verified"|"corroborated"|"incomplete";
  enrichment_status: "SOURCE_ONLY"|"RESEARCH_ENRICHED"|"EDITORIAL_REVIEWED";
  before: CitedDatum[]; expectation: CitedDatum[];
  actual: CitedDatum[]; observed_market: CitedDatum[];
  exact_primary_statements: {url:string; claim:string; observed_at:string}[];
  mechanism: {hypothesis:string; supported_by:string[]; caveat:string}[];
  rival_read: {interpretation:string; source:string; limitation:string}[];
  next_tests: {metric:string; expected_date?:string; confirm:string; invalidate:string}[];
  missing_evidence: string[];
  linked_research_ids: string[];
  canonical_story_version?: string; // reference only, no automatic mutation
};
```

**Rules:** No made-up consensus. A null is not “unchanged”. A forecast is not an actual. A revised previous figure is not the initially reported release. Company-defined FCF is not necessarily CFO minus property cash. A TradingView chart with real-time updates is not proof of the historical event-window move unless that window is reconstructed. Secondary commentary never promotes a claim to primary-source verification.

## Automation without a sixth scheduled task or another research engine

1. **Existing MacroPulse / official feed:** Discover issuer or original event and create a bounded source receipt. Newsroom can show this immediately as “original-source notice”.
2. **Existing Research Gap after the MacroPulse:** For the highest-salience 3–5 topics, retrieve the prior source edition and pre-frozen expectation; use official documents, connected financial/rates data, available earnings call transcripts, existing public observations and relevant Notion research. Record missing fields instead of bluffing.
3. **Pure deterministic comparator:** Normalize units, period, metric and basis, then calculate deltas only between compatible pairs. Never ask a language model to invent missing figures. The selected number table and evidence provenance are the reusable structured inputs.
4. **Narrative compiler in the existing writing/research workflow:** Use the LY / Shark Tank method to produce a chronological explanation and investor objections *from that evidence packet*, with the original text and links. No on-page LLM call, and no new scheduled writer.
5. **Evidence and publication review:** Allow `SOURCE_ONLY` cards in Newsroom, but do not advertise a source-only card as a completed “Key Story”. `RESEARCH_ENRICHED` can publish a provisional clearly attributed narrative; material investment verdicts still require existing owner/System 2 authority.
6. **Read-only projection and immutable editions:** Render the vetted public portion from existing canonical handoff stores. Join by stable issuer event identity and original URL/date, not fuzzy search on the current headline; preserve old versions and link to the latest qualified update. Never retrieve private Notion, raw X, or the Supabase service key from the public browser.
7. **At each next existing cycle:** Refresh only when a new qualified fact, expectation revision or market observation is available; compare with prior edition, retain the previous narrative, and record why the reading changed.

### Tool usage by proof obligation

- **Original issuer fact:** Fed, Treasury, BEA, BLS, EIA, SEC/issuer IR, central-bank websites and company filing footnotes.
- **Prior/consensus/forecasts:** issuer previous release, pre-event saved estimates, futures/OIS with a real quote time, connected FactIQ / FMP / financial data where valid.
- **Market tape:** source-timed yields, Treasury/Alpha Vantage/RainbowStats and financial-market provider observations, observing provider licence and actual granularity.
- **Call and analyst interpretation:** investor presentation, verified transcript/Quartr where available, attributable press commentary.
- **X / creators:** discovery and argument mapping only, including permitted ZeroHedge; a social post is not the underlying proof of a decision or price.
- **Historical research memory:** Notion is the full research archive. Copy only explicitly approved public projection fields into Bluebelly. Reuse the linked documents rather than requiring presenters to search Notion again.

## FOMC 28 Oct exemplar

The September Fed raised 25bp to 3.75–4.00% on a unanimous 12–0 vote and described activity as “solid”. Reuters described a pre-Oct hold probability of roughly 90%. On 28 Oct the Fed indeed held 3.75–4.00%, but the vote was 10–2 as Cook and Hammack preferred +25bp, and “solid” became “strong”. It is not an October new-dot-plot decision. Daily Treasury data showed 2Y 4.67% (−3bp), 10Y 5.05% (+6bp), 30Y 5.37% (+7bp); these are daily observations, **not** matched 14:00/14:30 intraday reaction windows. The reason to watch the next PCE / jobs / futures path is that the *path* can matter more than the hold.

Primary: [Oct Fed](https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm), [Sep Fed](https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm), [Treasury Oct curve](https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value_month=202610), [pre-event Reuters expectation](https://www.reuters.com/business/fed-likely-go-into-wait-and-see-mode-rates-2026-10-28/), [MacroPulse private source memory](https://app.notion.com/p/407519b67a9481ad91a0e858dfce77db).

## Acceptance tests

- Original URL `?news=e378d91d-deb9-4148-88c5-ab6bf5ef367f` must lead to the same full source-grounded comparison as the editorial FOMC reading rather than the generic four-paragraph template, preserving a stable dated edition after seven-day news expiry.
- Test three other unrelated original-source news headlines: no FOMC figures leak into them, missing consensus is labelled unavailable, and unknown headlines never get inferred bond-price effects.
- Compare previous/expected/actual only on matching period, unit, metric definition and release vintage. Catch three negative test cases: mismatched EPS basis, revised previous presented as consensus, and company-prepayment-adjusted FCF presented as issuer CFO.
- Public key stories show a separate “Research depth incomplete” state; they do not claim fully researched insight from a headline-only receipt.
- No public read calls private Notion pages, internal research-intake rows, Supabase admin, or an LLM.
- Owner-only routes, canonical Story/Regime admission, existing seven-company research and historical editions remain unaffected.
- Run all tests, TypeScript, build, cross-theme contrast, desktop/mobile and production exact-link readback.
