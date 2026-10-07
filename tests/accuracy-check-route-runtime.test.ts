import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("live-provider API routes stay request-time only and cannot execute fan-out during static export", () => {
  const routes = [
    "../app/api/accuracy-check/route.ts",
    "../app/api/power-stack-context/route.ts",
  ];

  for (const path of routes) {
    const route = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(route, /export const dynamic = ["']force-dynamic["']/);
    assert.doesNotMatch(route, /export const revalidate\s*=\s*\d+/);
  }
});
