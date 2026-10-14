import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  CONTRACT_VERSION,
  KNOWN_KEYS,
  MONITOR_SPECS,
  createDefaultPresenterChecklist,
  isValidDateString,
  isValidHttpsUrl,
  normalizePresenterChecklistTimestamps,
  validateIncomingPutPayload,
} from "../lib/presenter-technical-checks.ts";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20261010000000_presenter_technical_checklists.sql",
);
const routePath = path.join(
  root,
  "app",
  "api",
  "presenter",
  "technical-checks",
  "route.ts",
);

const todayDate = new Date().toISOString().slice(0, 10);
const futureDate = "2099-12-31";

test("SQL Migration Contract: presenter technical checklists schema and RLS policies", () => {
  assert.equal(fs.existsSync(migrationPath), true, "Migration file must exist");
  const migration = fs.readFileSync(migrationPath, "utf8");

  assert.match(
    migration,
    /create table if not exists public\.presenter_technical_checklists/i,
  );
  assert.match(
    migration,
    /user_id uuid not null primary key references auth\.users\(id\)/i,
  );
  assert.match(migration, /contract_version text not null default 'technical-checks\/2'/i);
  assert.match(migration, /checks jsonb not null/i);
  assert.match(migration, /history jsonb not null/i);
  assert.match(migration, /revision bigint not null default 1/i);
  assert.match(migration, /updated_at timestamptz not null default now\(\)/i);
  assert.match(migration, /jsonb_array_length\(checks\)\s*=\s*13/i);
  assert.match(migration, /jsonb_array_length\(history\)\s*<=\s*30/i);

  assert.match(
    migration,
    /alter table public\.presenter_technical_checklists enable row level security/i,
  );
  assert.match(
    migration,
    /revoke all on public\.presenter_technical_checklists from anon, public/i,
  );
  assert.match(
    migration,
    /grant select, insert, update on public\.presenter_technical_checklists to authenticated/i,
  );

  assert.match(
    migration,
    /create policy presenter_technical_checklists_select[\s\S]*for select[\s\S]*to authenticated/i,
  );
  assert.match(
    migration,
    /create policy presenter_technical_checklists_insert[\s\S]*for insert[\s\S]*to authenticated/i,
  );
  assert.match(
    migration,
    /create policy presenter_technical_checklists_update[\s\S]*for update[\s\S]*to authenticated/i,
  );

  // UPDATE policy must contain both USING and WITH CHECK
  const updatePolicyMatch = migration.match(
    /create policy presenter_technical_checklists_update[\s\S]*?;/i,
  );
  assert.ok(updatePolicyMatch, "UPDATE policy must be defined");
  assert.match(updatePolicyMatch[0], /using\s*\(/i);
  assert.match(updatePolicyMatch[0], /with check\s*\(/i);

  // Must reference app_access_allowlist
  assert.match(migration, /app_access_allowlist/i);
  assert.match(migration, /auth\.uid\(\)/i);
  assert.match(migration, /auth\.jwt\(\)\s*->>\s*'email'/i);

  // Avoid SECURITY DEFINER or public RPCs
  assert.doesNotMatch(migration, /security definer/i);
  assert.doesNotMatch(migration, /create function/i);
});

test("Route Contract: API route configuration and security headers", () => {
  assert.equal(fs.existsSync(routePath), true, "API Route file must exist");
  const route = fs.readFileSync(routePath, "utf8");

  assert.match(route, /export const dynamic = ["']force-dynamic["']/);
  assert.match(route, /Cache-Control":\s*["']private,\s*no-store["']/);
  assert.doesNotMatch(route, /Access-Control-Allow-Origin":\s*"\*"/);
  assert.match(route, /createSupabaseServerClient/);
  assert.match(route, /app_access_allowlist/);
  assert.match(route, /validateIncomingPutPayload/);
  assert.match(route, /normalizePresenterChecklistTimestamps/);
});

test("Validation: 13 known monitor keys and spec default payload", () => {
  assert.equal(MONITOR_SPECS.length, 13);
  assert.equal(KNOWN_KEYS.size, 13);

  const defaultPayload = createDefaultPresenterChecklist();
  assert.equal(defaultPayload.contractVersion, CONTRACT_VERSION);
  assert.equal(defaultPayload.checks.length, 13);
  assert.equal(defaultPayload.revision, 0);
  assert.deepEqual(defaultPayload.history, []);

  const coreKeys = MONITOR_SPECS.filter((s) => s.group === "Core").map((s) => s.key);
  assert.deepEqual(coreKeys, ["dxy-4h", "dxy-1d", "jxy", "us02y-30y", "spx-log-channel-rollover"]);
});

test("Validation: pure schema validation enforces exact rules", () => {
  const defaultPayload = createDefaultPresenterChecklist();
  const all13Checks = defaultPayload.checks.map((c) => ({
    ...c,
    observedOn: todayDate,
    updatedAt: new Date().toISOString(),
  }));

  const validPayload = {
    expectedRevision: 1,
    checks: all13Checks,
    history: [],
  };

  const res = validateIncomingPutPayload(validPayload);
  assert.equal(res.success, true);
  if (res.success) {
    assert.equal(res.expectedRevision, 1);
    assert.equal(res.checks.length, 13);
    assert.equal(res.checks[0].title, "DXY · 4H EMA20 ± 1σ band");
    assert.equal(res.checks[0].group, "Core");
  }

  // Reject invalid body type
  assert.equal(validateIncomingPutPayload(null).success, false);
  assert.equal(validateIncomingPutPayload("invalid").success, false);
  assert.equal(validateIncomingPutPayload([]).success, false);

  // Reject invalid expectedRevision
  assert.equal(
    validateIncomingPutPayload({ expectedRevision: -1, checks: all13Checks }).success,
    false,
  );
  assert.equal(
    validateIncomingPutPayload({ expectedRevision: "1", checks: all13Checks }).success,
    false,
  );

  // Reject userId direct input
  assert.equal(
    validateIncomingPutPayload({ expectedRevision: 0, userId: "some-id", checks: all13Checks }).success,
    false,
  );
  assert.equal(
    validateIncomingPutPayload({ expectedRevision: 0, user_id: "some-id", checks: all13Checks }).success,
    false,
  );

  // Reject partial checks array (<13 items)
  assert.equal(
    validateIncomingPutPayload({ expectedRevision: 0, checks: all13Checks.slice(0, 5) }).success,
    false,
  );

  // Reject >13 items
  const tooMany = [...all13Checks, all13Checks[0]];
  assert.equal(
    validateIncomingPutPayload({ expectedRevision: 0, checks: tooMany }).success,
    false,
  );

  // Reject unknown monitor key
  const withUnknown = all13Checks.map((c, i) => (i === 0 ? { ...c, key: "unknown-coin-key" } : c));
  assert.equal(
    validateIncomingPutPayload({ expectedRevision: 0, checks: withUnknown }).success,
    false,
  );

  // Reject duplicate key
  const withDuplicate = all13Checks.map((c, i) => (i === 1 ? { ...c, key: "dxy-4h" } : c));
  assert.equal(
    validateIncomingPutPayload({ expectedRevision: 0, checks: withDuplicate }).success,
    false,
  );

  // Reject invalid technical status
  const withBadStatus = all13Checks.map((c, i) => (i === 0 ? { ...c, technical: "To The Moon!" } : c));
  assert.equal(
    validateIncomingPutPayload({ expectedRevision: 0, checks: withBadStatus }).success,
    false,
  );

  // Reject invalid lastBreak
  const withBadBreak = all13Checks.map((c, i) => (i === 0 ? { ...c, lastBreak: "SIDEWAYS" } : c));
  assert.equal(
    validateIncomingPutPayload({ expectedRevision: 0, checks: withBadBreak }).success,
    false,
  );

  // Reject invalid alignment
  const withBadAlignment = all13Checks.map((c, i) => (i === 0 ? { ...c, alignment: "bullish" } : c));
  assert.equal(
    validateIncomingPutPayload({ expectedRevision: 0, checks: withBadAlignment }).success,
    false,
  );

  // Reject invalid date (future date, malformed, or rollover date like Feb 30)
  const withFutureDate = all13Checks.map((c, i) => (i === 0 ? { ...c, observedOn: futureDate } : c));
  assert.equal(
    validateIncomingPutPayload({ expectedRevision: 0, checks: withFutureDate }).success,
    false,
  );
  const withRolloverDate = all13Checks.map((c, i) => (i === 0 ? { ...c, observedOn: "2026-02-30" } : c));
  assert.equal(
    validateIncomingPutPayload({ expectedRevision: 0, checks: withRolloverDate }).success,
    false,
  );

  // Reject non-https URL
  const withHttpUrl = all13Checks.map((c, i) => (i === 0 ? { ...c, evidenceUrl: "http://insecure-site.com" } : c));
  assert.equal(
    validateIncomingPutPayload({ expectedRevision: 0, checks: withHttpUrl }).success,
    false,
  );

  // Reject HTML / script injection
  const withScript = all13Checks.map((c, i) => (i === 0 ? { ...c, fundamentals: "<script>alert('xss')</script>" } : c));
  assert.equal(
    validateIncomingPutPayload({ expectedRevision: 0, checks: withScript }).success,
    false,
  );

  // Enforce max text lengths
  const withLongText = all13Checks.map((c, i) => (i === 0 ? { ...c, fundamentals: "A".repeat(601) } : c));
  assert.equal(
    validateIncomingPutPayload({ expectedRevision: 0, checks: withLongText }).success,
    false,
  );
});

test("Validation: helper functions URL and date checking", () => {
  assert.equal(isValidHttpsUrl("https://example.com"), true);
  assert.equal(isValidHttpsUrl(""), true);
  assert.equal(isValidHttpsUrl("http://example.com"), false);

  assert.equal(isValidDateString(todayDate), true);
  assert.equal(isValidDateString(""), true);
  assert.equal(isValidDateString("2026-02-30"), false, "February 30th rollover date must be rejected");
  assert.equal(isValidDateString("2026-13-40"), false);
  assert.equal(isValidDateString(futureDate), false);
});

test("Timestamps: server-side normalization and change tracking", () => {
  const defaultPayload = createDefaultPresenterChecklist();
  const nowIso = new Date().toISOString();

  const { checks, history } = normalizePresenterChecklistTimestamps(
    defaultPayload.checks,
    null,
    [],
    nowIso,
  );

  assert.equal(checks.length, 13);
  assert.equal(history.length, 0);
  assert.equal(checks[0].updatedAt, "");

  // When a check is modified, server assigns nowIso
  const modifiedChecks = defaultPayload.checks.map((c, i) =>
    i === 0 ? { ...c, technical: "Upper-band break", observedOn: todayDate } : c,
  );

  const normalized = normalizePresenterChecklistTimestamps(
    modifiedChecks,
    defaultPayload.checks,
    [],
    nowIso,
  );

  assert.equal(normalized.checks[0].updatedAt, nowIso);
  assert.equal(normalized.checks[1].updatedAt, "");
});
