import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20260906140500_guard_legacy_hybrid_snapshot_trigger.sql",
  import.meta.url,
);
const sql = readFileSync(migrationPath, "utf8");

function position(fragment: string) {
  const index = sql.indexOf(fragment);
  assert.notEqual(index, -1, `Expected migration to contain: ${fragment}`);
  return index;
}

test("legacy completion trigger stands down when the run already owns a canonical daily brief", () => {
  const existenceCheck = position("where research_run_id = new.id\n      and snapshot_type = 'daily_brief'");
  const guard = position("if canonical_edition_exists then");
  const guardReturn = position("return new;\n  end if;\n\n  -- Legacy fallback only");
  const legacyStoryInsert = position("research_run_id,slot_run_id,story_id,story_thesis_version_id,snapshot_type");

  assert.ok(existenceCheck < guard);
  assert.ok(guard < guardReturn);
  assert.ok(guardReturn < legacyStoryInsert, "Canonical edition guard must return before legacy Story snapshots can be inserted.");
});

test("canonical guard preserves handoff bookkeeping without publishing a second state surface", () => {
  const guardStart = position("if canonical_edition_exists then");
  const guardEnd = position("return new;\n  end if;\n\n  -- Legacy fallback only");
  const guardedBlock = sql.slice(guardStart, guardEnd);

  assert.match(guardedBlock, /hybrid_handoff_status\s*=\s*'complete'/);
  assert.match(guardedBlock, /hybrid_snapshots_sent\s*=\s*\(/);
  assert.doesNotMatch(guardedBlock, /insert\s+into\s+public\.hybrid_publication_snapshots/i);
});

test("legacy fallback remains explicit and cannot masquerade as exact canonical replay", () => {
  const fallbackStart = position("-- Legacy fallback only");
  const fallback = sql.slice(fallbackStart);

  assert.match(fallback, /'replayStatus','legacy_unproven'/);
  assert.match(fallback, /snapshot_type,public_summary,payload,confidence,published_at/);
  assert.doesNotMatch(sql, /drop\s+trigger\s+if\s+exists\s+research_runs_publish_hybrid_snapshot/i);
});
