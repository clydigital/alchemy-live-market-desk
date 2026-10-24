import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  blueDeskHostAccess, blueDeskPresentationTarget, LIVE_DESK_PRESENTATION_HOST,
} from "../lib/blue-desk-host.ts";
import { resolvePresenterPrepExactSelection } from "../lib/presenter-prep-exact-edition.ts";
import type { EditionSnapshot } from "../lib/edition-replay.ts";

const uuid = (n: number) => "00000000-0000-4000-8000-" + n.toString(16).padStart(12, "0");

function edition(n: number, supersedes: string | null = null): EditionSnapshot {
  // Separate dated morning slots are distinct publications, not retries.
  const d = new Date(Date.UTC(2026, 8, 1 + n, 1, 30));
  const published = new Date(d.getTime() + 20 * 60_000).toISOString();
  return {
    id: uuid(n), snapshot_type: "daily_brief",
    research_run_id: uuid(200 + n),
    published_at: published,
    supersedes_snapshot_id: supersedes,
    payload: {scheduleSlot:"morning", scheduledFor:d.toISOString()},
  };
}

test("P1b host path is exact private route; public and machine sibling routes remain closed", () => {
  const host = "bluebelly-desk.vercel.app";
  assert.equal(blueDeskHostAccess("/presenter/full-prep", host), "private");
  assert.equal(blueDeskPresentationTarget("/presenter/full-prep", host), "/blue-desk/presenter/full-prep");
  assert.equal(blueDeskPresentationTarget("/presenter/full-prep", LIVE_DESK_PRESENTATION_HOST), null);
  for (const path of ["/presenter/full-prep/", "/presenter/full-prep/raw",
    "/blue-desk/presenter/full-prep", "/api/owner/bluebelly/v1/overview",
    "/hybrid-output/prepare", "/api/cron/research/morning"]) {
    assert.equal(blueDeskHostAccess(path, host), "blocked", path);
  }
  for (const path of ["/login", "/auth/callback", "/auth/google"]) {
    assert.equal(blueDeskHostAccess(path, host), "public", path);
  }
});

test("exact valid edition older than 24 can be selected when direct superseder proof is available", () => {
  const full = Array.from({length: 28}, (_, i) => edition(i + 1));
  const recent = full.slice(-24).reverse();
  const archived = full[0]!;
  const result = resolvePresenterPrepExactSelection({
    recent, requestedEditionId: archived.id, exactEdition: archived,
    directSuperseders: [],
  });
  assert.equal(result.status, "historical");
  assert.equal(result.selectedSnapshot?.id, archived.id);
  assert.notEqual(result.selectedSnapshot?.id, result.current?.snapshotId);
});

test("wrong IDs, missing frozen archive and unknown superseder probe cannot fall back to current", () => {
  const a = edition(1), b = edition(2);
  const inputs = [
    {requestedEditionId: uuid(9), exactEdition: null, directSuperseders: []},
    {requestedEditionId: uuid(9), exactEdition: b, directSuperseders: []},
    {requestedEditionId: uuid(9), exactEdition: edition(9), directSuperseders: null},
    {requestedEditionId: "bad", exactEdition: a, directSuperseders: []},
    {requestedEditionId: a.id, exactEdition: a,
      directSuperseders: [{...b, supersedes_snapshot_id: uuid(500)}]},
  ];
  for (const input of inputs) {
    const result = resolvePresenterPrepExactSelection({ recent: [b, a], ...input });
    assert.equal(result.status, "invalid_fallback_current");
    assert.equal(result.selectedSnapshot, null);
    assert.equal(result.selected, null);
  }
});

test("native exact source reader preserves immutable Dossier and original editorial boundaries", () => {
  const src = readFileSync(new URL("../app/blue-desk/presenter/full-prep/page.tsx", import.meta.url), "utf8");
  const presenter = readFileSync(new URL("../app/blue-desk/presenter/page.tsx", import.meta.url), "utf8");
  const publication = readFileSync(new URL("../lib/hybrid-publication.ts", import.meta.url), "utf8");
  assert.match(src, /getHybridExactDailyBriefEdition\(requested\)/);
  assert.match(src, /getHybridDirectDailyBriefSuperseders\(requested\)/);
  assert.match(src, /getDossierV2PresentationSelectionById\(frozen\.dossierId\)/);
  assert.match(src, /dossierRead\.selectedDossierId === frozen\?\.dossierId/);
  assert.match(src, /dossierRead\.selectedAsOf === frozen\?\.dossierAsOf/);
  assert.match(src, /buildPresenterPrepSourceProjection/);
  assert.match(src, /buildPresenterPrepEditorialReadiness/);
  assert.match(src, /<PresenterPrepSession editionId=\{pinned\.editionId\} dossierId=\{pinned\.dossierId\}/);
  assert.doesNotMatch(src, /createSupabaseAdminClient|story_thesis_versions|generateContent/);
  assert.match(presenter, /redirect\("\/presenter\/full-prep\?" \+ params\.toString\(\)\)/);
  assert.match(publication, /export async function getHybridDirectDailyBriefSuperseders/);
  const api = readFileSync(new URL("../app/api/owner/editorial-generate/route.ts", import.meta.url), "utf8");
  assert.match(api, /blueDeskHostAccess/);
  assert.match(api, /req\.headers\.get\("origin"\)/);
});
