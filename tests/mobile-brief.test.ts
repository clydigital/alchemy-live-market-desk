import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app/mobile-brief/page.tsx"),
  "utf8"
);

test("Mobile brief validates market-intelligence-snapshot/v1 contract and rejects malformed Dossier timestamps", () => {
  assert.match(pageSource, /result\.contractVersion !== "market-intelligence-snapshot\/v1"/);
  assert.match(pageSource, /!result\.dossier\?\.dossierId/);
  assert.match(pageSource, /!result\.regime\?\.headline/);
  assert.match(pageSource, /!result\.dossier\?\.asOf/);
  assert.match(pageSource, /!Number\.isFinite\(Date\.parse\(result\.dossier\.asOf\)\)/);
  assert.match(
    pageSource,
    /Incomplete or malformed snapshot contract\. No new assessment shown\./
  );
});

test("Mobile brief handles HTTP 503 and generic refresh failures cleanly", () => {
  assert.match(pageSource, /response\.status === 503/);
  assert.match(
    pageSource,
    /No usable Dossier presentation is available\./
  );
  assert.match(
    pageSource,
    /Snapshot unavailable \(HTTP \$\{response\.status\}\)\./
  );
  assert.match(
    pageSource,
    /setError\(cause instanceof Error \? cause\.message : "Unable to load the snapshot\."\)/
  );
});

test("Mobile brief warns user when displaying a cached snapshot after a failed refresh", () => {
  assert.match(pageSource, /error \? "Latest refresh failed\." : ""/);
  assert.match(
    pageSource,
    /Showing the last snapshot loaded in this browser session; it may be outdated\./
  );
});

test("Mobile brief gracefully handles missing or non-finite market watch data", () => {
  assert.match(
    pageSource,
    /typeof row\.last === "number" && Number\.isFinite\(row\.last\)/
  );
  assert.match(
    pageSource,
    /typeof row\.change5d === "number" && Number\.isFinite\(row\.change5d\)/
  );
  assert.match(pageSource, /row\.asOf \|\| "unknown"/);
  assert.match(pageSource, /row\.label \|\| row\.symbol \|\| "Unspecified asset"/);
  assert.match(pageSource, /No market observations available\./);
});

test("Mobile brief flags stale and degraded Dossiers correctly", () => {
  assert.match(pageSource, /!Number\.isFinite\(dossierAsOfTime\)/);
  assert.match(pageSource, /Date\.now\(\) - dossierAsOfTime > 24 \* 60 \* 60 \* 1000/);
  assert.match(pageSource, /Dossier is more than 24 hours old\./);
  assert.match(pageSource, /Selected Dossier is degraded or a fallback\./);
});

test("Mobile brief handles missing Story IDs, evidence references, and provider health fields", () => {
  assert.match(pageSource, /story\.persistentStoryId \|\| "Unlinked Dossier Story"/);
  assert.match(pageSource, /story\.evidenceRefs\?\.length \?\? 0/);
  assert.match(pageSource, /story\.epistemicLabel \|\| "Unclassified"/);
  assert.match(pageSource, /No provider health data reported\./);
  assert.match(pageSource, /No items reported\./);
});

test("Mobile brief preserves canonical explanations, contradictions, and stated uncertainty", () => {
  assert.match(pageSource, /snapshot\.regime\?\.answer/);
  assert.match(pageSource, /snapshot\.regime\?\.regimeImplication/);
  assert.match(pageSource, /snapshot\.regime\?\.rateRegime\?\.state \|\| "Unresolved"/);
  assert.match(pageSource, /story\.whatChanged \|\| "No change described\."/);
  assert.match(pageSource, /story\.whyItMatters \|\| story\.mechanism \|\| "Mechanism not specified\."/);
  assert.match(pageSource, /story\.conclusion \|\| "Not established\."/);
  assert.match(pageSource, /story\.whatWouldChangeMind \|\| "Not specified\."/);
  assert.match(pageSource, /item\.detail/);
});

test("Mobile brief prohibits invented MacroPulse fallbacks and causal market claims", () => {
  assert.match(
    pageSource,
    /No fallback assessment is invented\. Consult the existing MacroPulse separately\./
  );
  assert.match(
    pageSource,
    /These are observations, not causal claims\./
  );
  assert.doesNotMatch(pageSource, /generateFallbackAssessment/);
  assert.doesNotMatch(pageSource, /synthesizeMacroPulse/);
});

test("Mobile brief complies with British English and LY copy style guidelines", () => {
  assert.match(pageSource, /en-GB/);
  assert.match(pageSource, /Read-only view of the existing Live Desk assessment/);
  assert.match(pageSource, /Confirmation and disagreement/);
  assert.match(pageSource, /Persistent Stories and causal explanations/);
});
