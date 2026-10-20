import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const folder = new URL("../docs/research-receipts/", import.meta.url);
const source = JSON.parse(readFileSync(new URL("2026-10-20-p3-official-measurements.json", folder), "utf8"));
const dispatch = JSON.parse(readFileSync(new URL("2026-10-20-verified-macro-signals.json", folder), "utf8"));

test("official source pack is a noncanonical receipt and cannot rewrite frozen publication", () => {
  assert.equal(source.schema, "official-primary-measurement-candidates/1");
  assert.equal(source.admission_status, "SOURCE_VERIFIED_NOT_CANONICAL");
  assert.equal(source.historical_edition_id, "fcea17ef-f575-4283-a363-7d5fa9c918c7");
  assert.equal(source.receipts.length, 4);
  assert.equal(source.receipts.filter((item: any) => item.admitted_intraday_reaction === true).length, 0);
});

test("the exact BLS September CPI receipt retains event vintage and original archived URL", () => {
  const bls = source.receipts.find((row: any) => row.id === "bls-us-september-2026-cpi");
  assert.equal(bls.released_at, "2026-10-14T12:30:00Z");
  assert.equal(bls.release_id, "USDL-26-1574");
  assert.equal(bls.exact_original_url, "https://www.bls.gov/news.release/archives/cpi_10142026.htm");
  const fields = Object.fromEntries(bls.measures.map((item: any) => [item.name, item.observed]));
  assert.equal(fields["CPI-U headline seasonally adjusted month-on-month"], 0.6);
  assert.equal(fields["CPI-U core seasonally adjusted month-on-month"], 0.3);
  assert.equal(fields["Gasoline seasonally adjusted month-on-month"], 9.1);
  assert.equal(bls.expected_values_status, "MISSING_OR_SECONDARY_ONLY");
});

test("official nominal and real Treasury daily changes contradict a close-to-close TIPS rise, not intraday", () => {
  const nominal = source.receipts.find((row: any) => row.id === "treasury-nominal-daily-2026-10-13-14");
  const real = source.receipts.find((row: any) => row.id === "treasury-real-daily-2026-10-13-14");
  const diffBp = (last: number, prev: number) => Math.round((last - prev) * 100);
  assert.equal(diffBp(nominal.points[1].nominal_2yr, nominal.points[0].nominal_2yr), 2);
  assert.equal(diffBp(nominal.points[1].nominal_10yr, nominal.points[0].nominal_10yr), -2);
  assert.equal(diffBp(real.points[1].real_10yr, real.points[0].real_10yr), -4);
  assert.equal(real.finding, "CONTRADICTS_CLAIM_OF_POSITIVE_CLOSE_TO_CLOSE_10Y_REAL_YIELD_MOVE");
  assert.equal(real.admitted_intraday_reaction, false);
  assert.equal(nominal.admitted_intraday_reaction, false);
});

test("EIA Table 6 exact weekly inventory source and regional reported rounding are preserved", () => {
  const eia = source.receipts.find((row: any) => row.family === "weekly_inventory");
  assert.equal(eia.release_page_url, "https://www.eia.gov/petroleum/supply/weekly/");
  assert.equal(eia.exact_original_url, "https://ir.eia.gov/wpsr/table6.csv");
  assert.equal(eia.week_end, "2026-10-09");
  assert.equal(eia.unit, "million_barrels");
  assert.equal(eia.mutable_source_url, true);
  assert.equal(eia.rows.length, 6);
  for (const row of eia.rows) {
    // EIA independently rounds reported change and levels: allow 0.002 MMbbl.
    assert.ok(Math.abs(row.current - row.prior - row.source_reported_change) <= 0.002,
      "Historical EIA arithmetic changed: " + row.area);
  }
  const total = eia.rows.find((row: any) => row.area === "United States");
  assert.equal(total.current, 102.611);
  assert.equal(total.source_reported_change, -2.527);
  assert.equal(eia.no_inferred_causal_price_reaction, true);
});

test("existing authenticated workflow inputs never backdate ingestion or invent CPI/tape expectations", () => {
  assert.equal(dispatch.signals.length, 2);
  for (const signal of dispatch.signals) {
    assert.equal(signal.kind, "economic_release");
    assert.equal(signal.sourceRole, "primary_data");
    assert.equal(signal.sourceUrl.startsWith("https://"), true);
    assert.equal("availableAt" in signal, false,
      "Production ingestion must stamp the actual new availability time");
    assert.equal("expectedValue" in signal, false,
      "A source actual is not an independently verified consensus forecast");
    assert.ok(!/intraday (rise|fall|reaction)|proved.*price/i.test(signal.claim));
  }
  assert.equal(dispatch.signals[0].eventAt, "2026-10-14T12:30:00Z");
  assert.equal(dispatch.signals[1].eventAt, "2026-10-15T18:00:00Z");
  assert.equal(dispatch.signals[0].sourceUrl, source.receipts[0].exact_original_url);
  assert.equal(dispatch.signals[1].sourceUrl, source.receipts[3].exact_original_url);
});
