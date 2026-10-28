# Alchemy plugins → Bluebelly Market Tools routing contract

Applies to existing private plugins:
- alchemy-research-suite (plugins_6ad169ee658c8191ad5a24d98527a642)
- alchemy-research-workflows (plugins_6ad1720c018c8191ae7a67cd2dcaf3e1)

**Status:** proposed plugin release change, NOT an installed plugin update. Do not claim automatic invocation until plugin archive is updated and released.

## New market-tools candidate workflow
When asked for market trade ideas, cross-asset correlations, technical divergence or research catalysts:
1. Read Bluebelly market monitor research triggers (same source as /market-tools); do not treat a link-directory result as a signal.
2. Reuse existing verified MacroPulse, research-gap and canonical source observations, plus primary-source FRED/Treasury/SEC/EIA data when relevant.
3. If price histories exist, compute 20/60/120 aligned-return correlation with as-of, sample size, calendar, instrument/proxy and source limitations. Never infer current correlation from a known historical relationship.
4. Label each candidate as discovery, investigation, evidence-verified or rejected; include confirmation/invalidation and the next catalyst.
5. Route verified findings to existing canonical evidence and Story association only through the approved research ingestion workflow. Bluebelly is the reader destination; Notion remains durable research publication where already configured.
6. Presenter and editorial consumers may use a candidate as a question to investigate; never promote it to a verified claim without independent receipts.
7. Do not modify PowerStack, schedule a new job, or publish to retired Live Desk/Hybrid surfaces.

## Plugin implementation checklist
- Update both private plugin archives' workflow instructions and relevant tool descriptions.
- Add explicit link to /market-tools and the workflow contract in docs/bluebelly-market-tools-workflow-contract.md.
- Add a shared candidate JSON schema, not a new competing ledger.
- Test discovery → evidence receipts → Story admission → Notion publication → Bluebelly readback.
- Verify installed plugin release IDs and confirm live behavior before reporting success.

## Current repo-side integration
The /market-tools page reads existing getMarketMonitor().researchTriggers on the server and displays source-monitor candidates. This is an immediate workflow input, not a new canonical storage or scheduling path.
