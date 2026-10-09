/**
 * Safe, bounded diagnostic for scheduled research that was rejected by the
 * canonical publisher. Never persist free-form publisher errors: they can
 * contain provider URLs, source text or other sensitive upstream material.
 */
const LABELS = [
  "run_identity",
  "source_checks",
  "item_limit",
  "item_key",
  "item_type",
  "item_attribution",
  "item_url",
  "item_date",
  "item_summary",
  "item_score",
  "article_position",
  "video_transcript",
  "item_evidence",
  "recalibration",
  "other_validation",
] as const;

type Label = typeof LABELS[number];

function category(error: unknown): Label {
  if (typeof error !== "string") return "other_validation";
  if (/^items\[\d+\]\.articlePosition\b/.test(error)) return "article_position";
  if (/^items\[\d+\]\.itemKey\b/.test(error)) return "item_key";
  if (/^items\[\d+\]\.itemType\b/.test(error)) return "item_type";
  if (/^items\[\d+\]\.(publisher|title)\b/.test(error)) return "item_attribution";
  if (/^items\[\d+\]\.url\b/.test(error)) return "item_url";
  if (/^items\[\d+\]\.publishedAt\b/.test(error)) return "item_date";
  if (/^items\[\d+\]\.summary\b/.test(error)) return "item_summary";
  if (/^items\[\d+\]\.(sourceQuality|relevance|novelty|materiality|recommendedAction)\b/.test(error)) return "item_score";
  if (/^items\[\d+\]\.(transcriptStatus|transcriptText)\b/.test(error)) return "video_transcript";
  if (/^items\[\d+\]\.evidence\[\d+\]/.test(error)) return "item_evidence";
  if (/^recalibrations\[\d+\]/.test(error)) return "recalibration";
  if (/source check|sourceChecks|^(?:Missing|Unknown|Invalid) source|^alchemy-market-insights/i.test(error)) return "source_checks";
  if (/^A run may contain at most/.test(error)) return "item_limit";
  if (/^(?:runKey|scheduleSlot|scheduledFor)\b/.test(error)) return "run_identity";
  return "other_validation";
}

export function scheduledResearchValidationFailureDetail(payload: unknown): string {
  const errors = payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).errors
    : null;
  if (!Array.isArray(errors)) return "Research run validation failed (reason categories unavailable).";

  const counts = new Map<Label, number>();
  for (const error of errors.slice(0, 250)) {
    const label = category(error);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const summary = LABELS.filter((label) => counts.has(label))
    .map((label) => `${label}=${counts.get(label)}`)
    .join(", ");
  return `Research run validation failed (${Math.min(errors.length, 250)} issue(s)${errors.length > 250 ? "+" : ""}): ${summary || "no_categories"}.`;
}
