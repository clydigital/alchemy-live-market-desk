import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  deriveMarketMotionRoutingClass,
  getCurrentMarketMotion,
  type MarketMotionRecord,
} from "../market-motion.ts";
import { selectPromotedMarketMotionForDossier } from "../market-motion-promotion.ts";
import {
  DOSSIER_MOTION_CONTEXT_CONTRACT_VERSION,
  MAX_DOSSIER_MOTION_CONTEXT,
  toCanonicalJson,
  type DossierMotionContext,
  type DossierMotionContextItem,
  type DossierV2InputPacket,
} from "./input-packet.ts";

const MAX_DOSSIER_PACKET_BYTES = 200_000;

function clip(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const clean = value.trim();
  if (!clean) return null;
  return clean.length <= max ? clean : `${clean.slice(0, Math.max(0, max - 3))}...`;
}

function canonicalMotionEvidenceRef(
  item: MarketMotionRecord,
  validEvidenceIds: Set<string>,
) {
  const promotionEvidencePacketRef = typeof item.metadata?.promotionEvidencePacketRef === "string"
    ? item.metadata.promotionEvidencePacketRef.trim()
    : "";
  if (promotionEvidencePacketRef && validEvidenceIds.has(promotionEvidencePacketRef)) {
    return promotionEvidencePacketRef;
  }

  const promotionEvidenceId = typeof item.metadata?.promotionEvidenceId === "string"
    ? item.metadata.promotionEvidenceId.trim()
    : "";
  if (promotionEvidenceId && validEvidenceIds.has(promotionEvidenceId)) {
    return promotionEvidenceId;
  }
  if (item.evidence_id && validEvidenceIds.has(item.evidence_id)) {
    return item.evidence_id;
  }
  return null;
}

function boundedMotionItem(
  item: MarketMotionRecord,
  validEvidenceIds: Set<string>,
): DossierMotionContextItem {
  return {
    motion_id: item.id,
    motion_key: clip(item.motion_key, 300) ?? item.id,
    version_number: item.version_number,
    occurred_at: item.occurred_at,
    observed_at: item.observed_at,
    expires_at: item.expires_at,
    category: clip(item.category, 80) ?? "OTHER",
    verification_state: clip(item.verification_state, 80) ?? "UNRESOLVED",
    headline: clip(item.headline, 500) ?? "Untitled Motion",
    what_happened: clip(item.what_happened, 1_200) ?? "No bounded Motion description supplied.",
    market_reaction: clip(item.market_reaction, 600),
    why_interesting: clip(item.why_interesting, 900) ?? "No bounded attention rationale supplied.",
    big_picture_bridge: clip(item.big_picture_bridge, 900) ?? "No bounded regime bridge supplied.",
    next_test: clip(item.next_test, 700),
    primary_story_id: clip(item.primary_story_id, 120),
    primary_regime_slug: clip(item.primary_regime_slug, 120),
    routing_class: deriveMarketMotionRoutingClass({
      primaryStoryId: item.primary_story_id,
      primaryRegimeSlug: item.primary_regime_slug,
      nextTest: item.next_test,
    }) ?? undefined,
    attention: {
      materiality: Number(item.materiality || 0),
      relevance: Number(item.relevance || 0),
      novelty: Number(item.novelty || 0),
    },
    origin_evidence_ref: canonicalMotionEvidenceRef(item, validEvidenceIds),
  };
}

function rehashPacket(
  packet: DossierV2InputPacket,
  motionContext: DossierMotionContext,
  diagnosticNote?: string,
): DossierV2InputPacket {
  const next: DossierV2InputPacket = {
    ...packet,
    motion_context: motionContext,
    diagnostics: {
      ...packet.diagnostics,
      notes: diagnosticNote
        ? [...packet.diagnostics.notes, diagnosticNote]
        : [...packet.diagnostics.notes],
    },
  };

  let context = next.motion_context!;
  while (
    Buffer.byteLength(toCanonicalJson(next), "utf8") > MAX_DOSSIER_PACKET_BYTES
    && context.items.length > 0
  ) {
    context = {
      ...context,
      items: context.items.slice(0, -1),
      omitted_count: context.omitted_count + 1,
    };
    next.motion_context = context;
  }

  if (
    Buffer.byteLength(toCanonicalJson(next), "utf8") > MAX_DOSSIER_PACKET_BYTES
    && diagnosticNote
  ) {
    next.diagnostics = {
      ...next.diagnostics,
      notes: [...packet.diagnostics.notes],
    };
  }

  if (Buffer.byteLength(toCanonicalJson(next), "utf8") > MAX_DOSSIER_PACKET_BYTES) {
    delete next.motion_context;
  }

  const { packet_id: _packetId, ...withoutId } = next;
  const packetId = createHash("sha256")
    .update(toCanonicalJson(withoutId), "utf8")
    .digest("hex");

  return {
    packet_id: packetId,
    ...withoutId,
  };
}

function chronologySafeMarketMotionRows(
  rows: MarketMotionRecord[],
  now: Date,
) {
  return rows.filter((item) => {
    const observedAt = Date.parse(item.observed_at);
    const occurredAt = Date.parse(item.occurred_at);
    return Number.isFinite(observedAt)
      && Number.isFinite(occurredAt)
      && observedAt <= now.getTime()
      && occurredAt <= now.getTime();
  });
}

export function promotedMarketMotionEvidencePins(
  rows: MarketMotionRecord[],
  now = new Date(),
) {
  const selected = selectPromotedMarketMotionForDossier(
    chronologySafeMarketMotionRows(rows, now),
    now,
    MAX_DOSSIER_MOTION_CONTEXT,
  );

  return [...new Set(selected.flatMap((item) => {
    const canonicalEvidenceId = typeof item.metadata?.promotionEvidenceId === "string"
      ? item.metadata.promotionEvidenceId.trim()
      : "";
    return canonicalEvidenceId ? [canonicalEvidenceId] : [];
  }))];
}

export async function loadCurrentMarketMotionEvidencePins(
  client: SupabaseClient,
  asOf: string,
) {
  const asOfMs = Date.parse(asOf);
  const now = Number.isFinite(asOfMs) ? new Date(asOfMs) : new Date();
  const rows = await getCurrentMarketMotion({
    includeExpired: true,
    limit: 60,
    client,
  });
  return promotedMarketMotionEvidencePins(rows, now);
}

export function attachDossierMotionContext(
  packet: DossierV2InputPacket,
  rows: MarketMotionRecord[],
): DossierV2InputPacket {
  const asOfMs = Date.parse(packet.as_of);
  const now = Number.isFinite(asOfMs) ? new Date(asOfMs) : new Date();
  const validEvidenceIds = new Set([
    ...packet.observed_evidence.map((item) => item.evidence_id),
    ...(packet.rate_context?.evidence ?? []).map((item) => item.evidence_id),
  ]);

  const chronologySafeRows = chronologySafeMarketMotionRows(rows, now);
  const eligible = selectPromotedMarketMotionForDossier(
    chronologySafeRows,
    now,
    Math.max(1, chronologySafeRows.length),
  );
  const selected = eligible.slice(0, MAX_DOSSIER_MOTION_CONTEXT);

  return rehashPacket(packet, {
    contract_version: DOSSIER_MOTION_CONTEXT_CONTRACT_VERSION,
    items: selected.map((item) => boundedMotionItem(item, validEvidenceIds)),
    omitted_count: Math.max(0, eligible.length - selected.length),
  });
}

export async function attachCurrentMarketMotionContext(
  packet: DossierV2InputPacket,
  client: SupabaseClient,
): Promise<DossierV2InputPacket> {
  try {
    const rows = await getCurrentMarketMotion({
      includeExpired: true,
      limit: 60,
      client,
    });
    return attachDossierMotionContext(packet, rows);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return rehashPacket(
      packet,
      {
        contract_version: DOSSIER_MOTION_CONTEXT_CONTRACT_VERSION,
        items: [],
        omitted_count: 0,
      },
      `Optional bounded Market Motion context unavailable; Dossier continued evidence-first: ${clip(detail, 240) ?? "unknown error"}`,
    );
  }
}
