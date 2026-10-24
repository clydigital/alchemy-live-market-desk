/**
 * A strictly bounded, private projection of an existing immutable
 * story_thesis_versions row. Not a new adjudicator or a Story writer.
 *
 * Snapshot reasoning claim references identify candidates for an independent
 * canonical evidence/source/time join. Their presence alone NEVER verifies a
 * market move, a causal mechanism or a Dossier System-2 acceptance decision.
 */
export const BLUEBELLY_CANONICAL_STORY_VERSION_V1 = "bluebelly-canonical-story-version/1" as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORIGINAL_CLASSES = new Set([
  "official_release", "company_primary", "official_statistic",
  "official_measurement", "verified_macro", "official_document",
  "filing", "regulatory_filing",
]);

type RecordValue = Record<string, unknown>;
const record = (v: unknown): RecordValue | null =>
  v && typeof v === "object" && !Array.isArray(v) ? v as RecordValue : null;
const string = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const bounded = (v: unknown, limit: number): string | null => {
  const t = string(v);
  return t ? t.slice(0, limit) : null;
};
const time = (v: unknown): string | null => {
  const s = string(v);
  return s && Number.isFinite(Date.parse(s)) ? new Date(s).toISOString() : null;
};
const uuid = (v: unknown): string | null => {
  const s = string(v);
  return s && UUID.test(s) ? s.toLowerCase() : null;
};
const validSource = (v: unknown): string | null => {
  const s = string(v);
  if (!s || s.length > 2048) return null;
  try {
    const parsed = new URL(s);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password
      && parsed.hostname.length >= 4
      && (parsed.pathname !== "/" || !!parsed.search) ? parsed.href : null;
  } catch { return null; }
};

export function parseExactCanonicalStoryVersionSelection(
  story: string | null, version: string | null,
): { storyId: string; versionId: string } | null {
  const storyId = uuid(story);
  const versionId = uuid(version);
  return storyId && versionId ? { storyId, versionId } : null;
}

export function referencedEvidenceIds(version: unknown): string[] {
  const snapshot = record(record(version)?.snapshot);
  const reasoning = record(snapshot?.reasoning);
  if (reasoning?.contractVersion !== "canonical-story-reasoning/v1") return [];
  if (!Array.isArray(reasoning.claims)) return [];
  const ids = new Set<string>();
  for (const raw of reasoning.claims.slice(0, 32)) {
    const claim = record(raw);
    if (!Array.isArray(claim?.evidenceIds)) continue;
    for (const rawId of claim.evidenceIds.slice(0, 20)) {
      const id = uuid(rawId);
      if (id) ids.add(id);
      if (ids.size >= 48) return [...ids];
    }
  }
  return [...ids];
}

export type VerifiedVersionFact = {
  evidenceId: string;
  sourceName: string;
  originalSourceUrl: string;
  claimText: string;
  availableAt: string;
};

export type BluebellyCanonicalStoryVersionV1 = {
  contractVersion: typeof BLUEBELLY_CANONICAL_STORY_VERSION_V1;
  recordType: "EXACT_CANONICAL_STORY_THESIS_VERSION";
  storyId: string;
  versionId: string;
  eventId: string | null;
  versionNumber: number;
  effectiveAt: string;
  title: string;
  marketQuestion: string | null;
  thesis: string;
  status: string;
  confidence: number;
  strongestContradiction: string | null;
  confirmationTrigger: string | null;
  invalidationTrigger: string | null;
  nextCatalyst: string | null;
  thesisTruncated: boolean;
  evidence: {
    state: "SOURCE_LINKED" | "SOURCE_GAP";
    referencedCount: number;
    admittedSourceFactCount: number;
    facts: VerifiedVersionFact[];
  };
  verificationBoundary: {
    storyVersion: "IMMUTABLE_RECORD";
    sourceFacts: "CHECKED_CANONICAL_EVIDENCE_ID_AND_AS_OF";
    marketReaction: "NOT_VERIFIED";
    causalAttribution: "NOT_VERIFIED";
    dossierDecision: "NOT_INFERRED";
  };
};

export function projectBluebellyCanonicalStoryVersion(
  rawVersion: unknown,
  rawEvidence: readonly unknown[],
  expected: { storyId: string; versionId: string },
): BluebellyCanonicalStoryVersionV1 | null {
  const row = record(rawVersion);
  if (!row || !UUID.test(expected.storyId) || !UUID.test(expected.versionId)) return null;

  const storyId = uuid(row.story_id), versionId = uuid(row.id);
  const effectiveAt = time(row.effective_at);
  const title = bounded(row.title, 250);
  const rawThesis = string(row.thesis);
  const status = bounded(row.status, 90);
  const number = row.version_number;
  const confidence = row.confidence;
  if (storyId !== expected.storyId.toLowerCase()
    || versionId !== expected.versionId.toLowerCase()
    || !effectiveAt || !title || !rawThesis || !status
    || !Number.isInteger(number) || (number as number) < 1
    || typeof confidence !== "number" || !Number.isFinite(confidence)
    || confidence < 0 || confidence > 100) return null;

  const referenced = referencedEvidenceIds(row);
  const allowIds = new Set(referenced);
  const facts: VerifiedVersionFact[] = [];
  const used = new Set<string>();
  for (const raw of rawEvidence) {
    const evidence = record(raw), id = uuid(evidence?.id);
    if (!evidence || !id || !allowIds.has(id) || used.has(id)) continue;
    const availableAt = time(evidence.available_at);
    const createdAt = time(evidence.created_at);
    if (!availableAt || !createdAt
      || Date.parse(availableAt) > Date.parse(effectiveAt)
      || Date.parse(createdAt) > Date.parse(effectiveAt)
      || !ORIGINAL_CLASSES.has((string(evidence.evidence_class) || "").toLowerCase())) continue;
    const linked = Array.isArray(evidence.source) ? record(evidence.source[0]) : record(evidence.source);
    const tier = linked?.source_tier, sourceName = bounded(linked?.source_name, 100);
    const sourceUrl = validSource(linked?.source_url);
    const claimText = bounded(evidence.claim_text, 650);
    if (typeof tier !== "number" || tier < 1 || tier > 2
      || !sourceName || !sourceUrl || !claimText) continue;
    used.add(id);
    facts.push({ evidenceId: id, sourceName, originalSourceUrl: sourceUrl, claimText, availableAt });
    if (facts.length >= 12) break;
  }
  const rawMax = 5000;
  return {
    contractVersion: BLUEBELLY_CANONICAL_STORY_VERSION_V1,
    recordType: "EXACT_CANONICAL_STORY_THESIS_VERSION",
    storyId,
    versionId,
    eventId: uuid(row.event_id),
    versionNumber: number as number,
    effectiveAt,
    title,
    marketQuestion: bounded(row.market_question, 800),
    thesis: rawThesis.slice(0, rawMax),
    status,
    confidence,
    strongestContradiction: bounded(row.strongest_contradiction, 1400),
    confirmationTrigger: bounded(row.confirmation_trigger, 900),
    invalidationTrigger: bounded(row.invalidation_trigger, 900),
    nextCatalyst: bounded(row.next_catalyst, 900),
    thesisTruncated: rawThesis.length > rawMax,
    evidence: {
      state: facts.length ? "SOURCE_LINKED" : "SOURCE_GAP",
      referencedCount: referenced.length,
      admittedSourceFactCount: facts.length,
      facts,
    },
    verificationBoundary: {
      storyVersion: "IMMUTABLE_RECORD",
      sourceFacts: "CHECKED_CANONICAL_EVIDENCE_ID_AND_AS_OF",
      marketReaction: "NOT_VERIFIED",
      causalAttribution: "NOT_VERIFIED",
      dossierDecision: "NOT_INFERRED",
    },
  };
}
