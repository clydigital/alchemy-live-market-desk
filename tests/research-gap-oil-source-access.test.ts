import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  eligibleDatedOilOriginal,
  inspectOilPublisherAccess,
  probeDatedOilOriginal,
} from "../lib/research-gap-oil-source-access.ts";

const CME = "https://www.cmegroup.com/daily_bulletin/archive/20261014/Section61_Energy_Futures_Products.pdf";
const ICE = "https://www.ice.com/marketdata/20261014/settlements/brent.csv";
const PDF = "%PDF-1.7\nSynthetic PDF bytes for test only.";
const CSV = "date,front_contract,front_settle,next_contract,next_settle\n2026-10-14,LCOZ26,80.01,LCOF27,79.96\n";

function fake(response: Response) {
  return async () => response;
}

test("allowlist requires original dated CME/ICE publisher file, not arbitrary URL or rotating link", () => {
  assert.equal(eligibleDatedOilOriginal(CME, "WTI"), CME);
  assert.equal(eligibleDatedOilOriginal(ICE, "BRENT"), ICE);
  const wrong = [
    "http://www.cmegroup.com/daily_bulletin/archive/20261014/a.pdf",
    "https://www.cmegroup.com.evil.test/daily_bulletin/20261014/x.pdf",
    "https://127.0.0.1/daily_bulletin/20261014/x.pdf",
    "https://www.cmegroup.com/daily_bulletin/current/Section61_Energy_Futures_Products.pdf",
    "https://www.cmegroup.com/daily_bulletin/archive/20261014/a.pdf?redirect=http://localhost",
    "https://www.cmegroup.com/daily_bulletin/archive/20261014/a.html",
    "https://user:secret@www.cmegroup.com/daily_bulletin/archive/20261014/a.pdf",
    "https://www.cmegroup.com/daily_bulletin/archive/20261014/%2E%2E/a.pdf",
  ];
  for (const url of wrong) assert.equal(eligibleDatedOilOriginal(url, "WTI"), null, url);
  assert.equal(eligibleDatedOilOriginal(CME, "BRENT"), null);
  assert.equal(eligibleDatedOilOriginal(ICE, "WTI"), null);
});

test("public dated publisher PDFs can be read and SHA-256 checked but never admitted as Evidence", async () => {
  let call = 0;
  const result = await probeDatedOilOriginal("WTI", CME, async (url, init) => {
    call++;
    assert.equal(url, CME);
    assert.equal(init.redirect, "manual");
    assert.equal(init.method, "GET");
    assert.equal((init.headers as Record<string, string>).Accept, "application/pdf,text/csv");
    return new Response(PDF, { status: 200, headers: { "Content-Type": "application/pdf" } });
  });
  assert.equal(call, 1);
  assert.equal(result.status, "RETRIEVED_UNARCHIVED");
  assert.equal(result.bytes, Buffer.byteLength(PDF));
  assert.equal(result.fetchedSha256, createHash("sha256").update(PDF).digest("hex"));
  assert.equal(result.originalArchived, false);
  assert.equal(result.canonicalAdmitted, false);
});

test("ICE csv stays unarchived even if it contains both contract prices", async () => {
  const result = await probeDatedOilOriginal("BRENT", ICE, fake(new Response(CSV, {
    status: 200, headers: { "Content-Type": "text/csv" },
  })));
  assert.equal(result.status, "RETRIEVED_UNARCHIVED");
  assert.equal(result.canonicalAdmitted, false);
});

test("no publisher redirects, access denials, rate limits or bad pages can be called final data", async () => {
  const examples: Array<[number, string, string]> = [
    [302, "REDIRECT_BLOCKED", "text/html"],
    [401, "AUTH_REQUIRED", "text/html"],
    [403, "ACCESS_DENIED", "text/html"],
    [404, "NOT_FOUND", "text/html"],
    [429, "RATE_LIMITED", "text/html"],
    [503, "FETCH_FAILED", "application/pdf"],
    [200, "WRONG_MEDIA_TYPE", "text/html"],
  ];
  for (const [status, expected, media] of examples) {
    const result = await probeDatedOilOriginal("WTI", CME, fake(new Response("login", {
      status, headers: { "Content-Type": media },
    })));
    assert.equal(result.status, expected);
    assert.equal(result.canonicalAdmitted, false);
    assert.equal(result.fetchedSha256, null);
  }
  const forged = await probeDatedOilOriginal("WTI", CME, fake(new Response("<html>hello</html>", {
    headers: { "Content-Type": "application/pdf" },
  })));
  assert.equal(forged.status, "WRONG_MEDIA_TYPE");
  const huge = await probeDatedOilOriginal("WTI", CME, fake(new Response(PDF, {
    headers: { "Content-Type": "application/pdf", "Content-Length": "9000000" },
  })));
  assert.equal(huge.status, "SOURCE_TOO_LARGE");
});

test("missing originals are reported for both requested exchanges without browsing arbitrary sites", async () => {
  let calls = 0;
  const results = await inspectOilPublisherAccess({
    required: ["WTI", "BRENT"],
    citedUrls: [
      "https://www.cmegroup.com/daily_bulletin/current/Section61_Energy_Futures_Products.pdf",
      "https://www.ice.com/report-center",
      "https://github.com/clydigital/alchemy-live-market-desk",
    ],
    fetcher: async () => { calls++; throw new Error("should never request arbitrary/rotating URLs"); },
  });
  assert.equal(calls, 0);
  assert.equal(results.length, 2);
  assert.equal(results[0].benchmark, "WTI");
  assert.equal(results[0].status, "NO_DATED_ORIGINAL_URL");
  assert.equal(results[1].status, "NO_DATED_ORIGINAL_URL");
  assert.equal(results.every(item => !item.canonicalAdmitted && !item.originalArchived), true);
});

test("publisher HTTP failure stays a health diagnostic and never affects the canonical stop gate", async () => {
  const results = await inspectOilPublisherAccess({
    required: ["WTI", "BRENT"],
    citedUrls: [CME, ICE, CME],
    fetcher: async (url) => {
      if (url === CME) throw new Error("temporary provider outage");
      return new Response(CSV, { status: 200, headers: { "Content-Type": "text/csv" } });
    },
  });
  assert.deepEqual(results.map(x => x.status), ["FETCH_FAILED", "RETRIEVED_UNARCHIVED"]);
  assert.equal(results.every(x => !x.canonicalAdmitted), true);
});

test("existing scheduled authenticated Research Gap evaluate route runs probe without promoting its result", () => {
  const route = readFileSync(new URL("../app/api/research-gap/execution/route.ts", import.meta.url), "utf8");
  assert.match(route, /await inspectOilPublisherAccess\(/);
  assert.match(route, /event: "research_gap_oil_source_access"/);
  assert.match(route, /verifiedCanonicalOilEvidence/);
  assert.match(route, /originalSourceAccess/);
  assert.doesNotMatch(route, /from\("story_thesis_versions"\)/);
});
