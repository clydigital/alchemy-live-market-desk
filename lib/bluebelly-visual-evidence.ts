/** Source-preserving visual payload for an already authorised Bluebelly edition. */
export type EvidenceStatus = "ORIGINAL_VERIFIED" | "CORROBORATED" | "RESEARCH_LEAD" | "UNKNOWN";
export type VisualKind = "table" | "bar" | "line" | "comparison";
export type VisualDatum = string | number | null;
export interface VisualSource {
  url: string;
  publisher: string;
  observed_at: string;
}
export interface VisualPayload {
  schema_version: "bluebelly.visual.v1";
  visual_id: string;
  kind: VisualKind;
  title: string;
  description: string;
  unit: string;
  as_of_et: string;
  retrieved_at: string;
  period_basis: string;
  columns: string[];
  rows: VisualDatum[][];
  series: { name: string; values: (number | null)[] }[];
  sources: VisualSource[];
  evidence_status: EvidenceStatus;
  limitations: string[];
}

const statuses: EvidenceStatus[] = ["ORIGINAL_VERIFIED", "CORROBORATED", "RESEARCH_LEAD", "UNKNOWN"];
const kinds: VisualKind[] = ["table", "bar", "line", "comparison"];
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const validDate = (s: unknown): s is string => typeof s === "string" && /(?:Z|[+-]\d\d:\d\d)$/.test(s) && Number.isFinite(Date.parse(s));
const isDatum = (v: unknown): v is VisualDatum => v === null || typeof v === "string" || (typeof v === "number" && Number.isFinite(v));
const isHttpUrl = (v: unknown): v is string => typeof v === "string" && /^https?:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(v);

/** Reject malformed or unproven visuals rather than silently inventing values. */
export function parseVisualPayload(value: unknown): VisualPayload | null {
  if (!isRecord(value) || value.schema_version !== "bluebelly.visual.v1" ||
    !kinds.includes(value.kind as VisualKind) || !statuses.includes(value.evidence_status as EvidenceStatus)) return null;
  for (const field of ["visual_id", "title", "description", "unit", "period_basis"] as const) {
    if (typeof value[field] !== "string" || !(value[field] as string).trim()) return null;
  }
  if (!validDate(value.as_of_et) || !validDate(value.retrieved_at) ||
    !Array.isArray(value.columns) || !value.columns.every(v => typeof v === "string" && !!v.trim()) ||
    !Array.isArray(value.rows) || !value.rows.every(v => Array.isArray(v) && v.length === (value.columns as string[]).length && v.every(isDatum)) ||
    !Array.isArray(value.series) || !value.series.every(v => isRecord(v) && typeof v.name === "string" && Array.isArray(v.values) && v.values.every(n => n === null || (typeof n === "number" && Number.isFinite(n)))) ||
    !Array.isArray(value.limitations) || !value.limitations.every(v => typeof v === "string") ||
    !Array.isArray(value.sources) || value.sources.length === 0 ||
    !value.sources.every(v => isRecord(v) && isHttpUrl(v.url) && typeof v.publisher === "string" && !!v.publisher.trim() && validDate(v.observed_at))) return null;
  if (value.kind === "table" && value.columns.length === 0) return null;
  if (value.kind !== "table" && value.series.length === 0) return null;
  return value as unknown as VisualPayload;
}

/** Only independently admitted evidence may be projected into public articles. */
export function isPublicVisualEligible(value: unknown): value is VisualPayload {
  const parsed = parseVisualPayload(value);
  return !!parsed && (parsed.evidence_status === "ORIGINAL_VERIFIED" || parsed.evidence_status === "CORROBORATED");
}

export type IdeaScoreCriterion = "market_impact" | "evidence_quality" | "decision_utility" | "novelty" | "timeliness";
export const IDEA_SCORE_MAX: Readonly<Record<IdeaScoreCriterion, number>> = {
  market_impact: 25, evidence_quality: 25, decision_utility: 20, novelty: 15, timeliness: 15
};
export interface IdeaPriority {
  score_version: "bluebelly.idea-priority.v1";
  criterion_scores: Record<IdeaScoreCriterion, number>;
  total: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  source_vintage: string;
  reason: string;
  editor_override: number | null;
  override_reason: string | null;
}
/** Scoring follows, never replaces, the existing binary reasoning/evidence qualification gate. */
export function scoreQualifiedIdea(
  qualified: boolean,
  scores: Partial<Record<IdeaScoreCriterion, number>>,
  context: { source_vintage: string; reason: string; confidence: IdeaPriority["confidence"]; editor_override?: number | null; override_reason?: string | null }
): IdeaPriority | null {
  if (!qualified || !validDate(context.source_vintage) || !context.reason.trim() ||
    !["HIGH", "MEDIUM", "LOW"].includes(context.confidence)) return null;
  const keys = Object.keys(IDEA_SCORE_MAX) as IdeaScoreCriterion[];
  if (keys.some(k => !Number.isInteger(scores[k]) || (scores[k] as number) < 0 || (scores[k] as number) > IDEA_SCORE_MAX[k])) return null;
  const override = context.editor_override ?? null;
  if (override !== null && (!Number.isInteger(override) || override < 0 || override > 100 || !context.override_reason?.trim())) return null;
  const criterion_scores = Object.fromEntries(keys.map(k => [k, scores[k]])) as Record<IdeaScoreCriterion, number>;
  return {
    score_version: "bluebelly.idea-priority.v1", criterion_scores,
    total: keys.reduce((sum, k) => sum + criterion_scores[k], 0),
    confidence: context.confidence, source_vintage: context.source_vintage, reason: context.reason,
    editor_override: override, override_reason: override === null ? null : context.override_reason!
  };
}
