import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync(new URL("../components/live-desk/PresenterTechnicalChecks.tsx", import.meta.url), "utf8");
const overview = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const prep = readFileSync(new URL("../app/hybrid-output/prepare/page.tsx", import.meta.url), "utf8");
const routes = readFileSync(new URL("../lib/live-desk/routes.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/presenter/technical-checks/page.tsx", import.meta.url), "utf8");
const specs = [...component.matchAll(/\{ key: "([^"]+)", title: "([^"]+)", group: "(Core|Additional)"/g)]
  .map(([, key, title, group]) => ({ key, title, group }));
const specsByKey = new Map(specs.map((spec) => [spec.key, spec]));

test("account-sync technical checks stay presenter-owned and never rewrite local backups", () => {
  assert.ok(component.includes('readStorage()'), "Existing browser-local data must remain readable");
  assert.ok(!component.includes('localStorage.setItem(STORAGE_KEY'), "Cloud saves never rewrite browser backup");
  assert.ok(component.includes('credentials: "same-origin"'));
  assert.ok(component.includes('expectedRevision: cloudRevision'));
  assert.ok(component.includes('cloudRevision !== 0'), "Import cannot overwrite an existing cloud record");
  assert.ok(component.includes('reviewImport'), "Local import requires explicit user review");
  assert.ok(component.includes('response.status === 409'), "Revision conflict must be surfaced");
  assert.match(component, /non-canonical/i);
  assert.doesNotMatch(component, /\.from\(["'](?:stories|story_thesis_versions|dossiers|evidence)["']\)/);
  assert.match(component, /"unassessed" \| "aligned" \| "diverging" \| "mixed"/);
});
test("five core checks preserve stable identities and source-linked agreement", () => {
  assert.deepEqual(
    specs.filter((spec) => spec.group === "Core").map((spec) => spec.key),
    ["dxy-4h", "dxy-1d", "jxy", "us02y-30y", "spx-log-channel-rollover"],
  );
  assert.deepEqual(specsByKey.get("us02y-30y"), {
    key: "us02y-30y", title: "US02Y–US30Y · Yield spread · GOLD IDEA", group: "Core",
  });
  assert.deepEqual(specsByKey.get("spx-log-channel-rollover"), {
    key: "spx-log-channel-rollover", title: "SPX RISING LOG CHANNEL IDEA + ROLLOVER IDEA", group: "Core",
  });
  assert.match(component, /const STORAGE_KEY = "alchemy-presenter-technical-fundamentals-v1"/);
  assert.match(component, /type Stored = \{ version: 1;/);
  assert.match(component, /if \(value\.version !== 1/);
  assert.match(component, /const old = previous\.get\(fresh\.key\)/);
  assert.match(component, /sourceIsValid\(check\.evidenceUrl\)/);
  assert.match(component, /!draft\.observedOn/);
  assert.match(component, /Upper-band break/);
  assert.match(component, /Lower-band break/);
  for (const label of [
    "Technical reading", "Chart observation date", "Technical versus fundamentals",
    "Fundamental driver / contradiction", "Original source URL", "Livestream talking point",
  ]) assert.match(component, new RegExp(label));
});
test("additional monitors add cross-asset information without duplicating existing checks", () => {
  assert.deepEqual(specsByKey.get("move-vix"), {
    key: "move-vix", title: "MOVE–VIX · Rates-to-equity volatility transmission", group: "Additional",
  });
  assert.deepEqual(specsByKey.get("copper-gold"), {
    key: "copper-gold", title: "Copper/Gold · Cyclical growth impulse", group: "Additional",
  });
  assert.equal(specs.filter((spec) => spec.group === "Additional").length, 8);
  assert.equal(new Set(specs.map((spec) => spec.key)).size, specs.length);
  assert.equal(new Set(specs.map((spec) => spec.title)).size, specs.length);
  assert.match(component, /const coreCount = SPECS\.filter\(\(check\) => check\.group === "Core"\)\.length/);
  assert.match(component, /SPECS\.length - coreCount/);
});
test("link and reminder present on Overview and Prep without changing exact edition", () => {
  assert.match(overview, /<PresenterTechnicalChecks compact\s*\/>/);
  assert.match(prep, /<PresenterTechnicalChecks compact\s*\/>/);
  assert.match(prep, /projection\.status !== "READY"/);
  assert.match(routes, /\/presenter\/technical-checks/);
  assert.match(page, /PresenterTechnicalChecks/);
});
test("review action is explicitly separate from saving", () => {
  assert.match(component, /encodeURIComponent\(promptFor\(check\)\)/);
  assert.match(component, /navigator\.clipboard\.writeText/);
  assert.match(component, /apply any changes here manually/i);
});
