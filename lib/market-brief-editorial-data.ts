import "server-only";

import { createSupabaseAdminClient } from "./supabase/admin";
import type { MarketBriefArticlesProjectionResult } from "./market-brief-articles";
import {
  buildEditorialBrief, editorialEvidenceIds,
  type EditorialBrief, type EditorialEvidenceRow,
} from "./market-brief-editorial";

type Source = { source_name?: string | null; source_url?: string | null; source_tier?: number | null };
type Row = {
  id: string;
  claim_text: string | null;
  evidence_class: string | null;
  support_direction: string | null;
  created_at: string | null;
  available_at: string | null;
  provenance_urls: string[] | null;
  source: Source | Source[] | null;
};

function oneSource(row: Row): Source | null {
  return Array.isArray(row.source) ? row.source[0] ?? null : row.source;
}

/** Read-only, bounded, article-owned canonical evidence enrichment. */
export async function loadEditorialMarketBrief(
  projected: MarketBriefArticlesProjectionResult,
): Promise<EditorialBrief> {
  const ids = editorialEvidenceIds(projected);
  if (!ids.length) return buildEditorialBrief(projected, []);
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from("intelligence_evidence")
      .select("id,claim_text,evidence_class,support_direction,created_at,available_at,provenance_urls,source:intelligence_evidence_sources(source_name,source_url,source_tier)")
      .in("id", ids)
      .limit(120);
    if (error) {
      // Do not promote unknown sources to verified editorial output.
      console.error("Blue Desk editorial provenance lookup unavailable");
      return buildEditorialBrief(projected, []);
    }
    const rows = (data || []) as Row[];
    const evidence: EditorialEvidenceRow[] = rows.map(row => {
      const source = oneSource(row);
      return {
        id: row.id,
        claimText: row.claim_text,
        evidenceClass: row.evidence_class,
        supportDirection: row.support_direction,
        createdAt: row.created_at,
        availableAt: row.available_at,
        sourceTier: source?.source_tier ?? null,
        sourceName: source?.source_name ?? null,
        sourceUrl: source?.source_url ?? null,
        provenanceUrls: Array.isArray(row.provenance_urls) ? row.provenance_urls : [],
      };
    });
    return buildEditorialBrief(projected, evidence);
  } catch {
    console.error("Blue Desk editorial provenance lookup unavailable");
    return buildEditorialBrief(projected, []);
  }
}
