import "server-only";

import { runStructuredStage, type OpenAIStageResult } from "./openai.ts";

export const DOSSIER_STORYLINE_COMPOSITION_V1 = "dossier-storyline-composition/v1" as const;
const MAX_COMPOSER_CANDIDATES = 8;
const MAX_STORYLINES = 3;
const MAX_DOSSIER_LESSONS = 8;
const STORYLINE_NODE_TYPES = ["event", "macro", "policy", "rates", "fx", "commodity", "equity", "credit", "positioning"] as const;

export type StorylineEvidenceState = "observed" | "strongly_supported" | "inferred" | "speculative";
export type StorylineNodeType = typeof STORYLINE_NODE_TYPES[number];
type JsonRecord = Record<string, unknown>;

type ExistingLesson = JsonRecord & { storyId: string; evidenceRefs: string[] };
type PersistedManifestEntry = {
  position: number;
  snapshotId: string;
  storyId: string;
  thesisVersionId: string;
  state: JsonRecord;
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
  currentAttention: JsonRecord | null;
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
  opening: { headline: string; summary: string };
  storylines: Array<{
    id: string;
    title: string;
    centralQuestion: string;
    summary: string;
    storyIds: string[];
    nodes: Array<{ id: string; label: string; type: StorylineNodeType; storyIds: string[] }>;
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
      properties: { headline: { type: "string" }, summary: { type: "string" } },
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
              required: ["id", "label", "type", "storyIds"],
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                type: { type: "string", enum: ["event", "macro", "policy", "rates", "fx", "commodity", "equity", "credit", "positioning"] },
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
Your job is to organise supplied canonical Story snapshots into the smallest causal model that best explains the current market state. Do not create new research.

Hard rules:
- Use only supplied candidate Stories and market tape.
- Never invent a Story ID, evidence ID, fact, number, market move or thesis version.
- Produce one to three storylines. Do not force unrelated Stories together.
- Group Stories only where supplied text supports a causal, transmission or conditional relationship.
- Preserve countercases and break conditions. Do not turn correlation into causation.
- Every Story reference must exactly match a candidate storyId.
- Every node.type must be exactly one of event, macro, policy, rates, fx, commodity, equity, credit, or positioning.
- Every evidenceRefs value must be copied from evidenceRefs supplied for supporting Stories.
- Legacy Story snapshots may support inferred or speculative cross-Story links even when itemised evidence IDs are unavailable.
- observed or strongly_supported is allowed only when an existing supplied causal edge directly supports the same arrow.
- Use short, plain British English.
- Put lessonOrder in teaching order, not confidence order. Keep genuinely material current-change Stories.
- Do not add trade instructions.

Reader-facing composition (opening and storyline summaries):
- Start with the supplied event, change or current market condition and explain why it matters. When nothing new is supplied, describe the continuing condition without presenting it as today's news.
- Follow the reader's next question: what happened, how does the mechanism work, what comparison helps explain it, and what condition could change the interpretation? Use this as a reasoning sequence, not a mandatory set of headings or repeated questions.
- Explain one supported causal step at a time in connected prose. Include numbers only where they answer that question; preserve their supplied comparator, timeframe and uncertainty. Never manufacture a missing comparator.
- Where supplied evidence supports alternatives, explain them with clear if/then conditions and keep the strongest countercase visible. Do not turn a conditional outcome into a prediction or an automatic asset-direction rule.
- A difference between the expected mechanism and observed price reaction may lead the explanation only when both are supplied. Without market tape, do not claim that markets rallied, sold off, absorbed news or refused to break.
- Use direct, ordinary language. Avoid suspense, hype, rhetorical questions, artificial contrasts, repeated punchlines and fragments such as "That matters", "The interesting part?" or "So far, it hasn't". State the actual implication instead.
- Keep each sentence useful to a reader. Do not discuss the Brain, Cranium, candidate selection, scoring, pipeline, prompts or the writing process in reader-facing prose.
- Preserve the supplied thesis, evidence qualifications and break conditions while improving explanation. Do not copy an example market narrative into an unrelated edition.`;

function object(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown) {
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

function storylineNodeType(value: unknown): StorylineNodeType | null {
  const candidate = String(value);
  return (STORYLINE_NODE_TYPES as readonly string[]).includes(candidate) ? candidate as StorylineNodeType : null;
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

function activeLifecycle(value: string) {
  const lifecycle = value.toLowerCase();
  return !lifecycle.includes("invalid") && !lifecycle.includes("archive");
}

function existingLessonMap(dossier: JsonRecord | null) {
  const output = new Map<string, ExistingLesson>();
  const lessons = dossier && Array.isArray(dossier.lessons) ? dossier.lessons : [];
  for (const lesson of lessons) {
    if (!object(lesson)) continue;
    const storyId = text(lesson.storyId);
    if (!storyId) continue;
    output.set(storyId, { ...lesson, storyId, evidenceRefs: strings(lesson.evidenceRefs) });
  }
  return output;
}

function existingEdges(lesson: ExistingLesson | null) {
  if (!lesson || !Array.isArray(lesson.causeEffect)) return [];
  return lesson.causeEffect.flatMap((edge) => {
    if (!object(edge)) return [];
    const from = text(edge.from);
    const to = text(edge.to);
    const relationship = text(edge.relationship);
    if (!from || !to || !relationship) return [];
    return [{
      from,
      to,
      relationship,
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
    const thesisVersionId = text(entry.thesisVersionId)
      || (object(entry.state.thesisVersion) ? text(entry.state.thesisVersion.id) : null);
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

function changedStoryIds(payload: JsonRecord) {
  const stories = Array.isArray(payload.stories) ? payload.stories : [];
  return new Set(stories.flatMap((story) => object(story) && text(story.id) ? [text(story.id)!] : []));
}

function candidateFromManifest(entry: PersistedManifestEntry, lesson: ExistingLesson | null, changedIds: Set<string>): DossierComposerCandidate | null {
  const state = entry.state;
  const intelligence = object(state.intelligence) ? state.intelligence : null;
  const confidence = finiteNumber(state.confidence);
  const title = text(state.title) || text(lesson?.title);
  if (confidence === null || !title) return null;

  const causalEdges = existingEdges(lesson);
  const assets = strings(state.assets).length ? strings(state.assets) : strings(intelligence?.affectedAssets);
  const evidenceRefs = [...new Set([
    ...(lesson?.evidenceRefs || []),
    ...strings(intelligence?.decisiveEvidenceIds),
    ...causalEdges.flatMap((edge) => edge.evidenceRefs),
  ])];

  return {
    position: entry.position,
    storyId: entry.storyId,
    snapshotId: entry.snapshotId,
    thesisVersionId: entry.thesisVersionId,
    title,
    question: text(state.marketQuestion) || text(lesson?.question),
    thesis: text(state.thesis) || (Array.isArray(lesson?.body) ? text(lesson.body[0]) : null) || title,
    explanation: text(state.bestExplanation) || text(intelligence?.researchSynthesis),
    strongestSupport: text(state.strongestSupport) || text(intelligence?.strongestSupport),
    strongestContradiction: text(state.strongestContradiction) || text(intelligence?.strongestContradiction),
    confirmation: text(state.confirmationCondition) || text(intelligence?.confirmationCondition) || text(intelligence?.confirmation),
    invalidation: text(state.invalidationCondition) || text(intelligence?.invalidationCondition) || text(intelligence?.invalidation),
    assets,
    confidence,
    lifecycle: text(intelligence?.lifecycleStatus) || text(state.status) || "detected",
    isCurrentChange: changedIds.has(entry.storyId),
    currentAttention: object(lesson?.currentAttention) ? lesson.currentAttention : null,
    evidenceRefs,
    existingCausalEdges: causalEdges,
    existingLesson: lesson,
  };
}

function candidateScore(candidate: DossierComposerCandidate, marketTape: JsonRecord | null) {
  const tapeAssets = new Set(
    marketTape && Array.isArray(marketTape.assets)
      ? marketTape.assets.flatMap((asset) => object(asset) && text(asset.symbol) ? [normaliseAsset(text(asset.symbol)!)] : [])
      : [],
  );
  const overlap = candidate.assets.map(normaliseAsset).filter((asset) => tapeAssets.has(asset)).length;
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
  const wordOverlap = [...storyText].filter((word) => tapeText.has(word)).length;
  return candidate.confidence
    + (candidate.isCurrentChange ? 30 : 0)
    + lifecycleScore(candidate.lifecycle)
    + Math.max(0, 20 - Math.max(0, candidate.position - 1) * 2)
    + Math.min(60, overlap * 20)
    + Math.min(20, wordOverlap * 4);
}

export function buildDossierComposerCandidates(payload: JsonRecord) {
  const dossier = object(payload.dossier) ? payload.dossier : null;
  const lessons = existingLessonMap(dossier);
  const admittedStoryIds = new Set(lessons.keys());
  const changedIds = changedStoryIds(payload);
  const marketTape = object(payload.marketTape) ? payload.marketTape : null;
  const ranked = manifestEntries(payload.canonicalStoryManifest)
    .flatMap((entry) => {
      // The deterministic base Dossier owns current-attention admission. The
      // semantic composer may group and teach those Stories, but must never
      // reintroduce stale manifest memory that the base ranker excluded.
      if (dossier && !admittedStoryIds.has(entry.storyId)) return [];
      const candidate = candidateFromManifest(entry, lessons.get(entry.storyId) || null, changedIds);
      if (!candidate || (!candidate.isCurrentChange && !activeLifecycle(candidate.lifecycle))) return [];
      const lessonNumber = finiteNumber(candidate.existingLesson?.number);
      return [{
        candidate,
        score: dossier && lessonNumber !== null
          ? 10_000 - lessonNumber
          : candidateScore(candidate, marketTape),
      }];
    })
    .sort((left, right) => right.score - left.score || left.candidate.position - right.candidate.position);

  const selected = ranked.slice(0, MAX_COMPOSER_CANDIDATES);
  const selectedIds = new Set(selected.map((item) => item.candidate.storyId));
  for (const changed of ranked.filter((item) => item.candidate.isCurrentChange && !selectedIds.has(item.candidate.storyId))) {
    const replace = [...selected].reverse().findIndex((item) => !item.candidate.isCurrentChange);
    if (replace < 0) break;
    const actualIndex = selected.length - 1 - replace;
    selectedIds.delete(selected[actualIndex].candidate.storyId);
    selected[actualIndex] = changed;
    selectedIds.add(changed.candidate.storyId);
  }
  return selected.sort((left, right) => right.score - left.score || left.candidate.position - right.candidate.position).map((item) => item.candidate);
}

function candidateNodeType(candidate: DossierComposerCandidate): StorylineNodeType {
  const value = `${candidate.title} ${candidate.question || ""} ${candidate.thesis} ${candidate.assets.join(" ")}`.toLowerCase();
  if (/oil|crude|brent|wti|energy|diesel|gasoline|refin|commodity|hormuz/.test(value)) return "commodity";
  if (/fed|fomc|central bank|policy|warsh|powell|ecb|boe|boj/.test(value)) return "policy";
  if (/treasury|yield|bond|duration|term premium|curve|jgb|rates?/.test(value)) return "rates";
  if (/usd|eur|gbp|aud|nzd|cad|chf|jpy|yen|currency|fx/.test(value)) return "fx";
  if (/credit|spread|funding|financ|leverage/.test(value)) return "credit";
  if (/position|flow|crowd|short|long positioning|carry trade/.test(value)) return "positioning";
  if (/equity|stock|software|semiconductor|tech|earnings|nasdaq|s&p|spx|nvda|mag7/.test(value)) return "equity";
  if (/war|attack|sanction|election|geopolit|meeting|announcement/.test(value)) return "event";
  return "macro";
}

function exactExistingEdge(
  fromLabel: string,
  toLabel: string,
  relationship: string,
  supportingStoryIds: string[],
  candidatesById: Map<string, DossierComposerCandidate>,
) {
  const from = fromLabel.toLowerCase();
  const to = toLabel.toLowerCase();
  const relation = relationship.toLowerCase();
  return supportingStoryIds.some((storyId) => candidatesById.get(storyId)?.existingCausalEdges.some((edge) => (
    edge.from.toLowerCase() === from
    && edge.to.toLowerCase() === to
    && edge.relationship.toLowerCase() === relation
    && ["observed", "strongly_supported"].includes(edge.evidenceStatus)
  )));
}

function sanitiseModelOutput(data: ModelOutput, candidates: DossierComposerCandidate[]) {
  const warnings: string[] = [];
  const candidatesById = new Map(candidates.map((candidate) => [candidate.storyId, candidate]));
  const allowedIds = new Set(candidatesById.keys());
  const evidenceByStory = new Map(candidates.map((candidate) => [candidate.storyId, new Set(candidate.evidenceRefs)]));
  const usedStoryIds = new Set<string>();
  const storylines: DossierStorylineComposition["storylines"] = [];
  const rawStorylines = Array.isArray(data.storylines) ? data.storylines.slice(0, MAX_STORYLINES) : [];

  for (const [index, raw] of rawStorylines.entries()) {
    if (!object(raw)) continue;
    const storyIds = strings(raw.storyIds).filter((id) => allowedIds.has(id) && !usedStoryIds.has(id));
    if (!storyIds.length) continue;
    storyIds.forEach((id) => usedStoryIds.add(id));

    const id = text(raw.id) || `storyline-${index + 1}`;
    const nodeIds = new Set<string>();
    const nodes = (Array.isArray(raw.nodes) ? raw.nodes : []).flatMap((node, nodeIndex) => {
      if (!object(node)) return [];
      const nodeId = text(node.id) || `${id}:node:${nodeIndex + 1}`;
      const label = text(node.label);
      const type = storylineNodeType(node.type);
      const nodeStories = strings(node.storyIds).filter((storyId) => storyIds.includes(storyId));
      if (!label || !type || !nodeStories.length || nodeIds.has(nodeId)) return [];
      nodeIds.add(nodeId);
      return [{ id: nodeId, label, type, storyIds: nodeStories }];
    });
    if (!nodes.length) {
      storyIds.forEach((storyId) => usedStoryIds.delete(storyId));
      continue;
    }
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const nodeLabels = new Map(nodes.map((node) => [node.id, node.label]));

    const links = (Array.isArray(raw.links) ? raw.links : []).flatMap((link) => {
      if (!object(link)) return [];
      const from = text(link.from);
      const to = text(link.to);
      const relationship = text(link.relationship);
      const supportingStoryIds = strings(link.supportingStoryIds).filter((storyId) => storyIds.includes(storyId));
      if (!from || !to || !relationship || !nodeIds.has(from) || !nodeIds.has(to) || !supportingStoryIds.length) return [];
      const fromStories = nodesById.get(from)?.storyIds || [];
      const toStories = nodesById.get(to)?.storyIds || [];
      if (!supportingStoryIds.some((storyId) => fromStories.includes(storyId))
        || !supportingStoryIds.some((storyId) => toStories.includes(storyId))) return [];

      const allowedEvidence = new Set(supportingStoryIds.flatMap((storyId) => [...(evidenceByStory.get(storyId) || [])]));
      const evidenceRefs = strings(link.evidenceRefs).filter((evidenceId) => allowedEvidence.has(evidenceId));
      let status = evidenceState(link.evidenceStatus);
      if (["observed", "strongly_supported"].includes(status)) {
        const supported = exactExistingEdge(
          nodeLabels.get(from) || "",
          nodeLabels.get(to) || "",
          relationship,
          supportingStoryIds,
          candidatesById,
        );
        if (!supported) {
          status = "inferred";
          warnings.push(`Storyline link ${from} -> ${to} was downgraded to inferred because no exact pre-existing canonical causal edge supports the stronger label.`);
        }
      }
      return [{ from, to, relationship, evidenceStatus: status, evidenceRefs, supportingStoryIds }];
    });

    const first = candidatesById.get(storyIds[0]);
    storylines.push({
      id,
      title: text(raw.title) || first?.title || `Storyline ${index + 1}`,
      centralQuestion: text(raw.centralQuestion) || first?.question || first?.title || `Storyline ${index + 1}`,
      summary: text(raw.summary) || first?.explanation || first?.thesis || `Storyline ${index + 1}`,
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
      nodes: [{ id: `story:${candidate.storyId}`, label: candidate.title, type: candidateNodeType(candidate), storyIds: [candidate.storyId] }],
      links: [],
      strongestBreakCondition: candidate.invalidation,
    });
    warnings.push("The model returned no valid causal storyline; the Dossier fell back to the highest-ranked canonical Story without inventing cross-Story links.");
  }

  const rawOrder = Array.isArray(data.lessonOrder) ? strings(data.lessonOrder).filter((id) => allowedIds.has(id)) : [];
  const storylineOrder = storylines.flatMap((storyline) => storyline.storyIds);
  const currentChanges = candidates.filter((candidate) => candidate.isCurrentChange).map((candidate) => candidate.storyId);
  const allCandidates = candidates.map((candidate) => candidate.storyId);
  const lessonOrder = [...new Set([...rawOrder, ...storylineOrder, ...currentChanges, ...allCandidates])].slice(0, MAX_DOSSIER_LESSONS);
  const opening: JsonRecord = object(data.opening) ? data.opening : {};

  return {
    composition: {
      contractVersion: DOSSIER_STORYLINE_COMPOSITION_V1,
      opening: {
        headline: text(opening.headline) || storylines[0]?.title || candidates[0]?.title || "Current market state",
        summary: text(opening.summary) || storylines[0]?.summary || candidates[0]?.explanation || candidates[0]?.thesis || "No supported causal summary is available.",
      },
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
  if (/credit|spread|funding|financ/.test(value)) return "credit";
  if (/usd|eur|gbp|aud|nzd|cad|chf|currency|fx/.test(value)) return "fx";
  if (/equity|stock|software|semiconductor|tech|earnings|nasdaq|s&p|spx|nvda|mag7/.test(value)) return "equities";
  if (/inflation|cpi|ppi|pce|jobs|payroll|productivity|gdp|growth|consumer/.test(value)) return "macro";
  return "generic";
}

function optionalCallout(type: string, label: string, value: string | null) {
  return value ? [{ type, label, text: value }] : [];
}

function lessonFor(candidate: DossierComposerCandidate, lessonNumber: number) {
  if (candidate.existingLesson) return { ...candidate.existingLesson, number: lessonNumber };
  const body = [candidate.thesis, candidate.explanation].filter((value, index, values): value is string => Boolean(value && values.indexOf(value) === index));
  return {
    number: lessonNumber,
    storyId: candidate.storyId,
    publicationSnapshotId: candidate.snapshotId,
    thesisVersionId: candidate.thesisVersionId,
    icon: iconFor(candidate),
    title: candidate.question || candidate.title,
    question: candidate.question,
    body,
    causeEffect: [],
    callouts: [
      ...optionalCallout("why_traders_care", "WHY TRADERS CARE", candidate.assets.length ? `Affected markets: ${candidate.assets.join(", ")}.` : null),
      ...optionalCallout("warning", "IMPORTANT CAVEAT", candidate.strongestContradiction),
      ...optionalCallout("confirmation", "WHAT CONFIRMS THIS?", candidate.confirmation),
      ...optionalCallout("invalidation", "WHAT WEAKENS THIS?", candidate.invalidation),
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
    nodes: storyline.nodes.map((node) => ({ id: node.id, label: node.label, type: node.type })),
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
    return candidate ? [lessonFor(candidate, index + 1)] : [];
  });
  const quickSummary = lessons.slice(0, 5).map((lesson, index) => ({
    rank: index + 1,
    text: Array.isArray(lesson.body) && typeof lesson.body[0] === "string" ? lesson.body[0] : lesson.title,
    storyId: lesson.storyId,
  }));
  const originalOpening: JsonRecord = object(original.opening) ? original.opening : {};
  const originalDiagnostics: JsonRecord = object(original.diagnostics) ? original.diagnostics : {};
  const sourceDiscipline: JsonRecord = object(original.sourceDiscipline) ? original.sourceDiscipline : {};
  const selectedAssets = [...new Set(composition.lessonOrder.flatMap((storyId) => byId.get(storyId)?.assets || []))].slice(0, 7);

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
        ...strings(sourceDiscipline.interpretationNotes),
        "Edition-level causal grouping uses exact persisted Story snapshots. Legacy Stories without itemised evidence IDs may support inferred cross-Story links at Story-snapshot level, but never observed or strongly-supported links.",
      ])],
    },
    diagnostics: {
      ...originalDiagnostics,
      warnings: [...new Set([...strings(originalDiagnostics.warnings), ...compositionWarnings])],
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
  const inputWarnings = marketTape ? [] : [
    "Dossier storyline composition ran without persisted market tape. Story grouping can use canonical Story state, but claims about today's price action remain limited until tape is available.",
  ];
  const result = await modelRunner<ModelOutput>({
    stageKey: "dossier_storyline_composer",
    instructions: COMPOSER_INSTRUCTIONS,
    input: {
      marketTape,
      candidates: candidates.map(({ existingLesson: _existingLesson, ...candidate }) => candidate),
    },
    schema: COMPOSER_SCHEMA as unknown as Record<string, unknown>,
    modelKind: "complex",
    maxOutputTokens: 5_000,
    maxAttempts: 2,
  });
  const sanitised = sanitiseModelOutput(result.data, candidates);
  const warnings = [...inputWarnings, ...sanitised.warnings];
  return {
    dossier: applyDossierStorylineComposition(editionPayload, candidates, sanitised.composition, warnings),
    composition: sanitised.composition,
    warnings,
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
