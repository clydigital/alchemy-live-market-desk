import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {MONITOR_SPECS} from "../lib/presenter-technical-checks.ts";

const page=readFileSync(new URL("../app/owner/presenter/page.tsx",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/live-desk/PresenterTechnicalChecks.tsx",import.meta.url),"utf8");

test("Bluebelly owner Presenter shows both core and additional technical monitors",()=>{
  assert.equal(MONITOR_SPECS.length,14);
  assert.equal(new Set(MONITOR_SPECS.map(m=>m.key)).size,14);
  assert.equal(MONITOR_SPECS.filter(m=>m.group==="Core").length,7);
  assert.equal(MONITOR_SPECS.filter(m=>m.group==="Additional").length,7);
  assert.match(page,/<PresenterTechnicalChecks(?:\s+[^>]*)?\s*\/>/);
  assert.doesNotMatch(page,/<PresenterTechnicalChecks\s+compact/);
  assert.match(component,/!compact\s*\?\s*</);
  assert.match(component,/showAdditional\s*\?\s*"Hide"\s*:\s*"Show"/);
  assert.match(component,/SPECS\.length - coreCount/);
});

test("Expose all monitors without a new evidence writer, data contract, or private access route",()=>{
  assert.match(page,/data-presenter-studio="owner-only"/);
  assert.match(page,/id="technical-checks"/);
  assert.match(component,/credentials:\s*"same-origin"/);
  assert.match(component,/expectedRevision:\s*cloudRevision/);
  assert.match(component,/non-canonical/i);
  assert.doesNotMatch(page,/(?:insert|upsert|update)\s*\(/);
});
