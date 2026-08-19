import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeMacroSourceText,
  fetchMacroSourceDiagnostic,
} from "../lib/jina-macro-source-diagnostic.ts";

test("macro source analysis reports expected sections and calendar fields without inference", () => {
  const body = [
    "Calendar Actual Surprise Forecast Previous",
    "ISM NFIB Housing Energy Bonds Retail Employment Inflation FedWatch Credit COT Commodities",
    "x".repeat(600),
  ].join("\n");

  const analysis = analyzeMacroSourceText(body);

  assert.equal(analysis.hasMeaningfulContent, true);
  assert.deepEqual(analysis.sectionsMissing, []);
  assert.deepEqual(analysis.calendarFieldsMissing, []);
  assert.ok(analysis.sample.length <= 4_000);
});

test("Jina diagnostic is isolated, uses the Reader endpoint, and sends the key only as Authorization", async () => {
  const calls: Array<{ url: string; authorization: string | null }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: String(input),
      authorization: headers.get("authorization"),
    });
    return new Response("Calendar Actual Surprise Forecast Previous\n" + "x".repeat(600), {
      status: 200,
      statusText: "OK",
    });
  }) as typeof fetch;

  const result = await fetchMacroSourceDiagnostic({
    sourceUrl: "https://example.test/macro",
    jinaApiKey: "test-secret",
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.usedAuthenticatedReader, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://r.jina.ai/https://example.test/macro");
  assert.equal(calls[0]?.authorization, "Bearer test-secret");
  assert.equal(JSON.stringify(result).includes("test-secret"), false);
});

test("Jina diagnostic can run unauthenticated for a zero-secret proof of concept", async () => {
  let authorization: string | null = "unexpected";
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    authorization = new Headers(init?.headers).get("authorization");
    return new Response("short response", { status: 200 });
  }) as typeof fetch;

  const result = await fetchMacroSourceDiagnostic({ fetchImpl });

  assert.equal(result.usedAuthenticatedReader, false);
  assert.equal(authorization, null);
  assert.equal(result.analysis.hasMeaningfulContent, false);
});
