import {
  marketMotionAttention,
  type MarketMotionRecord,
} from "./market-motion.ts";

export const MARKET_MOTION_BUNDLE_PREVIEW_LIMIT = 3;

export type MarketMotionPresentationSingleton = {
  kind: "singleton";
  id: string;
  primary: MarketMotionRecord;
  records: [MarketMotionRecord];
};

export type MarketMotionCreatorBundle = {
  kind: "creator_bundle";
  id: string;
  bundleKey: string;
  sourceName: string;
  sourceUrl: string;
  videoTitle: string;
  primary: MarketMotionRecord;
  records: MarketMotionRecord[];
  previewRecords: MarketMotionRecord[];
  promotedCount: number;
  leadCount: number;
};

export type MarketMotionPresentationUnit =
  | MarketMotionPresentationSingleton
  | MarketMotionCreatorBundle;

function metadataString(
  item: MarketMotionRecord,
  field: string,
) {
  const value = item.metadata?.[field];
  return typeof value === "string" ? value.trim() : "";
}

function exactCreatorBundleKey(item: MarketMotionRecord) {
  if (item.source_kind !== "creator") return null;
  if (metadataString(item, "ingestion") !== "creator-transcript-motion-lead/v1") return null;
  const itemKey = metadataString(item, "itemKey");
  return itemKey || null;
}

function lifecycleRank(item: MarketMotionRecord) {
  return item.lifecycle_state === "PROMOTED" ? 1 : 0;
}

export function compareMarketMotionBundleRecords(
  left: MarketMotionRecord,
  right: MarketMotionRecord,
) {
  const lifecycleDelta = lifecycleRank(right) - lifecycleRank(left);
  if (lifecycleDelta) return lifecycleDelta;

  const leftAttention = marketMotionAttention(left);
  const rightAttention = marketMotionAttention(right);
  const tierDelta =
    (rightAttention.tier === "PRIMARY" ? 1 : 0)
    - (leftAttention.tier === "PRIMARY" ? 1 : 0);
  if (tierDelta) return tierDelta;

  const attentionDelta = rightAttention.score - leftAttention.score;
  if (attentionDelta) return attentionDelta;

  const materialityDelta = right.materiality - left.materiality;
  if (materialityDelta) return materialityDelta;

  const relevanceDelta = right.relevance - left.relevance;
  if (relevanceDelta) return relevanceDelta;

  const noveltyDelta = right.novelty - left.novelty;
  if (noveltyDelta) return noveltyDelta;

  const keyDelta = left.motion_key.localeCompare(right.motion_key);
  if (keyDelta) return keyDelta;
  return left.id.localeCompare(right.id);
}

function bundleId(bundleKey: string) {
  return `creator-bundle:${bundleKey}`;
}

function singleton(item: MarketMotionRecord): MarketMotionPresentationSingleton {
  return {
    kind: "singleton",
    id: item.id,
    primary: item,
    records: [item],
  };
}

/**
 * Compress exact-video creator claim rows for reader-facing presentation only.
 *
 * Canonical Motion identity, persistence, promotion and Research Gap semantics
 * stay claim-level. Only creator-transcript leads sharing the exact upstream
 * itemKey are bundled. Stronger-source/corroborated events fail out of this
 * path because their canonical source_kind is no longer creator.
 */
export function buildMarketMotionPresentationUnits(
  records: MarketMotionRecord[],
): MarketMotionPresentationUnit[] {
  const grouped = new Map<string, MarketMotionRecord[]>();
  const standalone: MarketMotionRecord[] = [];

  for (const record of records) {
    const key = exactCreatorBundleKey(record);
    if (!key) {
      standalone.push(record);
      continue;
    }
    const prior = grouped.get(key) || [];
    prior.push(record);
    grouped.set(key, prior);
  }

  const units: MarketMotionPresentationUnit[] = standalone.map(singleton);

  for (const [key, groupedRecords] of grouped) {
    if (groupedRecords.length === 1) {
      units.push(singleton(groupedRecords[0]));
      continue;
    }

    const ranked = [...groupedRecords].sort(compareMarketMotionBundleRecords);
    const primary = ranked[0];
    units.push({
      kind: "creator_bundle",
      id: bundleId(key),
      bundleKey: key,
      sourceName: primary.source_name,
      sourceUrl: primary.source_url,
      videoTitle: metadataString(primary, "creatorVideoTitle") || primary.source_name,
      primary,
      records: ranked,
      previewRecords: ranked.slice(0, MARKET_MOTION_BUNDLE_PREVIEW_LIMIT),
      promotedCount: ranked.filter((item) => item.lifecycle_state === "PROMOTED").length,
      leadCount: ranked.filter((item) => item.verification_state === "LEAD").length,
    });
  }

  return units.sort((left, right) => {
    const timeDelta =
      Date.parse(right.primary.occurred_at)
      - Date.parse(left.primary.occurred_at);
    if (timeDelta) return timeDelta;
    return left.id.localeCompare(right.id);
  });
}

export function marketMotionPresentationUnderlyingCount(
  units: MarketMotionPresentationUnit[],
) {
  return units.reduce((total, unit) => total + unit.records.length, 0);
}
