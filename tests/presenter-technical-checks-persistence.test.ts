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
  const validCheck = {
    key: "dxy-4h",
    technical: "Holding uptrend",
    lastBreak: "UPPER",
    observedOn: "2026-10-09",
    fundamentals: "Yields rising on robust labor data",
    alignment: "aligned",
    evidenceUrl: "https://example.com/chart",
    notes: "Watch 105.20 resistance level",
    updatedAt: "2026-10-09T10:00:00Z",
  };

  const validPayload = {
    expectedRevision: 1,
    checks: createDefaultPresenterChecklist().checks.map((check) => check.key === "dxy-4h"
      ? { ...check, ...validCheck, updatedAt: "" } : check),
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
    validateIncomingPutPayload({ expectedRevision: -1, checks: [] }).success,
    false,
  );
  assert.equal(
    validateIncomingPutPayload({ expectedRevision: "1", checks: [] }).success,
    false,
  );

  // Reject userId direct input
  assert.equal(
    validateIncomingPutPayload({ expectedRevision: 0, userId: "some-id", checks: [] }).success,
    false,
  );
  assert.equal(
    validateIncomingPutPayload({ expectedRevision: 0, user_id: "some-id", checks: [] }).success,
    false,
  );

  // Reject unknown monitor key
  assert.equal(
    validateIncomingPutPayload({
      expectedRevision: 0,
      checks: validPayload.checks.map((c) => c.key === "dxy-4h" ? { ...c, key: "unknown-coin-key" } : c),
    }).success,
    false,
  );

  // Reject duplicate key
  assert.equal(
    validateIncomingPutPayload({
      expectedRevision: 0,
      checks: [validCheck, validCheck],
    }).success,
    false,
  );

  // Reject >13 items
  const tooMany = Array.from({ length: 14 }, () => validCheck);
  assert.equal(
    validateIncomingPutPayload({ expectedRevision: 0, checks: tooMany }).success,
    false,
  );

  // Reject invalid technical status
  assert.equal(
    validateIncomingPutPayload({
      expectedRevision: 0,
      checks: [{ ...validCheck, technical: "To The Moon!" }],
    }).success,
    false,
  );

  // Reject invalid lastBreak
  assert.equal(
    validateIncomingPutPayload({
      expectedRevision: 0,
      checks: [{ ...validCheck, lastBreak: "SIDEWAYS" }],
    }).success,
    false,
  );

  // Reject invalid alignment
  assert.equal(
    validateIncomingPutPayload({
      expectedRevision: 0,
      checks: [{ ...validCheck, alignment: "bullish" }],
    }).success,
    false,
  );

  // Reject invalid date (future or malformed)
  assert.equal(
    validateIncomingPutPayload({
      expectedRevision: 0,
      checks: [{ ...validCheck, observedOn: "2099-12-31" }],
    }).success,
    false,
  );
  assert.equal(
    validateIncomingPutPayload({
      expectedRevision: 0,
      checks: [{ ...validCheck, observedOn: "October 9th" }],
    }).success,
    false,
  );

  // Reject non-https URL
  assert.equal(
    validateIncomingPutPayload({
      expectedRevision: 0,
      checks: [{ ...validCheck, evidenceUrl: "http://insecure-site.com" }],
    }).success,
    false,
  );
  assert.equal(
    validateIncomingPutPayload({
      expectedRevision: 0,
      checks: [{ ...validCheck, evidenceUrl: "javascript:alert(1)" }],
    }).success,
    false,
  );

  // Reject HTML / script injection in fundamentals or notes
  assert.equal(
    validateIncomingPutPayload({
      expectedRevision: 0,
      checks: [{ ...validCheck, fundamentals: "<script>alert('xss')</script>" }],
    }).success,
    false,
  );
  assert.equal(
    validateIncomingPutPayload({
      expectedRevision: 0,
      checks: [{ ...validCheck, notes: "<img src=x onerror=alert(1)>" }],
    }).success,
    false,
  );

  // Enforce max text lengths
  assert.equal(
    validateIncomingPutPayload({
      expectedRevision: 0,
      checks: [{ ...validCheck, fundamentals: "A".repeat(601) }],
    }).success,
    false,
  );
  assert.equal(
    validateIncomingPutPayload({
      expectedRevision: 0,
      checks: [{ ...validCheck, notes: "B".repeat(701) }],
    }).success,
    false,
  );
});

test("Validation: helper functions URL and date checking", () => {
  assert.equal(isValidHttpsUrl("https://example.com"), true);
  assert.equal(isValidHttpsUrl(""), true);
  assert.equal(isValidHttpsUrl("http://example.com"), false);
  assert.equal(isValidHttpsUrl("ftp://example.com"), false);

  assert.equal(isValidDateString("2026-10-09"), true);
  assert.equal(isValidDateString(""), true);
  assert.equal(isValidDateString("2026-13-40"), false);
  assert.equal(isValidDateString("2099-01-01"), false);
});
