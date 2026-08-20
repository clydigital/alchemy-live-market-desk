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
Raw string labels returned by the API (e.g. `"Thousand Barrels"`, `"Percent"`, `"Thousand Barrels per Day"`) are normalized to standardized canonical symbols (`MBBL`, `%`, `MBBL/D`). Numeric values are kept exact and formatted deterministically with thousands separators for monitor consumption.

### Timestamp Semantics
The canonical snapshot contract (`EiaWeeklyPetroleumSnapshot`) clearly distinguishes observation periods and retrieval timestamps:
- **Observation / As-Of Period (`period` / `asOf`)**: The ending date of the weekly reporting period provided directly by EIA (e.g. `2026-08-07`).
- **Retrieval Timestamp (`retrievedAt`)**: An ISO-8601 UTC timestamp recording exactly when the HTTP response payload was retrieved and parsed by the system.
- **Release Timestamp**: The EIA v2 endpoint does not supply a separate publication release timestamp in its weekly JSON records. The adapter never fabricates or invents a fake release timestamp.

### Failure & Degradation Behavior
If `EIA_API_KEY` is absent, the adapter returns state `unconfigured`. If the API returns non-200 HTTP responses, timeouts, or malformed payloads without valid data arrays, the adapter degrades gracefully to `state: "unavailable"` with diagnostic notes. Provider failures or gaps are propagated as coverage gaps rather than producing local fallback or LLM-fabricated estimates.

## SEC EDGAR / XBRL Integration Contract

The SEC adapter (`lib/providers/sec-edgar.ts`) is a deterministic specialist sensor. It remains detached from the scheduled Brain/Story path until its persistence/change contract is reviewed.

### Source endpoints

- `https://data.sec.gov/submissions/CIK##########.json` — recent filing identity and metadata.
- `https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json` — company XBRL facts.

CIKs are normalized to ten digits. Filing accession numbers remain canonical identities and primary-document URLs are reconstructed against the official SEC archive path.

### Initial metric registry

The adapter selects a bounded set of US-GAAP concepts with conservative fallbacks:

- revenue;
- operating income;
- net income;
- operating cash flow;
- capital expenditure;
- cash;
- assets;
- liabilities;
- stockholders' equity.

It preserves the original XBRL concept, unit, filing date, period start/end, form, fiscal year/period, accession number and frame. It does not fabricate missing facts or coerce incompatible units.

### Fetch / failure semantics

SEC EDGAR does not require an API key, but requests must include a descriptive `SEC_USER_AGENT` containing application identity and contact information. Missing configuration returns `unconfigured`; HTTP/network/schema failures return `unavailable`; a usable submissions/XBRL response returns `ready`.

The first implementation is intentionally **sensor-only**:

```text
SEC EDGAR/XBRL
→ deterministic normalized snapshot
→ tests / persistence contract next
→ Story Finder activation only after review
```

No SEC call is currently added to cron, Brain, Story Finder or Hybrid by this adapter change.

## FINRA Daily Short-Sale Volume Integration Contract

The FINRA adapter (`lib/providers/finra-short-volume.ts`) reads the official public **Consolidated NMS Daily Short Sale Volume** text file for an explicitly supplied trade date.

### Source endpoint

`https://cdn.finra.org/equity/regsho/daily/CNMSshvolYYYYMMDD.txt`

The file is keyless and public. The adapter intentionally uses the published daily file rather than introducing FINRA Identity Platform credentials for the Query API.

The parser preserves:

- trade date;
- source symbol exactly as FINRA publishes it;
- short-sale volume;
- short-exempt volume;
- total publicly disseminated reported volume;
- FINRA market/facility codes;
- deterministic `shortShareOfReportedVolume = shortVolume / totalVolume` when total volume is non-zero.

The adapter can narrow one daily file to a bounded symbol watchlist without changing source identity.

### Interpretation guardrail

FINRA daily short-sale volume is **not short interest** and is **not a complete market-wide short-sale measure**. It covers publicly disseminated off-exchange trades reported to FINRA facilities. The ratio is therefore a positioning/anomaly context field only and must not be described as the percentage of a company's shares sold short.

### Failure semantics

The requested trade date is explicit; the adapter does not silently roll backward to a different date. A missing/holiday file therefore returns `unavailable` with the requested source URL intact. Schema drift or malformed source content also returns `unavailable` rather than fabricating rows.

This first implementation remains sensor-only:

```text
FINRA public daily file
→ deterministic normalized snapshot
→ persistence/change contract next
→ Story Finder activation only after review
```

No FINRA call is currently added to cron, Brain, Story Finder or Hybrid by this adapter change.

## JODI-Oil Integration Contract

The JODI adapter (`lib/providers/jodi-oil.ts`) reads the official annual primary/secondary CSV files from the JODI-Oil World Database. JODI publishes the dataset for free and the current year can use a different filename from completed years, so the adapter explicitly tries both known naming conventions rather than treating a 404 as an empty year.

### Source files

Base path:

`https://www.jodidata.org/_resources/files/downloads/oil-data/annual-csv/`

For each requested year and table family the adapter tries:

```text
primary/{year}.csv
primary/primaryyear{year}.csv

secondary/{year}.csv
secondary/secondaryyear{year}.csv
```

By default it requests both the current and prior calendar year and both primary/secondary families, which prevents an early-year run from silently losing the latest published month.

### Canonical row identity

Each observation preserves the JODI source identity:

```text
REF_AREA
+ ENERGY_PRODUCT
+ FLOW_BREAKDOWN
+ UNIT_MEASURE
+ TIME_PERIOD
```

The default sensor filter keeps `KBD` (thousand barrels/day), but callers can request other published units or countries without changing source values.

### Assessment / quality codes

The adapter preserves `ASSESSMENT_CODE` rather than discarding lower-confidence rows:

- `1` → comparable / reasonable level of comparability;
- `2` → caution / consult metadata;
- `3` → unassessed;
- `4` → under verification;
- anything else → unknown.

This quality field is context for later reasoning; the sensor itself does not rewrite a valid reported value to null solely because it is unassessed.

### Failure semantics

A missing annual source file is explicit. If some requested files are available and others are not, the snapshot is `partial`; missing files are never interpreted as deletions. If none of the requested files yield usable observations, the snapshot is `unavailable`.

The first implementation remains sensor-only:

```text
JODI annual CSV
→ deterministic normalized snapshot
→ persistence/change contract next
→ oil Story activation only after review
```

No JODI call is currently added to cron, Brain, Story Finder or Hybrid by this adapter change.

## Credential map

- `EIA_API_KEY`: required by EIA Open Data API v2.
- `BLS_REGISTRATION_KEY`: registered BLS v2 usage and higher limits.
- `SEC_USER_AGENT`: descriptive SEC-compliant user agent including a real contact address.
- `FRED_API_KEY`: required by FRED/ALFRED web services.
- `BEA_API_KEY`: BEA registered UserID/API key.
- `CENSUS_API_KEY`: required for Census Economic Indicators API queries.

Do not place provider credentials in browser-visible variables.
