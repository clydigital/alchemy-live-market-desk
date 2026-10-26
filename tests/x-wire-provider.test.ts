import assert from "node:assert/strict";
import test from "node:test";
import { fetchXWirePreview } from "../lib/x-wire-provider.ts";
import { X_CORE_ROSTER } from "../lib/x-sweep-core.ts";
import { blueDeskHostAccess } from "../lib/blue-desk-host.ts";
import { readFileSync } from "node:fs";

const NOW = "2026-10-23T06:00:00.000Z";
const POSTED = "2026-10-23T05:30:00.000Z";
function mockFetch(response: (handle: string, url: string) => Response) {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "api.fxtwitter.com");
    assert.match(url.pathname, /^\/2\/profile\/[A-Za-z0-9_]+\/statuses$/);
    assert.equal(url.searchParams.get("count"), "50");
    assert.ok(Number(url.searchParams.get("since")) > 0);
    return response(url.pathname.split("/")[3], url.toString());
  }) as typeof fetch;
}
function row(handle: string, id: string, overrides: Record<string, unknown> = {}) {
  return {
    type: "status", id, author: { screen_name: handle },
    created_at: POSTED, text: "Original attributed research observation",
    media: { photos: [{ url: "https://pbs.twimg.com/media/example.jpg" }] }, ...overrides,
  };
}
function ok(rows: unknown[], cursor: unknown = { bottom: null }) {
  return new Response(JSON.stringify({ code: 200, results: rows, cursor }),
    { status: 200, headers: { "content-type": "application/json" } });
}
test("retrieves nine registered accounts, never ZeroHedge, from a fixed provider host and preserves attributed original URLs", async () => {
  let n = 0;
  const fetchImpl = mockFetch(handle => {
    n += 1;
    return ok([row(handle, "211317772374942" + String(n).padStart(4, "0"))]);
  });
  const result = await fetchXWirePreview({ nowIso: NOW, fetchImpl });
  assert.equal(result.accounts.length, 9);
  assert.equal(n, 9);
  assert.equal(result.posts.length, 9);
  assert.equal(result.health.healthy, 9);
  assert.ok(result.posts.every(post => post.url.startsWith("https://x.com/")));
  assert.ok(result.posts.every(post => post.attribution === "THIRD_PARTY_ONLY"));
  assert.equal(result.window.windowHours, 2.5);
  assert.equal(result.posts[0].images.length, 1);
  assert.ok(result.accounts.every(x=>x.handle.toLowerCase()!=="zerohedge"));
  assert.equal(result.deferredCount, 0);
});
test("provider errors are visible as blocked/unavailable, never zero new posts or false all-source health", async () => {
  const result = await fetchXWirePreview({ nowIso: NOW,
    fetchImpl: mockFetch(handle => handle === "HFI_Research"
      ? new Response("", { status: 429 })
      : new Response(null, { status: 204 })),
  });
  assert.equal(result.posts.length, 0);
  assert.equal(result.health.healthy, 8);
  assert.equal(result.health.inaccessible, 1);
  assert.equal(result.health.complete, false);
  assert.equal(result.accounts[1].status, "blocked");
  assert.equal(result.accounts[1].error, "HTTP 429");
});
test("withholds falsely attributed social content and flags provider incompleteness", async () => {
  const result = await fetchXWirePreview({ nowIso: NOW,
    fetchImpl: mockFetch(handle => handle === X_CORE_ROSTER[0].handle
      ? ok([row("unrelated", "2113177723749421000"), row(handle, "2113177723749421001")],
        { bottom: "nextpage" })
      : new Response(null, { status: 204 })),
  });
  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0].handle, "Bluekurtic");
  assert.equal(result.accounts[0].status, "partial");
  assert.equal(result.health.complete, false);
});
test("protected owner Wire cannot be routed onto the public Bluebelly hostname", () => {
  assert.equal(blueDeskHostAccess("/owner/x-wire", "bluebelly-desk.vercel.app"), "blocked");
  assert.equal(blueDeskHostAccess("/owner/x-wire", "alchemy-live-market-desk.vercel.app"), "private");
  const page = readFileSync(new URL("../app/owner/x-wire/page.tsx", import.meta.url), "utf8");
  assert.match(page, /force-dynamic/);
  assert.match(page, /THIRD_PARTY|Third-party/);
  assert.doesNotMatch(page, /CANONICAL_EVIDENCE_ACCEPTED/);
});
