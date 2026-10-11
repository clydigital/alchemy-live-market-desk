import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/hybrid-output/page.tsx", import.meta.url), "utf8");

test("lean Hybrid hierarchy surfaces canonical meaning and independently verified Motion before audits", () => {
  const now = page.indexOf('title="Now — canonical market view"');
  const verified = page.indexOf('title="What materially changed?"', now);
  const leads = page.indexOf('title="What still needs checking?"', verified);
  const catalysts = page.indexOf('title="Upcoming news & catalysts"', leads);
  const audit = page.indexOf('title="Live–Hybrid Dossier edition parity"', catalysts);
  assert.ok(now > 0 && verified > now && leads > verified && catalysts > leads && audit > catalysts);
  assert.match(page.slice(now, verified), /presenterDossier\.header\.answer/);
  assert.match(page.slice(now, verified), /presenterDossier\.header\.regimeImplication/);
  assert.match(page.slice(now, verified), /presenterDossier\.header\.whatWouldChangeMind/);
});

test("visible safeguards explain edition mismatch before the market narrative", () => {
  const top = page.slice(
    page.indexOf('<div className={styles.grid}>', page.indexOf('title="Hybrid Output"')),
    page.indexOf('title="Now — canonical market view"'),
  );
  assert.match(top, /invalid_fallback_current/);
  assert.match(top, /HISTORICAL_STORY_REASONING_ONLY/);
  assert.match(top, /dossierEditionParity\.status !== "SAME"/);
  assert.match(page, /presenterHistoricalContextBoundary\.scope !== "HISTORICAL_FULL_CASE"/);
  assert.match(page, /FROZEN DOSSIER/);
  assert.match(page, /formatDeskDate\(presenterDossier\.asOf\)/);
});

test("technical detail stays inspectable without preceding on-air market reasoning", () => {
  const auditOpener = page.indexOf("<details className={styles.record}>");
  const parity = page.indexOf('title="Live–Hybrid Dossier edition parity"');
  const watch = page.indexOf('title="Evidence-gated Regime watch checks"');
  const measured = page.indexOf('title="Measured Regime assumptions"');
  const auditCloser = page.indexOf("</details>", auditOpener);
  assert.ok(auditOpener > 0 && parity > auditOpener && watch > parity);
  assert.ok(measured > watch && auditCloser > measured);
  assert.match(page.slice(auditOpener, parity), /<summary/);
  assert.match(page.slice(auditOpener, auditCloser), /canonicalEvidenceUuid|Canonical Evidence/);
});
