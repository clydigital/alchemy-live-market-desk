import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("fresh-news recruitment remains inside the existing resumable Market Belief call", () => {
  const runtime = source("../lib/intelligence/runtime.ts");
  const schema = source("../lib/intelligence/schemas.ts");

  assert.equal((runtime.match(/modelStage<MarketBeliefOutput>/g) || []).length, 1);
  assert.match(runtime, /buildFreshNewsRecruitment\(evidence, analysisAsOf\)/);
  assert.match(runtime, /freshEvidenceCandidates:/);
  assert.match(runtime, /persistRecruitmentClusters/);
  assert.match(runtime, /cluster\.verdict === "recruit"/);
  assert.match(schema, /recruitmentClusters:[\s\S]*primaryCategory:[\s\S]*materiality:[\s\S]*momentum:[\s\S]*breadth:[\s\S]*urgency:/);
  assert.match(schema, /recruitmentClusterKeys/);
});

test("current attention reaches candidates, immutable editions and the Dossier without replacing confidence", () => {
  const runtime = source("../lib/intelligence/runtime.ts");
  const edition = source("../lib/intelligence/edition.ts");
  const dossier = source("../lib/intelligence/dossier-briefing.ts");

  assert.match(runtime, /currentAttentionForHypothesis/);
  assert.match(runtime, /current_attention: candidate\.currentAttention/);
  assert.match(edition, /export type CurrentAttention/);
  assert.match(edition, /rightAttention\?\.materiality/);
  assert.match(dossier, /Current-attention fields are ordered explicitly; no opaque blended score is used/);
  assert.match(dossier, /right\.attention\.materiality[\s\S]*right\.attention\.freshness[\s\S]*right\.confidence/);
});

test("calendar-only evidence and late slot retries fail closed at their canonical boundaries", () => {
  const runtime = source("../lib/intelligence/runtime.ts");
  const replay = source("../lib/edition-replay.ts");

  assert.match(runtime, /evidenceNature: calendarItem \? \(calendarReleased \? "event_outcome" : "scheduled_event"\)/);
  assert.match(replay, /Canonical schedule identity outranks wall-clock publication time/);
  assert.match(replay, /canonicalOrderAt/);
});

test("database migration records clusters and permits exactly one base plus one composed edition", () => {
  const recruitment = source("../supabase/migrations/20260903090000_fresh_news_recruitment.sql");
  const composition = source("../supabase/migrations/20260903093000_dossier_composition_phase.sql");

  assert.match(recruitment, /create table if not exists public\.intelligence_recruitment_clusters/);
  assert.match(recruitment, /revoke all privileges[\s\S]*anon, authenticated/);
  assert.match(recruitment, /grant select, insert, update, delete[\s\S]*service_role/);
  assert.match(composition, /edition_phase in \('base', 'composed'\)/);
  assert.match(composition, /unique index if not exists hybrid_daily_brief_run_phase_unique/);
});
