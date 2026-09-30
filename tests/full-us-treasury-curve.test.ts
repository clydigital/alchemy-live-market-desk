import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("full US Treasury curve uses official FRED constant-maturity series and survives Dossier selection", () => {
  const monitor = readFileSync(new URL("../lib/market-monitor.ts", import.meta.url), "utf8");
  const snapshot = readFileSync(new URL("../lib/dossier-v2/canonical-snapshot.ts", import.meta.url), "utf8");
  const packet = readFileSync(new URL("../lib/dossier-v2/input-packet.ts", import.meta.url), "utf8");
  for (const [id, series] of [["us2y","DGS2"],["us5y-fred","DGS5"],["us10y-fred","DGS10"],["us20y-fred","DGS20"],["us30y-fred","DGS30"]]) {
    assert.match(monitor, new RegExp(`id: "${id}", seriesId: "${series}"`));
  }
  for (const id of ["us2y","us5y-fred","us10y-fred","us20y-fred","us30y-fred"]) {
    assert.match(snapshot, new RegExp(`"${id}"`));
    assert.match(packet, new RegExp(`market-monitor:${id}`));
  }
});
