import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const board = readFileSync(
  new URL("../components/live-desk/RegimeBoard.tsx", import.meta.url),
  "utf8",
);
const strip = readFileSync(
  new URL("../components/live-desk/MarketRegimeStrip.tsx", import.meta.url),
  "utf8",
);

test("C1.5b1 Regime overview surfaces Dossier Motion as explicitly non-state context", () => {
  assert.match(board, /sourceKind === "dossier_motion"/);
  assert.match(board, /SYSTEM 2 DOSSIER CONTEXT · NON-STATE/);

  assert.match(strip, /sourceKind === "dossier_motion"/);
  assert.match(strip, /System 2 Dossier context · non-state/);
});

test("C1.5b1 ordinary Regime contributions keep their existing labels", () => {
  assert.match(board, /LATEST CONTRIBUTION/);
  assert.match(strip, /Latest contribution/);
});
