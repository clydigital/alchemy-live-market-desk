# Required Asian-market discovery

Source: Journey design conversation, 7 September 2026. User explicitly requires Asian markets to be observed, including Japan, KOSPI and Chinese markets. Journey must lead with the biggest supported story, not personalised watchlist history. Nasdaq, SPX, USDJPY, EURUSD, AI, technology, oil and US equities remain core interests.

Every scheduled research cycle already calls applyHighImpactMarketDiscovery. Its required roster now covers Japan yen/BOJ, Japan equities, Korea, mainland China, Hong Kong, Taiwan, India and Southeast Asia alongside US macro. Underlying publisher provenance and evidence requirements are preserved. Each added regional check retains at most one new publisher lead per cycle, bounding additional acquisition work. Existing US macro and yen checks retain their four-lead limit.

Run summary records the checked timestamp, search status, discovery leads, new retained leads and readable publisher pages for every target. 429, 401/403, other HTTP failures, malformed responses and exceptions remain explicit even when no items are retained. A successful zero-result search means no recent discovery leads, not an unchanged market. Coverage is not a publication gate.

Scope: required regional news discovery, using the existing pipeline. Existing price monitor already has labelled EWJ, EWY, EWH and ASHR proxies for Japan, Korea, Hong Kong and China A-shares. This change does not pretend those US-listed ETFs are Nikkei, KOSPI, Hang Seng or CSI 300 readings. It does not add verified local intraday exchange feeds. Primary corroboration remains necessary before canonical promotion. No database writes, merge or production deployment were performed.
