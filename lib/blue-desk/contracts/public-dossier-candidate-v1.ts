import type { DossierPresentationV1 } from "../../dossier-v2/presentation-adapter.ts";

/**
 * P−1b: contract and *offline* review projection. Not a publication API.
 * No production Dossier fields, sources or licences are approved by this module.
 * It must not be wired to a public route until a separate release review.
 */
export const BLUE_DESK_PUBLIC_DOSSIER_CANDIDATE_V1 = "blue-desk-public-dossier-candidate/1" as const;
export const BLUE_DESK_DOSSIER_CLEARANCE_V1 = "blue-desk-dossier-clearance/1" as const;
export const PUBLIC_DOSSIER_ROUTE_ENABLED = false as const;

export type DossierEvidenceClearance = {
  evidenceId: string;
  sourceName: string;
  originalSourceUrl: string;
  sourcePublishedAt: string;
  availableAt: string;
  sourceKind: "PRIMARY_ORIGINAL" | "SECONDARY" | "CREATOR_TRANSCRIPT" | "OTHER";
  redistributionRights: "PUBLIC_REDISTRIBUTION_CLEARED" | "UNKNOWN" | "RESTRICTED";
};

/** Exact text approval is revoked by any change in Story wording or edition. */
export type DossierStoryEditorialClearance = {
  contractVersion: typeof BLUE_DESK_DOSSIER_CLEARANCE_V1;
  dossierId: string;
  asOf: string;
  analyticalStoryId: string;
  approvedText: {
    title: string;
    whatChanged: string;
    whyItMatters: string;
  };
  /** Every used canonical Evidence UUID, including contradictors, must resolve. */
  evidence: DossierEvidenceClearance[];
};

export type PublicDossierStoryCandidate = {
  analyticalStoryId: string;
  persistentStoryId: string | null;
  title: string;
  whatChanged: string;
  whyItMatters: string;
  marketReaction: "UNVERIFIED";
  sources: Array<{
    evidenceId: string;
    sourceName: string;
    originalSourceUrl: string;
    sourcePublishedAt: string;
    availableAt: string;
  }>;
};

export type PublicDossierReviewProjection = {
  contractVersion: typeof BLUE_DESK_PUBLIC_DOSSIER_CANDIDATE_V1;
  status: "UNAVAILABLE" | "REVIEW_REQUIRED" | "REVIEWED_CANDIDATE";
  /** A reviewed candidate does NOT grant publication or licensing approval. */
  published: false;
  dossier: { dossierId: string; asOf: string } | null;
  story: PublicDossierStoryCandidate | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EDITION_TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/;
const STORY_KEY = /^[a-zA-Z0-9_.:-]{1,120}$/;
const MAX_STORY_EVIDENCE = 12;

function time(value: unknown): number | null {
  if (typeof value !== "string" || !EDITION_TIME.test(value)) return null;
  const n = Date.parse(value);
  return Number.isFinite(n) ? n : null;
}

function validText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength
    && value.trim() === value && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value);
}

function originalPublicUrl(input: unknown): input is string {
  if (typeof input !== "string" || input.length > 2048) return false;
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443") return false;
    if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (/^(?:localhost|\d+\.\d+\.\d+\.\d+|\[.*\])$/.test(host)) return false;
    if (/(?:^|\.)(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(host)) return false;
    for (const key of url.searchParams.keys()) {
      if (/^(?:api[_-]?key|access[_-]?token|token|secret|signature|sig|password|auth|code)$/i.test(key)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

const unavailable = (): PublicDossierReviewProjection => ({
  contractVersion: BLUE_DESK_PUBLIC_DOSSIER_CANDIDATE_V1,
  status: "UNAVAILABLE", published: false, dossier: null, story: null,
});

/**
 * An intentionally restricted preparatory read model.
 * - No spread, clone, dynamic field selector, or raw JSON passthrough.
 * - Requires exact Dossier + Story + all Evidence identities and per-field wording approval.
 * - Rejects missing rights, creator leads, future evidence, malformed/missing original URLs.
 * - Never emits a PUBLISHED state, nor acts as a public endpoint.
 */
export function buildPublicDossierReviewCandidate(
  presentation: DossierPresentationV1 | null,
  clearance: DossierStoryEditorialClearance | null = null,
): PublicDossierReviewProjection {
  if (!presentation || !UUID.test(presentation.dossierId) || time(presentation.asOf) === null) {
    return unavailable();
  }
  const waiting: PublicDossierReviewProjection = {
    contractVersion: BLUE_DESK_PUBLIC_DOSSIER_CANDIDATE_V1,
    status: "REVIEW_REQUIRED",
    published: false,
    dossier: { dossierId: presentation.dossierId, asOf: presentation.asOf },
    story: null,
  };
  if (!clearance || clearance.contractVersion !== BLUE_DESK_DOSSIER_CLEARANCE_V1
    || clearance.dossierId !== presentation.dossierId || clearance.asOf !== presentation.asOf
    || !STORY_KEY.test(clearance.analyticalStoryId)) return waiting;

  const stories = presentation.whatMattersNow?.stories;
  if (!Array.isArray(stories)) return waiting;
  const story = stories.find(s => s?.id === clearance.analyticalStoryId);
  if (!story || !validText(story.title, 160)
    || !validText(story.whatChanged, 1200) || !validText(story.whyItMatters, 1200)
    || story.title !== clearance.approvedText?.title
    || story.whatChanged !== clearance.approvedText?.whatChanged
    || story.whyItMatters !== clearance.approvedText?.whyItMatters) return waiting;

  const refs = [story.evidenceRefs, story.confirmingEvidenceRefs, story.contradictingEvidenceRefs,
    story.acceleratingEvidenceRefs, story.unresolvedEvidenceRefs].flatMap(items => items ?? []);
  const distinct = [...new Set(refs)];
  if (!refs.length || refs.length !== distinct.length || distinct.length > MAX_STORY_EVIDENCE
    || !distinct.every(ref => typeof ref === "string" && UUID.test(ref))) return waiting;

  const snapshotTime = time(presentation.asOf)!;
  const evidence = Array.isArray(clearance.evidence) ? clearance.evidence : [];
  if (evidence.length !== distinct.length || new Set(evidence.map(e => e.evidenceId)).size !== distinct.length) {
    return waiting;
  }
  const byId = new Map(evidence.map(e => [e.evidenceId, e]));
  const sources: PublicDossierStoryCandidate["sources"] = [];
  for (const id of distinct) {
    const item = byId.get(id);
    if (!item || item.sourceKind !== "PRIMARY_ORIGINAL"
      || item.redistributionRights !== "PUBLIC_REDISTRIBUTION_CLEARED"
      || !validText(item.sourceName, 120) || !originalPublicUrl(item.originalSourceUrl)) return waiting;
    const publishedAt = time(item.sourcePublishedAt);
    const availableAt = time(item.availableAt);
    if (publishedAt === null || availableAt === null || publishedAt > availableAt
      || availableAt > snapshotTime) return waiting;
    sources.push({
      evidenceId: id,
      sourceName: item.sourceName,
      originalSourceUrl: item.originalSourceUrl,
      sourcePublishedAt: item.sourcePublishedAt,
      availableAt: item.availableAt,
    });
  }

  return {
    contractVersion: BLUE_DESK_PUBLIC_DOSSIER_CANDIDATE_V1,
    status: "REVIEWED_CANDIDATE",
    published: false,
    dossier: { dossierId: presentation.dossierId, asOf: presentation.asOf },
    story: {
      analyticalStoryId: story.id,
      persistentStoryId: typeof story.persistentStoryId === "string" && UUID.test(story.persistentStoryId)
        ? story.persistentStoryId : null,
      title: story.title,
      whatChanged: story.whatChanged,
      whyItMatters: story.whyItMatters,
      marketReaction: "UNVERIFIED",
      sources,
    },
  };
}
