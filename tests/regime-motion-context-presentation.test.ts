import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const board = readFileSync(new URL("../components/live-desk/RegimeBoard.tsx", import.meta.url), "utf8");
const strip = readFileSync(new URL("../components/live-desk/MarketRegimeStrip.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../components/live-desk/RegimeDetailWorkspace.tsx", import.meta.url), "utf8");

test("C1.5b Regime cards distinguish Dossier System 2 context from ordinary contributions", () => {
  assert.match(board, /SYSTEM 2 DOSSIER CONTEXT · NON-STATE/);
  assert.match(board, /sourceKind === "dossier_motion"/);
  assert.match(strip, /System 2 Dossier context · non-state/);
  assert.match(strip, /sourceKind === "dossier_motion"/);
});

test("C1.5b Regime LIVE view labels Dossier Motion as accepted context without state authority", () => {
  assert.match(detail, /SYSTEM 2 · DOSSIER CONTEXT/);
  assert.match(detail, /Context only · does not change Regime state by itself/);
  assert.match(detail, /regime\.dossierContext\.map/);
  assert.match(detail, /Structural state still comes from durable Stories and System 1 telemetry/);
  assert.match(detail, /Non-state Regime context/);
});
