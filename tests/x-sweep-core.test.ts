import assert from "node:assert/strict";
import test from "node:test";
import {
  X_CORE_ROSTER,
  X_SWEEP_DEFAULTS,
  isExcludedXWireHandle,
  configureXSweep,
  normaliseXPostUrl,
  selectXSweepCandidates,
  xSourceHealth,
  xSweepWindow,
  type XCandidate,
} from "../lib/x-sweep-core.ts";

const NOW = "2026-10-23T06:00:00+08:00";
const ISO = "2026-10-22T21:00:00Z";
function post(id: number, handle = "Bluekurtic", patch: Partial<XCandidate> = {}): XCandidate {
  return {
    postUrl: "https://x.com/" + handle + "/status/211317772374942" + String(id).padStart(4, "0"),
    accountHandle: handle,
    publishedAt: ISO,
    retrievedAt: "2026-10-22T22:00:00Z",
    importance: id % 100,
    ...patch,
  };
}

test("preserves the X sweep settings with 11 monitored accounts", () => {
  assert.deepEqual(X_SWEEP_DEFAULTS, {
    sweep: "x", preset: "normal", lookbackHours: 2.5, overlapMinutes: 30,
    maxCandidatesPerRun: 250, softLimitPerAccount: 40, recoveryLookbackHours: 72,
    deepInvestigationsCap: 12, schedule: "existing MacroPulse only",
    newScheduledTask: false,
  });
  assert.equal(X_CORE_ROSTER.length, 11);
  assert.deepEqual(X_CORE_ROSTER.map(item => item.handle), [
    "Bluekurtic", "HFI_Research", "OilandEnergy", "HormuzReport", "TheStudyofWar",
    "Currentreport1", "arena", "KobeissiLetter", "FirstSquawk", "zerohedge", "TGLetter",
  ]);
});

test("custom caps are bounded without ever authorising a new task", () => {
  assert.equal(configureXSweep({ preset: "custom", lookbackHours: 24 }).lookbackHours, 24);
  assert.throws(() => configureXSweep({ maxCandidatesPerRun: 999 }), /Invalid X sweep/);
  assert.throws(() => configureXSweep({ softLimitPerAccount: 0 }), /Invalid X sweep/);
  assert.throws(() => configureXSweep({ recoveryLookbackHours: 1 }), /Recovery window/);
  assert.throws(() => configureXSweep({ newScheduledTask: true as false }), /No new scheduler/);
  assert.throws(() => configureXSweep({ deepInvestigationsCap: 13 }), /Invalid X sweep/);
});

test("uses 150-minute rolling window and expands only after actual missed coverage", () => {
  const normal = xSweepWindow(NOW, "2026-10-23T04:00:00+08:00");
  assert.equal(normal.windowHours, 2.5);
  assert.equal(normal.startAt, "2026-10-22T19:30:00.000Z");
  assert.equal(normal.hasUncoveredGap, false);
  const recovered = xSweepWindow(NOW, "2026-10-22T06:00:00+08:00");
  assert.equal(recovered.windowHours, 24.5);
  assert.equal(recovered.hasUncoveredGap, false);
  const capped = xSweepWindow(NOW, "2026-10-18T00:00:00+08:00");
  assert.equal(capped.windowHours, 72);
  assert.equal(capped.hasUncoveredGap, true);
  assert.equal(xSweepWindow(NOW, null).checkpointAvailable, false);
});

test("normalises direct X status URLs and rejects unsafe and non-status inputs", () => {
  assert.deepEqual(normaliseXPostUrl("https://twitter.com/Bluekurtic/status/2113177723749420001?utm_campaign=abc"), {
    handle: "Bluekurtic",
    postId: "2113177723749420001",
    url: "https://x.com/Bluekurtic/status/2113177723749420001",
  });
  assert.throws(() => normaliseXPostUrl("http://x.com/Bluekurtic/status/2113177723749420001"));
  assert.throws(() => normaliseXPostUrl("https://x.com.evil.com/Bluekurtic/status/2113177723749420001"));
  assert.throws(() => normaliseXPostUrl("https://x.com/Bluekurtic"));
});

test("deduplicates repeated post IDs, excludes bare reposts, preserves materially distinct quotes", () => {
  const first = post(1, "Bluekurtic", { importance: 91, investigate: true });
  const dup = post(1, "Bluekurtic", { importance: 88 });
  const repost = post(2, "Bluekurtic", { type: "repost" });
  const quote = post(3, "Bluekurtic", { type: "quote", investigate: true });
  const result = selectXSweepCandidates([first, dup, repost, quote], NOW);
  assert.deepEqual(result.selected.map(x => x.postId), [
    "2113177723749420001", "2113177723749420003",
  ]);
  assert.equal(result.withheld.filter(x => x.reason === "duplicate_post_id").length, 1);
  assert.equal(result.withheld.filter(x => x.reason === "bare_repost").length, 1);
  assert.equal(result.deepInvestigationCandidates.length, 2);
});

test("withholds unverifiable time/identity instead of pretending those posts were checked", () => {
  const rows = [
    post(1, "Bluekurtic", { publishedAt: null }),
    post(2, "Bluekurtic", { accountHandle: "FirstSquawk" }),
    post(3, "Bluekurtic", { publishedAt: "2026-10-10T01:00:00Z" }),
    post(4, "Bluekurtic"),
  ];
  const result = selectXSweepCandidates(rows, NOW);
  assert.equal(result.selected.length, 1);
  assert.deepEqual(result.withheld.map(x => x.reason), [
    "unknown_publication_time", "account_identity_mismatch", "outside_window",
  ]);
});

test("honours 40-per-account soft cap and retains deferred rows as backlog", () => {
  const rows = Array.from({ length: 45 }, (_, i) => post(i + 10, "Bluekurtic", { importance: 80 }));
  const result = selectXSweepCandidates(rows, NOW);
  assert.equal(result.selected.length, 40);
  assert.equal(result.deferred.length, 5);
  assert.equal(result.limitReached, true);
});

test("hard global and deep-investigation budgets are independent", () => {
  const settings = configureXSweep({ preset: "custom", maxCandidatesPerRun: 4, softLimitPerAccount: 5, deepInvestigationsCap: 2 });
  const rows = Array.from({ length: 8 }, (_, i) => post(i + 50, "FirstSquawk", { importance: 90, investigate: true }));
  const result = selectXSweepCandidates(rows, NOW, settings);
  assert.equal(result.selected.length, 4);
  assert.equal(result.deferred.length, 4);
  assert.equal(result.deepInvestigationCandidates.length, 2);
});

test("source-health does not call inaccessible accounts quiet", () => {
  const result = xSourceHealth([{
    handle: "Bluekurtic", status: "blocked", attemptedAt: ISO,
    lastSuccessAt: null, lastObservedPostAt: null, fetched: 0,
    newPosts: 0, error: "login challenge",
  }]);
  assert.equal(result.inaccessible, 1);
  assert.equal(result.complete, false);
  assert.equal(result.monitored, 11);
});

test("restores ZeroHedge, adds TGLetter and continues to exclude GordianKnotDev", () => {
  assert.equal(isExcludedXWireHandle("@ZeroHedge"), false);
  assert.equal(isExcludedXWireHandle("zerohedge"), false);
  assert.equal(isExcludedXWireHandle("@TGLetter"), false);
  assert.equal(isExcludedXWireHandle("zerohedge2"), false);
  assert.equal(isExcludedXWireHandle("@GordianKnotDev"), true);
  assert.equal(isExcludedXWireHandle("gordianknotdev"), true);
  const selected=selectXSweepCandidates([
    post(70,"ZeroHedge"),post(71,"zerohedge"),post(76,"TGLetter"),
    post(72,"Bluekurtic"),post(73,"Bluekurtic",{accountHandle:"@ZEROHEDGE"}),
    post(74,"GordianKnotDev"),post(75,"Bluekurtic",{accountHandle:"@GORDIANKNOTDEV"}),
  ],NOW);
  assert.deepEqual(new Set(selected.selected.map(x=>x.accountHandle)),new Set(["ZeroHedge","zerohedge","TGLetter","Bluekurtic"]));
  assert.equal(selected.withheld.filter(x=>x.reason==="excluded_x_wire_source").length,2);
  assert.ok(!X_CORE_ROSTER.some(x=>isExcludedXWireHandle(x.handle)));
});
