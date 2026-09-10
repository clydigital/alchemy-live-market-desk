import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { publicationCallerTelemetry } from "../lib/intelligence/publication-caller-telemetry.ts";

test("publication caller telemetry keeps only coarse non-sensitive caller context", () => {
  const request = new Request("https://desk.example/api/hybrid-feed?edition=latest&secret=do-not-log", {
    headers: {
      "user-agent": "Mozilla/5.0 Chrome/152.0.0.0 Safari/537.36",
      referer: "https://client.example/private/dashboard?token=secret",
      "sec-fetch-site": "cross-site",
      cookie: "session=secret",
      authorization: "Bearer secret",
      "x-forwarded-for": "203.0.113.10",
    },
  });

  const telemetry = publicationCallerTelemetry(request, "/api/hybrid-feed");
  assert.deepEqual(telemetry, {
    event: "publication_feed_caller",
    version: "publication-caller-v1",
    route: "/api/hybrid-feed",
    method: "GET",
    callerClass: "browser",
    fetchSite: "cross-site",
    referrerHost: "client.example",
    hasEditionParameter: true,
  });
  const serialized = JSON.stringify(telemetry);
  assert.doesNotMatch(serialized, /secret|session|203\.0\.113\.10|Chrome\/152/);
});

test("publication caller telemetry classifies scripts without retaining raw user agent", () => {
  const request = new Request("https://desk.example/api/intelligence-feed", {
    headers: { "user-agent": "curl/8.7.1" },
  });
  const telemetry = publicationCallerTelemetry(request, "/api/intelligence-feed");
  assert.equal(telemetry.callerClass, "script");
  assert.equal(telemetry.referrerHost, null);
  assert.equal(telemetry.fetchSite, "unknown");
  assert.equal(telemetry.hasEditionParameter, false);
  assert.doesNotMatch(JSON.stringify(telemetry), /curl\/8\.7\.1/);
});

test("all three compatibility feed routes record caller telemetry before delegating", () => {
  const routes = [
    ["../app/api/hybrid-feed/route.ts", "/api/hybrid-feed"],
    ["../app/api/hybrid-feed-v2/route.ts", "/api/hybrid-feed-v2"],
    ["../app/api/intelligence-feed/route.ts", "/api/intelligence-feed"],
  ] as const;

  for (const [path, route] of routes) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, /recordPublicationCaller/);
    assert.match(source, new RegExp(`recordPublicationCaller\\(request, ["']${route.replace(/\//g, "\\/")}["']\\)`));
    assert.match(source, /getCanonicalPublicationResponseWithDeskRead/);
  }
});

test("telemetry source never reads known sensitive request headers", () => {
  const source = readFileSync(new URL("../lib/intelligence/publication-caller-telemetry.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /headers\.get\(["'](?:cookie|authorization|x-forwarded-for|x-real-ip)["']\)/i);
});
