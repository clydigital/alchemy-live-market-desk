# Bluebelly My Desk — Daily Intelligence visual and delivery contract (4 November 2026)

**Status:** Implementation PR draft; NOT verified deployed. **Canonical location:** owner-only `/my-reports` → Daily Intelligence. **Design authority:** `docs/editorial/BLUEBELLY_DAILY_INTELLIGENCE_EDITORIAL_READER_V4.md`.

## Editorial objective

A full, substantial, story-driven private briefing on up to five consequential market questions, with the completed US equity session as its reference and genuinely new Asia/pre-release information as separately time-stamped updates. Preserve the five-minute executive opening and deep narrative. Tables or figures are evidence in context, not a dashboard replacement.

## Five native visual types

| Visual | Trigger and required proof | Safe unavailable state |
| --- | --- | --- |
| Economic release/expectations table | Original event/period and separate prior, *dated/frozen pre-release* consensus with provider, actual and revised prior when released; distinguish source clock | PENDING actual, NOT VERIFIED expectation or revision; do not infer surprise |
| Earnings economics table | Matching GAAP/adjusted fiscal periods, original filing/IR, consensus vintage, revenue/operating profit, OCF, actual capex, FCF, guidance and debt only as available | NO COMPARABLE CONSENSUS; NOT REPORTED cash; no imagined trend |
| Market and breadth table | Instrument, latest and previous observation, quoted unit and observation clock from established authorised data; release-window reactions require independent event-aligned observations | DATA UNAVAILABLE / NOT EVENT-WINDOW MEASURED; no bps/% or causal inference |
| Mechanism versus countercase | Separate reviewed primary evidence or clearly marked model-assisted hypothesis, human/business stakes and an observable deciding test | No qualified comparative mechanism, omit table rather than create unsupported direction |
| Upcoming catalysts and branches | Source-listed event, ET/MYT with date-only distinction, question, conditional constructive/adverse cases and original link | No precise clock or forecast = DATE ONLY / NOT VERIFIED |

Figures should appear next to the paragraphs they explain, including in the *later half*; not clustered at the beginning. Keep source-linked original X posts/creator timelines as attributed material, not verified price claims. Use the same frozen packet for HTML and any derivative print/PDF, with a per-edition hash.

## Automated handoff: reuse, do not replicate

1. Existing MacroPulse discovers and stores original source IDs, actual market observations, event clocks and approved hypothesis-only questions.
2. Existing Research Investigation (08:40 and 20:40 MYT) reconciles exact original release, period, vintage, previous, consensus, actual, source-linked company cash measures and countercase. It assembles the **complete private HTML report** for the latest completed US session with dated same-day forward previews.
3. Existing Writing Brain (09:30 MYT) reuses that complete edition and makes three commissions; only creates a missing complete report with the same visual standard after checking exact session and source watermark.
4. Existing protected 03:30 UTC server-side fallback builds an **abbreviated owner-private source-led HTML** from admitted `NEWS`, `OBSERVATION` and `CALENDAR`. The deterministic renderer now produces market-level, calendar-comparator, dated-evidence and conditional-debate tables when its exact packet provides data. Its calendar consensus is *reported at packet compilation*, not proven frozen; **it must never be labelled a verified surprise**.
5. Owner-only archive stores exact edition ID, ET session label, source manifest, UTC/MYT clocks and immutable SHA, with private `/my-reports` readback. The abbreviated fallback never silently counts as a completed full Work edition. The public Newsroom and Key Stories remain separate destinations.

No sixth ChatGPT task, extra cron, public publisher, fresh paid data collector, database migration, new Dossier/Regime engine or private-data exposure.

## Acceptance gates

- [ ] End-to-end Work edition contains longform analysis **and** source-relevant tables distributed through the article, not shallow cards.
- [ ] A material upcoming event (e.g. ISM) is included pre-release with actual PENDING, pre-event expectation provenance, explicit bull/bear deciding variables, relevant assets and exact ET/MYT clock.
- [ ] Calendar rows sharing a URL remain distinct by event identity.
- [ ] Frozen consensus requires real provider+retrieval-before-release proof; a calendar-supplied number alone is labelled reported/unfrozen.
- [ ] Market level comparison and release-window market reaction are never conflated.
- [ ] HTML is static, safe under the existing archive parser, readable at 390px/1440px, and source links work; A4 print checked.
- [ ] Regression tests, typecheck, production build and database/access controls pass.
- [ ] Real completed session has an immutable owner-private report ID/SHA, authenticated inline My Desk readback, and separately tested anonymous denial. Production deployment SHA is documented.

**Current unfinished dependencies:** independently frozen consensus-series vintages, event-window market quotes and comprehensive issuer metric join for every candidate; a code-only renderer cannot manufacture these. Preserve missing-source flags and hand off exact gaps to the existing Research Investigation owner.


## Daily Watch & Question Radar — editorial handoff requirement (4 November 2026)

Apply the six-lens selection rule in [Daily Intelligence Editorial Reader v4](./BLUEBELLY_DAILY_INTELLIGENCE_EDITORIAL_READER_V4.md#addendum--4-november-2026--daily-watchlists-divergences-and-forward-clues): **key stocks; key cross-assets; material news; sectors and divergences; labelled speculation/unresolved questions; and forward-looking clues**. It belongs in the *same* complete owner-private edition and the existing up-to-five-question editorial hierarchy, not in a new task or competing dashboard.

The opening should expose a short, ranked watch radar; the narrative should supply the evidence, competing readings and specific next tests. Reuse current market/breadth, issuer, mechanism/countercase and catalyst tables where the frozen packet supports them. Every selected item needs a concrete **why now**, exact source/as-of, **what would confirm or falsify it**, and **new/changed/open/resolved** status against the previous edition. Hypotheses and creator opinions remain attributed; missing release-window, consensus or technical data remains visibly unavailable. A report containing generic tickers and headlines without forward clues fails editorial acceptance.

Existing MacroPulse → Research Investigation → private HTML/PDF delivery responsibilities remain unchanged. This documentation change does not establish an automation or live deployment.
