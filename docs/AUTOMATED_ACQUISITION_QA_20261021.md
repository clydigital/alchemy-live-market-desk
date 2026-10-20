# Scheduled acquisition repair — 21 October 2026

## Scope and observable failures

20 October Live Desk scheduled morning and evening runs completed canonical research; both retained a blocked FXStreet direct source and failed/partial Daily Investment Brief macro HTML capture. Neither run published a material Story update. The 09:30 and 21:30 MYT schedules, existing evidence tables, System 2, Story thesis-version writer and publication gates remain unchanged.

### FXStreet fallback: confirmed parser defect

The direct source is currently `https://www.fxstreet.com/news/feed`, which is a public HTML headline index. The old Firecrawl fallback had only legacy `/rss` URLs and parsed RSS/Atom exclusively. A successfully scraped current HTML index would yield zero entries. The repaired fallback first tries the current HTML index, uses the existing canonical FXStreet URL/date parser, accepts only **original FXStreet /news/ article links with valid YYYYMMDDHHMM date slug** within the 36-hour acquisition window, deduplicates and retains at most 12 research leads, and never treats the index as independent evidence of the headline's claims. No fresh entries means the source stays blocked; there is no fake recovery.

**Availability/rights limitations:** A Firecrawl-powered production recovery requires an authorised `FIRECRAWL_API_KEY` attached to Vercel; a connected ChatGPT Firecrawl plugin alone does not supply that server environment. FXStreet also documents keyed commercial feeds and syndication rights. Original article URLs in a private research queue are **leads for verification**, not a public redistribution licence. Do not bypass FXStreet's 403, scrape restricted account pages, or automatically publish their copyrighted headlines.

### Macro dashboard: missing measurement provenance

The Daily Investment Brief webpage serves `Analyzing...` and `--` placeholders to plain HTTP clients. The old quality gate computed a dated-signal flag but ignored it, and could accept partial content containing two numbers. The fixed source gate rejects pages with multiple placeholders regardless of incidental numeric cards and rejects otherwise numeric dashboards without an explicit observation date. Failed/partial attempts remain stored; they do not replace prior verified snapshots. Retrieval time is not observation time.

### Required acceptance after deployment

1. Full CI, typecheck, production build and database contract tests for this isolated source parser change.
2. Vercel READY deployment with both public and private route regression checks.
3. A later **natural scheduled** research run showing whether FXStreet recovered (only when authorised Firecrawl is configured) or remains blocked, with exact source URL, event timestamps, source_checks and run IDs.
4. At least one independently dated original-source macro observation and a new canonical source evidence UUID carried through System 2 adjudication to an immutable publication, or a traceable legitimate NO_CHANGE/UNRESOLVED verdict.
5. Review source distribution rights before using third-party private research headlines in the publicly accessible Blue Desk.

**Not marked done here:** live FXStreet recovery, production Firecrawl configuration, macro source replacement, the accepted AI/rates/oil Story chain, P−1 owner OAuth/machine-positive acceptance, and public V6 full cutover.
