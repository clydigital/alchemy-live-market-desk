import assert from "node:assert/strict";
import test from "node:test";

import {
  officialActualSourceUrl,
  parseOfficialActual,
  type OfficialMacroRelease,
} from "../lib/macro/official-actuals.ts";

function release(overrides: Partial<OfficialMacroRelease>): OfficialMacroRelease {
  return {
    id: "macro-test",
    release_name: "Consumer Price Index",
    agency: "U.S. Bureau of Labor Statistics",
    release_date: "2026-08-12T12:30:00.000Z",
    reference_period: "July 2026",
    actual: null,
    status: "ingestion_pending",
    source_url: "https://www.bls.gov/schedule/news_release/cpi.htm",
    ...overrides,
  };
}

test("BLS archive URLs are pinned to the release date instead of a mutable latest page", () => {
  assert.equal(
    officialActualSourceUrl(release({})),
    "https://www.bls.gov/news.release/archives/cpi_08122026.htm",
  );
  assert.equal(
    officialActualSourceUrl(release({ release_name: "Producer Price Index", release_date: "2026-08-13T12:30:00.000Z" })),
    "https://www.bls.gov/news.release/archives/ppi_08132026.htm",
  );
  assert.equal(
    officialActualSourceUrl(release({ release_name: "JOLTS Job Openings", release_date: "2026-08-04T14:00:00.000Z", reference_period: "June 2026" })),
    "https://www.bls.gov/news.release/archives/jolts_08042026.htm",
  );
});

test("ISM sources are deterministic month-specific first-party pages", () => {
  assert.equal(
    officialActualSourceUrl(release({ release_name: "ISM Manufacturing PMI" })),
    "https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/pmi/july/",
  );
  assert.equal(
    officialActualSourceUrl(release({ release_name: "ISM Services PMI" })),
    "https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/services/july/",
  );
});

test("CPI parser extracts the official July 2026 headline without inventing a value", () => {
  const html = `<h1>CONSUMER PRICE INDEX - JULY 2026</h1>
    <p>The Consumer Price Index for All Urban Consumers (CPI-U) increased 0.1 percent on a seasonally adjusted basis in July after falling 0.4 percent in June.</p>
    <p>Over the last 12 months, the all items index increased 3.4 percent before seasonal adjustment.</p>
    <p>The index for all items less food and energy rose 0.2 percent after being unchanged in June.</p>
    <p>The all items less food and energy index rose 2.5 percent over the year.</p>`;
  assert.equal(
    parseOfficialActual(release({}), html)?.actual,
    "Headline CPI +0.1% m/m; +3.4% y/y; Core +0.2% m/m; +2.5% y/y",
  );
});

test("PPI, JOLTS and ISM parsers capture only matching official reference periods", () => {
  const ppi = release({ release_name: "Producer Price Index", release_date: "2026-08-13T12:30:00.000Z" });
  assert.equal(
    parseOfficialActual(ppi, "PRODUCER PRICE INDEXES - JULY 2026 The Producer Price Index for final demand was unchanged in July, seasonally adjusted. On an unadjusted basis, the index for final demand increased 4.7 percent for the 12 months ended in July.")?.actual,
    "Final demand PPI 0.0% m/m; +4.7% y/y",
  );

  const jolts = release({ release_name: "JOLTS Job Openings", release_date: "2026-08-04T14:00:00.000Z", reference_period: "June 2026" });
  assert.equal(
    parseOfficialActual(jolts, "JOB OPENINGS AND LABOR TURNOVER - JUNE 2026 The number of job openings was little changed at 7.4 million in June.")?.actual,
    "Job openings 7.4M",
  );

  const manufacturing = release({ release_name: "ISM Manufacturing PMI" });
  assert.equal(
    parseOfficialActual(manufacturing, "July 2026 ISM Manufacturing PMI Report. The Manufacturing PMI registered 55.6 percent in July, 2.3 percentage points above June.")?.actual,
    "Manufacturing PMI 55.6",
  );

  const services = release({ release_name: "ISM Services PMI" });
  assert.equal(
    parseOfficialActual(services, "July 2026 ISM Services PMI Report. The Services PMI registered 54.1 percent in July.")?.actual,
    "Services PMI 54.1",
  );

  assert.equal(parseOfficialActual(jolts, "JOB OPENINGS AND LABOR TURNOVER - JULY 2026 Job openings were 7.1 million."), null);
});
