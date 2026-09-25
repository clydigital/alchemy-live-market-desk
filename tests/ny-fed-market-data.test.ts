import assert from "node:assert/strict";
import test from "node:test";

import { parseNyFedPrimaryDealers } from "../lib/providers/ny-fed-primary-dealers.ts";
import { parseNyFedReferenceRates } from "../lib/providers/ny-fed-reference-rates.ts";

test("normalizes NY Fed EFFR/SOFR/TGCR/BGCR rates and volumes", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  const snapshot = parseNyFedReferenceRates({
    refRates: [
      { type: "EFFR", effectiveDate: "2026-09-24", percentRate: 4.25, volumeInBillions: 110 },
      { type: "SOFR", effectiveDate: "2026-09-24", percentRate: 4.28, volumeInBillions: 2100 },
      { type: "TGCR", effectiveDate: "2026-09-24", percentRate: 4.26, volumeInBillions: 1000 },
      { type: "BGCR", effectiveDate: "2026-09-24", percentRate: 4.27, volumeInBillions: 1050 },
      { type: "SOFRAI", effectiveDate: "2026-09-25", average30day: 4.2 },
    ],
  }, now);

  assert.equal(snapshot.status, "OK");
  assert.equal(snapshot.asOf, "2026-09-24");
  assert.equal(snapshot.rates.length, 4);
  assert.equal(snapshot.rates.find((item) => item.type === "SOFR")?.volumeInBillions, 2100);
});

test("flags stale NY Fed reference rates instead of treating old values as current", () => {
  const snapshot = parseNyFedReferenceRates({
    refRates: [
      { type: "EFFR", effectiveDate: "2026-09-10", percentRate: 4.25 },
      { type: "SOFR", effectiveDate: "2026-09-10", percentRate: 4.28 },
      { type: "TGCR", effectiveDate: "2026-09-10", percentRate: 4.26 },
      { type: "BGCR", effectiveDate: "2026-09-10", percentRate: 4.27 },
    ],
  }, new Date("2026-09-25T12:00:00Z"));
  assert.equal(snapshot.status, "STALE");
  assert.match(snapshot.warnings.join(" "), /more than five calendar days old/i);
});

test("normalizes dealer positioning and weekly changes without converting missing values to zero", () => {
  const snapshot = parseNyFedPrimaryDealers({
    pd: {
      timeseries: [
        { keyid: "PDPOSGST-TOT", asofdate: "2026-09-23", value: "125000" },
        { keyid: "PDPOSGST-TOT", asofdate: "2026-09-16", value: "120000" },
        { keyid: "PDFTD-USTET", asofdate: "2026-09-23", value: "3500" },
        { keyid: "PDFTD-USTET", asofdate: "2026-09-16", value: "3000" },
        { keyid: "PDFTR-USTET", asofdate: "2026-09-23", value: "*" },
        { keyid: "PDFTR-USTET", asofdate: "2026-09-16", value: "2800" },
      ],
    },
  }, new Date("2026-09-25T12:00:00Z"));

  assert.equal(snapshot.status, "PARTIAL");
  const position = snapshot.series.find((item) => item.keyId === "PDPOSGST-TOT");
  assert.equal(position?.valueMillions, 125000);
  assert.equal(position?.weeklyChangeMillions, 5000);
  assert.equal(snapshot.series.find((item) => item.keyId === "PDFTR-USTET")?.valueMillions, null);
});
