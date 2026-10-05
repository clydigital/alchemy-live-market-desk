import {
  type AutomaticGapEvidence,
  type CompletedResearchGapResult,
} from "./research-gap-auto-handoff.ts";
import type { ResearchGapCaseRow, ResearchGapOutcome } from "./research-gap-lifecycle.ts";

type PersistedPlan = {
  contractVersion?: unknown;
  planId?: unknown;
  researchQuestion?: unknown;
  priorExpectation?: unknown;
  linkedInvestigationIds?: unknown;
};

type PersistedVerdictEvidence = {
  evidenceId?: unknown;
  sourceClass?: unknown;
  sourceUrl?: unknown;
  sourceTitle?: unknown;
  publisher?: unknown;
  publishedAt?: unknown;
  summary?: unknown;
  requirementIds?: unknown;
  direction?: unknown;
  directness?: unknown;
  quality?: unknown;
  traceable?: unknown;
  claim?: unknown;
};

type PersistedVerdict = {
  contractVersion?: unknown;
  evidenceSnapshotVersion?: unknown;
  evidenceSnapshot?: unknown;
  evaluatedAt?: unknown;
  outcome?: unknown;
  confidence?: unknown;
  rationale?: unknown;
  missingRequirementIds?: unknown;
  nextResearch?: unknown;
};

const VALID_OUTCOMES = new Set<ResearchGapOutcome>([
  "CONFIRMING",
  "CONTRADICTING",
  "UNRESOLVED",
  "NO_CHANGE",
]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validDate(value: unknown) {
  return typeof value === "string"
    && value.trim().length > 0
    && Number.isFinite(Date.parse(value));
}

function strings(value: unknown, limit = 24) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(clean).filter(Boolean))].slice(0, limit);
}

function numberInRange(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.round(value)))
    : null;
}

function requireHttps(value: unknown) {
  const text = clean(value);
  try {
    const url = new URL(text);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function outcomeImplication(outcome: ResearchGapOutcome) {
  if (outcome === "CONFIRMING") {
    return "Underlying evidence supports the investigated direction; canonical Live must independently decide whether any Story or Regime changes.";
  }
  if (outcome === "CONTRADICTING") {
    return "Underlying evidence contradicts the investigated direction; canonical Live must independently decide whether any Story or Regime changes.";
  }
  if (outcome === "NO_CHANGE") {
    return "Evidence supports no material change; admit the source packet for canonical context without forcing Story recalibration.";
  }
  return "Do not force a directional Story or Regime change; admit the conflicting evidence packet for canonical review.";
}

function evidenceToHandoff(
  item: PersistedVerdictEvidence,
  observedAt: string,
): AutomaticGapEvidence {
  const sourceId = clean(item.evidenceId);
  const publisher = clean(item.publisher);
  const url = requireHttps(item.sourceUrl);
  const title = clean(item.sourceTitle) || (publisher ? `${publisher} source` : "");
  const claim = clean(item.claim);
  const quality = numberInRange(item.quality, 0, 100);

  if (!sourceId || !publisher || !url || !claim || quality === null || item.traceable !== true) {
    throw new Error("Persisted Research Gap evidence is missing traceable source metadata required for canonical handoff.");
  }

  const hasPublishedAt = validDate(item.publishedAt);
  const publishedAt = hasPublishedAt
    ? new Date(clean(item.publishedAt)).toISOString()
    : observedAt;
  const summary = clean(item.summary);
  const dateNote = hasPublishedAt
    ? ""
    : `Observed by Research Gap at ${observedAt}; the underlying source page did not expose a reliable publication timestamp.`;

  return {
    sourceId,
    itemType: "news",
    publisher,
    title,
    url,
    publishedAt,
    claim,
    summary: [dateNote, summary].filter(Boolean).join(" "),
    sourceQuality: quality,
    // These are conservative intake-routing scores. The canonical intelligence
    // engine, not this adapter, owns any Story/Regime interpretation.
    relevance: item.directness === "DIRECT" ? 85 : 70,
    novelty: 60,
    materiality: item.directness === "DIRECT" ? 75 : 65,
  };
}

export function completedResearchGapResultFromSnapshot(
  row: ResearchGapCaseRow,
): CompletedResearchGapResult {
  if (row.status !== "COMPLETED" && row.status !== "HANDED_OFF") {
    throw new Error("Research Gap case must be COMPLETED or HANDED_OFF before snapshot handoff.");
  }
  if (!row.completed_at || !validDate(row.completed_at)) {
    throw new Error("Completed Research Gap case is missing completed_at.");
  }

  const plan = (row.research_plan ?? {}) as PersistedPlan;
  const verdict = (row.verdict ?? {}) as PersistedVerdict;
  const planId = clean(plan.planId);
  const researchQuestion = clean(plan.researchQuestion) || clean(row.question) || clean(row.action);
  const priorExpectation = clean(plan.priorExpectation);
  const verdictOutcome = clean(verdict.outcome);
  const outcome = row.research_outcome;

  if (!planId || !researchQuestion) {
    throw new Error("Persisted Research Gap plan is missing planId or researchQuestion.");
  }
  if (!outcome || !VALID_OUTCOMES.has(outcome) || verdictOutcome !== outcome) {
    throw new Error("Persisted Research Gap outcome does not match the deterministic verdict.");
  }
  if (verdict.contractVersion !== "research-gap-verdict/1") {
    throw new Error("Persisted Research Gap verdict version is unsupported.");
  }
  if (verdict.evidenceSnapshotVersion !== "research-gap-evidence-snapshot/1") {
    throw new Error("Persisted Research Gap verdict has no durable evidence snapshot.");
  }

  const observedAt = validDate(verdict.evaluatedAt)
    ? new Date(clean(verdict.evaluatedAt)).toISOString()
    : new Date(row.completed_at).toISOString();
  const snapshot = Array.isArray(verdict.evidenceSnapshot)
    ? verdict.evidenceSnapshot as PersistedVerdictEvidence[]
    : [];
  if (!snapshot.length) throw new Error("Persisted Research Gap verdict has an empty evidence snapshot.");

  const rationale = strings(verdict.rationale, 12);
  const finding = rationale.join(" ") || `Research Gap completed with ${outcome.toLowerCase().replaceAll("_", " ")} evidence.`;
  const confidence = numberInRange(verdict.confidence, 0, 100);
  if (confidence === null) throw new Error("Persisted Research Gap verdict is missing confidence.");

  const investigationIds = strings(plan.linkedInvestigationIds, 12);
  const nextResearch = strings(verdict.nextResearch, 12);
  const missingRequirementIds = strings(verdict.missingRequirementIds, 12);
  const remainsUnknown = [
    ...missingRequirementIds.map((id) => `Required evidence branch remains unresolved: ${id}.`),
    ...(outcome === "UNRESOLVED" && !missingRequirementIds.length
      ? ["Directional interpretation remains unresolved despite complete requirement coverage."]
      : []),
  ];

  return {
    caseId: row.id,
    gateRunId: planId,
    gapId: row.id,
    ...(investigationIds[0] ? { investigationId: investigationIds[0] } : {}),
    researchQuestion,
    ...(priorExpectation ? { priorExpectation } : {}),
    finding: finding.slice(0, 2_000),
    confidence,
    outcome,
    ...(remainsUnknown.length ? { remainsUnknown } : {}),
    liveImplication: outcomeImplication(outcome),
    ...(nextResearch[0] ? { nextTest: nextResearch[0] } : {}),
    completedAt: new Date(row.completed_at).toISOString(),
    evidence: snapshot.map((item) => evidenceToHandoff(item, observedAt)),
  };
}
