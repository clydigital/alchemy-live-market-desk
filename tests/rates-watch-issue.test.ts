import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../scripts/rates-source-integrity-issue.mjs", import.meta.url));
function project(data: unknown, http = 200) {
  const output = spawnSync(process.execPath, [script, String(http)], {
    input: JSON.stringify(data), encoding: "utf8", timeout: 10_000,
  });
  assert.equal(output.status, 0, output.stderr);
  return JSON.parse(output.stdout) as {
    status: "OK" | "WATCH" | "ACTION_REQUIRED"; fingerprint: string;
    alertLines: string[]; body: string;
  };
}
function snapshot(alerts: Array<{ code: string; severity: string; detail: string }> = [
  { code: "NY_FED_PRIMARY_DEALERS_UPSTREAM_STALE", severity: "WATCH", detail: "Official NY Fed publication is delayed." },
]) {
  return {
    contractVersion: "rates-source-integrity/1", generatedAt: "2026-10-14T22:49:00Z",
    operationalStatus: alerts.some((a) => a.severity === "ACTION_REQUIRED")
      ? "ACTION_REQUIRED" : alerts.length ? "WATCH" : "OK",
    dossier: { id: "dossier-a", asOf: "2026-10-14T22:07:00Z" },
    alerts, treasury: { states: ["us2y", "us5y-fred", "us10y-fred", "us20y-fred", "us30y-fred"]
      .map((id) => ({ id, state: "COMPLETE", observationDate: "2026-10-14" })) },
    requiredRateInputs: { required: 5, present: 5, missing: [], diagnostics: [] },
    primaryDealers: { asOf: "2026-09-30", state: "UPSTREAM_STALE" },
    move: { state: "ADAPTER_PRESENT_NO_VERIFIED_DATA", observationDate: null },
    fiveSessionCurve: { state: "COMPLETE", latestDate: "2026-10-14", missingMaturities: [] },
  };
}

test("unchanged NY Fed watch ignores run time, market observation day, Dossier rebase and alert order", () => {
  const a = snapshot();
  const first = project(a);
  const second = project({ ...a, generatedAt: "2026-10-15T04:49:00Z",
    dossier: { id: "dossier-b", asOf: "2026-10-15T04:20:00Z" },
    treasury: { states: a.treasury.states.map((p) => ({ ...p, observationDate: "2026-10-15" })) } });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.body, second.body);
  assert.equal(first.status, "WATCH");
  assert.match(first.body, /NY_FED_PRIMARY_DEALERS_UPSTREAM_STALE/);
});

test("new warning updates existing WATCH instead of suppressing it behind the NY Fed alert", () => {
  const a = snapshot();
  const added = project(snapshot([...a.alerts, { code: "REQUIRED_RATE_INPUT_US10Y_BREAKEVEN",
    severity: "WATCH", detail: "Source was published after persisted Dossier." }]));
  const baseline = project(a);
  assert.equal(added.status, "WATCH");
  assert.notEqual(added.fingerprint, baseline.fingerprint);
  assert.match(added.body, /US10Y_BREAKEVEN/);
});

test("recovery and WATCH-to-ACTION_REQUIRED both change notification identity", () => {
  const old = snapshot();
  const good = project(snapshot([]));
  const emergency = project(snapshot([...old.alerts, { code: "TREASURY_FIVE_SESSION_MOVEMENT_LOST",
    severity: "ACTION_REQUIRED", detail: "Dated 10Y change dropped downstream." }]));
  assert.equal(good.status, "OK");
  assert.equal(emergency.status, "ACTION_REQUIRED");
  assert.notEqual(project(old).fingerprint, good.fingerprint);
  assert.notEqual(project(old).fingerprint, emergency.fingerprint);
});

test("upstream source vintage changes are significant without alert spam for old observation dates", () => {
  const a = snapshot();
  const b = snapshot();
  b.primaryDealers.asOf = "2026-10-07";
  assert.notEqual(project(a).fingerprint, project(b).fingerprint);
});

test("alert presentation order does not generate a new notification", () => {
  const original = snapshot().alerts[0];
  const second = { code: "REQUIRED_RATE_INPUT_US10Y_BREAKEVEN", severity: "WATCH", detail: "Pending rebase." };
  assert.equal(project(snapshot([original, second])).fingerprint,
    project(snapshot([second, original])).fingerprint);
});

test("invalid HTTP, missing source contract, and inconsistent severity all fail closed", () => {
  assert.equal(project(snapshot(), 502).status, "ACTION_REQUIRED");
  assert.equal(project({ nonsense: true }).status, "ACTION_REQUIRED");
  const inconsistent = snapshot([{ code: "RATE_DOSSIER_MISMATCH_US2Y",
    severity: "ACTION_REQUIRED", detail: "Missing" }]);
  inconsistent.operationalStatus = "WATCH";
  assert.equal(project(inconsistent).status, "ACTION_REQUIRED");
});
