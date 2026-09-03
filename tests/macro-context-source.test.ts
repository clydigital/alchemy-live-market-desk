import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DAILY_INVESTMENT_BRIEF_SOURCE,
  LEGACY_MACRO_INDICATORS_SOURCE,
  MACROMICRO_SOURCE,
  macroContextBlockReason,
} from "../lib/macro/macro-context-source.ts";

test("Daily Investment Brief is primary, MacroMicro supplemental, legacy dashboard retired", () => {
  assert.equal(DAILY_INVESTMENT_BRIEF_SOURCE.role, "primary");
  assert.equal(DAILY_INVESTMENT_BRIEF_SOURCE.url, "https://dailyinvestmentbrief.com/macroeconomic-dashboard/");
  assert.equal(MACROMICRO_SOURCE.role, "supplemental");
  assert.equal(MACROMICRO_SOURCE.url, "https://en.macromicro.me/");
  assert.equal(LEGACY_MACRO_INDICATORS_SOURCE.role, "retired");
});

test("client-side placeholders never become a usable Daily Investment Brief reading", () => {
  const placeholder = "Macro Regime Analyzing... Growth -- Inflation -- Labour -- Liquidity & Monetary Policy --";
  assert.equal(macroContextBlockReason(DAILY_INVESTMENT_BRIEF_SOURCE, placeholder), "client_placeholders");
});

test("populated Daily Investment Brief readings can clear the deterministic source check", () => {
  const populated = "Updated Sep 3, 2026. Growth 0.4 Inflation 3.4% Labour 4.1% 10-Year Treasury 4.78%";
  assert.equal(macroContextBlockReason(DAILY_INVESTMENT_BRIEF_SOURCE, populated), null);
});

test("MacroMicro remains unavailable when only a landing page or security verification is accessible", () => {
  assert.equal(macroContextBlockReason(MACROMICRO_SOURCE, "Security Verification Checking your browser"), "security_verification");
  assert.equal(macroContextBlockReason(MACROMICRO_SOURCE, "MacroMicro economic insight and charts"), "insufficient_dated_readings");
  assert.equal(macroContextBlockReason(MACROMICRO_SOURCE, "Sep 3, 2026 US 10Y Treasury yield 4.78%"), null);
});

test("scheduled research calls the new macro-context collector, not the retired dashboard collector", () => {
  const handler = readFileSync(new URL("../lib/cron-research-handler.ts", import.meta.url), "utf8");
  assert.match(handler, /captureMacroContextSnapshot/);
  assert.match(handler, /attachMacroContextCaptureToResearchRun/);
  assert.doesNotMatch(handler, /captureMacroIndicatorsSnapshot/);
  assert.doesNotMatch(handler, /attachMacroCaptureToResearchRun/);
});
