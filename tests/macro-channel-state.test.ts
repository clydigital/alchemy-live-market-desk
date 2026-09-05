import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMacroChannelState,
  composeMacroStateSnapshot,
  isUsableRawReading,
  reasoningMacroChannels,
} from "../lib/macro/macro-channel-state.ts";

test("rejects dashboard placeholders instead of interpreting them as readings", () => {
  assert.equal(isUsableRawReading("Analyzing"), false);
  assert.equal(isUsableRawReading("--"), false);
  assert.equal(isUsableRawReading("—"), false);
  assert.equal(isUsableRawReading(null), false);
  assert.equal(isUsableRawReading("4.76%"), true);
  assert.equal(isUsableRawReading(4.76), true);
});

test("a stale macro channel contributes zero without suppressing fresh unrelated channels", () => {
  const generatedAt = "2026-09-01T12:00:00Z";
  const snapshot = composeMacroStateSnapshot([
    {
      channelKey: "financial_conditions",
      directionScore: -1.6,
      confidence: 0.94,
      regime: "Higher real and nominal yields",
      observedAt: "2026-09-01T10:00:00Z",
      staleAfterHours: 24,
      interpretation: "Higher sovereign yields are tightening financing conditions.",
      evidenceRefs: ["evidence-rates"],
      sourceRefs: [{ sourceName: "Treasury market", sourceUrl: null, sourceTier: 2, observedAt: "2026-09-01T10:00:00Z" }],
    },
    {
      channelKey: "crude_tightness",
      directionScore: 1.4,
      confidence: 0.9,
      regime: "Previously tight crude balance",
      observedAt: "2026-08-29T10:00:00Z",
      staleAfterHours: 24,
      interpretation: "This crude reading has aged beyond its allowed window.",
      evidenceRefs: ["evidence-crude-old"],
      sourceRefs: [{ sourceName: "Oil market", sourceUrl: null, sourceTier: 2, observedAt: "2026-08-29T10:00:00Z" }],
    },
  ], generatedAt);

  const rates = snapshot.channels.find((channel) => channel.channelKey === "financial_conditions");
  const crude = snapshot.channels.find((channel) => channel.channelKey === "crude_tightness");

  assert.equal(snapshot.health, "degraded");
  assert.equal(rates?.freshness, "fresh");
  assert.equal(rates?.usableForReasoning, true);
  assert.equal(rates?.activeDirectionScore, -1.6);
  assert.equal(crude?.freshness, "stale");
  assert.equal(crude?.usableForReasoning, false);
  assert.equal(crude?.activeDirectionScore, 0);
  assert.deepEqual(reasoningMacroChannels(snapshot, ["financial_conditions", "crude_tightness"]).map((channel) => channel.channelKey), ["financial_conditions"]);
});

test("unavailable channels remain explicit diagnostics instead of blocking the snapshot", () => {
  const state = buildMacroChannelState({
    channelKey: "labour",
    directionScore: null,
    confidence: 0,
    regime: "Awaiting fresh data",
    observedAt: null,
    staleAfterHours: 48,
    interpretation: "No current labour reading.",
    evidenceRefs: [],
    sourceRefs: [],
    unavailableReason: "Provider unavailable",
  }, new Date("2026-09-01T12:00:00Z"));

  assert.equal(state.freshness, "unavailable");
  assert.equal(state.usableForReasoning, false);
  assert.equal(state.activeDirectionScore, 0);
  assert.equal(state.unavailableReason, "Provider unavailable");
});
