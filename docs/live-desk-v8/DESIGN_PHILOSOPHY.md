# Live Market Desk V8 Design Philosophy

## 1. Canonical research engine first

The Live Desk is not primarily a news homepage or article reader. It is the authoritative operating system behind Alchemy research.

Every interface decision should improve at least one of:

- evidence quality;
- research continuity;
- speed of interpretation;
- source traceability;
- contradiction detection;
- historical recall;
- Hybrid handoff quality.

A visually polished panel that weakens those functions should not ship.

## 2. Preserve the difference between an update and a Story

### What's New

What's New is the short-lived intake layer. It contains newly detected facts, statements, releases, market reactions and material deltas.

Each item must have a disposition:

- awaiting verification;
- duplicate or grouped;
- promoted into an existing Story;
- promoted into a new Story;
- rejected as low relevance.

### Stories

Stories are persistent market questions. They can remain open for weeks or months.

A Story owns:

- a stable title and market question;
- current thesis;
- strongest support;
- strongest contradiction;
- confidence and status;
- confirmation and invalidation conditions;
- next catalyst;
- related assets, releases, statements, positioning and charts;
- a dated major-event log;
- interpretation history.

New events append to the Story. They do not create a supposedly fresh narrative every day.

## 3. Articles are memory, not another news feed

The Articles page compares current evidence against previously published Alchemy coverage.

It should answer:

- What did the article argue?
- What has changed since publication?
- Is the thesis still valid?
- Is a follow-up justified?
- Would a new article duplicate the existing angle?
- Which chart or catalyst is genuinely new?

The output should classify the article as Revisit now, Material evolution, Incremental, Little changed or Duplicate angle.

## 4. Data must show both freshness and history

Every data-driven panel should display, where applicable:

- observation date;
- publication date;
- ingestion or verification time;
- source;
- stale or failed-source state;
- revision state;
- next expected update.

Recent windows and longer historical lookbacks are separate concepts. Do not use a short display window as a substitute for historical context.

## 5. Macro is a release workspace

Macro Data must support several releases on the same day.

The selected release controls:

- actual, consensus and prior;
- revisions;
- release-specific interpretation;
- Component Laboratory;
- rolling history.

A separate day synthesis reconciles multiple releases and prevents the latest selected item from becoming the entire macro interpretation.

Store every release vintage and component observation. Display twelve months by default, while preserving longer history in storage.

## 6. Dense but scannable

The Live Desk should retain its purple institutional workspace identity and data-dense character.

Use:

- equal-width cards;
- clear panel titles;
- compact badges;
- meaningful status colour;
- short explanatory copy;
- side drawers for depth;
- one expanded chart stage rather than many heavy embeds;
- visible source and freshness metadata.

Avoid:

- giant decorative hero sections that push research below the fold;
- empty whitespace that hides operational information;
- long flat tab strips;
- nested dropdown navigation that obscures destinations;
- duplicated cards showing the same conclusion.

## 7. Charts answer research questions

The Charts page is a lightweight evidence library organised by analytical purpose:

- Rates
- Macro
- Indices
- Breadth
- FX
- Commodities
- Credit
- Positioning

Each chart needs:

- a research question;
- related Story tags;
- source;
- lookback;
- last-verified state;
- a reason it exists.

Do not add 20, 50 or 200 EMA overlays unless a validated common OHLC source can reproduce the intended candle definitions accurately. V8 deliberately excludes them.

## 8. Positioning is context, not a forecast

Official CFTC data is canonical.

The Alchemy view preserves the relevant official participant categories. The COTSignal-style Legacy View may use:

- Weekly Positioning Extremes;
- a 52-week percentile heatmap;
- Commercials, Large Specs and Small Specs;
- the disclosed inverted Commercial display score;
- five-year net positioning as a percentage of open interest;
- positioning beside price;
- plain-English weekly insights.

The interface must always state that positioning describes crowding and exposure. It does not determine the next price move.

## 9. History is append-only

The History Cabinet preserves what the desk knew at each point in time.

Do not silently overwrite:

- initial macro values;
- revisions;
- Story interpretations;
- source states;
- positioning vintages;
- Hybrid snapshots;
- post-event lessons.

A corrected record appends a new version and links to the superseded version.

## 10. Hybrid receives a selective snapshot

Hybrid Output should show exactly what is being sent and why.

For each candidate record, store:

- included or excluded;
- reason;
- source and freshness state;
- Story linkage;
- intended Hybrid destination;
- generated time;
- blocked or missing requirements.

The Original calculates and approves. Hybrid explains and presents.

## 11. Operational truth beats visual completeness

A module should show unavailable, stale or incomplete when data is missing.

Never use polished illustrative values in production as though they were live observations. Never fill gaps silently. Never claim an integration exists because a mockup demonstrates the desired interface.
