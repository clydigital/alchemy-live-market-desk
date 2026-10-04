import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { Story } from "../lib/data.ts";
import type { StoryThesisVersion } from "../lib/persistence/contracts.ts";
import { selectHybridPublicationStoryStates } from "../lib/hybrid-publication.ts";

const STORY_ID = "story-rates";
const CURRENT_VERSION_ID = "11111111-1111-4111-8111-111111111111";
const NEWER_NON_CURRENT_VERSION_ID = "22222222-2222-4222-8222-222222222222";

function story(overrides: Partial<Story> = {}): Story {
  return {
    id: STORY_ID,
    slug: "rates-cost-of-capital",
    title: "Mutable current Story title",
    thesis: "Mutable current Story thesis",
    status: "develop",
    confidence: 70,
    rank: 1,
    market_question: "Are long-end yields a durable financing constraint?",
    dominant_narrative: "Rates remain restrictive.",
    best_explanation: "Higher yields raise financing costs.",
    strongest_support: "Current support",
    strongest_contradiction: "Current contradiction",
    priced_assessment: null,
    confirmation_trigger: "Yields remain elevated.",
    invalidation_trigger: "Yields fall materially.",
    next_catalyst: null,
    article_angle: null,
    provisional_title: null,
    article_verdict: "develop",
    assets: ["US10Y"],
    source_quality: 80,
    novelty: 70,
    persistence: 80,
    trader_relevance: 80,
    article_potential: 70,
    current_thesis_version_id: CURRENT_VERSION_ID,
    ...overrides,
  };
}

function version(
  id: string,
  versionNumber: number,
  thesis: string,
  confidence: number,
): StoryThesisVersion {
  return {
    id,
    story_id: STORY_ID,
    event_id: null,
    version_number: versionNumber,
    title: `Version ${versionNumber} title`,
    thesis,
    status: "develop",
    confidence,
    market_question: "Are long-end yields a durable financing constraint?",
    dominant_narrative: "Version narrative",
    best_explanation: "Version explanation",
    strongest_support: "Version support",
    strongest_contradiction: "Version contradiction",
    priced_assessment: null,
    confirmation_trigger: "Yields remain elevated.",
    invalidation_trigger: "Yields fall materially.",
    next_catalyst: null,
    article_angle: null,
    provisional_title: null,
    article_verdict: "develop",
    assets: ["US10Y"],
    portfolio_map: {},
    snapshot: {},
    change_reason: "fixture",
    effective_at: `2026-10-05T0${versionNumber}:00:00.000Z`,
    created_at: `2026-10-05T0${versionNumber}:00:00.000Z`,
    created_by: null,
  };
}

test("B4.6 authoritative current pointer wins over a newer non-current thesis row", () => {
  const result = selectHybridPublicationStoryStates({
    stories: [story()],
    records: {
      thesisVersions: [
        version(
          NEWER_NON_CURRENT_VERSION_ID,
          2,
          "Newer row that is not the authoritative current pointer.",
          88,
        ),
        version(
          CURRENT_VERSION_ID,
          1,
          "Exact current-pointer thesis returned by the canonical mutation.",
          76,
        ),
      ],
      events: [],
      intelligenceStates: [],
    },
  });

  assert.equal(result.storyStates.length, 1);
  const state = result.storyStates[0]!;
  assert.equal(state.thesisVersion?.id, CURRENT_VERSION_ID);
  assert.equal(state.thesisVersion?.version, 1);
  assert.equal(state.thesis, "Exact current-pointer thesis returned by the canonical mutation.");
  assert.equal(state.confidence, 76);
  assert.notEqual(state.thesisVersion?.id, NEWER_NON_CURRENT_VERSION_ID);
});

test("B4.6 generic selector retains legacy newest-version fallback when no pointer exists", () => {
  const result = selectHybridPublicationStoryStates({
    stories: [story({ current_thesis_version_id: null })],
    records: {
      thesisVersions: [
        version(CURRENT_VERSION_ID, 1, "Older version.", 70),
        version(NEWER_NON_CURRENT_VERSION_ID, 2, "Legacy newest fallback.", 81),
      ],
      events: [],
      intelligenceStates: [],
    },
  });

  assert.equal(result.storyStates.length, 1);
  assert.equal(result.storyStates[0]!.thesisVersion?.id, NEWER_NON_CURRENT_VERSION_ID);
  assert.equal(result.storyStates[0]!.thesis, "Legacy newest fallback.");
});

test("B4.6 canonical capture loads only exact current Story thesis pointers and fails closed", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const source = fs.readFileSync(path.join(root, "lib", "hybrid-publication.ts"), "utf8");

  const start = source.indexOf("async function exactCurrentThesisVersionsForPublication");
  const end = source.indexOf("export async function captureCanonicalPublicationStoryStates", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const exactLoader = source.slice(start, end);

  assert.match(exactLoader, /story\.current_thesis_version_id/);
  assert.match(exactLoader, /story_thesis_versions/);
  assert.match(exactLoader, /select=\*&id=in\.\(/);
  assert.match(exactLoader, /without current thesis version pointers/);
  assert.match(exactLoader, /could not load current thesis version/);
  assert.match(exactLoader, /does not belong to Story/);

  const captureStart = end;
  const captureEnd = source.indexOf("\n}", captureStart) + 2;
  const capture = source.slice(captureStart, captureEnd);
  assert.match(capture, /exactCurrentThesisVersionsForPublication\(stories, options\)/);
  assert.doesNotMatch(capture, /order=effective_at\.desc,version_number\.desc/);
});

test("B4.6 publication persistence keeps exact state version and DB-returned version equal", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const runtime = fs.readFileSync(path.join(root, "lib", "intelligence", "runtime.ts"), "utf8");
  const start = runtime.indexOf("async function persistCanonicalStoryManifest");
  const end = runtime.indexOf("export async function persistCanonicalEditionForResearchRun", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = runtime.slice(start, end);

  assert.match(section, /story_thesis_version_id: story\.thesisVersion\?\.id \|\| null/);
  assert.match(section, /stateVersionId && thesisVersionId !== stateVersionId/);
  assert.match(section, /canonicalStoryReasoning/);
  assert.match(section, /storyVersionId === thesisVersionId/);
});

test("B4.6 database publication trigger freezes reasoning from the exact current immutable version", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const migration = fs.readFileSync(
    path.join(
      root,
      "supabase",
      "migrations",
      "20260823232940_canonical_story_publication_linkage_v1.sql",
    ),
    "utf8",
  );

  assert.match(migration, /select story\.current_thesis_version_id[\s\S]*into current_version_id/);
  assert.match(
    migration,
    /new\.story_thesis_version_id is not null[\s\S]*is distinct from current_version_id[\s\S]*raise exception/,
  );
  assert.match(
    migration,
    /where version\.id = current_version_id[\s\S]*version\.story_id = new\.story_id/,
  );
  assert.match(
    migration,
    /materialise_story_reasoning_for_publication_v1\(current_version_id\)/,
  );
  assert.match(
    migration,
    /new\.payload := jsonb_set\([\s\S]*\{canonicalStoryReasoning\}[\s\S]*materialised_reasoning/,
  );
  assert.doesNotMatch(migration, /update public\.hybrid_publication_snapshots/i);
});

test("B4.6 source chain binds B4.5 result pointer to publication pointer semantics", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const runtime = fs.readFileSync(path.join(root, "lib", "intelligence", "runtime.ts"), "utf8");
  const publication = fs.readFileSync(path.join(root, "lib", "hybrid-publication.ts"), "utf8");

  assert.match(
    runtime,
    /if \(result\.story\.current_thesis_version_id !== result\.version_id\)/,
  );
  assert.match(
    publication,
    /authoritativeThesisForStory\(story, versionById, newestVersionByStory\)/,
  );
  assert.match(
    publication,
    /const pointer = story\.current_thesis_version_id\?\.trim\(\) \|\| "";/,
  );
});
