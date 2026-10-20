/**
 * Read-only input to Blue Desk's eventual editorial composer.
 * Packages source identity and asset read-through without creating facts,
 * changing Story authority or promoting Market Motion to canonical evidence.
 */
export const MARKET_IMPACT_PACKET_V1 = "market-impact-packet/1" as const;

type R = Record<string, unknown>;
type SourceState = "CANONICAL_CLAIM" | "FROZEN_DOSSIER_CONTEXT" | "SOURCE_VERIFIED_MOTION";
export type MarketImpactPacketV1 = {
  contractVersion: typeof MARKET_IMPACT_PACKET_V1;
  kind: "STORY" | "MOTION";
  identity: {
    storyId: string | null;
    motionId: string | null;
    storyThesisVersionId: string | null;
    storySnapshotId: string | null;
    lineage: "EXACT_EDITION_MANIFEST" | "FROZEN_DOSSIER_CONTEXT" | "VERIFIED_MOTION_ONLY";
  };
  asOf: string;
  sourceVersionEffectiveAt: string | null;
  attentionAssessedAt: string | null;
  materialChangeAt: string | null;
  headline: string;
  development: { text: string | null; basis: SourceState; evidenceIds: string[]; sourceUrl: string | null };
  background: string[];
  mechanism: { text: string | null; evidenceIds: string[]; evidenceState: "CANONICAL_INTERPRETATION" | "CONTEXT_ONLY" | "UNAVAILABLE" };
  assetReadThroughs: Array<{ asset: string; interpretation: string; evidenceIds: string[]; kind: "CANONICAL_CONDITIONAL" | "LESSON_CONTEXT" | "MOTION_CONTEXT" }>;
  observedReaction: null;
  reactionCandidate: string | null;
  countercase: string | null;
  nextTest: string | null;
  sourceUrls: string[];
  missing: Array<"ORIGINAL_SOURCE_LINK" | "CURRENT_VERIFIED_FACT" | "ASSET_READ_THROUGH" | "MEASURED_MARKET_REACTION" | "CANONICAL_STORY_LINEAGE">;
};

function rec(x: unknown): R | null {
  return x !== null && typeof x === "object" && !Array.isArray(x) ? x as R : null;
}
function txt(x: unknown): string | null {
  return typeof x === "string" && x.trim() ? x.trim() : null;
}
function arr(x: unknown): unknown[] { return Array.isArray(x) ? x : []; }
function strs(x: unknown): string[] {
  return [...new Set(arr(x).flatMap(x => txt(x) ? [txt(x)!] : []))];
}
function date(x: unknown, asOf: string): string | null {
  const v = txt(x);
  return v && Number.isFinite(Date.parse(v)) && Date.parse(v) <= Date.parse(asOf)
    ? new Date(v).toISOString() : null;
}
function uuid(x: unknown): string | null {
  const s = txt(x);
  return s && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s) ? s : null;
}
function url(x: unknown): string | null {
  const s = txt(x);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && !u.username && !u.password
      && u.pathname !== "/" && u.href.length < 2048 ? u.href : null;
  } catch { return null; }
}
function contextualAssetReadThroughs(callouts: unknown): MarketImpactPacketV1["assetReadThroughs"] {
  return arr(callouts).flatMap(raw => {
    const entry = rec(raw);
    if (entry?.type !== "why_traders_care") return [];
    const text = txt(entry.text) || "";
    return text.split(/;\s*(?=[A-Z][A-Z0-9./_-]{1,15}:\s)/g).flatMap(piece => {
      const m = piece.match(/^([A-Z][A-Z0-9./_-]{1,15}):\s+(.+)$/s);
      if (!m) return [];
      return [{ asset: m[1], interpretation: m[2].trim(), evidenceIds: [], kind: "LESSON_CONTEXT" as const }];
    });
  }).slice(0, 8);
}
function gaps(
  sourceUrls: string[], development: MarketImpactPacketV1["development"],
  assets: MarketImpactPacketV1["assetReadThroughs"], exact: boolean,
): MarketImpactPacketV1["missing"] {
  return [
    ...(!sourceUrls.length ? ["ORIGINAL_SOURCE_LINK" as const] : []),
    ...(development.basis !== "CANONICAL_CLAIM" && development.basis !== "SOURCE_VERIFIED_MOTION"
      ? ["CURRENT_VERIFIED_FACT" as const] : []),
    ...(!assets.length ? ["ASSET_READ_THROUGH" as const] : []),
    "MEASURED_MARKET_REACTION" as const,
    ...(!exact ? ["CANONICAL_STORY_LINEAGE" as const] : []),
  ];
}

/**
 * Pure projection from a single edition's frozen payload. Never queries
 * mutable Story state or treats an observedAt/assessedAt refresh as a material
 * Story change. Exactly one claim's IDs are attached to that claim; a Dossier
 * lesson-wide pool NEVER becomes sentence-level proof.
 */
export function buildMarketImpactPacketsV1(input: {
  payload: Record<string, unknown>;
  asOf: string;
}): MarketImpactPacketV1[] {
  const asOf = date(input.asOf, input.asOf);
  if (!asOf) return [];
  const dossier = rec(input.payload.dossier);
  const manifestByStory = new Map(arr(input.payload.canonicalStoryManifest).flatMap(value => {
    const m = rec(value);
    const id = uuid(m?.storyId), version = uuid(m?.thesisVersionId);
    const reasoning = rec(m?.reasoning);
    if (!id || !version || !reasoning || reasoning.contractVersion !== "canonical-story-reasoning/v1"
      || reasoning.storyId !== id || reasoning.storyVersionId !== version
      || !date(reasoning.effectiveAt, asOf)) return [];
    return [[id, m] as const];
  }));
  const changedIds = new Set(arr(input.payload.stories).flatMap(s => uuid(rec(s)?.id) ? [uuid(rec(s)?.id)!] : []));
  const lessons = arr(dossier?.lessons).slice(0, 8).flatMap(raw => {
    const lesson = rec(raw);
    const id = uuid(lesson?.storyId);
    const version = uuid(lesson?.thesisVersionId);
    const snapshot = uuid(lesson?.publicationSnapshotId);
    const headline = txt(lesson?.title);
    // A lesson without exact frozen identities is not eligible for publication.
    if (!id || !version || !snapshot || !headline) return [];
    const manifest = manifestByStory.get(id);
    const exact = Boolean(manifest && manifest.thesisVersionId === version && manifest.snapshotId === snapshot);
    const reasoning = exact ? rec(manifest?.reasoning) : null;
    const claims = arr(reasoning?.claims).flatMap(v => rec(v) ? [rec(v)!] : []);
    const facts = claims.filter(c => c.type === "fact" && txt(c.text) && strs(c.evidenceIds).some(uuid));
    const changed = txt(reasoning?.whatChanged);
    const exactChange = changed
      ? claims.find(c => txt(c.text)?.toLowerCase() === changed.toLowerCase() && strs(c.evidenceIds).some(uuid))
      : null;
    const selected = changedIds.has(id) && exactChange ? exactChange : (facts[0] || null);
    const evidenceIds = selected ? strs(selected.evidenceIds).filter(uuid) : [];
    const development: MarketImpactPacketV1["development"] = selected
      ? { text: txt(selected.text), basis: "CANONICAL_CLAIM", evidenceIds, sourceUrl: null }
      : { text: null, basis: "FROZEN_DOSSIER_CONTEXT", evidenceIds: [], sourceUrl: null };
    const canonicalAssets: MarketImpactPacketV1["assetReadThroughs"] = arr(reasoning?.assetImplications).flatMap(raw => {
      const item = rec(raw), asset = txt(item?.asset), interpretation = txt(item?.baseCase);
      if (!asset || !interpretation) return [];
      return [{ asset, interpretation, evidenceIds: strs(item?.evidenceIds).filter(uuid),
        kind: "CANONICAL_CONDITIONAL" as const }];
    });
    const assetReadThroughs = canonicalAssets.length ? canonicalAssets.slice(0, 8)
      : contextualAssetReadThroughs(lesson.callouts);
    const context = strs(lesson.body).slice(0, 3);
    const mechanism = txt(reasoning?.acceptedExplanation);
    const counterpart = rec(reasoning?.countercase);
    const nextTest = rec(reasoning?.nextTest);
    const attention = rec(lesson.currentAttention);
    return [{
      contractVersion: MARKET_IMPACT_PACKET_V1,
      kind: "STORY" as const,
      identity: {
        storyId: id, motionId: null, storyThesisVersionId: version, storySnapshotId: snapshot,
        lineage: exact ? "EXACT_EDITION_MANIFEST" as const : "FROZEN_DOSSIER_CONTEXT" as const,
      },
      asOf,
      sourceVersionEffectiveAt: date(reasoning?.effectiveAt, asOf),
      attentionAssessedAt: date(attention?.assessedAt, asOf),
      // The version's effective time is not automatically the time of a new move.
      materialChangeAt: changedIds.has(id) && exact ? date(reasoning?.effectiveAt, asOf) : null,
      headline,
      development,
      background: context,
      mechanism: {
        text: mechanism || (context[1] || null),
        evidenceIds: mechanism ? claims.flatMap(c =>
          txt(c.text)?.toLowerCase() === mechanism.toLowerCase() ? strs(c.evidenceIds).filter(uuid) : []).slice(0, 12) : [],
        evidenceState: mechanism ? "CANONICAL_INTERPRETATION" as const
          : context[1] ? "CONTEXT_ONLY" as const : "UNAVAILABLE" as const,
      },
      assetReadThroughs,
      observedReaction: null,
      reactionCandidate: txt(reasoning?.marketReaction),
      countercase: txt(counterpart?.strongest)
        || txt(arr(lesson.callouts).map(rec).find(x => x?.type === "warning")?.text),
      nextTest: txt(nextTest?.label) || txt(arr(lesson.watchItems).map(rec)[0]?.variable),
      sourceUrls: [],
      missing: gaps([], development, assetReadThroughs, exact),
    }];
  });
  const motionAttachment = rec(input.payload.marketMotion);
  const motions = motionAttachment?.contractVersion === "market-motion-edition/v1"
    ? arr(motionAttachment.items).slice(0, 12).flatMap(raw => {
      const item = rec(raw);
      const id = uuid(item?.id), storyId = uuid(item?.storyId);
      const sourceUrl = url(item?.sourceUrl);
      const occurred = date(item?.occurredAt, asOf);
      const observed = date(item?.observedAt, asOf);
      if (!id || !sourceUrl || !occurred || !observed || Date.parse(observed) < Date.parse(occurred)
        || item?.verificationState !== "VERIFIED"
        || !["official", "primary", "filing", "reporting", "market_data"].includes(txt(item?.sourceKind) || "")
        || !txt(item?.headline) || !txt(item?.whatHappened)) return [];
      const development: MarketImpactPacketV1["development"] = {
        text: txt(item.whatHappened), basis: "SOURCE_VERIFIED_MOTION", evidenceIds: [], sourceUrl,
      };
      const assetReadThroughs: MarketImpactPacketV1["assetReadThroughs"] = strs(item.tickers).slice(0, 8)
        .map(asset => ({ asset, interpretation: txt(item.bigPictureBridge) || "Potential transmission requires validation",
          evidenceIds: [], kind: "MOTION_CONTEXT" as const }));
      return [{
        contractVersion: MARKET_IMPACT_PACKET_V1,
        kind: "MOTION" as const,
        identity: { storyId, motionId: id, storyThesisVersionId: null, storySnapshotId: null,
          lineage: "VERIFIED_MOTION_ONLY" as const },
        asOf,
        sourceVersionEffectiveAt: null, attentionAssessedAt: observed, materialChangeAt: null,
        headline: txt(item.headline)!,
        development,
        background: [], mechanism: { text: null, evidenceIds: [], evidenceState: "UNAVAILABLE" as const },
        assetReadThroughs, observedReaction: null,
        reactionCandidate: txt(item.marketReaction),
        countercase: null, nextTest: txt(item.nextTest),
        sourceUrls: [sourceUrl],
        // Even source-verified Motion is not a canonically admitted Story.
        missing: gaps([sourceUrl], development, assetReadThroughs, false),
      }];
    }) : [];
  return [...lessons, ...motions];
}
