import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEiaWeeklyPetroleumUrl,
  EIA_WEEKLY_SERIES,
  fetchEiaWeeklyPetroleumSnapshot,
  parseEiaWeeklyPetroleumPayload,
} from "../lib/providers/eia-v2.ts";

test("EIA URL requests the configured weekly series through the official v2 route", () => {
  const url = new URL(buildEiaWeeklyPetroleumUrl("test-key"));
  assert.equal(url.origin + url.pathname, "https://api.eia.gov/v2/petroleum/sum/sndw/data/");
  assert.equal(url.searchParams.get("api_key"), "test-key");
  assert.equal(url.searchParams.get("frequency"), "weekly");
  assert.deepEqual(
    url.searchParams.getAll("facets[series][]").sort(),
    Object.values(EIA_WEEKLY_SERIES).map((item) => item.id).sort(),
  );
});

test("EIA payload parser keeps latest and previous values by stable series identity", () => {
  const result = parseEiaWeeklyPetroleumPayload({
    response: {
      data: [
        { period: "2026-08-07", series: "WCESTUS1", value: "430000", units: "MBBL" },
        { period: "2026-07-31", series: "WCESTUS1", value: "421000", units: "MBBL" },
        { period: "2026-08-07", series: "WPULEUS3", value: 95.1, units: "%" },
        { period: "2026-07-31", series: "WPULEUS3", value: 94.2, units: "%" },
      ],
    },
  });

  assert.equal(result.state, "ready");
  assert.equal(result.asOf, "2026-08-07");
  assert.equal(result.metrics.crudeStocksExSpr?.seriesId, "WCESTUS1");
  assert.equal(result.metrics.crudeStocksExSpr?.latest.value, 430000);
  assert.equal(result.metrics.crudeStocksExSpr?.previous?.value, 421000);
  assert.equal(result.metrics.refineryUtilisation?.latest.value, 95.1);
});

test("EIA parser rejects malformed and non-numeric rows instead of fabricating data", () => {
  const result = parseEiaWeeklyPetroleumPayload({
    response: {
      data: [
        { period: "2026-08-07", series: "WCESTUS1", value: "not-a-number", units: "MBBL" },
        { period: "2026-08-07", series: "UNKNOWN", value: "123", units: "MBBL" },
      ],
    },
  });
  assert.equal(result.state, "unavailable");
  assert.deepEqual(result.metrics, {});
});

test("EIA fetch degrades explicitly when no key is configured", async () => {
  const result = await fetchEiaWeeklyPetroleumSnapshot("");
  assert.equal(result.state, "unconfigured");
  assert.match(result.note || "", /EIA_API_KEY/);
  assert.deepEqual(result.metrics, {});
});
