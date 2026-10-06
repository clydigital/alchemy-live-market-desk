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


test("withinTimeout invokes work only once when the deadline wins", async () => {
  let calls = 0;

  await assert.rejects(
    withinTimeout(
      "single invocation",
      () => {
        calls += 1;
        return new Promise<never>(() => {});
      },
      20,
    ),
    OperationTimeoutError,
  );

  assert.equal(calls, 1);
});

test("withinTimeout preserves an immediate dependency failure", async () => {
  const failure = new Error("reader failed");

  await assert.rejects(
    withinTimeout(
      "failed read",
      async () => {
        throw failure;
      },
      100,
    ),
    (error: unknown) => error === failure,
  );
});
