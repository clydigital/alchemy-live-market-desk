import assert from "node:assert/strict";
import test from "node:test";

import { createLatestMobileBriefRequestGate } from "../app/mobile-brief/refresh-gate.ts";

test("the latest mobile brief request is the only request allowed to update the page", () => {
  const gate = createLatestMobileBriefRequestGate();
  const first = gate.begin();
  assert.equal(gate.isCurrent(first), true);
  assert.equal(first.signal.aborted, false);

  const second = gate.begin();
  assert.equal(first.signal.aborted, true);
  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(second), true);
  assert.notStrictEqual(first, second);
});

test("component cleanup aborts an outstanding refresh and allows effect replay", () => {
  const gate = createLatestMobileBriefRequestGate();
  const initial = gate.begin();
  gate.cancel();

  assert.equal(initial.signal.aborted, true);
  assert.equal(gate.isCurrent(initial), false);

  // React Strict Mode may immediately re-run an effect after its cleanup.
  const replay = gate.begin();
  assert.equal(replay.signal.aborted, false);
  assert.equal(gate.isCurrent(replay), true);
  gate.cancel();
  assert.equal(gate.isCurrent(replay), false);
});

test("an older response resolving after a newer one can never be committed", async () => {
  const gate = createLatestMobileBriefRequestGate();
  const applied: string[] = [];
  let finishOld!: (value: string) => void;
  const delayed = new Promise<string>(resolve => { finishOld = resolve; });

  const oldController = gate.begin();
  const oldRequest = delayed.then(value => {
    if (gate.isCurrent(oldController)) applied.push(value);
  });

  const currentController = gate.begin();
  const currentRequest = Promise.resolve("current").then(value => {
    if (gate.isCurrent(currentController)) applied.push(value);
  });

  await currentRequest;
  finishOld("stale");
  await oldRequest;

  assert.deepEqual(applied, ["current"]);
  assert.equal(oldController.signal.aborted, true);
});
