import assert from "node:assert/strict";
import test from "node:test";
import { parseTreasuryNominalCurve } from "../lib/providers/treasury-nominal-curve.ts";

const XML = `<feed xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices">
  <entry><updated>2026-10-14T15:54:40Z</updated><content><m:properties><d:NEW_DATE>2026-10-13T00:00:00</d:NEW_DATE><d:BC_2YEAR>4.79</d:BC_2YEAR><d:BC_5YEAR>4.96</d:BC_5YEAR><d:BC_10YEAR>5.21</d:BC_10YEAR><d:BC_20YEAR>5.59</d:BC_20YEAR><d:BC_30YEAR>5.62</d:BC_30YEAR></m:properties></content></entry>
  <entry><updated>2026-10-14T15:54:40Z</updated><content><m:properties><d:NEW_DATE>2026-10-14T00:00:00</d:NEW_DATE><d:BC_2YEAR>4.82</d:BC_2YEAR><d:BC_5YEAR>4.99</d:BC_5YEAR><d:BC_10YEAR>5.19</d:BC_10YEAR><d:BC_20YEAR>5.57</d:BC_20YEAR><d:BC_30YEAR>5.60</d:BC_30YEAR></m:properties></content></entry>
</feed>`;

test("Treasury feed parses all five nominal tenors with actual source dates", () => {
  const series = parseTreasuryNominalCurve(XML);
  for (const id of ["us2y", "us5y-fred", "us10y-fred", "us20y-fred", "us30y-fred"] as const) {
    assert.equal(series[id].length, 2, id);
    assert.equal(series[id][1].date, "2026-10-14");
  }
  assert.equal(series.us2y[1].yieldPercent, 4.82);
  assert.equal(series["us30y-fred"][1].yieldPercent, 5.6);
  assert.equal(series.us2y[1].sourceUpdatedAt, "2026-10-14T15:54:40Z");
});

test("Treasury feed excludes invalid and fabricated rates", () => {
  const xml = `<feed><entry><d:NEW_DATE>2026-10-14</d:NEW_DATE><d:BC_2YEAR>not_a_number</d:BC_2YEAR><d:BC_10YEAR>88</d:BC_10YEAR></entry></feed>`;
  const series = parseTreasuryNominalCurve(xml);
  assert.equal(series.us2y.length, 0);
  assert.equal(series["us10y-fred"].length, 0);
});
