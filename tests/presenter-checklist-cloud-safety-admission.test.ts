import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

const schemaUrl = new URL("../lib/presenter-technical-checks.ts", import.meta.url);
const migrationUrl = new URL("../supabase/migrations/20261010000000_presenter_technical_checklists.sql", import.meta.url);

async function schema(t: { skip: (reason: string) => void }) {
  if (!existsSync(schemaUrl)) {
    t.skip("E1 schema not on main; gate activates when presenter cloud PR is merged");
    return null;
  }
  const modulePath = "../lib/presenter-technical-checks.ts";
  return import(modulePath);
}

function request(checks: unknown[], history: unknown[] = []): unknown {
  return { expectedRevision: 0, checks, history };
}

test("Cloud PUT requires the complete unique set of all 13 presenter monitors", async t => {
  const m = await schema(t); if (!m) return;
  const full = m.createDefaultPresenterChecklist().checks;
  assert.equal(full.length, 13);
  const valid = m.validateIncomingPutPayload(request(full));
  assert.equal(valid.success, true, "Complete default 13-key payload is accepted");
  assert.equal(m.validateIncomingPutPayload(request([])).success, false,
    "Empty array would silently erase every existing reading");
  assert.equal(m.validateIncomingPutPayload(request(full.slice(0, 12))).success, false,
    "Missing a monitor would silently erase that reading");
  const duplicate = [...full.slice(0, 12), full[0]];
  assert.equal(m.validateIncomingPutPayload(request(duplicate)).success, false,
    "Duplicate known key is not a complete distinct monitor set");
});

test("Client cannot impersonate the stored last-updated or history timestamp", async t => {
  const m = await schema(t); if (!m) return;
  const payload = m.createDefaultPresenterChecklist();
  const forged = payload.checks.map((c: Record<string, unknown>) => ({
    ...c, updatedAt: "2099-01-01T00:00:00.000Z"
  }));
  const res = m.validateIncomingPutPayload(request(forged));
  assert.ok(!res.success || res.checks.every(
    (c: { updatedAt?: string }) => c.updatedAt !== "2099-01-01T00:00:00.000Z"
  ), "An unchecked client-supplied timestamp must not become persisted proof of recent monitoring");
  const rootForged = m.validateIncomingPutPayload({
    ...request(payload.checks) as Record<string, unknown>, updatedAt: "2099-01-01T00:00:00Z"
  });
  assert.equal(rootForged.success, false, "Reject untrusted top-level updatedAt");
  const poisonedHistory = m.validateIncomingPutPayload(request(payload.checks, [{
    key: "dxy-4h", title: "<img src=x onerror=alert(1)>",
    technical: "Holding uptrend", alignment: "aligned", observedOn: "2026-10-14",
    updatedAt: "not a timestamp"
  }]));
  assert.equal(poisonedHistory.success, false,
    "History title and update time cannot be arbitrary untrusted input");
});

test("Reject impossible civil dates without JS date rollover", async t => {
  const m = await schema(t); if (!m) return;
  assert.equal(m.isValidDateString("2026-02-30"), false);
  assert.equal(m.isValidDateString("2026-04-31"), false);
  assert.equal(m.isValidDateString("2026-10-14"), true);
  const full = m.createDefaultPresenterChecklist().checks;
  assert.equal(m.validateIncomingPutPayload(request(full.map((c: Record<string,unknown>,i:number) =>
    i === 0 ? { ...c, observedOn:"2026-02-30" } : c))).success, false);
});

test("Database write privileges must not bypass all JSON safety bounds", async t => {
  if (!existsSync(migrationUrl)) {
    t.skip("E1 migration not yet merged");
    return;
  }
  const sql = readFileSync(migrationUrl, "utf8");
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /user_id\s*=\s*\(?select auth\.uid\(\)/i);
  const directAuthenticatedWrite = /grant\s+[\s\S]*?(?:insert[\s\S]*?update|update[\s\S]*?insert)[\s\S]*?to\s+authenticated/i.test(sql);
  if (directAuthenticatedWrite) {
    assert.match(sql, /(?:check\s*\(|create\s+(?:constraint|trigger))[\s\S]*?jsonb_array_length\s*\(\s*checks\s*\)/i,
      "If Data API grants direct writes, database must enforce 13-item manifest bounds beyond the Next.js route");
    assert.match(sql, /(?:octet_length|pg_column_size|length)\s*\(/i,
      "If Data API grants direct writes, bound persisted JSON size independent of the route");
  }
});
