import assert from "node:assert/strict";
import test from "node:test";
import { upsertOfficialJobsMetrics } from "../lib/macro/official-actuals.ts";
import {
  BLS_MAJOR_SECTORS, BLS_WORKER_CONDITIONS, BLS_LABOUR_EXTRA_IDS,
  parseBlsLabourComposition, detectBlsLabourDivergences, type BlsMonthlySeries,
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


test("flags observed payroll/underemployment and hours divergence without fabricating a consumer spending conclusion", () => {
  const composition = parseBlsLabourComposition(sample(), 2026, 10);
  const signals = detectBlsLabourDivergences(165, composition);
  assert.deepEqual(signals.map(s => s.code),
    ["PAYROLL_VS_U6", "PAYROLL_VS_WEEKLY_HOURS"]);
  assert.equal(detectBlsLabourDivergences(-20, composition).length, 0);
  assert.equal(detectBlsLabourDivergences(null, composition).length, 0);
});

test("requires both consumer-exposed sectors and full breadth before a related watch is raised", () => {
  const rows = sample();
  for (const sector of ["CES7000000001", "CES4142000001"]) {
    const s = rows.find(x => x.seriesID === sector);
    assert.ok(s);
    s.data[0].value = "995";
  }
  const complete = parseBlsLabourComposition(rows, 2026, 10);
  assert.ok(detectBlsLabourDivergences(165, complete)
    .some(s => s.code === "CONSUMER_EXPOSED_SECTORS"));
  const partial = parseBlsLabourComposition(rows.filter(s => s.seriesID !== "CES4142000001"), 2026, 10);
  assert.ok(!detectBlsLabourDivergences(165, partial)
    .some(s => s.code === "CONSUMER_EXPOSED_SECTORS"));
});

test("labour release metrics have immutable consensus fields and traceable BLS series IDs", async () => {
  let inserted: Record<string, unknown>[] = [];
  const client = {
    from(table: string) {
      assert.equal(table, "macro_release_metrics");
      return {
        async upsert(rows: Record<string, unknown>[], options: Record<string, unknown>) {
          assert.deepEqual(options, { onConflict: "release_id,metric_key", ignoreDuplicates: true });
          inserted = rows;
          return { error: null };
        },
      };
    },
  };
  const release = {
    id: "us-bls-oct-2026", agency: "U.S. Bureau of Labor Statistics",
    release_name: "Employment Situation for October 2026",
    release_date: "2026-11-06T13:30:00Z", reference_period: "October 2026",
    source_url: "https://www.bls.gov/news.release/archives/empsit_11062026.htm",
  };
  const count = await upsertOfficialJobsMetrics(client as never, release, {
    actual: "Nonfarm payrolls +165k", sourceUrl: release.source_url,
    labourComposition: parseBlsLabourComposition(sample(), 2026, 10),
  }, "2026-11-08T01:00:00Z", true);
  assert.equal(count, 16);
  assert.equal(inserted.length, 16);
  assert.ok(inserted.every(row => !("consensus" in row) && !("consensus_captured_at" in row)));
  const retail = inserted.find(row => row.metric_key === "employment_sector_retail_net_change");
  assert.equal(retail?.actual, -3);
  assert.equal((retail?.metadata as Record<string, unknown>).sourceSeriesId, "CES4200000001");
  assert.equal((retail?.metadata as Record<string, unknown>).reconstructedAfterRelease, true);
});
