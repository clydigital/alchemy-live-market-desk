// @ts-nocheck
// Hybrid source parity; projection only, no new canonical reasoning writes.
import { REASONING_AVAILABILITY, readCanonicalStoryReasoning } from "./canonical-story-reasoning";

export const NO_CAUSAL_PLAN_DIAGNOSTIC = "No canonical causal plan is attached to this Story version.";
export const NO_SERIES_PLAN_DIAGNOSTIC = "No canonical series relationship is attached to this Story version.";
export const NO_ENTITY_PLAN_DIAGNOSTIC = "No canonical transmission map is attached to this Story version.";

function uniqueBy(values, keyFor) {
  const seen = new Set();
  return values.filter((value) => {
    const key = keyFor(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function canonicalReasoning(story) {
  const read = readCanonicalStoryReasoning(story);
  return read.reasoningAvailability === REASONING_AVAILABILITY.V1 ? read.reasoning : null;
}

export function canonicalVisualPlan(story) {
  return canonicalReasoning(story)?.visualPlan || [];
}

export function canonicalCausalSelection(story) {
  const reasoning = canonicalReasoning(story);
  if (!reasoning) return { edgeIds: [], edges: [] };
  const edgeIds = uniqueBy(
    reasoning.visualPlan.flatMap((visual) => {
      if (Array.isArray(visual.edgeIds)) return visual.edgeIds;
      if (Array.isArray(visual.connectionEdgeIds)) return visual.connectionEdgeIds;
      return [];
    }),
    (id) => id,
  );
  if (!edgeIds.length) return { edgeIds: [], edges: [] };
  const byId = new Map(reasoning.causalChain.map((edge) => [edge.id, edge]));
  return { edgeIds, edges: edgeIds.map((id) => byId.get(id)).filter(Boolean) };
}

export function canonicalRelationshipVisual(story) {
  const visual = canonicalVisualPlan(story).find((item) => Array.isArray(item.series) && item.series.length > 0) || null;
  if (!visual) return null;
  return {
    id: visual.id,
    type: visual.type,
    title: visual.title,
    series: uniqueBy(visual.series, (item) => String(item.seriesId || "").toLowerCase()),
    expectedRelationship: visual.type === "divergence_chart" ? visual.expectedRelationship : "none_asserted",
    window: visual.window || null,
  };
}

export function canonicalSeriesRefs(story) {
  return uniqueBy(
    canonicalVisualPlan(story).flatMap((visual) => Array.isArray(visual.series) ? visual.series : []),
    (item) => String(item.seriesId || "").toLowerCase(),
  );
}

export function canonicalEntityVisual(story) {
  const visual = canonicalVisualPlan(story).find((item) => (
    (item.type === "entity_map" || item.type === "money_or_commodity_flow")
    && Array.isArray(item.entities)
    && item.entities.length > 0
  )) || null;
  if (!visual) return null;
  return {
    id: visual.id,
    type: visual.type,
    title: visual.title,
    entities: uniqueBy(visual.entities, (item) => item.entityId),
    edgeIds: visual.type === "entity_map" ? [...visual.connectionEdgeIds] : [...visual.edgeIds],
    flowLabel: visual.type === "money_or_commodity_flow" ? visual.flowLabel : null,
  };
}

export function explicitSeriesRefsForCatalyst(catalyst) {
  if (!catalyst || catalyst.kind !== "macro") return [];
  if (Array.isArray(catalyst.seriesRefs)) {
    return uniqueBy(
      catalyst.seriesRefs.filter((item) => item && typeof item.seriesId === "string"),
      (item) => item.seriesId.toLowerCase(),
    );
  }
  const key = catalyst.seriesKey || catalyst.series_key || null;
  return key ? [{ seriesId: String(key), label: String(key) }] : [];
}

export function filterObservationsBySeriesRefs(observations, seriesRefs) {
  const keys = new Set((seriesRefs || []).map((item) => String(item?.seriesId || item || "").toLowerCase()).filter(Boolean));
  if (!keys.size) return [];
  return (observations || []).filter((row) => keys.has(String(row.series_key || row.series_id || "").toLowerCase()));
}
