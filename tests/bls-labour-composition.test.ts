import assert from "node:assert/strict";
import test from "node:test";
import {
  BLS_MAJOR_SECTORS, BLS_WORKER_CONDITIONS, BLS_LABOUR_EXTRA_IDS,
  parseBlsLabourComposition, type BlsMonthlySeries,
} from "../lib/macro/bls-labour-composition.ts";

function sample(year = 2026, month = 10): BlsMonthlySeries[] {
  const earlier = month === 1
    ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  return [
    ...BLS_MAJOR_SECTORS.map((sector, i) => ({
      seriesID: sector.id,
      data: [
        { year: String(year), period: "M" + String(month).padStart(2, "0"),
          value: String(1000 + i + (i % 4 === 0 ? -3 : 7)) },
        { year: String(earlier.year), period: "M" + String(earlier.month).padStart(2, "0"),
          value: String(1000 + i) },
      ],
    })),
    ...BLS_WORKER_CONDITIONS.map((metric, i) => ({
      seriesID: metric.id,
      data: [
        { year: String(year), period: "M" + String(month).padStart(2, "0"),
          value: String(i === 0 ? 7.9 : 34.4) },
        { year: String(earlier.year), period: "M" + String(earlier.month).padStart(2, "0"),
          value: String(i === 0 ? 7.6 : 34.5) },
      ],
    })),
  ];
}

test("CES registry contains 14 unique major sectors, not overlapping parent totals", () => {
  assert.equal(BLS_MAJOR_SECTORS.length, 14);
  assert.equal(new Set(BLS_LABOUR_EXTRA_IDS).size, BLS_LABOUR_EXTRA_IDS.length);
  assert.ok(BLS_LABOUR_EXTRA_IDS.length <= 21,
    "fits with the four existing headline BLS series inside a 25-series unregistered request");
  assert.ok(!BLS_MAJOR_SECTORS.some(row => row.key.includes("total") || row.key === "goods_producing"));
});

test("computes month-to-month sector changes, employment breadth and worker conditions", () => {
  const result = parseBlsLabourComposition(sample(), 2026, 10);
  assert.equal(result.coverageComplete, true);
  assert.equal(result.breadth?.shrinkingSectors, 4);
  assert.equal(result.breadth?.growingSectors, 10);
  assert.equal(result.breadth?.unchangedSectors, 0);
  assert.equal(result.breadth?.netSectorChangeK, 58);
  assert.equal(result.breadth?.shrinkingShare, 0.286);
  assert.equal(result.sectors.find(x => x.key === "mining_logging")?.changeK, -3);
  assert.deepEqual(result.conditions.find(x => x.key === "u6_rate"), {
    key: "u6_rate", label: "U-6 underemployment rate",
    seriesId: "LNS13327709", unit: "%", current: 7.9, previous: 7.6,
  });
});

test("reports partial source coverage instead of treating missing employment as zero", () => {
  const rows = sample().filter(row => row.seriesID !== "CES7000000001");
  const result = parseBlsLabourComposition(rows, 2026, 10);
  assert.equal(result.coverageComplete, false);
  assert.equal(result.breadth, null);
  assert.ok(result.missingSeries.includes("CES7000000001"));
  assert.equal(result.sectors.length, 13);
});

test("supports January/December crossover and rejects invalid or unreleased cells", () => {
  const result = parseBlsLabourComposition(sample(2027, 1), 2027, 1);
  assert.equal(result.coverageComplete, true);
  assert.equal(result.referencePeriod, "2027-01");
  assert.throws(() => parseBlsLabourComposition(sample(), 2026, 13));
  const bad = sample();
  bad[0].data[0].value = ".";
  assert.equal(parseBlsLabourComposition(bad, 2026, 10).breadth, null);
});
