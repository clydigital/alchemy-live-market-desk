import assert from "node:assert/strict";
import test from "node:test";

import {
  ALCHEMY_REPORT_V1_BASELINE_EDITION_ID,
  ALCHEMY_REPORT_V1_GRANDFATHERED_THESIS_VERSION_IDS,
  annotateAlchemyReportHtml,
  prepareAlchemyReportSource,
} from "../lib/report-era.ts";
import { ReportComposerError } from "../lib/report-composer.ts";

const BASELINE = ALCHEMY_REPORT_V1_BASELINE_EDITION_ID;
const GRANDFATHERED_VERSION = ALCHEMY_REPORT_V1_GRANDFATHERED_THESIS_VERSION_IDS[0];

function storyEntry(position: number, storyId: string, snapshotId: string, versionId: string, reasoning: unknown) {
  const state = {
    id: storyId,
    title: `${storyId} immutable title`,
    featuredRank: position,
    thesisVersion: {
      id: versionId,
      version: position,
      effectiveAt: "2026-08-24T09:30:47.000Z",
    },
  };
  return {
    manifest: { position, storyId, snapshotId, state },
    snapshot: {
      id: snapshotId,
      story_id: storyId,
      story_thesis_version_id: versionId,
      snapshot_type: "story",
      payload: {
        canonicalStoryState: structuredClone(state),
        canonicalStoryReasoning: reasoning,
      },
    },
  };
}

function v1Reasoning(storyId: string, versionId: string) {
  return {
    contractVersion: "canonical-story-reasoning/v1",
    storyId,
    storyVersionId: versionId,
  };
}

function sourceFixture({
  selectedEditionId = BASELINE,
  includeLegacy = true,
  legacyVersionId = GRANDFATHERED_VERSION,
}: {
  selectedEditionId?: string;
  includeLegacy?: boolean;
  legacyVersionId?: string;
} = {}) {
  const v1 = storyEntry(2, "story-v1", "snapshot-v1", "version-v1", v1Reasoning("story-v1", "version-v1"));
  const legacy = storyEntry(1, "story-legacy", "snapshot-legacy", legacyVersionId, null);
  const manifest = includeLegacy ? [v1.manifest, legacy.manifest] : [{ ...v1.manifest, position: 1 }];
  const latestSnapshots = includeLegacy ? [v1.snapshot, legacy.snapshot] : [v1.snapshot];
  const newer = selectedEditionId === BASELINE ? [] : [{ snapshotId: selectedEditionId }];
  return {
    edition: {
      snapshotId: selectedEditionId,
      payload: { canonicalStoryManifest: manifest },
    },
    publication: {
      editionIndex: [
        ...newer,
        { snapshotId: BASELINE },
        { snapshotId: "edition-before-baseline" },
      ],
      latestSnapshots,
    },
    canonical: {
      storyStates: [
        { id: "current-state-must-not-be-used", title: "CURRENT STATE MUST NOT BE USED" },
      ],
    },
    stories: [{ title: "LEGACY CURRENT STORY FALLBACK MUST NOT BE USED" }],
  };
}

test("baseline mixed edition keeps only V1-native Stories and reports explicit legacy exclusion", () => {
  const source = sourceFixture();
  const before = structuredClone(source);
  const prepared = prepareAlchemyReportSource(source) as {
    source: any;
    diagnostics: {
      v1StoryCount: number;
      legacyExcludedCount: number;
      legacyExcludedThesisVersionIds: string[];
    };
  };

  assert.deepEqual(source, before, "report cutover must not mutate canonical transport/history");
  assert.equal(prepared.diagnostics.v1StoryCount, 1);
  assert.equal(prepared.diagnostics.legacyExcludedCount, 1);
  assert.deepEqual(prepared.diagnostics.legacyExcludedThesisVersionIds, [GRANDFATHERED_VERSION]);
  assert.equal(prepared.source.edition.payload.canonicalStoryManifest.length, 1);
  assert.equal(prepared.source.edition.payload.canonicalStoryManifest[0].storyId, "story-v1");
  assert.equal(prepared.source.edition.payload.canonicalStoryManifest[0].position, 1);
  assert.doesNotMatch(JSON.stringify(prepared.source.edition.payload.canonicalStoryManifest), /CURRENT STATE MUST NOT BE USED|FALLBACK MUST NOT BE USED/);
});

test("a later edition may carry the exact grandfathered legacy thesis version without blocking the V1 report", () => {
  const prepared = prepareAlchemyReportSource(sourceFixture({ selectedEditionId: "edition-after-baseline" })) as {
    source: any;
    diagnostics: { v1StoryCount: number; legacyExcludedCount: number };
  };
  assert.equal(prepared.diagnostics.v1StoryCount, 1);
  assert.equal(prepared.diagnostics.legacyExcludedCount, 1);
  assert.deepEqual(
    prepared.source.edition.payload.canonicalStoryManifest.map((entry: any) => entry.storyId),
    ["story-v1"],
  );
});

test("a new thesis version without V1 fails closed instead of inheriting grandfather status from the Story", () => {
  const source = sourceFixture({
    selectedEditionId: "edition-after-baseline",
    legacyVersionId: "new-post-baseline-version-without-v1",
  });
  assert.throws(
    () => prepareAlchemyReportSource(source),
    (error) => error instanceof ReportComposerError
      && /post-baseline or unrecognised legacy state without canonical-story-reasoning\/v1/i.test(error.message),
  );
});

test("a post-baseline all-V1 edition passes with zero legacy exclusions", () => {
  const source = sourceFixture({ selectedEditionId: "edition-after-baseline", includeLegacy: false });
  const prepared = prepareAlchemyReportSource(source);
  assert.equal(prepared.diagnostics.v1StoryCount, 1);
  assert.equal(prepared.diagnostics.legacyExcludedCount, 0);
});

test("editions older than the V1 baseline remain canonical replay only and are not retroactively report-enriched", () => {
  const source = sourceFixture({ selectedEditionId: "edition-before-baseline", includeLegacy: false });
  source.publication.editionIndex = [
    { snapshotId: BASELINE },
    { snapshotId: "edition-before-baseline" },
  ];
  assert.throws(
    () => prepareAlchemyReportSource(source),
    (error) => error instanceof ReportComposerError && /predates the Canonical Story Reasoning V1 report baseline/i.test(error.message),
  );
});

test("grandfather filtering still requires exact immutable Story and thesis-version linkage", () => {
  const source = sourceFixture();
  source.publication.latestSnapshots[1]!.story_thesis_version_id = "different-version";
  assert.throws(
    () => prepareAlchemyReportSource(source),
    (error) => error instanceof ReportComposerError && /thesis version linkage mismatch/i.test(error.message),
  );
});

test("report-era preparation and provenance annotation are deterministic", () => {
  const source = sourceFixture();
  const first = prepareAlchemyReportSource(source);
  const second = prepareAlchemyReportSource(source);
  assert.deepEqual(first, second);

  const html = '<!doctype html><html><head><title>Report</title></head><body><main class="report"></main></body></html>';
  const annotatedFirst = annotateAlchemyReportHtml(html, first.diagnostics);
  const annotatedSecond = annotateAlchemyReportHtml(html, second.diagnostics);
  assert.equal(annotatedFirst, annotatedSecond);
  assert.match(annotatedFirst, /alchemy-report-v1-baseline-edition/);
  assert.match(annotatedFirst, /data-v1-story-count="1"/);
  assert.match(annotatedFirst, /data-legacy-excluded-count="1"/);
  assert.match(annotatedFirst, new RegExp(GRANDFATHERED_VERSION));
});
