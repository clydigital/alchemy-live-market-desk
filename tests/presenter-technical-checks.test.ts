import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync(new URL("../components/live-desk/PresenterTechnicalChecks.tsx", import.meta.url), "utf8");
const overview = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const prep = readFileSync(new URL("../app/hybrid-output/prepare/page.tsx", import.meta.url), "utf8");
const routes = readFileSync(new URL("../lib/live-desk/routes.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/presenter/technical-checks/page.tsx", import.meta.url), "utf8");

test("manual technical checks remain presenter-owned and never write canonical state", () => {
  assert.match(component, /localStorage\.setItem\(STORAGE_KEY/);
  assert.doesNotMatch(component, /\.from\(["'](?:stories|story_thesis_versions|dossiers|evidence)["']\)/);
  assert.match(component, /not an automated price feed or verified fundamental signal/i);
  assert.match(component, /"unassessed" \| "aligned" \| "diverging" \| "mixed"/);
});
test("four required checks and source-linked agreement", () => {
  for (const key of ["dxy-4h", "dxy-1d", "jxy", "us02y-30y"]) {
    assert.match(component, new RegExp('key: "' + key + '"'));
  }
  assert.match(component, /sourceIsValid\(check\.evidenceUrl\)/);
  assert.match(component, /!draft\.observedOn/);
  assert.match(component, /Upper-band break/);
  assert.match(component, /Lower-band break/);
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
