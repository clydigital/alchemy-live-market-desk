# Canonical primary-data adapters

This note tracks the staged addition of official primary data into the Live Desk. Live remains the canonical research owner; downstream layers consume the resulting public-safe Live context rather than running a duplicate data-acquisition brain.

## Priority order

1. **EIA Open Data API v2** — US petroleum stocks, refinery utilisation/inputs, product supplied, production, imports/exports, SPR.
2. **BLS Public Data API v2** — CPI/PPI, payrolls, unemployment, JOLTS, wages/productivity.
3. **SEC EDGAR/XBRL** — filings, capex, cash flow, earnings-quality evidence.
4. **Japan Ministry of Finance portfolio flows** — critical confirmation for yen-carry/repatriation stories.
5. **FRED/ALFRED** — rates, breakevens, credit and historical vintages/validation.
6. **BEA API** — GDP/PCE/income/profits.
7. **Census Economic Indicators API** — retail sales, durable goods, construction/housing and trade.
8. **IMF SDMX + World Gold Council** — official reserve/gold monitoring.
9. **JODI Oil** — global physical oil history.
10. **FINRA** — short-volume/positioning context.

## EIA Open Data v2 Integration Contract

The EIA v2 adapter (`lib/providers/eia-v2.ts`) acquires deterministic weekly petroleum data directly from official EIA Open Data v2 endpoints.

### Series Registry & Identity

| Key | Series ID | Canonical Name | Source Unit | Canonical Unit | Frequency / Timestamps |
|---|---|---|---|---|---|
| `crudeStocksExSpr` | `WCESTUS1` | Crude stocks excluding SPR | Thousand Barrels | `MBBL` | Weekly (`YYYY-MM-DD`) |
| `gasolineStocks` | `WGTSTUS1` | Total gasoline stocks | Thousand Barrels | `MBBL` | Weekly (`YYYY-MM-DD`) |
| `distillateStocks` | `WDISTUS1` | Distillate fuel oil stocks | Thousand Barrels | `MBBL` | Weekly (`YYYY-MM-DD`) |
| `refineryUtilisation` | `WPULEUS3` | Refinery operable utilisation | Percent | `%` | Weekly (`YYYY-MM-DD`) |
| `refineryCrudeInputs` | `WCRRIUS2` | Refiner net input of crude oil | Thousand Barrels per Day | `MBBL/D` | Weekly (`YYYY-MM-DD`) |
| `crudeProduction` | `WCRFPUS2` | Field production of crude oil | Thousand Barrels per Day | `MBBL/D` | Weekly (`YYYY-MM-DD`) |
| `sprStocks` | `WCSSTUS1` | Crude oil stocks in SPR | Thousand Barrels | `MBBL` | Weekly (`YYYY-MM-DD`) |
| `gasolineProductSupplied` | `WGFUPUS2` | Finished motor gasoline product supplied | Thousand Barrels per Day | `MBBL/D` | Weekly (`YYYY-MM-DD`) |

### Unit Conversion & Normalization
Raw string labels returned by the API (e.g. `"Thousand Barrels"`, `"Percent"`, `"Thousand Barrels per Day"`) are normalized to standardized canonical symbols (`MBBL`, `%`, `MBBL/D`). Numeric values are kept exact and formatted deterministically withThousands separators for monitor consumption.

### Failure & Degradation Behavior
If `EIA_API_KEY` is absent, the adapter returns state `unconfigured`. If the API returns non-200 HTTP responses, timeouts, or malformed payloads without valid data arrays, the adapter degrades gracefully to `state: "unavailable"` with diagnostic notes. Provider failures or gaps are propagated as coverage gaps rather than producing local fallback or LLM-fabricated estimates.

## Credential map

- `EIA_API_KEY`: required by EIA Open Data API v2.
- `BLS_REGISTRATION_KEY`: registered BLS v2 usage and higher limits.
- `SEC_USER_AGENT`: descriptive SEC-compliant user agent including a real contact address.
- `FRED_API_KEY`: required by FRED/ALFRED web services.
- `BEA_API_KEY`: BEA registered UserID/API key.
- `CENSUS_API_KEY`: required for Census Economic Indicators API queries.

Do not place provider credentials in browser-visible variables.
