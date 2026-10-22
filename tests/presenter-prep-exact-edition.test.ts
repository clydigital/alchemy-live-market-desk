import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolvePresenterPrepExactSelection } from "../lib/presenter-prep-exact-edition.ts";
import type { EditionSnapshot } from "../lib/edition-replay.ts";

const id = (i: number) => "00000000-0000-4000-8000-" + String(i).padStart(12, "0");
function brief(i: number): EditionSnapshot {
  const day = String(i + 1).padStart(2, "0");
  const time = "2026-09-" + day + "T09:00:00Z";
  return {
    id: id(i), snapshot_type: "daily_brief", research_run_id: null,
    supersedes_snapshot_id: null, published_at: time,
    payload: { scheduleSlot: "morning", scheduledFor: time },
  };
}
const archive = Array.from({ length: 30 }, (_, i) => brief(29 - i));
const recent = archive.slice(0, 24);

test("recent selection stays bounded and current when no edition is specified", () => {
  const result = resolvePresenterPrepExactSelection({
    recent, requestedEditionId: null, exactEdition: null, directSuperseders: null,
  });
  assert.equal(result.status, "current");
  assert.equal(result.current?.snapshotId, id(29));
  assert.equal(result.selectedSnapshot?.id, id(29));
});

test("an immutable archived edition beyond the last 24 resolves by exact UUID, without latest fallback", () => {
  const old = archive[29]!;
  assert.ok(!recent.some(row => row.id === old.id));
  const result = resolvePresenterPrepExactSelection({
    recent, requestedEditionId: old.id, exactEdition: old, directSuperseders: [],
  });
  assert.equal(result.status, "historical");
  assert.equal(result.selected?.snapshotId, old.id);
  assert.equal(result.selectedSnapshot?.payload, old.payload);
  assert.equal(result.current?.snapshotId, id(29));
});

test("missing, malformed, mismatched or unverified successor reads fail closed", () => {
  for (const input of [
    { requestedEditionId: id(0), exactEdition: null, directSuperseders: [] },
    { requestedEditionId: "invalid-uuid", exactEdition: brief(0), directSuperseders: [] },
    { requestedEditionId: id(0), exactEdition: brief(1), directSuperseders: [] },
    { requestedEditionId: id(0), exactEdition: brief(0), directSuperseders: null },
  ]) {
    const result = resolvePresenterPrepExactSelection({ recent, ...input });
    assert.equal(result.status, "invalid_fallback_current");
    assert.equal(result.selected, null);
    assert.equal(result.selectedSnapshot, null);
    assert.equal(result.current?.snapshotId, id(29));
  }
});

test("same-slot retry outside latest-24 selector cannot revive a superseded old edition", () => {
  const old = brief(0);
  const newer = {
    ...brief(2), supersedes_snapshot_id: old.id,
    payload: { scheduleSlot: "morning", scheduledFor: "2026-09-01T09:01:00Z" },
  };
  const result = resolvePresenterPrepExactSelection({
    recent, requestedEditionId: old.id, exactEdition: old, directSuperseders: [newer],
  });
  assert.equal(result.status, "invalid_fallback_current");
  assert.equal(result.selectedSnapshot, null);
});

test("cross-slot supersession still preserves separately published exact morning editions", () => {
  const old = brief(0);
  const later = {
    ...brief(2), supersedes_snapshot_id: old.id,
    payload: { scheduleSlot: "evening", scheduledFor: "2026-09-01T19:00:00Z" },
  };
  const result = resolvePresenterPrepExactSelection({
    recent, requestedEditionId: old.id, exactEdition: old, directSuperseders: [later],
  });
  assert.equal(result.status, "historical");
  assert.equal(result.selectedSnapshot?.id, old.id);
});

test("the Presenter page uses server-side read-only exact archive and successor probes", () => {
  const page = readFileSync(new URL("../app/hybrid-output/prepare/page.tsx", import.meta.url), "utf8");
  const publication = readFileSync(new URL("../lib/hybrid-publication.ts", import.meta.url), "utf8");
  assert.match(page, /getHybridExactDailyBriefEdition\(validExactId\)/);
  assert.match(page, /getHybridDirectDailyBriefSuperseders\(validExactId\)/);
  assert.match(page, /resolvePresenterPrepExactSelection/);
  assert.match(page, /selectedSnapshot = selection\.selectedSnapshot/);
  assert.match(publication, /export async function getHybridDirectDailyBriefSuperseders/);
  assert.match(publication, /supersedes_snapshot_id=eq\./);
  assert.match(publication, /limit=25/);
  assert.match(publication, /rows\.length >= 25/);
  assert.match(publication, /headers: \{ apikey: serverKey, Authorization: "Bearer " \+ serverKey \}/);
  assert.match(publication, /limit=24/);
});
