# Canonical primary-data adapters

This note tracks the staged addition of official primary data into the Live Desk. Live remains the canonical research owner; Power Stack consumes the resulting public-safe Live context rather than running a duplicate data-acquisition brain.

## Priority order

1. EIA Open Data API v2 — US petroleum stocks, refinery utilisation/inputs, product supplied, production, imports/exports, SPR.
2. BLS Public Data API v2 — CPI/PPI, payrolls, unemployment, JOLTS, wages/productivity.
3. SEC EDGAR/XBRL — filings, capex, cash flow, earnings-quality evidence.
4. Japan Ministry of Finance portfolio flows — critical confirmation for yen-carry/repatriation stories.
5. FRED/ALFRED — rates, breakevens, credit and historical vintages/validation.
6. BEA API — GDP/PCE/income/profits.
7. Census Economic Indicators API — retail sales, durable goods, construction/housing and trade.
8. IMF SDMX + World Gold Council — official reserve/gold monitoring.
9. JODI Oil — global physical oil history.
10. FINRA — short-volume/positioning context.

Paid/optional: CME FedWatch formal API. Event detector only: X API.

## Integration rule

Primary official data should enter as structured observations with source identity, observation period, retrieval/vintage timestamp and units. Provider failure is a coverage gap, not permission to fabricate a substitute observation.

## Credential map

- `EIA_API_KEY`: required by EIA Open Data API v2.
- `BLS_REGISTRATION_KEY`: required for registered BLS v2 usage and higher limits.
- `SEC_USER_AGENT`: descriptive SEC-compliant user agent including a real contact address.
- `FRED_API_KEY`: required by FRED/ALFRED web services.
- `BEA_API_KEY`: BEA registered UserID/API key.
- `CENSUS_API_KEY`: required for Census Economic Indicators API queries.

Do not place provider credentials in browser-visible variables.
