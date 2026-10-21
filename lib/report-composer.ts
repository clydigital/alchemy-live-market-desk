import {
  CANONICAL_STORY_REASONING_V1,
  type CanonicalStoryReasoningV1,
  type VisualPlanV1,
} from "./intelligence/story-reasoning.ts";

export const ALCHEMY_REPORT_COMPOSER_V1 = "alchemy-report-composer/v1" as const;

export class ReportComposerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportComposerError";
  }
}

type JsonRecord = Record<string, unknown>;

type ReportStory = {
  position: number;
  publicationSnapshotId: string;
  reasoning: CanonicalStoryReasoningV1;
};

type ReportModel = {
  editionSnapshotId: string;
  generatedAt: string;
  summary: string | null;
  regime: string | null;
  caveats: string[];
  stories: ReportStory[];
};

function fail(message: string): never {
  throw new ReportComposerError(message);
}

function record(value: unknown, path: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${path} must be an object.`);
  return value as JsonRecord;
}

function has(value: JsonRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function string(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) fail(`${path} must be a non-empty string.`);
  return value;
}

function nullableString(value: JsonRecord, key: string, path: string): string | null {
  if (!has(value, key)) fail(`${path}.${key} is required.`);
  const item = value[key];
  if (item !== null && typeof item !== "string") fail(`${path}.${key} must be a string or null.`);
  return item as string | null;
}

function number(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`${path} must be a finite number.`);
  return value;
}

function integer(value: unknown, path: string): number {
  const item = number(value, path);
  if (!Number.isInteger(item)) fail(`${path} must be an integer.`);
  return item;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(`${path} must be an array.`);
  return value;
}

function stringArray(value: unknown, path: string): string[] {
  return array(value, path).map((item, index) => string(item, `${path}[${index}]`));
}

function optionalString(value: unknown, path: string): string | null {
  if (value === undefined || value === null) return null;
  return string(value, path);
}

function enumString(value: unknown, allowed: readonly string[], path: string) {
  const item = string(value, path);
  if (!allowed.includes(item)) fail(`${path} is not canonical.`);
  return item;
}

function requireUnique(values: string[], path: string) {
  if (new Set(values).size !== values.length) fail(`${path} contains duplicate identifiers.`);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const item = value as JsonRecord;
    return `{${Object.keys(item).sort().map((key) => `${JSON.stringify(key)}:${stableJson(item[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function validateClaim(value: unknown, path: string) {
  const item = record(value, path);
  enumString(item.type, ["fact", "interpretation", "thesis", "speculation"], `${path}.type`);
  string(item.id, `${path}.id`);
  string(item.text, `${path}.text`);
  stringArray(item.evidenceIds, `${path}.evidenceIds`);
}

function validateEdge(value: unknown, path: string) {
  const item = record(value, path);
  enumString(item.evidenceState, ["observed", "strongly_supported", "inferred", "speculative"], `${path}.evidenceState`);
  for (const key of ["id", "sourceHypothesisId", "from", "relationship", "to"] as const) {
    string(item[key], `${path}.${key}`);
  }
  stringArray(item.evidenceIds, `${path}.evidenceIds`);
}

function validateSeries(value: unknown, path: string) {
  const item = record(value, path);
  string(item.seriesId, `${path}.seriesId`);
  string(item.label, `${path}.label`);
  enumString(item.transform, ["level", "change", "yoy", "mom", "return", "spread", "indexed"], `${path}.transform`);
  enumString(item.role, ["driver", "asset", "benchmark", "observed", "expected", "spread"], `${path}.role`);
  nullableString(item, "geography", path);
}

function validateEntity(value: unknown, path: string) {
  const item = record(value, path);
  string(item.entityId, `${path}.entityId`);
  string(item.label, `${path}.label`);
  stringArray(item.evidenceIds, `${path}.evidenceIds`);
  const geography = record(item.geography, `${path}.geography`);
  const kind = string(geography.kind, `${path}.geography.kind`);
  if (kind === "country") string(geography.countryCode, `${path}.geography.countryCode`);
  else if (kind === "coordinate") {
    number(geography.lat, `${path}.geography.lat`);
    number(geography.lon, `${path}.geography.lon`);
  } else fail(`${path}.geography.kind is not canonical.`);
}

function validateVisualPlan(value: unknown, path: string) {
  const item = record(value, path);
  string(item.id, `${path}.id`);
  string(item.title, `${path}.title`);
  const type = string(item.type, `${path}.type`);
  if (type === "linear_chain") stringArray(item.edgeIds, `${path}.edgeIds`);
  else if (type === "feedback_loop") {
    stringArray(item.edgeIds, `${path}.edgeIds`);
    string(item.loopClosureEdgeId, `${path}.loopClosureEdgeId`);
  } else if (type === "money_or_commodity_flow") {
    stringArray(item.edgeIds, `${path}.edgeIds`);
    array(item.entities, `${path}.entities`).forEach((entity, index) => validateEntity(entity, `${path}.entities[${index}]`));
    string(item.flowLabel, `${path}.flowLabel`);
  } else if (type === "entity_map") {
    array(item.entities, `${path}.entities`).forEach((entity, index) => validateEntity(entity, `${path}.entities[${index}]`));
    stringArray(item.connectionEdgeIds, `${path}.connectionEdgeIds`);
  } else if (type === "divergence_chart") {
    array(item.series, `${path}.series`).forEach((series, index) => validateSeries(series, `${path}.series[${index}]`));
    enumString(item.expectedRelationship, ["positive", "inverse", "divergent", "none_asserted"], `${path}.expectedRelationship`);
    stringArray(item.evidenceIds, `${path}.evidenceIds`);
    const window = record(item.window, `${path}.window`);
    nullableString(window, "start", `${path}.window`);
    nullableString(window, "end", `${path}.window`);
    if (!has(window, "observations")) fail(`${path}.window.observations is required.`);
    if (window.observations !== null) integer(window.observations, `${path}.window.observations`);
  } else if (type === "before_after") {
    stringArray(item.beforeClaimIds, `${path}.beforeClaimIds`);
    stringArray(item.afterClaimIds, `${path}.afterClaimIds`);
    stringArray(item.changeEvidenceIds, `${path}.changeEvidenceIds`);
    array(item.series, `${path}.series`).forEach((series, index) => validateSeries(series, `${path}.series[${index}]`));
  } else if (type === "decision_tree") {
    string(item.rootClaimId, `${path}.rootClaimId`);
    array(item.branches, `${path}.branches`).forEach((branch, index) => {
      const branchItem = record(branch, `${path}.branches[${index}]`);
      const condition = record(branchItem.conditionRef, `${path}.branches[${index}].conditionRef`);
      const kind = string(condition.kind, `${path}.branches[${index}].conditionRef.kind`);
      if (kind === "confirmation" || kind === "invalidation") integer(condition.index, `${path}.branches[${index}].conditionRef.index`);
      else if (kind !== "next_test") fail(`${path}.branches[${index}].conditionRef.kind is not canonical.`);
      stringArray(branchItem.outcomeClaimIds, `${path}.branches[${index}].outcomeClaimIds`);
    });
  } else fail(`${path}.type is not a Canonical Story Reasoning V1 visual type.`);
}

function validateReasoning(value: unknown, path: string): CanonicalStoryReasoningV1 {
  const item = record(value, path);
  if (item.contractVersion !== CANONICAL_STORY_REASONING_V1) fail(`${path}.contractVersion must be ${CANONICAL_STORY_REASONING_V1}.`);
  for (const key of ["storyId", "storyVersionId", "title", "thesis"] as const) string(item[key], `${path}.${key}`);
  enumString(item.lifecycle, ["detected", "developing", "confirmed", "weakening", "invalidated", "archived"], `${path}.lifecycle`);
  integer(item.versionNumber, `${path}.versionNumber`);
  string(item.effectiveAt, `${path}.effectiveAt`);
  nullableString(item, "centralQuestion", path);
  number(item.confidence, `${path}.confidence`);
  for (const key of ["whatChanged", "previousState", "currentState", "marketReaction", "acceptedExplanation"] as const) {
    nullableString(item, key, path);
  }
  array(item.claims, `${path}.claims`).forEach((claim, index) => validateClaim(claim, `${path}.claims[${index}]`));
  array(item.causalChain, `${path}.causalChain`).forEach((edge, index) => validateEdge(edge, `${path}.causalChain[${index}]`));

  const countercase = record(item.countercase, `${path}.countercase`);
  nullableString(countercase, "strongest", `${path}.countercase`);
  stringArray(countercase.evidenceIds, `${path}.countercase.evidenceIds`);
  nullableString(countercase, "weakestLink", `${path}.countercase`);
  nullableString(countercase, "marketMayBeRight", `${path}.countercase`);

  const overlooked = record(item.overlookedVariable, `${path}.overlookedVariable`);
  nullableString(overlooked, "text", `${path}.overlookedVariable`);
  if (!has(overlooked, "evidenceState")) fail(`${path}.overlookedVariable.evidenceState is required.`);
  if (overlooked.evidenceState !== null) {
    enumString(overlooked.evidenceState, ["observed", "strongly_supported", "inferred", "speculative"], `${path}.overlookedVariable.evidenceState`);
  }
  stringArray(overlooked.evidenceIds, `${path}.overlookedVariable.evidenceIds`);

  array(item.assetImplications, `${path}.assetImplications`).forEach((impact, index) => {
    const impactItem = record(impact, `${path}.assetImplications[${index}]`);
    for (const key of ["asset", "baseCase", "confirmation", "invalidation"] as const) {
      string(impactItem[key], `${path}.assetImplications[${index}].${key}`);
    }
    enumString(impactItem.bias, ["bullish", "bearish", "neutral", "mixed", "unscored"], `${path}.assetImplications[${index}].bias`);
    if (!has(impactItem, "conviction")) fail(`${path}.assetImplications[${index}].conviction is required.`);
    if (impactItem.conviction !== null) number(impactItem.conviction, `${path}.assetImplications[${index}].conviction`);
    stringArray(impactItem.evidenceIds, `${path}.assetImplications[${index}].evidenceIds`);
  });
  stringArray(item.confirmation, `${path}.confirmation`);
  stringArray(item.invalidation, `${path}.invalidation`);

  if (!has(item, "nextTest")) fail(`${path}.nextTest is required.`);
  if (item.nextTest !== null) {
    const nextTest = record(item.nextTest, `${path}.nextTest`);
    for (const key of ["id", "label"] as const) string(nextTest[key], `${path}.nextTest.${key}`);
    enumString(nextTest.status, ["upcoming", "due", "resolved", "expired"], `${path}.nextTest.status`);
    nullableString(nextTest, "catalystRef", `${path}.nextTest`);
    nullableString(nextTest, "dueAt", `${path}.nextTest`);
    nullableString(nextTest, "expiresAt", `${path}.nextTest`);
    stringArray(nextTest.evidenceIds, `${path}.nextTest.evidenceIds`);
    stringArray(nextTest.resolutionEvidenceIds, `${path}.nextTest.resolutionEvidenceIds`);
  }
  array(item.visualPlan, `${path}.visualPlan`).forEach((visual, index) => validateVisualPlan(visual, `${path}.visualPlan[${index}]`));

  const reasoning = item as CanonicalStoryReasoningV1;
  requireUnique(reasoning.claims.map((claim) => claim.id), `${path}.claims`);
  requireUnique(reasoning.causalChain.map((edge) => edge.id), `${path}.causalChain`);
  requireUnique(reasoning.visualPlan.map((visual) => visual.id), `${path}.visualPlan`);
  validateVisualReferences(reasoning, path);
  return reasoning;
}

function validateVisualReferences(reasoning: CanonicalStoryReasoningV1, path: string) {
  const edgeIds = new Set(reasoning.causalChain.map((edge) => edge.id));
  const claimIds = new Set(reasoning.claims.map((claim) => claim.id));
  const requireRefs = (ids: string[], known: ReadonlySet<string>, refPath: string) => {
    const unknown = ids.filter((id) => !known.has(id));
    if (unknown.length) fail(`${refPath} references IDs outside immutable Story reasoning: ${unknown.join(", ")}.`);
  };
  reasoning.visualPlan.forEach((visual, index) => {
    const visualPath = `${path}.visualPlan[${index}]`;
    if (visual.type === "linear_chain" || visual.type === "feedback_loop" || visual.type === "money_or_commodity_flow") {
      requireRefs(visual.edgeIds, edgeIds, `${visualPath}.edgeIds`);
    }
    if (visual.type === "feedback_loop") requireRefs([visual.loopClosureEdgeId], edgeIds, `${visualPath}.loopClosureEdgeId`);
    if (visual.type === "entity_map") requireRefs(visual.connectionEdgeIds, edgeIds, `${visualPath}.connectionEdgeIds`);
    if (visual.type === "before_after") {
      requireRefs(visual.beforeClaimIds, claimIds, `${visualPath}.beforeClaimIds`);
      requireRefs(visual.afterClaimIds, claimIds, `${visualPath}.afterClaimIds`);
    }
    if (visual.type === "decision_tree") {
      requireRefs([visual.rootClaimId], claimIds, `${visualPath}.rootClaimId`);
      visual.branches.forEach((branch, branchIndex) => {
        requireRefs(branch.outcomeClaimIds, claimIds, `${visualPath}.branches[${branchIndex}].outcomeClaimIds`);
        if (branch.conditionRef.kind === "confirmation" && !reasoning.confirmation[branch.conditionRef.index]) {
          fail(`${visualPath}.branches[${branchIndex}] references a missing confirmation condition.`);
        }
        if (branch.conditionRef.kind === "invalidation" && !reasoning.invalidation[branch.conditionRef.index]) {
          fail(`${visualPath}.branches[${branchIndex}] references a missing invalidation condition.`);
        }
        if (branch.conditionRef.kind === "next_test" && !reasoning.nextTest) {
          fail(`${visualPath}.branches[${branchIndex}] references a missing next test.`);
        }
      });
    }
  });
}

function canonicalStringList(payload: JsonRecord, key: string) {
  if (!has(payload, key) || payload[key] === null) return [];
  return stringArray(payload[key], `edition.payload.${key}`);
}

function buildReportModel(source: unknown): ReportModel {
  const root = record(source, "source");
  const edition = record(root.edition, "source.edition");
  const publication = record(root.publication, "source.publication");
  const canonical = record(root.canonical, "source.canonical");
  const editionSnapshotId = string(edition.snapshotId, "source.edition.snapshotId");
  if (edition.immutable !== true) fail("source.edition.immutable must be true.");
  if (!["current_canonical", "immutable_replay"].includes(string(edition.mode, "source.edition.mode"))) {
    fail("source.edition.mode is not immutable canonical publication state.");
  }

  const selection = record(edition.selected, "source.edition.selected");
  const selectionStatus = string(selection.status, "source.edition.selected.status");
  if (!["current", "historical"].includes(selectionStatus)) fail("The requested edition did not resolve exactly; report composition refused fallback state.");
  if (string(selection.snapshotId, "source.edition.selected.snapshotId") !== editionSnapshotId) fail("Edition selection snapshot ID mismatch.");
  if (string(canonical.snapshotId, "source.canonical.snapshotId") !== editionSnapshotId) fail("Canonical snapshot ID mismatch.");

  const selectedEdition = record(publication.selectedEdition, "source.publication.selectedEdition");
  if (string(selectedEdition.snapshotId, "source.publication.selectedEdition.snapshotId") !== editionSnapshotId) {
    fail("Publication selected-edition snapshot ID mismatch.");
  }
  if (string(selectedEdition.status, "source.publication.selectedEdition.status") !== selectionStatus) {
    fail("Publication and edition selection statuses do not match.");
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

  const positions = new Set<number>();
  const storyIds = new Set<string>();
  const publicationSnapshotIds = new Set<string>();
  const stories = manifest.map((entry, index): ReportStory => {
    const entryPath = `source.edition.payload.canonicalStoryManifest[${index}]`;
    const item = record(entry, entryPath);
    const position = integer(item.position, `${entryPath}.position`);
    if (position < 1 || positions.has(position)) fail(`${entryPath}.position must be a unique positive integer.`);
    positions.add(position);
    const publicationSnapshotId = string(item.snapshotId, `${entryPath}.snapshotId`);
    const storyId = string(item.storyId, `${entryPath}.storyId`);
    if (storyIds.has(storyId)) fail(`${entryPath}.storyId duplicates another manifest entry.`);
    if (publicationSnapshotIds.has(publicationSnapshotId)) fail(`${entryPath}.snapshotId duplicates another manifest entry.`);
    storyIds.add(storyId);
    publicationSnapshotIds.add(publicationSnapshotId);
    const state = record(item.state, `${entryPath}.state`);
    if (string(state.id, `${entryPath}.state.id`) !== storyId) fail(`${entryPath}.state.id does not match storyId.`);

    const snapshot = snapshotById.get(publicationSnapshotId);
    if (!snapshot) fail(`${entryPath}.snapshotId is not present in the canonical publication snapshots.`);
    if (snapshot.snapshot_type !== "story") fail(`${entryPath}.snapshotId does not identify a Story publication snapshot.`);
    if (string(snapshot.story_id, `Story snapshot ${publicationSnapshotId}.story_id`) !== storyId) fail(`${entryPath} Story ID does not match its publication snapshot.`);
    const versionId = string(snapshot.story_thesis_version_id, `Story snapshot ${publicationSnapshotId}.story_thesis_version_id`);
    const snapshotPayload = record(snapshot.payload, `Story snapshot ${publicationSnapshotId}.payload`);
    const snapshotState = record(snapshotPayload.canonicalStoryState, `Story snapshot ${publicationSnapshotId}.payload.canonicalStoryState`);
    if (stableJson(snapshotState) !== stableJson(state)) fail(`${entryPath}.state is not the exact immutable Story publication state.`);

    const thesisVersion = record(state.thesisVersion, `${entryPath}.state.thesisVersion`);
    if (string(thesisVersion.id, `${entryPath}.state.thesisVersion.id`) !== versionId) fail(`${entryPath} thesis version linkage mismatch.`);
    const versionNumber = integer(thesisVersion.version, `${entryPath}.state.thesisVersion.version`);
    const reasoning = validateReasoning(snapshotPayload.canonicalStoryReasoning, `Story snapshot ${publicationSnapshotId}.payload.canonicalStoryReasoning`);
    if (reasoning.storyId !== storyId) fail(`${entryPath} reasoning Story ID mismatch.`);
    if (reasoning.storyVersionId !== versionId) fail(`${entryPath} reasoning version ID mismatch.`);
    if (reasoning.versionNumber !== versionNumber) fail(`${entryPath} reasoning version number mismatch.`);
    return { position, publicationSnapshotId, reasoning };
  }).sort((left, right) => left.position - right.position);

  stories.forEach((story, index) => {
    if (story.position !== index + 1) fail("Canonical Story manifest positions must be contiguous from 1.");
  });

  const marketTape = has(payload, "marketTape") && payload.marketTape !== null
    ? record(payload.marketTape, "source.edition.payload.marketTape")
    : null;
  const regime = optionalString(payload.regime, "source.edition.payload.regime")
    ?? optionalString(marketTape?.regimeSummary, "source.edition.payload.marketTape.regimeSummary");
  return {
    editionSnapshotId,
    generatedAt: string(edition.generatedAt, "source.edition.generatedAt"),
    summary: optionalString(edition.summary, "source.edition.summary"),
    regime,
    caveats: [
      ...canonicalStringList(payload, "researchDebt"),
      ...canonicalStringList(payload, "caveats"),
      ...canonicalStringList(payload, "warnings"),
    ],
    stories,
  };
}

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function evidenceIds(ids: string[]) {
  if (!ids.length) return "";
  return `<div class="evidence-ids" aria-label="Canonical evidence identifiers">${ids.map((id) => `<code data-evidence-id="${escapeHtml(id)}">${escapeHtml(id)}</code>`).join("")}</div>`;
}

function list(items: string[], className = "criteria") {
  return `<ul class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderVisual(visual: VisualPlanV1, reasoning: CanonicalStoryReasoningV1) {
  const edges = new Map(reasoning.causalChain.map((edge) => [edge.id, edge]));
  const claims = new Map(reasoning.claims.map((claim) => [claim.id, claim]));
  const edgeChain = (ids: string[]) => `<div class="visual-chain">${ids.map((id) => {
    const edge = edges.get(id)!;
    return `<div class="visual-node"><b>${escapeHtml(edge.from)}</b><span>${escapeHtml(edge.relationship)}</span><b>${escapeHtml(edge.to)}</b><small>${escapeHtml(label(edge.evidenceState))}</small></div>`;
  }).join("")}</div>`;
  let body = "";
  if (visual.type === "linear_chain" || visual.type === "feedback_loop") body = edgeChain(visual.edgeIds);
  else if (visual.type === "money_or_commodity_flow") {
    body = `<p class="flow-label">${escapeHtml(visual.flowLabel)}</p>${edgeChain(visual.edgeIds)}<div class="entity-row">${visual.entities.map((entity) => `<span>${escapeHtml(entity.label)}</span>`).join("")}</div>`;
  } else if (visual.type === "entity_map") {
    body = `<div class="entity-grid">${visual.entities.map((entity) => `<div><b>${escapeHtml(entity.label)}</b><small>${escapeHtml(entity.geography.kind === "country" ? entity.geography.countryCode : `${entity.geography.lat}, ${entity.geography.lon}`)}</small></div>`).join("")}</div>`;
  } else if (visual.type === "divergence_chart") {
    body = `<div class="series-grid">${visual.series.map((series) => `<div><b>${escapeHtml(series.label)}</b><span>${escapeHtml(label(series.role))} · ${escapeHtml(label(series.transform))}</span></div>`).join("")}</div><p class="visual-meta">${escapeHtml(label(visual.expectedRelationship))}</p>${evidenceIds(visual.evidenceIds)}`;
  } else if (visual.type === "before_after") {
    const claimList = (ids: string[]) => list(ids.map((id) => claims.get(id)!.text), "claim-list");
    body = `<div class="before-after"><div><h5>Before</h5>${claimList(visual.beforeClaimIds)}</div><div><h5>After</h5>${claimList(visual.afterClaimIds)}</div></div>${evidenceIds(visual.changeEvidenceIds)}`;
  } else if (visual.type === "decision_tree") {
    body = `<p class="decision-root">${escapeHtml(claims.get(visual.rootClaimId)!.text)}</p><div class="decision-branches">${visual.branches.map((branch) => {
      const condition = branch.conditionRef.kind === "confirmation"
        ? reasoning.confirmation[branch.conditionRef.index]
        : branch.conditionRef.kind === "invalidation"
          ? reasoning.invalidation[branch.conditionRef.index]
          : reasoning.nextTest!.label;
      return `<div><b>${escapeHtml(condition)}</b>${list(branch.outcomeClaimIds.map((id) => claims.get(id)!.text), "claim-list")}</div>`;
    }).join("")}</div>`;
  }
  return `<article class="visual-plan" data-visual-plan-id="${escapeHtml(visual.id)}" data-visual-type="${escapeHtml(visual.type)}"><header><span>${escapeHtml(label(visual.type))}</span><h4>${escapeHtml(visual.title)}</h4></header>${body}</article>`;
}

function renderStory(story: ReportStory) {
  const reasoning = story.reasoning;
  const stateRows = [
    ["What changed", reasoning.whatChanged],
    ["Previous state", reasoning.previousState],
    ["Current state", reasoning.currentState],
    ["Market reaction", reasoning.marketReaction],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  const countercaseRows = [
    ["Strongest countercase", reasoning.countercase.strongest],
    ["Weakest link", reasoning.countercase.weakestLink],
    ["Why the market may be right", reasoning.countercase.marketMayBeRight],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  return `<section class="story sheet" data-story-id="${escapeHtml(reasoning.storyId)}" data-story-version-id="${escapeHtml(reasoning.storyVersionId)}">
    <header class="story-head"><div><span class="section-number">${String(story.position).padStart(2, "0")}</span><span class="kicker">Canonical Story</span></div><div class="story-meta"><span>${escapeHtml(label(reasoning.lifecycle))}</span><span>Confidence ${escapeHtml(reasoning.confidence)}</span></div></header>
    <div class="story-body">
      <h2>${escapeHtml(reasoning.title)}</h2>
      ${reasoning.centralQuestion ? `<p class="central-question">${escapeHtml(reasoning.centralQuestion)}</p>` : ""}
      <article class="thesis-card"><span>Thesis</span><p>${escapeHtml(reasoning.thesis)}</p></article>
      ${stateRows.length ? `<div class="state-grid">${stateRows.map(([heading, value]) => `<article><h3>${heading}</h3><p>${escapeHtml(value)}</p></article>`).join("")}</div>` : ""}
      ${reasoning.acceptedExplanation || reasoning.claims.length ? `<section class="report-section"><h3>Evidence and mechanism</h3>${reasoning.acceptedExplanation ? `<p class="lead-copy">${escapeHtml(reasoning.acceptedExplanation)}</p>` : ""}${reasoning.claims.length ? `<div class="claim-grid">${reasoning.claims.map((claim) => `<article class="claim"><span>${escapeHtml(label(claim.type))}</span><p>${escapeHtml(claim.text)}</p>${evidenceIds(claim.evidenceIds)}</article>`).join("")}</div>` : ""}</section>` : ""}
      ${reasoning.causalChain.length ? `<section class="report-section"><h3>Causal chain</h3><ol class="causal-chain">${reasoning.causalChain.map((edge) => `<li><div><b>${escapeHtml(edge.from)}</b><span>${escapeHtml(edge.relationship)}</span><b>${escapeHtml(edge.to)}</b></div><small>${escapeHtml(label(edge.evidenceState))}</small>${evidenceIds(edge.evidenceIds)}</li>`).join("")}</ol></section>` : ""}
      ${countercaseRows.length ? `<section class="report-section countercase"><h3>Countercase</h3>${countercaseRows.map(([heading, value]) => `<article><h4>${heading}</h4><p>${escapeHtml(value)}</p></article>`).join("")}${evidenceIds(reasoning.countercase.evidenceIds)}</section>` : ""}
      ${reasoning.overlookedVariable.text ? `<section class="report-section overlooked"><h3>Overlooked variable</h3><p>${escapeHtml(reasoning.overlookedVariable.text)}</p>${reasoning.overlookedVariable.evidenceState ? `<span class="status">${escapeHtml(label(reasoning.overlookedVariable.evidenceState))}</span>` : ""}${evidenceIds(reasoning.overlookedVariable.evidenceIds)}</section>` : ""}
      ${reasoning.assetImplications.length ? `<section class="report-section"><h3>Asset implications</h3><div class="asset-grid">${reasoning.assetImplications.map((impact) => `<article><header><b>${escapeHtml(impact.asset)}</b><span>${escapeHtml(label(impact.bias))}${impact.conviction === null ? "" : ` · ${escapeHtml(impact.conviction)}`}</span></header><p>${escapeHtml(impact.baseCase)}</p><dl><dt>Confirmation</dt><dd>${escapeHtml(impact.confirmation)}</dd><dt>Invalidation</dt><dd>${escapeHtml(impact.invalidation)}</dd></dl>${evidenceIds(impact.evidenceIds)}</article>`).join("")}</div></section>` : ""}
      ${reasoning.nextTest ? `<section class="report-section next-test"><h3>Next catalyst</h3><article><div><b>${escapeHtml(reasoning.nextTest.label)}</b><span>${escapeHtml(label(reasoning.nextTest.status))}</span></div>${reasoning.nextTest.catalystRef ? `<p>${escapeHtml(reasoning.nextTest.catalystRef)}</p>` : ""}<dl>${reasoning.nextTest.dueAt ? `<dt>Due</dt><dd>${escapeHtml(reasoning.nextTest.dueAt)}</dd>` : ""}${reasoning.nextTest.expiresAt ? `<dt>Expires</dt><dd>${escapeHtml(reasoning.nextTest.expiresAt)}</dd>` : ""}</dl>${evidenceIds(reasoning.nextTest.evidenceIds)}</article></section>` : ""}
      ${reasoning.confirmation.length || reasoning.invalidation.length ? `<section class="report-section"><h3>Confirmation and invalidation</h3><div class="criteria-grid">${reasoning.confirmation.length ? `<article><h4>Confirmation</h4>${list(reasoning.confirmation)}</article>` : ""}${reasoning.invalidation.length ? `<article><h4>Invalidation</h4>${list(reasoning.invalidation)}</article>` : ""}</div></section>` : ""}
      ${reasoning.visualPlan.length ? `<section class="report-section"><h3>Canonical visual plans</h3>${reasoning.visualPlan.map((visual) => renderVisual(visual, reasoning)).join("")}</section>` : ""}
      <footer class="provenance"><span>Story publication ${escapeHtml(story.publicationSnapshotId)}</span><span>Story version ${escapeHtml(reasoning.storyVersionId)} · effective ${escapeHtml(reasoning.effectiveAt)}</span></footer>
    </div>
  </section>`;
}

const REPORT_CSS = `
:root{--bg:#f7f5ff;--purple:#39217f;--purple-dark:#21134f;--navy:#0d2e61;--text:#122449;--muted:#66718d;--line:#d5ccff;--lav:#f1eeff;--blue:#eef4ff;--grey:#d4d4d8;--teal:#24577e}
*{box-sizing:border-box}html{background:#e8e6ef}body{margin:0;color:var(--text);font-family:Arial,Helvetica,sans-serif;background:#e8e6ef;-webkit-print-color-adjust:exact;print-color-adjust:exact}.report{padding:24px 0}.sheet{width:210mm;min-height:297mm;margin:0 auto 28px;background:var(--bg);box-shadow:0 12px 40px rgba(28,23,59,.16);break-after:page;page-break-after:always}.cover{height:297mm;position:relative;overflow:hidden;background:#070b1d;color:#fff}.brand{position:absolute;top:35px;left:45px;display:flex;align-items:center;gap:10px;font-size:12px}.brand-mark{width:16px;height:16px;background:#fff;transform:rotate(45deg);display:inline-grid;place-items:center}.brand-mark i{width:6px;height:6px;background:var(--purple-dark)}.cover-copy{position:absolute;left:45px;top:205px;max-width:610px}.cover-copy .eyebrow{color:#d8d0ff;font-size:10px;letter-spacing:.13em;text-transform:uppercase}.cover h1{font-size:42px;line-height:1.12;margin:13px 0 20px}.cover-summary{font-size:14px;line-height:1.5;color:#d8d5e8}.orbit{position:absolute;border:1.5px solid #4a39a0;border-radius:50%;transform:rotate(-20deg)}.orbit-a{width:340px;height:120px;left:150px;top:480px}.orbit-b{width:280px;height:190px;left:190px;top:435px;transform:rotate(29deg)}.orbit-c{width:200px;height:280px;left:290px;top:400px;transform:rotate(48deg)}.cover-block{position:absolute;background:#4f35bd;border-radius:17px}.block-a{width:150px;height:350px;right:93px;top:405px}.block-b{width:118px;height:300px;right:145px;top:440px;opacity:.78}.block-c{width:80px;height:250px;right:72px;top:495px;opacity:.7}.cover-meta{position:absolute;left:45px;right:45px;bottom:45px;background:#11152a;border-radius:9px;padding:18px;color:#d8d5e8;font-size:9px;display:flex;justify-content:space-between;gap:20px}.section-head,.story-head{background:var(--purple);color:#fff}.section-head{padding:28px 58px 30px}.section-head .kicker,.story-head .kicker{font-size:9px;color:#d8d0ff;letter-spacing:.08em;text-transform:uppercase}.section-head h2{font-size:28px;margin:16px 0 0}.page-body,.story-body{padding:28px 58px 52px}.regime-card,.caveat-card,.thesis-card,.claim,.report-section,.state-grid article,.asset-grid article,.visual-plan,.next-test article{border:1px solid var(--line);border-radius:16px;background:#fff}.regime-card{padding:18px;background:var(--blue);margin-bottom:22px}.regime-card h3,.report-section>h3{color:var(--navy);font-size:15px;margin:0 0 10px}.regime-card p,.caveat-card p{font-size:11px;line-height:1.48;margin:0}.executive-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.executive-grid article{border-top:3px solid var(--purple);padding:14px;background:#fff}.executive-grid span{font-size:9px;color:var(--muted);text-transform:uppercase}.executive-grid h3{font-size:14px;color:var(--navy);margin:7px 0}.executive-grid p{font-size:10.5px;line-height:1.45;margin:0}.caveat-card{padding:18px;margin-top:22px}.caveat-card h3{font-size:14px;color:var(--navy);margin:0 0 10px}.caveat-card li{font-size:10.5px;line-height:1.45;margin-bottom:7px}.story{background:#fff}.story-head{height:165px;padding:18px 58px;display:flex;justify-content:space-between}.section-number{display:block;font-size:72px;line-height:1;font-weight:900;margin-top:14px}.story-meta{display:flex;gap:7px;align-items:flex-start;padding-top:4px}.story-meta span,.status{font-size:8px;letter-spacing:.06em;text-transform:uppercase;border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:6px 8px}.story-body h2{font-size:25px;color:var(--navy);margin:0 0 8px}.central-question{color:var(--muted);font-size:11px;margin:0 0 20px}.thesis-card{padding:18px;background:var(--lav);margin-bottom:20px}.thesis-card>span,.claim>span{font-size:8px;color:var(--purple);font-weight:700;letter-spacing:.08em;text-transform:uppercase}.thesis-card p{font-size:14px;line-height:1.5;margin:8px 0 0}.state-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px}.state-grid article{padding:14px}.state-grid h3,.countercase h4{font-size:10px;text-transform:uppercase;color:var(--muted);margin:0 0 6px}.state-grid p,.countercase p,.overlooked p{font-size:10.5px;line-height:1.45;margin:0}.report-section{padding:18px;margin:16px 0;break-inside:avoid}.lead-copy{font-size:11px;line-height:1.5;margin:0}.claim-grid,.asset-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}.claim{padding:14px;break-inside:avoid}.claim p{font-size:10px;line-height:1.42;margin:7px 0}.evidence-ids{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}.evidence-ids code{font-size:6.8px;color:var(--muted);background:var(--blue);padding:3px 5px;border-radius:4px;overflow-wrap:anywhere}.causal-chain{padding:0;list-style:none;counter-reset:edge}.causal-chain li{padding:12px 0;border-top:1px solid var(--line);counter-increment:edge}.causal-chain li>div{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center}.causal-chain b{font-size:10px}.causal-chain li>div span{font-size:9px;color:var(--teal);text-align:center}.causal-chain small{display:block;color:var(--muted);font-size:8px;margin-top:5px}.countercase{background:var(--blue)}.countercase article+article{margin-top:12px}.overlooked{background:var(--lav)}.overlooked .status{display:inline-block;color:var(--purple);border-color:var(--line);margin-top:8px}.asset-grid article{padding:14px}.asset-grid header,.next-test article>div{display:flex;justify-content:space-between;gap:10px}.asset-grid header b{color:var(--navy)}.asset-grid header span,.next-test article span{font-size:8px;color:var(--purple);text-transform:uppercase}.asset-grid p{font-size:10px;line-height:1.4}.asset-grid dl,.next-test dl{display:grid;grid-template-columns:78px 1fr;gap:5px;margin:0}.asset-grid dt,.next-test dt{font-size:8px;color:var(--muted);text-transform:uppercase}.asset-grid dd,.next-test dd{font-size:9px;margin:0}.next-test{background:var(--lav)}.next-test article{padding:14px}.next-test article p{font-size:10px}.criteria-grid,.before-after,.decision-branches{display:grid;grid-template-columns:1fr 1fr;gap:16px}.criteria-grid h4,.before-after h5{color:var(--navy);font-size:11px;margin:0 0 8px}.criteria{margin:0;padding-left:18px}.criteria li,.claim-list li{font-size:10px;line-height:1.4;margin-bottom:6px}.visual-plan{padding:14px;margin-top:12px;background:var(--blue);break-inside:avoid}.visual-plan header span{font-size:8px;color:var(--purple);text-transform:uppercase}.visual-plan h4{font-size:12px;color:var(--navy);margin:5px 0 12px}.visual-chain{display:flex;flex-direction:column;gap:8px}.visual-node{display:grid;grid-template-columns:1fr .7fr 1fr auto;gap:8px;align-items:center;background:#fff;padding:9px;border-radius:8px}.visual-node b{font-size:9px}.visual-node span,.visual-node small{font-size:8px;color:var(--muted)}.entity-row,.entity-grid,.series-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:10px}.entity-row span,.entity-grid div,.series-grid div{background:#fff;padding:9px;border-radius:8px;font-size:9px}.entity-grid small,.series-grid span{display:block;color:var(--muted);font-size:8px;margin-top:3px}.flow-label,.visual-meta,.decision-root{font-size:10px}.decision-root{background:#fff;padding:10px;border-radius:8px}.decision-branches>div{background:#fff;padding:10px;border-radius:8px}.decision-branches b{font-size:9px}.claim-list{padding-left:16px}.provenance{display:flex;justify-content:space-between;gap:20px;border-top:1px solid var(--line);padding-top:10px;margin-top:24px;color:var(--muted);font-size:7px}.provenance span{overflow-wrap:anywhere}.disclaimer{font-size:8px;line-height:1.5;color:var(--muted);margin-top:24px}
@media print{@page{size:A4 portrait;margin:0}html,body{background:#fff}.report{padding:0}.sheet{width:210mm;min-height:297mm;margin:0;box-shadow:none}.story{break-before:page}.report-section,.claim,.asset-grid article,.visual-plan{break-inside:avoid}}
@media(max-width:860px){.report{padding:0}.sheet{width:100%;min-height:100vh;margin:0}.story-head,.section-head{padding-left:24px;padding-right:24px}.page-body,.story-body{padding-left:24px;padding-right:24px}.executive-grid,.claim-grid,.asset-grid,.state-grid,.criteria-grid{grid-template-columns:1fr}.cover-copy{left:28px;right:28px}.cover h1{font-size:36px}.cover-meta{left:28px;right:28px}.cover-block,.orbit{opacity:.32}}
`;

export function composeAlchemyReportHtml(source: unknown): string {
  const model = buildReportModel(source);
  const summary = model.summary ? `<p class="cover-summary">${escapeHtml(model.summary)}</p>` : "";
  const regime = model.regime ? `<article class="regime-card"><h3>Macro and regime</h3><p>${escapeHtml(model.regime)}</p></article>` : "";
  const caveats = model.caveats.length ? `<article class="caveat-card"><h3>Research debt and caveats</h3>${list(model.caveats)}</article>` : "";
  const executiveStories = model.stories.map((story) => `<article data-summary-story-version-id="${escapeHtml(story.reasoning.storyVersionId)}"><span>Story ${escapeHtml(story.position)} · ${escapeHtml(label(story.reasoning.lifecycle))}</span><h3>${escapeHtml(story.reasoning.title)}</h3><p>${escapeHtml(story.reasoning.thesis)}</p></article>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="alchemy-report-contract" content="${ALCHEMY_REPORT_COMPOSER_V1}"><title>Alchemy Markets Canonical Intelligence Report</title><style>${REPORT_CSS}</style></head>
<body><main class="report" data-edition-snapshot-id="${escapeHtml(model.editionSnapshotId)}">
  <section class="sheet cover"><div class="brand"><span class="brand-mark"><i></i></span><b>Alchemy Markets</b></div><div class="cover-copy"><div class="eyebrow">Canonical Intelligence Report</div><h1>Live reasoning.<br>Immutable edition.</h1>${summary}</div><div class="orbit orbit-a"></div><div class="orbit orbit-b"></div><div class="orbit orbit-c"></div><div class="cover-block block-a"></div><div class="cover-block block-b"></div><div class="cover-block block-c"></div><div class="cover-meta"><span>Deterministically assembled from persisted Canonical Story Reasoning V1</span><b>${escapeHtml(model.generatedAt)}</b></div></section>
  <section class="sheet executive"><header class="section-head"><span class="kicker">Edition ${escapeHtml(model.editionSnapshotId)}</span><h2>Executive summary</h2></header><div class="page-body">${regime}<div class="executive-grid">${executiveStories}</div>${caveats}<p class="disclaimer">For educational and informational purposes only. This report does not constitute investment advice, a recommendation, or an offer to buy or sell any financial instrument.</p></div></section>
  ${model.stories.map(renderStory).join("")}
</main></body></html>`;
}
