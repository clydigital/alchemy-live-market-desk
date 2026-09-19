import { CANONICAL_STORY_REASONING_V1 } from "./intelligence/story-reasoning.ts";
import { ReportComposerError } from "./report-composer.ts";

export const ALCHEMY_REPORT_V1_BASELINE_EDITION_ID = "924b8099-91aa-4d4e-b8f8-9b076331aa5f" as const;

/**
 * Exact immutable thesis versions carried into the V1 baseline edition without
 * Canonical Story Reasoning V1. They remain canonical history and Live memory,
 * but are not report-native until a later thesis version is persisted with V1.
 *
 * Grandfathering the thesis-version identity (not Story or snapshot identity)
 * is deliberate: unchanged Stories may be republished under a new snapshot ID,
 * while a genuine Story revision receives a new thesis-version ID and must then
 * satisfy the V1 report contract instead of being silently excluded.
 */
export const ALCHEMY_REPORT_V1_GRANDFATHERED_THESIS_VERSION_IDS = [
  "d412350d-5943-4ffc-b662-0b99bd9353f0",
  "6cbaf716-27fd-4fc0-b7da-f217cb334cc6",
  "03213824-c68f-4225-ad46-3e9f8e3632a8",
  "affda833-b468-41e0-8ef1-6bc944510b8d",
  "cfa8c7f9-aeb9-4503-a687-032348a0e8d3",
  "5948c0dc-7c0e-4235-afdf-90c931bd3afa",
  "bda8378d-86bf-421c-ad9a-88fa7373d594",
  "09d7b9f7-dade-4778-92dd-b1d6c091c149",
] as const;

const GRANDFATHERED_VERSION_IDS = new Set<string>(ALCHEMY_REPORT_V1_GRANDFATHERED_THESIS_VERSION_IDS);

type JsonRecord = Record<string, unknown>;

export type AlchemyReportEraDiagnostics = {
  contractVersion: typeof CANONICAL_STORY_REASONING_V1;
  baselineEditionId: typeof ALCHEMY_REPORT_V1_BASELINE_EDITION_ID;
  selectedEditionId: string;
  v1StoryCount: number;
  legacyExcludedCount: number;
  legacyExcludedThesisVersionIds: string[];
};

function fail(message: string): never {
  throw new ReportComposerError(message);
}

function record(value: unknown, path: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${path} must be an object.`);
  return value as JsonRecord;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(`${path} must be an array.`);
  return value;
}

function string(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) fail(`${path} must be a non-empty string.`);
  return value;
}

function integer(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) fail(`${path} must be an integer.`);
  return value;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const item = value as JsonRecord;
    return `{${Object.keys(item).sort().map((key) => `${JSON.stringify(key)}:${stableJson(item[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function escapeAttribute(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Prepare only the report transport. This never mutates canonical persistence,
 * current Story state, historical editions, dedupe state, or Live reasoning.
 *
 * Editions before the V1 baseline are intentionally not report-composed. The
 * baseline and later editions may carry the exact eight grandfathered pre-V1
 * thesis versions; those versions are excluded from the report until a genuine
 * revision creates a V1-bearing thesis version. Any other non-V1 version fails
 * closed and is surfaced by /api/report as HTTP 409.
 */
export function prepareAlchemyReportSource(source: unknown): {
  source: unknown;
  diagnostics: AlchemyReportEraDiagnostics;
} {
  const root = record(source, "source");
  const edition = record(root.edition, "source.edition");
  const publication = record(root.publication, "source.publication");
  const selectedEditionId = string(edition.snapshotId, "source.edition.snapshotId");

  const editionIndex = array(publication.editionIndex, "source.publication.editionIndex")
    .map((entry, index) => record(entry, `source.publication.editionIndex[${index}]`));
  const editionIds = editionIndex.map((entry, index) => string(entry.snapshotId, `source.publication.editionIndex[${index}].snapshotId`));
  if (new Set(editionIds).size !== editionIds.length) fail("source.publication.editionIndex contains duplicate snapshot IDs.");

  const baselineIndex = editionIds.indexOf(ALCHEMY_REPORT_V1_BASELINE_EDITION_ID);
  if (baselineIndex < 0) fail("Canonical publication index does not contain the V1 report baseline edition.");
  const selectedIndex = editionIds.indexOf(selectedEditionId);
  if (selectedIndex < 0) fail("Selected edition is not present in the canonical publication index.");
  if (selectedIndex > baselineIndex) {
    fail("Selected edition predates the Canonical Story Reasoning V1 report baseline; use immutable canonical replay instead of report composition.");
  }

  const payload = record(edition.payload, "source.edition.payload");
  const manifest = array(payload.canonicalStoryManifest, "source.edition.payload.canonicalStoryManifest");
  if (!manifest.length) fail("The selected edition has no canonical Story manifest.");

  const snapshots = array(publication.latestSnapshots, "source.publication.latestSnapshots")
    .map((snapshot, index) => record(snapshot, `source.publication.latestSnapshots[${index}]`));
  const snapshotById = new Map(snapshots.map((snapshot, index) => [
    string(snapshot.id, `source.publication.latestSnapshots[${index}].id`),
    snapshot,
  ]));

  const ordered = manifest.map((entry, index) => {
    const path = `source.edition.payload.canonicalStoryManifest[${index}]`;
    const item = record(entry, path);
    const position = integer(item.position, `${path}.position`);
    if (position < 1) fail(`${path}.position must be positive.`);
    return { item, path, position };
  }).sort((left, right) => left.position - right.position);
  ordered.forEach((entry, index) => {
    if (entry.position !== index + 1) fail("Canonical Story manifest positions must be unique and contiguous from 1 before report filtering.");
  });

  const legacyExcludedThesisVersionIds: string[] = [];
  const retained = ordered.flatMap(({ item, path, position }) => {
    const storyId = string(item.storyId, `${path}.storyId`);
    const publicationSnapshotId = string(item.snapshotId, `${path}.snapshotId`);
    const state = record(item.state, `${path}.state`);
    if (string(state.id, `${path}.state.id`) !== storyId) fail(`${path}.state.id does not match storyId.`);

    const snapshot = snapshotById.get(publicationSnapshotId);
    if (!snapshot) fail(`${path}.snapshotId is not present in the canonical publication snapshots.`);
    if (snapshot.snapshot_type !== "story") fail(`${path}.snapshotId does not identify a Story publication snapshot.`);
    if (string(snapshot.story_id, `Story snapshot ${publicationSnapshotId}.story_id`) !== storyId) {
      fail(`${path} Story ID does not match its publication snapshot.`);
    }

    const thesisVersionId = string(snapshot.story_thesis_version_id, `Story snapshot ${publicationSnapshotId}.story_thesis_version_id`);
    const thesisVersion = record(state.thesisVersion, `${path}.state.thesisVersion`);
    if (string(thesisVersion.id, `${path}.state.thesisVersion.id`) !== thesisVersionId) fail(`${path} thesis version linkage mismatch.`);

    const snapshotPayload = record(snapshot.payload, `Story snapshot ${publicationSnapshotId}.payload`);
    const snapshotState = record(snapshotPayload.canonicalStoryState, `Story snapshot ${publicationSnapshotId}.payload.canonicalStoryState`);
    if (stableJson(snapshotState) !== stableJson(state)) fail(`${path}.state is not the exact immutable Story publication state.`);

    const reasoning = snapshotPayload.canonicalStoryReasoning;
    if (reasoning === null || reasoning === undefined) {
      if (!GRANDFATHERED_VERSION_IDS.has(thesisVersionId)) {
        fail(`Story thesis version ${thesisVersionId} is post-baseline or unrecognised legacy state without ${CANONICAL_STORY_REASONING_V1}.`);
      }
      legacyExcludedThesisVersionIds.push(thesisVersionId);
      return [];
    }

    const reasoningRecord = record(reasoning, `Story snapshot ${publicationSnapshotId}.payload.canonicalStoryReasoning`);
    if (reasoningRecord.contractVersion !== CANONICAL_STORY_REASONING_V1) {
      fail(`Story thesis version ${thesisVersionId} does not use ${CANONICAL_STORY_REASONING_V1}.`);
    }
    return [{ item, canonicalPosition: position }];
  });

  if (!retained.length) fail("The selected edition has no V1-native Story versions available for report composition.");

  const cloned = structuredClone(source) as JsonRecord;
  const clonedEdition = record(cloned.edition, "source.edition");
  const clonedPayload = record(clonedEdition.payload, "source.edition.payload");
  clonedPayload.canonicalStoryManifest = retained.map(({ item }, index) => ({
    ...structuredClone(item),
    position: index + 1,
  }));

  return {
    source: cloned,
    diagnostics: {
      contractVersion: CANONICAL_STORY_REASONING_V1,
      baselineEditionId: ALCHEMY_REPORT_V1_BASELINE_EDITION_ID,
      selectedEditionId,
      v1StoryCount: retained.length,
      legacyExcludedCount: legacyExcludedThesisVersionIds.length,
      legacyExcludedThesisVersionIds,
    },
  };
}

/** Add report-era provenance without changing canonical analytical content. */
export function annotateAlchemyReportHtml(html: string, diagnostics: AlchemyReportEraDiagnostics) {
  const excluded = diagnostics.legacyExcludedThesisVersionIds.join(",");
  const meta = [
    `<meta name="alchemy-report-reasoning-contract" content="${escapeAttribute(diagnostics.contractVersion)}">`,
    `<meta name="alchemy-report-v1-baseline-edition" content="${escapeAttribute(diagnostics.baselineEditionId)}">`,
    `<meta name="alchemy-report-v1-story-count" content="${escapeAttribute(diagnostics.v1StoryCount)}">`,
    `<meta name="alchemy-report-legacy-excluded-count" content="${escapeAttribute(diagnostics.legacyExcludedCount)}">`,
    `<meta name="alchemy-report-legacy-excluded-thesis-versions" content="${escapeAttribute(excluded)}">`,
  ].join("");
  const withMeta = html.replace("<title>", `${meta}<title>`);
  return withMeta.replace(
    '<main class="report"',
    `<main class="report" data-report-reasoning-contract="${escapeAttribute(diagnostics.contractVersion)}" data-report-v1-baseline-edition="${escapeAttribute(diagnostics.baselineEditionId)}" data-v1-story-count="${escapeAttribute(diagnostics.v1StoryCount)}" data-legacy-excluded-count="${escapeAttribute(diagnostics.legacyExcludedCount)}"`,
  );
}
