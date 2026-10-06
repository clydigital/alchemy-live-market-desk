import assert from "node:assert/strict";
import test from "node:test";

import { OperationTimeoutError, withinTimeout } from "../lib/async-timeout.ts";

test("withinTimeout returns successful work unchanged", async () => {
  const result = await withinTimeout("fast read", async () => "ok", 100);
  assert.equal(result, "ok");
});

test("withinTimeout makes a never-settling dependency terminal", async () => {
  const startedAt = Date.now();

  await assert.rejects(
    withinTimeout(
      "hung read",
      () => new Promise<never>(() => {}),
      20,
    ),
    (error: unknown) => {
      assert.ok(error instanceof OperationTimeoutError);
      assert.equal(error.label, "hung read");
      assert.equal(error.timeoutMs, 20);
      assert.match(error.message, /hung read timed out after 20ms/);
      return true;
    },
  );

  assert.ok(Date.now() - startedAt < 500);
});
