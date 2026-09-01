import "server-only";

import { runStructuredStage, type OpenAIStageResult } from "./openai.ts";

export const DOSSIER_STORYLINE_COMPOSITION_V1 = "dossier-storyline-composition/v1" as const;
const MAX_COMPOSER_CANDIDATES = 8;
const MAX_STORYLINES = 3;
const MAX_DOSSIER_LESSONS = 8;

export type StorylineEvidenceState = "observed" | "strongly_supported" | "inferred" | "speculative";

type JsonRecord = Record<string, unknown>;

type PersistedManifestEntry = {
  position: number;
  snapshotId: string;
  storyId: string;
  thesisVersionId: string;
  state: JsonRecord;
};

type ExistingLesson = JsonRecord & {
  storyId: string;
  evidenceRefs: string[];
};

export type DossierComposerCandidate = {
  position: number;
  storyId: string;
  snapshotId: string;
  thesisVersionId: string;
  title: string;
  question: string | null;
  thesis: string;
  explanation: string | null;
  strongestSupport: string | null;
  strongestContradiction: string | null;
  confirmation: string | null;
  invalidation: string | null;
  assets: string[];
  confidence: number;
  lifecycle: string;
  isCurrentChange: boolean;
  evidenceRefs: string[];
  existingCausalEdges: Array<{
    from: string;
    relationship: string;
    to: string;
    evidenceStatus: StorylineEvidenceState;
    evidenceRefs: string[];
  }>;
  existingLesson: ExistingLesson | null;
};

export type DossierStorylineComposition = {
  contractVersion: typeof DOSSIER_STORYLINE_COMPOSITION_V1;
  opening: {
    headline: string;
    summary: string;
  };
  storylines: Array<{
    id: string;
    title: string;
    centralQuestion: string;
    summary: string;
    storyIds: string[];
    nodes: Array<{
      id: string;
      label: string;
      storyIds: string[];
    }>;
    links: Array<{
      from: string;
      to: string;
      relationship: string;
      evidenceStatus: StorylineEvidenceState;
      evidenceRefs: string[];
      supportingStoryIds: string[];
    }>;
    strongestBreakCondition: string | null;
  }>;
  lessonOrder: string[];
};

type ModelOutput = Omit<DossierStorylineComposition, "contractVersion">;

type ModelRunner = <T>(input: {
  stageKey: string;
  instructions: string;
  input: unknown;
  schema: Record<string, unknown>;
  modelKind?: "complex" | "fast";
  maxOutputTokens?: number;
  requestTimeoutMs?: number;
  maxAttempts?: number;
}) => Promise<OpenAIStageResult<T>>;

const COMPOSER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["opening", "storylines", "lessonOrder"],
  properties: {
    opening: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "summary"],
      properties: {
        headline: { type: "string" },
        summary: { type: "string" },
      },
    },
    storylines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "centralQuestion", "summary", "storyIds", "nodes", "links", "strongestBreakCondition"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          centralQuestion: { type: "string" },
          summary: { type: "string" },
          storyIds: { type: "array", items: { type: "string" } },
          nodes: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "label", "storyIds"],
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                storyIds: { type: "array", items: { type: "string" } },
              },
            },
          },
          links: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["from", "to", "relationship", "evidenceStatus", "evidenceRefs", "supportingStoryIds"],
              properties: {
                from: { type: "string" },
                to: { type: "string" },
                relationship: { type: "string" },
                evidenceStatus: { type: "string", enum: ["observed", "strongly_supported", "inferred", "speculative"] },
                evidenceRefs: { type: "array", items: { type: "string" } },
                supportingStoryIds: { type: "array", items: { type: "string" } },
              },
            },
          },
          strongestBreakCondition: { type: ["string", "null"] },
        },
      },
    },
    lessonOrder: { type: "array", items: { type: "string" } },
  },
} as const;

const COMPOSER_INSTRUCTIONS = `You are the edition-level Causal Storyline Composer inside the Alchemy Markets Live Desk.

Your job is NOT to create new research. Your job is to organise the supplied canonical Story snapshots into the smallest causal model that best explains the current market state.

Hard rules:
- Use only the candidate Stories and market tape supplied in the input.
- Never invent a Story ID, snapshot, thesis version, fact, number, market move or evidence ID.
- Produce between one and three storylines. Do not force unrelated Stories together just to make the edition feel coherent.
- A storyline should exist only when the supplied Story text supports a causal, transmission or conditional relationship. If the connection is weak, keep the Stories separate.
- Preserve competing explanations and break conditions. Do not turn correlation into causation.
- Every storyIds, node.storyIds and supportingStoryIds value must be an exact candidate storyId.
- Every evidenceRefs value must be copied exactly from the allowed evidenceRefs supplied for its supporting Stories. It may be empty when a legacy canonical Story snapshot has no itemised evidence IDs.
- A cross-Story link that relies only on legacy Story-level reasoning, without an exact existing causal edge, must be labelled inferred or speculative. Never label it observed or strongly_supported.
- observed or strongly_supported is allowed only when the input already contains an existing causal edge that directly supports substantially the same relationship.
- Use short, plain British English. The opening should explain the market machine, not sound like an article headline.
- lessonOrder should put the explanation in teaching order, not simply confidence order. Retain genuinely material current-change Stories even if they are secondary.
- Do not add trade instructions.

A good result may look conceptually like: physical oil risk -> fuel inflation -> policy expectations -> bond yields -> FX / Japan / gold. But use that shape ONLY if the supplied Stories actually support those arrows.`;

function object(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()))]
    : [];
}

function evidenceState(value: unknown): StorylineEvidenceState {
  return ["observed", "strongly_supported", "inferred", "speculative"].includes(String(value))
    ? value as StorylineEvidenceState
    : "inferred";
}

function normaliseAsset(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function words(value: string) {
  const stop = new Set(["this", "that", "with", "from", "into", "have", "will", "market", "story", "current", "while", "their", "than", "only", "still"]);
  return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !stop.has(word)));
}

function lifecycleScore(value: string) {
  const lifecycle = value.toLowerCase();
  if (lifecycle.includes("confirm")) return 30;
  if (lifecycle.includes("develop")) return 20;
  if (lifecycle.includes("detect")) return 10;
  if (lifecycle.includes("weaken")) return 0;
  if (lifecycle.includes("invalid") || lifecycle.includes("archive")) return -100;
  return 5;
}

function isActiveLifecycle(value: string) {
  const lifecycle = value.toLowerCase();
  return !lifecycle.includes("invalid") && !lifecycle.includes("archive");
}

function existingLessonMap(dossier: JsonRecord | null) {
  const lessons = dossier && Array.isArray(dossier.lessons) ? dossier.lessons : [];
  const result = new Map<string, ExistingLesson>();
  for (const lesson of lessons) {
    if (!object(lesson)) continue;
    const storyId = text(lesson.storyId);
    if (!storyId) continue;
    result.set(storyId, {
      ...lesson,
      storyId,
      evidenceRefs: strings(lesson.evidenceRefs),
    });
  }
  return result;
}

function existingEdges(lesson: ExistingLesson | null) {
  if (!lesson || !Array.isArray(lesson.causeEffect)) return [];
  return lesson.causeEffect.flatMap((edge) => {
    if (!object(edge)) return [];
    const from = text(edge.from);
    const relationship = text(edge.relationship);
    const to = text(edge.to);
    if (!from || !relationship || !to) return [];
    return [{
      from,
      relationship,
      to,
      evidenceStatus: evidenceState(edge.evidenceStatus),
      evidenceRefs: strings(edge.evidenceRefs),
    }];
  });
}

function manifestEntries(value: unknown): PersistedManifestEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!object(entry) || !object(entry.state)) return [];
    const storyId = text(entry.storyId) || text(entry.state.id);
    const snapshotId = text(entry.snapshotId);
    const thesisVersionId = text(entry.thesisVersionId) || (object(entry.state.thesisVersion) ? text(entry.state.thesisVersion.id) : null);
    if (!storyId || !snapshotId || !thesisVersionId) return [];
    return [{
      position: Number.isInteger(entry.position) && Number(entry.position) > 0 ? Number(entry.position) : index + 1,
      snapshotId,
      storyId,
      thesisVersionId,
      state: entry.state,
    }];
  });
}

function currentChangeIds(payload: JsonRecord) {
  const stories = Array.isArray(payload.stories) ? payload.stories : [];
  return new Set(stories.flatMap((story) => object(story) && text(story.id) ? [text(story.id)!] : []));
}

function candidateFromManifest(
  entry: PersistedManifestEntry,
  lesson: ExistingLesson | null,
  changedIds: Set<string>,
): DossierComposerCandidate | null {
  const state = entry.state;
  const intelligence = object(state.intelligence) ? state.intelligence : null;
  const confidence = number(state.confidence);
  const title = text(state.title) || text(lesson?.title);
  if (confidence === null || !title) return null;
  const lifecycle = text(intelligence?.lifecycleStatus) || text(state.status) || "detected";
  const question = text(state.marketQuestion) || text(lesson?.question);
  const thesis = text(state.thesis) || text(lesson?.body && Array.isArray(lesson.body) ? lesson.body[0] : null) || title;
  const explanation = text(state.bestExplanation) || text(intelligence?.researchSynthesis);
  const strongestSupport = text(state.strongestSupport) || text(intelligence?.strongestSupport);
  const strongestContradiction = text(state.strongestContradiction) || text(intelligence?.strongestContradiction);
  const confirmation = text(state.confirmationCondition);
  const invalidation = text(state.invalidationCondition);
  const assets = strings(state.assets).length ? strings(state.assets) : strings(intelligence?.affectedAssets);
  const lessonEvidence = lesson?.evidenceRefs || [];
  const intelligenceEvidence = strings(intelligence?.decisiveEvidenceIds);
  return {
    position: entry.position,
    storyId: entry.storyId,
    snapshotId: entry.snapshotId,
    thesisVersionId: entry.thesisVersionId,
    title,
    question,
    thesis,
    explanation,
    strongestSupport,
    strongestContradiction,
    confirmation,
    invalidation,
    assets,
    confidence,
    lifecycle,
    isCurrentChange: changedIds.has(entry.storyId),
    evidenceRefs: [...new Set([...lessonEvidence, ...intelligenceEvidence])],
    existingCausalEdges: existingEdges(lesson),
    existingLesson: lesson,
  };
}

function candidateScore(candidate: DossierComposerCandidate, marketTape: JsonRecord | null) {
  const tapeAssets = new Set(
    marketTape && Array.isArray(marketTape.assets)
      ? marketTape.assets.flatMap((asset) => object(asset) && text(asset.symbol) ? [normaliseAsset(text(asset.symbol)!)] : [])
      : [],
  );
  const assetOverlap = candidate.assets.map(normaliseAsset).filter((asset) => tapeAssets.has(asset)).length;
  const tapeText = words([
    text(marketTape?.regimeSummary) || "",
    ...(marketTape && Array.isArray(marketTape.assets)
      ? marketTape.assets.flatMap((asset) => object(asset) ? [text(asset.state) || "", text(asset.whyRelevant) || ""] : [])
      : []),
  ].join(" "));
  const storyText = words([
    candidate.title,
    candidate.question || "",
    candidate.thesis,
    candidate.explanation || "",
    candidate.strongestSupport || "",
    ...candidate.assets,
  ].join(" "));
  const textOverlap = [...storyText].filter((word) => tapeText.has(word)).length;
  return candidate.confidence
    + (candidate.isCurrentChange ? 30 : 0)
    + lifecycleScore(candidate.lifecycle)
    + Math.max(0, 20 - Math.max(0, candidate.position - 1) * 2)
    + Math.min(60, assetOverlap * 20)
    + Math.min(20, textOverlap * 4);
}

export function buildDossierComposerCandidates(payload: JsonRecord) {
  const dossier = object(payload.dossier) ? payload.dossier : null;
  const lessons = existingLessonMap(dossier);
  const changes = currentChangeIds(payload);
  const marketTape = object(payload.marketTape) ? payload.marketTape : null;
  const ranked = manifestEntries(payload.canonicalStoryManifest)
    .flatMap((entry) => {
      const candidate = candidateFromManifest(entry, lessons.get(entry.storyId) || null, changes);
      if (!candidate) return [];
      if (!candidate.isCurrentChange && !isActiveLifecycle(candidate.lifecycle)) return [];
      return [{ candidate, score: candidateScore(candidate, marketTape) }];
    })
    .sort((left, right) => right.score - left.score || left.candidate.position - right.candidate.position || left.candidate.storyId.localeCompare(right.candidate.storyId));

  const selected = ranked.slice(0, MAX_COMPOSER_CANDIDATES);
  const selectedIds = new Set(selected.map((item) => item.candidate.storyId));
  for (const changed of ranked.filter((item) => item.candidate.isCurrentChange && !selectedIds.has(item.candidate.storyId))) {
    let replace = -1;
    for (let index = selected.length - 1; index >= 0; index -= 1) {
      if (!selected[index].candidate.isCurrentChange) {
        replace = index;
        break;
      }
    }
    if (replace < 0) break;
    selectedIds.delete(selected[replace].candidate.storyId);
    selected[replace] = changed;
    selectedIds.add(changed.candidate.storyId);
  }
  return selected
    .sort((left, right) => right.score - left.score || left.candidate.position - right.candidate.position)
    .map((item) => item.candidate);
}

function allowedEvidenceByStory(candidates: DossierComposerCandidate[]) {
  return new Map(candidates.map((candidate) => [candidate.storyId, new Set(candidate.evidenceRefs)]));
}

function exactExistingEdge(
  link: JsonRecord,
  supportingStoryIds: string[],
  candidatesById: Map<string, DossierComposerCandidate>,
) {
  const from = text(link.from)?.toLowerCase();
  const to = text(link.to)?.toLowerCase();
  const relationship = text(link.relationship)?.toLowerCase();
  if (!from || !to || !relationship) return false;
  return supportingStoryIds.some((storyId) => candidatesById.get(storyId)?.existingCausalEdges.some((edge) => (
    edge.from.toLowerCase() === from
    && edge.to.toLowerCase() === to
    && edge.relationship.toLowerCase() === relationship
    && ["observed", "strongly_supported"].includes(edge.evidenceStatus)
  )));
}

function sanitiseModelOutput(
  data: ModelOutput,
  candidates: DossierComposerCandidate[],
) {
  const warnings: string[] = [];
  const candidatesById = new Map(candidates.map((candidate) => [candidate.storyId, candidate]));
  const allowedIds = new Set(candidatesById.keys());
  const evidenceByStory = allowedEvidenceByStory(candidates);
  const usedStoryIds = new Set<string>();
  const rawStorylines = Array.isArray(data.storylines) ? data.storylines.slice(0, MAX_STORYLINES) : [];
  const storylines: DossierStorylineComposition["storylines"] = [];

  for (const [index, raw] of rawStorylines.entries()) {
    if (!object(raw)) continue;
    const storyIds = strings(raw.storyIds).filter((id) => allowedIds.has(id) && !usedStoryIds.has(id));
    if (!storyIds.length) continue;
    storyIds.forEach((id) => usedStoryIds.add(id));
    const storylineId = text(raw.id) || `storyline-${index + 1}`;
    const nodeIds = new Set<string>();
    const nodes = (Array.isArray(raw.nodes) ? raw.nodes : []).flatMap((node, nodeIndex) => {
      if (!object(node)) return [];
      const id = text(node.id) || `${storylineId}:node:${nodeIndex + 1}`;
      const label = text(node.label);
      const nodeStories = strings(node.storyIds).filter((storyId) => storyIds.includes(storyId));
      if (!label || !nodeStories.length || nodeIds.has(id)) return [];
      nodeIds.add(id);
      return [{ id, label, storyIds: nodeStories }];
    });

    const links = (Array.isArray(raw.links) ? raw.links : []).flatMap((link) => {
      if (!object(link)) return [];
      const from = text(link.from);
      const to = text(link.to);
      const relationship = text(link.relationship);
      const supportingStoryIds = strings(link.supportingStoryIds).filter((storyId) => storyIds.includes(storyId));
      if (!from || !to || !relationship || !nodeIds.has(from) || !nodeIds.has(to) || !supportingStoryIds.length) return [];
      const allowedEvidence = new Set(supportingStoryIds.flatMap((storyId) => [...(evidenceByStory.get(storyId) || [])]));
      const evidenceRefs = strings(link.evidenceRefs).filter((id) => allowedEvidence.has(id));
      let status = evidenceState(link.evidenceStatus);
      if (["observed", "strongly_supported"].includes(status) && !exactExistingEdge(link, supportingStoryIds, candidatesById)) {
        status = "inferred";
        warnings.push(`Storyline link ${from} -> ${to} was downgraded to inferred because no exact pre-existing canonical causal edge supports the stronger label.`);
      }
      return [{ from, to, relationship, evidenceStatus: status, evidenceRefs, supportingStoryIds }];
    });

    const title = text(raw.title) || candidatesById.get(storyIds[0])?.title || `Storyline ${index + 1}`;
    const centralQuestion = text(raw.centralQuestion) || candidatesById.get(storyIds[0])?.question || title;
    const summary = text(raw.summary) || candidatesById.get(storyIds[0])?.explanation || candidatesById.get(storyIds[0])?.thesis || title;
    storylines.push({
      id: storylineId,
      title,
      centralQuestion,
      summary,
      storyIds,
      nodes,
      links,
      strongestBreakCondition: text(raw.strongestBreakCondition),
    });
  }

  if (!storylines.length && candidates.length) {
    const candidate = candidates[0];
    storylines.push({
      id: `storyline:${candidate.storyId}`,
      title: candidate.title,
      centralQuestion: candidate.question || candidate.title,
      summary: candidate.explanation || candidate.thesis,
      storyIds: [candidate.storyId],
      nodes: [{ id: `story:${candidate.storyId}`, label: candidate.title, storyIds: [candidate.storyId] }],
      links: [],
      strongestBreakCondition: candidate.invalidation,
    });
    usedStoryIds.add(candidate.storyId);
    warnings.push("The model returned no valid causal storyline; the Dossier fell back to the highest-ranked canonical Story without inventing cross-Story links.");
  }

  const currentChanges = candidates.filter((candidate) => candidate.isCurrentChange).map((candidate) => candidate.storyId);
  const rawOrder = Array.isArray(data.lessonOrder) ? strings(data.lessonOrder).filter((id) => allowedIds.has(id)) : [];
  const storylineOrder = storylines.flatMap((storyline) => storyline.storyIds);
  const lessonOrder = [...new Set([...rawOrder, ...storylineOrder, ...currentChanges])].slice(0, MAX_DOSSIER_LESSONS);
  const opening = object(data.opening) ? data.opening : {};
  const headline = text(opening.headline) || storylines[0]?.title || candidates[0]?.title || "Current market state";
  const summary = text(opening.summary) || storylines[0]?.summary || candidates[0]?.explanation || candidates[0]?.thesis || "No supported causal summary is available.";

  return {
    composition: {
      contractVersion: DOSSIER_STORYLINE_COMPOSITION_V1,
      opening: { headline, summary },
      storylines,
      lessonOrder,
    } satisfies DossierStorylineComposition,
    warnings,
  };
}

function iconFor(candidate: DossierComposerCandidate) {
  const value = `${candidate.title} ${candidate.question || ""} ${candidate.thesis} ${candidate.assets.join(" ")}`.toLowerCase();
  if (/oil|crude|brent|wti|energy|diesel|gasoline|refin|hormuz/.test(value)) return "energy";
  if (/fed|fomc|central bank|policy|warsh|powell|ecb|boe/.test(value)) return "policy";
  if (/treasury|yield|bond|duration|term premium|curve|jgb/.test(value)) return "bonds";
  if (/japan|yen|jpy|boj/.test(value)) return "japan";
  if (/gold|xau|precious/.test(value)) return "gold";
  if (/credit|spread|funding|financ/.test(value)) return "credit";
  if (/usd|eur|gbp|aud|nzd|cad|chf|currency|fx/.test(value)) return "fx";
  if (/equity|stock|software|semiconductor|tech|earnings|nasdaq|s&p|spx|nvda|mag7/.test(value)) return "equities";
  if (/inflation|cpi|ppi|pce|jobs|payroll|productivity|gdp|growth|consumer/.test(value)) return "macro";
  return "generic";
}

function callout(type: string, label: string, value: string | null) {
  return value ? [{ type, label, text: value }] : [];
}

function legacyLesson(candidate: DossierComposerCandidate, numberValue: number) {
  if (candidate.existingLesson) return { ...candidate.existingLesson, number: numberValue };
  const body = [candidate.thesis, candidate.explanation].filter((value, index, list): value is string => Boolean(value && list.indexOf(value) === index));
  return {
    number: numberValue,
    storyId: candidate.storyId,
    publicationSnapshotId: candidate.snapshotId,
    thesisVersionId: candidate.thesisVersionId,
    icon: iconFor(candidate),
    title: candidate.question || candidate.title,
    question: candidate.question,
    body,
    causeEffect: [],
    callouts: [
      ...callout("why_traders_care", "WHY TRADERS CARE", candidate.assets.length ? `Affected markets: ${candidate.assets.join(", ")}.` : null),
      ...callout("warning", "IMPORTANT CAVEAT", candidate.strongestContradiction),
      ...callout("confirmation", "WHAT CONFIRMS THIS?", candidate.confirmation),
      ...callout("invalidation", "WHAT WEAKENS THIS?", candidate.invalidation),
    ],
    watchItems: [],
    evidenceRefs: [...candidate.evidenceRefs],
    confidence: candidate.confidence,
  };
}

function primaryStoryline(composition: DossierStorylineComposition) {
  const storyline = composition.storylines[0];
  if (!storyline) return null;
  return {
    title: storyline.title,
    nodes: storyline.nodes.map((node) => ({ id: node.id, label: node.label })),
    links: storyline.links.map((link) => ({
      from: link.from,
      to: link.to,
      relationship: link.relationship,
      evidenceStatus: link.evidenceStatus,
      evidenceRefs: [...link.evidenceRefs],
    })),
    strongestBreakCondition: storyline.strongestBreakCondition,
  };
}

export function applyDossierStorylineComposition(
  payload: JsonRecord,
  candidates: DossierComposerCandidate[],
  composition: DossierStorylineComposition,
  compositionWarnings: string[] = [],
) {
  const original = object(payload.dossier) ? payload.dossier : {};
  const byId = new Map(candidates.map((candidate) => [candidate.storyId, candidate]));
  const lessons = composition.lessonOrder.flatMap((storyId, index) => {
    const candidate = byId.get(storyId);
    return candidate ? [legacyLesson(candidate, index + 1)] : [];
  });
  const quickSummary = lessons.slice(0, 5).map((lesson, index) => ({
    rank: index + 1,
    text: Array.isArray(lesson.body) && typeof lesson.body[0] === "string" ? lesson.body[0] : lesson.title,
    storyId: lesson.storyId,
  }));
  const selectedAssets = [...new Set(composition.lessonOrder.flatMap((storyId) => byId.get(storyId)?.assets || []))].slice(0, 7);
  const originalOpening = object(original.opening) ? original.opening : {};
  const originalDiagnostics = object(original.diagnostics) ? original.diagnostics : {};
  const existingWarnings = strings(originalDiagnostics.warnings);
  const sourceDiscipline = object(original.sourceDiscipline) ? original.sourceDiscipline : {};
  const interpretationNotes = strings(sourceDiscipline.interpretationNotes);
  return {
    ...original,
    contractVersion: text(original.contractVersion) || "dossier-briefing/v1",
    generatedAt: new Date().toISOString(),
    opening: {
      ...originalOpening,
      headline: composition.opening.headline,
      summary: composition.opening.summary,
      marketState: text(originalOpening.marketState) || (object(payload.marketTape) ? text(payload.marketTape.regimeSummary) : null) || "Canonical market tape is unavailable.",
      topicChips: selectedAssets.length ? selectedAssets : strings(originalOpening.topicChips),
    },
    quickSummary,
    primaryStoryline: primaryStoryline(composition),
    storylines: composition.storylines,
    lessons,
    sourceDiscipline: {
      ...sourceDiscipline,
      interpretationNotes: [...new Set([
        ...interpretationNotes,
        "Edition-level causal grouping uses exact persisted Story snapshots. Legacy Stories without itemised evidence IDs may support inferred cross-Story links at Story-snapshot level, but never observed or strongly-supported links.",
      ])],
    },
    diagnostics: {
      ...originalDiagnostics,
      warnings: [...new Set([...existingWarnings, ...compositionWarnings])],
      eventHorizonCoverage: Array.isArray(originalDiagnostics.eventHorizonCoverage) ? originalDiagnostics.eventHorizonCoverage : [],
    },
    readAloud: object(original.readAloud) ? original.readAloud : { available: true },
    compositionVersion: DOSSIER_STORYLINE_COMPOSITION_V1,
  };
}

export async function composePersistedDossierStorylines({
  editionPayload,
  modelRunner = runStructuredStage,
}: {
  editionPayload: JsonRecord;
  modelRunner?: ModelRunner;
}) {
  const candidates = buildDossierComposerCandidates(editionPayload);
  if (!candidates.length) {
    return {
      dossier: object(editionPayload.dossier) ? editionPayload.dossier : null,
      composition: null,
      warnings: ["Dossier storyline composition skipped: no active immutable Story candidates were available."],
      model: null,
    };
  }
  const marketTape = object(editionPayload.marketTape) ? editionPayload.marketTape : null;
  const result = await modelRunner<ModelOutput>({
    stageKey: "dossier_storyline_composer",
    instructions: COMPOSER_INSTRUCTIONS,
    input: {
      marketTape,
      candidates: candidates.map((candidate) => ({
        position: candidate.position,
        storyId: candidate.storyId,
        snapshotId: candidate.snapshotId,
        thesisVersionId: candidate.thesisVersionId,
        title: candidate.title,
        question: candidate.question,
        thesis: candidate.thesis,
        explanation: candidate.explanation,
        strongestSupport: candidate.strongestSupport,
        strongestContradiction: candidate.strongestContradiction,
        confirmation: candidate.confirmation,
        invalidation: candidate.invalidation,
        assets: candidate.assets,
        confidence: candidate.confidence,
        lifecycle: candidate.lifecycle,
        isCurrentChange: candidate.isCurrentChange,
        evidenceRefs: candidate.evidenceRefs,
        existingCausalEdges: candidate.existingCausalEdges,
      })),
    },
    schema: COMPOSER_SCHEMA as unknown as Record<string, unknown>,
    modelKind: "complex",
    maxOutputTokens: 5_000,
    maxAttempts: 2,
  });
  const sanitised = sanitiseModelOutput(result.data, candidates);
  return {
    dossier: applyDossierStorylineComposition(editionPayload, candidates, sanitised.composition, sanitised.warnings),
    composition: sanitised.composition,
    warnings: sanitised.warnings,
    model: {
      model: result.model,
      requestId: result.requestId,
      responseId: result.responseId,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      totalTokens: result.totalTokens,
    },
  };
}
