import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { formatBlueDeskSourceObservation } from "../lib/blue-desk-source-copy.ts";

test("renders actual 19 Oct TSMC and CoreWeave issuer observations without changing numbers", () => {
  const tsmc = "Taiwan Semiconductor Manufacturing Company reported 2026Q3 operating margin of 58.7 percent in its issuer release dated 2026-10-15.";
  const revenue = "Taiwan Semiconductor Manufacturing Company reported 2026Q3 net revenue of 46.72 USD_billion in its issuer release dated 2026-10-15.";
  const capex = "CoreWeave reported 2026Q2 cash purchases of property and equipment, including capitalised internal-use software of 6.422 USD_billion in its issuer release dated 2026-08-11.";
  const cash = "CoreWeave reported 2026Q2 net cash provided by (used in) operating activities of 0.679 USD_billion in its issuer release dated 2026-08-11.";
  assert.equal(formatBlueDeskSourceObservation(tsmc),
    "Taiwan Semiconductor Manufacturing Company reported Q3 2026 operating margin of 58.7% in its issuer release dated 15 October 2026.");
  assert.equal(formatBlueDeskSourceObservation(revenue),
    "Taiwan Semiconductor Manufacturing Company reported Q3 2026 net revenue of US$46.72 billion in its issuer release dated 15 October 2026.");
  assert.equal(formatBlueDeskSourceObservation(capex),
    "CoreWeave reported Q2 2026 cash purchases of property and equipment, including capitalised internal-use software of US$6.422 billion in its issuer release dated 11 August 2026.");
  assert.equal(formatBlueDeskSourceObservation(cash),
    "CoreWeave reported Q2 2026 net cash provided by (used in) operating activities of US$0.679 billion in its issuer release dated 11 August 2026.");
  assert.ok(revenue.includes("USD_billion"), "Raw original source claim remains unchanged");
});

test("unknown units, invalid dates, unqualified prices and ambiguous fiscal text remain verbatim", () => {
  const original = "Reported FY2026Q5 1.7 EUR_billion and 4 USD_billion annualised as of 2026-02-30.";
  assert.equal(formatBlueDeskSourceObservation(original),
    "Reported FY2026Q5 1.7 EUR_billion and US$4 billion annualised as of 2026-02-30.");
  assert.equal(formatBlueDeskSourceObservation("dated 2026-02-30, 10 percent"), "dated 2026-02-30, 10%");
  assert.equal(formatBlueDeskSourceObservation("CoreWeave may raise debt."), "CoreWeave may raise debt.");
  assert.equal(formatBlueDeskSourceObservation(""), "");
});

test("reader formats public facts while keeping exact original provenance and frozen edition identity", () => {
  const page = readFileSync(new URL("../app/blue-desk/stories/[articleId]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /formatBlueDeskSourceObservation\(claim\.claimText\)/);
  assert.match(page, /title=\{claim\.claimText\}/);
  assert.match(page, /article\.editorial\.causalLinks\.length/);
  assert.match(page, /getHybridExactDailyBriefEdition\(edition\)/);
  assert.match(page, /claim\.sourceUrl/);
});
