# Bluebelly BizNews mockup → production rewire

2026-10-28 | Scope: public Bluebelly UX + read-only routing

## Decisions implemented

- Public masthead and navigation reflect the seven real destinations: Today, Newsroom, Regime Watch, Markets, Calendar, Daily Report, Presenter Prep (authenticated).
- Today's first viewport uses a primary + four supporting source-verified stories, followed by a lean news feed and a right-hand rail. Never inject fictional headlines, event times, prices or private social/creator leads as verified breaking news. Missing source coverage stays visible.
- Legacy lead details and Treasury observations remain available from an expandable supporting panel.
- Newsroom is a bounded read view using existing NewsBriefV1 admission + qualified official press receipts. Filtering only rearranges the qualified set. Unassigned items appear in Other. Shortlist is browser-local and does not publish.
- Regime Watch is a research navigation layer of eight mockup questions, indexing existing public Story snapshots. It is NOT the canonical persisted Regime engine, adjudicator or evidence acceptance path. No guesses at current state or asset reaction.
- Markets keeps TradingView and source-vintage tables. Private technical checks stay in Presenter Prep. Daily Report and Calendar retain their original source/data readers.
- Public route allowlist extends only exact /newsroom, /regime-watch and their /blue-desk/ internal counterparts. Presenter and owner research remain protected by middleware. The original private /regimes route remains private.

## Structural follow-up and gates

P2 — Private incoming lead view: complete separately drafted PR #1110 against current main, with independent tests. Reuse existing research_intake_items, x_wire_posts, transcript and Motion sources. Rank attention separately from corroboration. Preserve original/observation clocks. Never force a story into a regime.

P3 — Real governed Regime statuses: only expose a reviewed, narrow redacted read-only projection from existing immutable reasoning/Regime state through an approved public security contract. Do not fetch privileged canonical Regime tables from public components. Until then, the eight public cards are explicitly historical research indexes, not current verdicts.

P4 — Source-bound story detail: what happened, financial stakes, countercase, deciding test and optional regime association. Creator interpretations and X rumours stay in private owner research pending independent verification.

P5 — Selective daily brief: use existing authenticated report pipeline. A browser-local shortlist does not automatically generate or publish a report, and this redesign adds no cron or new Story mutation route.

## Acceptance criteria

- Public route never leaks owner X, transcript, Evidence UUID, canonical private data or credentials.
- Story event and observation times and exact publisher source URLs remain preserved; late retrieval does not make old news breaking.
- Desktop 1+4 tiles + dated feed + sidebar; mobile readable stacked layout.
- Public navigation links resolve to unique pages, not redirects home; protected Presenter requires login.
- Existing source-dated prices and private technical monitors remain operational.
- No new reasoning engine or separate Story writer.
