import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DAILY_INVESTMENT_BRIEF_SOURCE,
  LEGACY_MACRO_INDICATORS_SOURCE,
  macroContextBlockReason,
} from "../lib/macro/macro-context-source.ts";

test("Daily Investment Brief remains separate context and MacroMicro is removed", () => {
  assert.equal(DAILY_INVESTMENT_BRIEF_SOURCE.role, "primary");
  assert.equal(DAILY_INVESTMENT_BRIEF_SOURCE.url, "https://dailyinvestmentbrief.com/macroeconomic-dashboard/");
  assert.equal(LEGACY_MACRO_INDICATORS_SOURCE.role, "retired");

  const sourceFile = readFileSync(
    new URL("../lib/macro/macro-context-source.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(sourceFile, /macromicro/i);
});

test("client-side placeholders never become a usable Daily Investment Brief reading", () => {
  const placeholder = "Macro Regime Analyzing... Growth -- Inflation -- Labour -- Liquidity & Monetary Policy --";
  assert.equal(macroContextBlockReason(DAILY_INVESTMENT_BRIEF_SOURCE, placeholder), "client_placeholders");
});

test("populated Daily Investment Brief readings can clear the deterministic source check", () => {
  const populated = "Updated Sep 3, 2026. Growth 0.4 Inflation 3.4% Labour 4.1% 10-Year Treasury 4.78%";
  assert.equal(macroContextBlockReason(DAILY_INVESTMENT_BRIEF_SOURCE, populated), null);
});

test("security verification never becomes usable macro context", () => {
  assert.equal(
    macroContextBlockReason(DAILY_INVESTMENT_BRIEF_SOURCE, "Security Verification Checking your browser"),
    "security_verification",
  );
});

test("scheduled research calls the macro-context collector, not the retired dashboard collector", () => {
  const handler = readFileSync(new URL("../lib/cron-research-handler.ts", import.meta.url), "utf8");
  assert.match(handler, /captureMacroContextSnapshot/);
  assert.match(handler, /attachMacroContextCaptureToResearchRun/);
  assert.doesNotMatch(handler, /captureMacroIndicatorsSnapshot/);
  assert.doesNotMatch(handler, /attachMacroCaptureToResearchRun/);
  assert.doesNotMatch(handler, /MacroMicro/);
});
