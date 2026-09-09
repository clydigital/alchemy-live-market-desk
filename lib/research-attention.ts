import { createHash } from "node:crypto";

import { candidateScore, type IntakeItemInput } from "./research-update.ts";

export const RESEARCH_ATTENTION_SHADOW_V1 = "research-attention-shadow/v1" as const;
export const DEFAULT_RESEARCH_ATTENTION_SLOTS = 8;

export type AttentionReservationLane = "contradiction" | "current_delta" | "emerging" | "open";

export type AttentionReservations = {
  contradiction: number;
  currentDelta: number;
  emerging: number;
  open: number;
  total: number;
};

export type ResearchAttentionCandidate = {
  id: string;
  representativeTitle: string;
  priority: number;
  reservationLane: AttentionReservationLane | null;
  question: string;
  itemKeys: string[];
  storySlugs: string[];
  publishers: string[];
  sourceAncestries: string[];
  canonicalEligibleItemCount: number;
  discoveryOnlyItemCount: number;
  independentAncestryCount: number;
  maxCandidateScore: number;
  maxMateriality: number;
  maxNovelty: number;
  contradiction: boolean;
  currentDelta: boolean;
  emerging: boolean;
};

export type ResearchAttentionPacket = {
  contractVersion: typeof RESEARCH_ATTENTION_SHADOW_V1;
  generatedAt: string;
  maxSlots: number;
  reservations: AttentionReservations;
  selected: ResearchAttentionCandidate[];
  watchOnly: ResearchAttentionCandidate[];
  diagnostics: string[];
};

type MutableCluster = {
  items: IntakeItemInput[];
  terms: Set<string>;
  storySlugs: Set<string>;
};

const STOP_WORDS = new Set([
  "about", "after", "again", "against", "also", "among", "because", "before", "being", "between",
  "could", "current", "from", "have", "into", "market", "markets", "more", "news", "over", "said",
  "says", "story", "than", "that", "their", "there", "these", "they", "this", "through", "under", "what",
  "when", "where", "which", "while", "with", "would", "your",
]);

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function unique(values: string[]) {
  return [...new Set(values.filter((value) => Boolean(value?.trim())).map((value) => value.trim()))];
}

function terms(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 4 && !STOP_WORDS.has(word))
      .slice(0, 40),
  );
}

function itemTerms(item: IntakeItemInput) {
  return terms(`${item.title} ${item.summary} ${(item.affectedStorySlugs || []).join(" ")}`);
}

function ancestry(item: IntakeItemInput) {
  try {
    const hostname = new URL(item.url).hostname.toLowerCase().replace(/^www\./, "");
    return hostname || item.publisher.toLowerCase();
  } catch {
    return item.publisher.toLowerCase();
  }
}

function overlaps(left: Set<string>, right: Set<string>) {
  let shared = 0;
  for (const value of left) if (right.has(value)) shared += 1;
  if (shared < 2) return false;
  const union = new Set([...left, ...right]).size;
  return union > 0 && shared / union >= 0.28;
}

function sharesStory(left: Set<string>, right: Set<string>) {
  for (const value of left) if (right.has(value)) return true;
  return false;
}

function addToCluster(cluster: MutableCluster, item: IntakeItemInput, itemTermSet: Set<string>, itemStorySlugs: Set<string>) {
  cluster.items.push(item);
  itemTermSet.forEach((term) => cluster.terms.add(term));
  itemStorySlugs.forEach((slug) => cluster.storySlugs.add(slug));
}

function clusterItems(items: IntakeItemInput[]) {
  const clusters: MutableCluster[] = [];
  const sorted = [...items].sort((left, right) => {
    const time = Date.parse(right.publishedAt) - Date.parse(left.publishedAt);
    return time || left.itemKey.localeCompare(right.itemKey);
  });

  for (const item of sorted) {
    const itemTermSet = itemTerms(item);
    const itemStorySlugs = new Set(unique(item.affectedStorySlugs || []));
    const match = clusters.find((cluster) => (
      (itemStorySlugs.size > 0 && sharesStory(cluster.storySlugs, itemStorySlugs))
      || overlaps(cluster.terms, itemTermSet)
    ));
    if (match) addToCluster(match, item, itemTermSet, itemStorySlugs);
    else clusters.push({ items: [item], terms: itemTermSet, storySlugs: itemStorySlugs });
  }
  return clusters;
}

function clusterId(items: IntakeItemInput[]) {
  const key = [...items].map((item) => item.itemKey).sort().join("|");
  return `attention:${createHash("sha256").update(key).digest("hex").slice(0, 16)}`;
}

function representative(items: IntakeItemInput[]) {
  return [...items].sort((left, right) => {
    const actionWeight = Number(right.recommendedAction !== "ignore") - Number(left.recommendedAction !== "ignore");
    if (actionWeight) return actionWeight;
    const scoreWeight = candidateScore(right) - candidateScore(left);
    if (scoreWeight) return scoreWeight;
    return Date.parse(right.publishedAt) - Date.parse(left.publishedAt);
  })[0];
}

function buildCandidate(cluster: MutableCluster): ResearchAttentionCandidate {
  const eligible = cluster.items.filter((item) => item.recommendedAction !== "ignore");
  const discoveryOnly = cluster.items.filter((item) => item.recommendedAction === "ignore");
  const scoringItems = eligible.length ? eligible : cluster.items;
  const sourceAncestries = unique(eligible.map(ancestry));
  const maxCandidateScore = Math.max(...scoringItems.map(candidateScore));
  const maxMateriality = Math.max(...scoringItems.map((item) => item.materiality));
  const maxNovelty = Math.max(...scoringItems.map((item) => item.novelty));
  const storySlugs = unique(cluster.items.flatMap((item) => item.affectedStorySlugs || []));
  const contradiction = eligible.some((item) => item.divergenceKind === "contradiction");
  const currentDelta = eligible.some((item) => item.recommendedAction === "recalibrate_story")
    || (storySlugs.length > 0 && maxMateriality >= 65)
    || maxMateriality >= 78;
  const emerging = storySlugs.length === 0 && maxNovelty >= 80 && maxMateriality >= 55;
  const independentAncestryCount = sourceAncestries.length;
  const priority = clamp(Math.round(
    maxCandidateScore
    + Math.min(12, Math.max(0, independentAncestryCount - 1) * 4)
    + (contradiction ? 10 : 0)
    + (currentDelta ? 8 : 0)
    + (emerging ? 6 : 0),
  ), 0, 100);
  const lead = representative(cluster.items);

  return {
    id: clusterId(cluster.items),
    representativeTitle: lead.title,
    priority,
    reservationLane: null,
    question: contradiction
      ? `What evidence resolves the contradiction around: ${lead.title}?`
      : `What would independently confirm or falsify: ${lead.title}?`,
    itemKeys: cluster.items.map((item) => item.itemKey).sort(),
    storySlugs,
    publishers: unique(cluster.items.map((item) => item.publisher)).sort(),
    sourceAncestries: sourceAncestries.sort(),
    canonicalEligibleItemCount: eligible.length,
    discoveryOnlyItemCount: discoveryOnly.length,
    independentAncestryCount,
    maxCandidateScore,
    maxMateriality,
    maxNovelty,
    contradiction,
    currentDelta,
    emerging,
  };
}

export function calculateAttentionReservations(maxSlots = DEFAULT_RESEARCH_ATTENTION_SLOTS): AttentionReservations {
  const total = Math.max(1, Math.floor(maxSlots));
  const contradiction = Math.floor(total * 0.25);
  const currentDelta = Math.floor(total * 0.25);
  const emerging = total >= 4 ? Math.max(1, Math.floor(total * 0.125)) : 0;
  const open = Math.max(0, total - contradiction - currentDelta - emerging);
  return { contradiction, currentDelta, emerging, open, total };
}

function rank(candidates: ResearchAttentionCandidate[]) {
  return [...candidates].sort((left, right) => (
    right.priority - left.priority
    || right.independentAncestryCount - left.independentAncestryCount
    || right.maxMateriality - left.maxMateriality
    || left.id.localeCompare(right.id)
  ));
}

function reserve(
  selected: ResearchAttentionCandidate[],
  selectedIds: Set<string>,
  candidates: ResearchAttentionCandidate[],
  count: number,
  lane: AttentionReservationLane,
) {
  if (count <= 0) return;
  for (const candidate of rank(candidates)) {
    if (selected.length >= count || selectedIds.has(candidate.id)) continue;
    selected.push({ ...candidate, reservationLane: lane });
    selectedIds.add(candidate.id);
  }
}

/**
 * Shadow-only attention allocation. It ranks what deserves investigation but
 * cannot create Evidence, mutate a Story, gate publication, or invoke a model.
 * Discovery-only rows may enrich a cluster but can never qualify it by themselves.
 */
export function buildResearchAttentionPacket(
  items: IntakeItemInput[],
  options: { generatedAt?: string; maxSlots?: number } = {},
): ResearchAttentionPacket {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const maxSlots = Math.max(1, Math.floor(options.maxSlots ?? DEFAULT_RESEARCH_ATTENTION_SLOTS));
  const reservations = calculateAttentionReservations(maxSlots);
  const all = rank(clusterItems(Array.isArray(items) ? items : []).map(buildCandidate));
  const eligible = all.filter((candidate) => candidate.canonicalEligibleItemCount > 0);
  const watchOnly = all.filter((candidate) => candidate.canonicalEligibleItemCount === 0).slice(0, maxSlots);

  const selected: ResearchAttentionCandidate[] = [];
  const selectedIds = new Set<string>();

  const contradictionPool = eligible.filter((candidate) => candidate.contradiction);
  reserve(selected, selectedIds, contradictionPool, reservations.contradiction, "contradiction");

  const currentStart = selected.length;
  reserve(selected, selectedIds, eligible.filter((candidate) => candidate.currentDelta), currentStart + reservations.currentDelta, "current_delta");

  const emergingStart = selected.length;
  reserve(selected, selectedIds, eligible.filter((candidate) => candidate.emerging), emergingStart + reservations.emerging, "emerging");

  // Unused reserved capacity automatically spills into the open pool. This is
  // deliberate: reservations protect scarce research functions without wasting
  // capacity when a lane has nothing credible to investigate.
  for (const candidate of eligible) {
    if (selected.length >= maxSlots) break;
    if (selectedIds.has(candidate.id)) continue;
    selected.push({ ...candidate, reservationLane: "open" });
    selectedIds.add(candidate.id);
  }

  const diagnostics = [
    `Attention capacity ${maxSlots}: ${reservations.contradiction} contradiction, ${reservations.currentDelta} current-delta, ${reservations.emerging} emerging, ${reservations.open} open before spillover.`,
    `${eligible.length} canonical-eligible cluster(s); ${watchOnly.length} discovery-only cluster(s) excluded from research allocation.`,
    "Shadow packet only: zero model calls, zero canonical Evidence writes, zero Story mutations and zero publication gating.",
  ];

  return {
    contractVersion: RESEARCH_ATTENTION_SHADOW_V1,
    generatedAt,
    maxSlots,
    reservations,
    selected,
    watchOnly,
    diagnostics,
  };
}

export function safeResearchAttentionLog(packet: ResearchAttentionPacket) {
  return {
    event: "research_attention_shadow",
    contractVersion: packet.contractVersion,
    generatedAt: packet.generatedAt,
    maxSlots: packet.maxSlots,
    reservations: packet.reservations,
    selected: packet.selected.map((candidate) => ({
      id: candidate.id,
      title: candidate.representativeTitle,
      priority: candidate.priority,
      reservationLane: candidate.reservationLane,
      independentAncestryCount: candidate.independentAncestryCount,
      eligibleItems: candidate.canonicalEligibleItemCount,
      discoveryOnlyItems: candidate.discoveryOnlyItemCount,
      contradiction: candidate.contradiction,
      currentDelta: candidate.currentDelta,
      emerging: candidate.emerging,
    })),
    watchOnlyCount: packet.watchOnly.length,
    diagnostics: packet.diagnostics,
  };
}
