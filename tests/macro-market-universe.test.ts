import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_FINRA_MACRO_SYMBOLS,
  FINRA_MACRO_PROXY_BASKET,
  PRIMARY_MACRO_MARKET_INSTRUMENTS,
} from "../lib/macro-market-universe.ts";
import { buildResearchBrainSystemInstructions } from "../lib/dossier-v2/research-brain-prompt.ts";

test("macro market universe uses actual instruments for Asia, gold, energy and semis", () => {
  const instruments = new Set(PRIMARY_MACRO_MARKET_INSTRUMENTS.map((item) => item.instrument));
  for (const expected of ["USDJPY", "NIKKEI", "KOSPI", "HSI", "XAUUSD", "WTI", "ULSD", "SMH"]) {
    assert.ok(instruments.has(expected), `missing primary macro instrument ${expected}`);
  }
  assert.ok(!instruments.has("GLD"));
  assert.ok(!instruments.has("USO"));
});

test("FINRA macro basket is bounded, Asia-aware and uses valid proxy lanes", () => {
  assert.equal(DEFAULT_FINRA_MACRO_SYMBOLS.length, 20);
  assert.equal(new Set(DEFAULT_FINRA_MACRO_SYMBOLS).size, 20);

  for (const expected of ["FXY", "EWJ", "EWY", "EWH", "GLD", "SMH", "USL", "CRAK"]) {
    assert.ok(DEFAULT_FINRA_MACRO_SYMBOLS.includes(expected), `missing FINRA macro proxy ${expected}`);
  }
  assert.ok(!DEFAULT_FINRA_MACRO_SYMBOLS.includes("USO"));
  assert.ok(!DEFAULT_FINRA_MACRO_SYMBOLS.includes("UHN"));

  const bySymbol = new Map(FINRA_MACRO_PROXY_BASKET.map((item) => [item.symbol, item]));
  assert.equal(bySymbol.get("FXY")?.tracks, "USDJPY / Japanese yen");
  assert.equal(bySymbol.get("FXY")?.relationship, "inverse_proxy");
  assert.equal(bySymbol.get("EWJ")?.tracks, "NIKKEI / Japan equities");
  assert.equal(bySymbol.get("EWY")?.tracks, "KOSPI / Korea equities");
  assert.equal(bySymbol.get("EWH")?.tracks, "HSI / Hong Kong equities");
  assert.equal(bySymbol.get("GLD")?.tracks, "XAUUSD / gold");
  assert.equal(bySymbol.get("USL")?.tracks, "WTI crude");
  assert.equal(bySymbol.get("CRAK")?.tracks, "ULSD / refined-product margins");
});

test("manual GitHub FINRA workflow defaults to the shared macro basket", () => {
  const workflow = readFileSync(new URL("../.github/workflows/run-live-research.yml", import.meta.url), "utf8");
  const expected = DEFAULT_FINRA_MACRO_SYMBOLS.join(",");
  assert.match(workflow, new RegExp(`default: "${expected}"`));
});

test("Research Brain distinguishes actual macro charts from FINRA positioning proxies", () => {
  const instructions = buildResearchBrainSystemInstructions();
  assert.match(instructions, /gold is XAUUSD/);
  assert.match(instructions, /Japan is NIKKEI/);
  assert.match(instructions, /Korea is KOSPI/);
  assert.match(instructions, /Hong Kong is HSI/);
  assert.match(instructions, /crude is WTI/);
  assert.match(instructions, /distillate stress is ULSD/);
  assert.match(instructions, /semiconductors are SMH/);
  assert.match(instructions, /GLD, FXY, EWJ, EWY, EWH, USL and CRAK/);
});
