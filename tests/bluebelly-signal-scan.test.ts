import assert from "node:assert/strict";
import test from "node:test";
import { scanBreakout, evaluateMarketSignals } from "../lib/bluebelly-signal-scan.ts";

const day = 86400;
const start = 1735689600;
function bars(count: number, increase = 0.4, withVolume = true) {
  return Array.from({ length: count }, (_, i) => ({
    time: start + i * day, close: 100 + i * increase,
    high: 101 + i * increase, low: 99 + i * increase,
    ...(withVolume ? { volume: i === count - 1 ? 200000 : 100000 } : {}),
  }));
}
test("Donchian uses previous highs, not including breakout candle; 20/55/252 independent", () => {
  const trending = bars(260);
  assert.equal(scanBreakout(trending,20).state, "inside"); // rising less than previous day's high
  trending[259].close += 10;
  assert.equal(scanBreakout(trending,20).state, "up");
  assert.equal(scanBreakout(trending,55).state, "up");
  assert.equal(scanBreakout(trending,252).state, "up");
  assert.equal(scanBreakout(trending.slice(-51),55).state, "unavailable");
});
test("Closing basis is explicit when provider lacks candle highs/lows", () => {
  const closeOnly = bars(260).map(({time,close})=>({time,close}));
  const result = scanBreakout(closeOnly,252);
  assert.equal(result.basis,"closing");
  assert.equal(result.state,"up");
});
test("Volume surge is distinct from price volatility, and missing volume stays unknown", () => {
  const good = bars(260);
  const snapshot = evaluateMarketSignals(good);
  assert.equal(snapshot?.volume.state,"up-surge");
  assert.equal(snapshot?.volume.multiple,2);
  const noVolume = evaluateMarketSignals(bars(260,0.4,false));
  assert.equal(noVolume?.volume.state,"unavailable");
  assert.ok((noVolume?.alignment.bullish.available ?? 99) < (snapshot?.alignment.bullish.available ?? 0));
});
test("Relative strength requires matching source session, and summary never includes raw bars", () => {
  const s = bars(260,0.4), b = bars(260,0.1);
  const scan = evaluateMarketSignals(s,b);
  assert.equal(scan?.relative.state,"leader");
  assert.equal("bars" in (scan ?? {}),false);
  const mismatch = evaluateMarketSignals(s,b.map(x=>({...x,time:x.time+day})));
  assert.equal(mismatch?.relative.state,"unavailable");
});
test("Insufficient coverage reports unavailable, not five failed conditions", () => {
  const scan = evaluateMarketSignals(bars(8));
  assert.equal(scan?.alignment.bullish.available,0);
  assert.equal(scan?.alignment.bullish.matched,0);
  assert.equal(scan?.squeeze.state,"unavailable");
  assert.equal(scan?.stoch.zone,"unavailable");
});
