import assert from "node:assert/strict";
import test from "node:test";

import {
  PRESENTER_MECHANISM_CODES,
  classifyPresenterMechanism,
} from "../lib/intelligence/presenter-mechanism-codes.ts";

test("Presenter mechanism vocabulary preserves the explicit UNKNOWN escape hatch", () => {
  assert.equal(PRESENTER_MECHANISM_CODES.includes("UNKNOWN"), true);
  assert.equal(classifyPresenterMechanism("A move occurred but the mechanism is not established."), "UNKNOWN");
});

test("Presenter mechanism classifier recognises high-value market mechanics without model inference", () => {
  assert.equal(classifyPresenterMechanism("Short covering amplified the rebound."), "SHORT_COVERING");
  assert.equal(classifyPresenterMechanism("10Y real yields fell even as nominal policy stayed restrictive."), "REAL_YIELD");
  assert.equal(classifyPresenterMechanism("Treasury supply and term premium lifted the long end."), "TERM_PREMIUM");
  assert.equal(classifyPresenterMechanism("Dealer gamma hedging amplified the move around expiry."), "DEALER_GAMMA");
  assert.equal(classifyPresenterMechanism("Diesel scarcity shows physical market stress despite lower crude."), "PHYSICAL_MARKET_STRESS");
});

test("Presenter mechanism classifier remains deterministic when several descriptions are supplied", () => {
  assert.equal(
    classifyPresenterMechanism("Gold rose after the meeting.", "The hike was already priced in before the event."),
    "PRICED_IN",
  );
});
