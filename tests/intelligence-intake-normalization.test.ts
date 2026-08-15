import assert from "node:assert/strict";
import test from "node:test";

import { buildAncestryUpsertSpecs } from "../lib/intelligence/intake-normalization.ts";

test("repeated domains collapse to one ancestry upsert key", () => {
  const specs = buildAncestryUpsertSpecs([
    { publisher: "Axios", url: "https://www.axios.com/2026/08/14/data-center-backlash-fossil-fuel-protests" },
    { publisher: "Axios", url: "https://axios.com/2026/08/14/ai-scrambles-political-map" },
    { publisher: "ZeroHedge", url: "https://www.zerohedge.com/energy/russia-admits-renewed-petrol-shortages-after-recently-claiming-situation-was-stabilized" },
  ], "2026-08-15T02:06:27.000Z");

  assert.deepEqual(specs.map((spec) => spec.ancestry_key), [
    "domain:axios.com",
    "domain:zerohedge.com",
  ]);
  assert.equal(new Set(specs.map((spec) => spec.ancestry_key)).size, specs.length);
});

test("distinct canonical domains remain distinct ancestry groups", () => {
  const specs = buildAncestryUpsertSpecs([
    { publisher: "Axios", url: "https://www.axios.com/2026/08/14/data-center-backlash-fossil-fuel-protests" },
    { publisher: "Investing.com", url: "https://www.investing.com/news/stock-market-news/nvidia-scales-back-250-billion-openai-data-center-guarantee-wsj-reports-4861638" },
    { publisher: "Office for National Statistics", url: "https://www.ons.gov.uk/releasecalendar?keywords=GDP&release-type=type-upcoming&sort=date-newest" },
  ], "2026-08-15T02:06:27.000Z");

  assert.deepEqual(specs.map((spec) => spec.ancestry_key), [
    "domain:axios.com",
    "domain:investing.com",
    "domain:ons.gov.uk",
  ]);
});

test("merged ancestry specs preserve publisher lineage deterministically", () => {
  const specs = buildAncestryUpsertSpecs([
    { publisher: "Epoch Times Syndication", url: "notaurl" },
    { publisher: "ZeroHedge", url: "https://www.zerohedge.com/political/house-committees-detail-harvard-ties-chinese-entities-new-report" },
    { publisher: "ZH Markets", url: "https://zerohedge.com/markets/another-story" },
    { publisher: "Axios", url: "still-not-a-url" },
  ], "2026-08-15T02:06:27.000Z");

  assert.deepEqual(specs, [
    {
      ancestry_key: "domain:unknown",
      canonical_name: "Axios",
      owner_name: "Axios",
      independence_notes: "Independence is conservatively grouped by canonical source domain.",
      metadata: {
        domain: "unknown",
        publishers: ["Axios", "Epoch Times Syndication"],
      },
      updated_at: "2026-08-15T02:06:27.000Z",
    },
    {
      ancestry_key: "domain:zerohedge.com",
      canonical_name: "zerohedge.com",
      owner_name: "ZeroHedge",
      independence_notes: "Independence is conservatively grouped by canonical source domain.",
      metadata: {
        domain: "zerohedge.com",
        publishers: ["ZeroHedge", "ZH Markets"],
      },
      updated_at: "2026-08-15T02:06:27.000Z",
    },
  ]);
});
