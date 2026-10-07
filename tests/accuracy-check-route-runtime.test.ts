import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("accuracy-check stays request-time only and cannot execute live provider fan-out during static export", () => {
  const route = readFileSync(
    new URL("../app/api/accuracy-check/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /export const dynamic = ["']force-dynamic["']/);
  assert.doesNotMatch(route, /export const revalidate\s*=\s*\d+/);
});
